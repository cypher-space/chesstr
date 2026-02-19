import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { Chess, type TimeControl, generatePGN, parsePGNHeaders } from '@/lib/chess';
import { CHESS_GAME_KIND, CHESS_CHALLENGE_KIND, type GameResult, formatTimeControlHeader } from '@/lib/gameTypes';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

export interface ActiveGame {
  id: string; // The d-tag / game ID
  eventId: string;
  white: string;
  black: string;
  pgn: string;
  timeControl: TimeControl;
  result: GameResult;
  createdAt: number;
  updatedAt: number;
}

// Parse a game from kind 64 event
function parseGameEvent(event: NostrEvent): ActiveGame | null {
  try {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const whiteTag = event.tags.find(t => t[0] === 'white')?.[1];
    const blackTag = event.tags.find(t => t[0] === 'black')?.[1];
    
    if (!dTag) return null;

    const pgn = event.content;
    const headers = parsePGNHeaders(pgn);
    
    // Parse time control from content or headers
    let timeControl: TimeControl = { initial: 300, increment: 0 };
    if (headers.timecontrol) {
      const match = headers.timecontrol.match(/^(\d+)(?:\+(\d+))?$/);
      if (match) {
        timeControl = {
          initial: parseInt(match[1]),
          increment: match[2] ? parseInt(match[2]) : 0,
        };
      }
    }

    return {
      id: dTag,
      eventId: event.id,
      white: whiteTag || headers.white || '',
      black: blackTag || headers.black || '',
      pgn,
      timeControl,
      result: (headers.result as GameResult) || '*',
      createdAt: event.created_at,
      updatedAt: event.created_at,
    };
  } catch {
    return null;
  }
}

// Hook for publishing a move (kind 64 event)
export function usePublishMove() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameId,
      pgn,
      white,
      black,
      timeControl,
      result = '*',
    }: {
      gameId: string;
      pgn: string;
      white: string;
      black: string;
      timeControl: TimeControl;
      result?: GameResult;
    }) => {
      if (!user) throw new Error('Not logged in');

      const event = await user.signer.signEvent({
        kind: CHESS_GAME_KIND,
        content: pgn,
        tags: [
          ['d', gameId],
          ['white', white],
          ['black', black],
          ['p', white],
          ['p', black],
          ['alt', `Chess game move - ${result === '*' ? 'In progress' : result}`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chess-games'] });
    },
  });
}

// Hook for fetching a specific game
export function useChessGameData(gameId: string | undefined, white?: string, black?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['chess-game', gameId],
    queryFn: async () => {
      if (!gameId) return null;

      // Query for game events and challenge events
      const filters: NostrFilter[] = [
        {
          kinds: [CHESS_GAME_KIND],
          '#d': [gameId],
          limit: 20,
        },
        {
          kinds: [CHESS_CHALLENGE_KIND],
          '#d': [gameId],
          limit: 10,
        },
      ];

      const events = await nostr.query(filters);

      // Find the latest game state
      const gameEvents = events
        .filter(e => e.kind === CHESS_GAME_KIND)
        .sort((a, b) => b.created_at - a.created_at);

      if (gameEvents.length > 0) {
        return parseGameEvent(gameEvents[0]);
      }

      // Check for accepted challenge
      const acceptedChallenge = events.find(
        e => e.kind === CHESS_CHALLENGE_KIND && e.tags.some(t => t[0] === 'status' && t[1] === 'accepted')
      );

      if (acceptedChallenge) {
        try {
          const content = JSON.parse(acceptedChallenge.content);
          const timeControl = content.timeControl || { initial: 300, increment: 0 };
          const originalChallenger = content.originalChallenger;
          
          // Determine who is white and black
          let whitePlayer = white;
          let blackPlayer = black;
          
          if (content.challengerColor === 'w') {
            whitePlayer = originalChallenger || acceptedChallenge.tags.find(t => t[0] === 'p')?.[1];
            blackPlayer = acceptedChallenge.pubkey;
          } else if (content.challengerColor === 'b') {
            blackPlayer = originalChallenger || acceptedChallenge.tags.find(t => t[0] === 'p')?.[1];
            whitePlayer = acceptedChallenge.pubkey;
          } else {
            // Random - use hash to determine
            const hash = (originalChallenger || '') + acceptedChallenge.pubkey;
            const isOdd = hash.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 2 === 1;
            if (isOdd) {
              whitePlayer = originalChallenger || acceptedChallenge.tags.find(t => t[0] === 'p')?.[1];
              blackPlayer = acceptedChallenge.pubkey;
            } else {
              blackPlayer = originalChallenger || acceptedChallenge.tags.find(t => t[0] === 'p')?.[1];
              whitePlayer = acceptedChallenge.pubkey;
            }
          }

          return {
            id: gameId,
            eventId: acceptedChallenge.id,
            white: whitePlayer || '',
            black: blackPlayer || '',
            pgn: '*',
            timeControl,
            result: '*' as GameResult,
            createdAt: acceptedChallenge.created_at,
            updatedAt: acceptedChallenge.created_at,
          };
        } catch {
          return null;
        }
      }

      return null;
    },
    enabled: !!gameId,
    refetchInterval: 3000, // Poll for updates
  });
}

// Hook for subscribing to game updates in real-time
export function useGameSubscription(
  gameId: string | undefined,
  onUpdate: (pgn: string) => void
) {
  const { nostr } = useNostr();
  const lastEventRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const controller = new AbortController();

    const subscribe = async () => {
      try {
        for await (const msg of nostr.req(
          [{ kinds: [CHESS_GAME_KIND], '#d': [gameId] }],
          { signal: controller.signal }
        )) {
          if (msg[0] === 'EVENT') {
            const event = msg[2];
            if (event.id !== lastEventRef.current) {
              lastEventRef.current = event.id;
              onUpdate(event.content);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Subscription error:', err);
        }
      }
    };

    subscribe();

    return () => {
      controller.abort();
    };
  }, [nostr, gameId, onUpdate]);
}

// Hook for fetching user's active games
export function useUserGames(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['chess-games', 'user', pubkey],
    queryFn: async () => {
      if (!pubkey) return [];

      const events = await nostr.query([
        {
          kinds: [CHESS_GAME_KIND],
          '#p': [pubkey],
          limit: 100,
        },
      ]);

      // Group by game ID and get latest
      const gameMap = new Map<string, ActiveGame>();
      
      for (const event of events) {
        const game = parseGameEvent(event);
        if (game) {
          const existing = gameMap.get(game.id);
          if (!existing || event.created_at > existing.updatedAt) {
            gameMap.set(game.id, { ...game, updatedAt: event.created_at });
          }
        }
      }

      return Array.from(gameMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    enabled: !!pubkey,
    refetchInterval: 10000,
  });
}

// Hook for fetching recent public games
export function useRecentGames() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['chess-games', 'recent'],
    queryFn: async () => {
      const events = await nostr.query([
        {
          kinds: [CHESS_GAME_KIND],
          limit: 50,
        },
      ]);

      const gameMap = new Map<string, ActiveGame>();
      
      for (const event of events) {
        const game = parseGameEvent(event);
        if (game) {
          const existing = gameMap.get(game.id);
          if (!existing || event.created_at > existing.updatedAt) {
            gameMap.set(game.id, { ...game, updatedAt: event.created_at });
          }
        }
      }

      return Array.from(gameMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    refetchInterval: 15000,
  });
}
