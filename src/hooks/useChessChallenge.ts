import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from './useCurrentUser';
import { type TimeControl, formatTimeControl } from '@/lib/chess';
import { CHESS_CHALLENGE_KIND, generateGameId } from '@/lib/gameTypes';
import type { NostrEvent } from '@nostrify/nostrify';

export interface Challenge {
  id: string;
  eventId: string;
  challenger: string;
  challenged: string;
  timeControl: TimeControl;
  challengerColor: 'w' | 'b' | 'random';
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined';
}

// Parse a challenge from a Nostr event
function parseChallenge(event: NostrEvent): Challenge | null {
  try {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const challengedTag = event.tags.find(t => t[0] === 'p')?.[1];
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1] || 'pending';
    
    if (!dTag || !challengedTag) return null;

    const content = JSON.parse(event.content);
    
    return {
      id: dTag,
      eventId: event.id,
      challenger: event.pubkey,
      challenged: challengedTag,
      timeControl: content.timeControl || { initial: 300, increment: 0 },
      challengerColor: content.challengerColor || 'random',
      createdAt: event.created_at,
      status: statusTag as Challenge['status'],
    };
  } catch {
    return null;
  }
}

// Hook for creating a challenge
export function useCreateChallenge() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      challenged,
      timeControl,
      challengerColor = 'random',
    }: {
      challenged: string;
      timeControl: TimeControl;
      challengerColor?: 'w' | 'b' | 'random';
    }) => {
      if (!user) throw new Error('Not logged in');

      const gameId = generateGameId();

      const event = await user.signer.signEvent({
        kind: CHESS_CHALLENGE_KIND,
        content: JSON.stringify({
          timeControl,
          challengerColor,
        }),
        tags: [
          ['d', gameId],
          ['p', challenged],
          ['status', 'pending'],
          ['alt', `Chess challenge: ${formatTimeControl(timeControl)}`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      
      return { event, gameId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chess-challenges'] });
    },
  });
}

// Hook for accepting a challenge
export function useAcceptChallenge() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challenge: Challenge) => {
      if (!user) throw new Error('Not logged in');
      if (user.pubkey !== challenge.challenged) {
        throw new Error('You are not the challenged player');
      }

      // Create updated challenge event with accepted status
      const event = await user.signer.signEvent({
        kind: CHESS_CHALLENGE_KIND,
        content: JSON.stringify({
          timeControl: challenge.timeControl,
          challengerColor: challenge.challengerColor,
          originalChallenger: challenge.challenger,
        }),
        tags: [
          ['d', challenge.id],
          ['p', challenge.challenger],
          ['e', challenge.eventId, '', 'reply'],
          ['status', 'accepted'],
          ['alt', `Chess challenge accepted: ${formatTimeControl(challenge.timeControl)}`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      
      return { event, challenge };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chess-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['chess-games'] });
    },
  });
}

// Hook for declining a challenge
export function useDeclineChallenge() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challenge: Challenge) => {
      if (!user) throw new Error('Not logged in');
      if (user.pubkey !== challenge.challenged) {
        throw new Error('You are not the challenged player');
      }

      const event = await user.signer.signEvent({
        kind: CHESS_CHALLENGE_KIND,
        content: JSON.stringify({
          timeControl: challenge.timeControl,
          challengerColor: challenge.challengerColor,
        }),
        tags: [
          ['d', `${challenge.id}-declined`],
          ['p', challenge.challenger],
          ['e', challenge.eventId, '', 'reply'],
          ['status', 'declined'],
          ['alt', 'Chess challenge declined'],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      
      return { event };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chess-challenges'] });
    },
  });
}

// Hook for fetching challenges for the current user
export function usePendingChallenges() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['chess-challenges', 'pending', user?.pubkey],
    queryFn: async () => {
      if (!user) return [];

      // Get challenges where current user is the challenged party
      const events = await nostr.query([
        {
          kinds: [CHESS_CHALLENGE_KIND],
          '#p': [user.pubkey],
          '#status': ['pending'],
          limit: 50,
        },
      ]);

      const challenges: Challenge[] = [];
      const seenIds = new Set<string>();

      for (const event of events) {
        const challenge = parseChallenge(event);
        if (challenge && challenge.status === 'pending' && !seenIds.has(challenge.id)) {
          // Don't show self-challenges or already processed ones
          if (challenge.challenger !== user.pubkey) {
            seenIds.add(challenge.id);
            challenges.push(challenge);
          }
        }
      }

      return challenges.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}

// Hook for fetching outgoing challenges and watching for acceptance
export function useOutgoingChallenges() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['chess-challenges', 'outgoing', user?.pubkey],
    queryFn: async () => {
      if (!user) return { pending: [] as Challenge[], accepted: [] as { gameId: string; acceptedAt: number }[] };

      // Query for both pending and accepted challenges
      const events = await nostr.query([
        {
          kinds: [CHESS_CHALLENGE_KIND],
          authors: [user.pubkey],
          '#status': ['pending'],
          limit: 50,
        },
        {
          kinds: [CHESS_CHALLENGE_KIND],
          '#p': [user.pubkey],
          '#status': ['accepted'],
          limit: 50,
        },
      ]);

      const pending: Challenge[] = [];
      const accepted: { gameId: string; acceptedAt: number }[] = [];
      const seenIds = new Set<string>();

      for (const event of events) {
        const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        
        if (!dTag) continue;

        if (statusTag === 'accepted') {
          // This is an acceptance event from the challenged player
          accepted.push({ gameId: dTag, acceptedAt: event.created_at });
        } else if (statusTag === 'pending' && event.pubkey === user.pubkey) {
          const challenge = parseChallenge(event);
          if (challenge && !seenIds.has(challenge.id)) {
            seenIds.add(challenge.id);
            pending.push(challenge);
          }
        }
      }

      return {
        pending: pending.sort((a, b) => b.createdAt - a.createdAt),
        accepted: accepted.sort((a, b) => b.acceptedAt - a.acceptedAt),
      };
    },
    enabled: !!user,
    refetchInterval: 3000, // Check more frequently for acceptances
  });
}

// Hook to watch for challenge acceptance and auto-navigate to game
export function useWatchChallengeAcceptance() {
  const { data } = useOutgoingChallenges();
  const navigate = useNavigate();

  useEffect(() => {
    if (data?.accepted && data.accepted.length > 0) {
      // Navigate to the most recently accepted game
      const mostRecent = data.accepted[0];
      navigate(`/game/${mostRecent.gameId}`);
    }
  }, [data?.accepted, navigate]);
}
