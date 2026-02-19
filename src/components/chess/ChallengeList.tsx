import { usePendingChallenges, useOutgoingChallenges, useAcceptChallenge, useDeclineChallenge, type Challenge } from '@/hooks/useChessChallenge';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { formatTimeControl } from '@/lib/chess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { Check, X, Clock, Loader2, Inbox, Send } from 'lucide-react';

interface ChallengeCardProps {
  challenge: Challenge;
  type: 'incoming' | 'outgoing';
}

function ChallengeCard({ challenge, type }: ChallengeCardProps) {
  const otherPubkey = type === 'incoming' ? challenge.challenger : challenge.challenged;
  const { data: authorData, isLoading } = useAuthor(otherPubkey);
  const { mutate: acceptChallenge, isPending: isAccepting } = useAcceptChallenge();
  const { mutate: declineChallenge, isPending: isDeclining } = useDeclineChallenge();
  const { toast } = useToast();
  const navigate = useNavigate();

  const displayName = authorData?.metadata?.name || genUserName(otherPubkey);
  const profilePicture = authorData?.metadata?.picture;

  const handleAccept = () => {
    acceptChallenge(challenge, {
      onSuccess: ({ challenge }) => {
        toast({
          title: 'Challenge accepted!',
          description: 'Starting the game...',
        });
        navigate(`/game/${challenge.id}`);
      },
      onError: (error) => {
        toast({
          title: 'Failed to accept challenge',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  const handleDecline = () => {
    declineChallenge(challenge, {
      onSuccess: () => {
        toast({
          title: 'Challenge declined',
        });
      },
      onError: (error) => {
        toast({
          title: 'Failed to decline challenge',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {profilePicture && <AvatarImage src={profilePicture} alt={displayName} />}
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="space-y-1">
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <p className="font-medium text-sm">{displayName}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTimeControl(challenge.timeControl)}</span>
            {challenge.challengerColor !== 'random' && (
              <Badge variant="outline" className="text-xs py-0">
                {type === 'incoming' 
                  ? (challenge.challengerColor === 'w' ? 'They play White' : 'They play Black')
                  : (challenge.challengerColor === 'w' ? 'You play White' : 'You play Black')
                }
              </Badge>
            )}
          </div>
        </div>
      </div>

      {type === 'incoming' && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecline}
            disabled={isDeclining || isAccepting}
          >
            {isDeclining ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isAccepting || isDeclining}
          >
            {isAccepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Accept
              </>
            )}
          </Button>
        </div>
      )}

      {type === 'outgoing' && (
        <Badge variant="secondary" className="text-xs animate-pulse">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Waiting...
        </Badge>
      )}
    </div>
  );
}

export function ChallengeList() {
  const { data: incomingChallenges, isLoading: loadingIncoming } = usePendingChallenges();
  const { data: outgoingData, isLoading: loadingOutgoing } = useOutgoingChallenges();

  const outgoingChallenges = outgoingData?.pending || [];
  const hasIncoming = incomingChallenges && incomingChallenges.length > 0;
  const hasOutgoing = outgoingChallenges.length > 0;

  if (loadingIncoming || loadingOutgoing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Challenges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasIncoming && !hasOutgoing) {
    return null;
  }

  return (
    <div className="space-y-4">
      {hasIncoming && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4 text-emerald-500" />
              Incoming Challenges
              <Badge variant="secondary" className="ml-auto bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {incomingChallenges.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomingChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} type="incoming" />
            ))}
          </CardContent>
        </Card>
      )}

      {hasOutgoing && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Sent Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outgoingChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} type="outgoing" />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
