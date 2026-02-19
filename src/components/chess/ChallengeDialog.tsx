import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIME_CONTROLS, type TimeControl } from '@/lib/chess';
import { useCreateChallenge } from '@/hooks/useChessChallenge';
import { useToast } from '@/hooks/useToast';
import { Loader2, Swords } from 'lucide-react';

interface ChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPubkey?: string;
}

export function ChallengeDialog({ open, onOpenChange, initialPubkey }: ChallengeDialogProps) {
  const [opponentInput, setOpponentInput] = useState(initialPubkey || '');
  const [timeControlIndex, setTimeControlIndex] = useState('4'); // Default to 5 min
  const [colorChoice, setColorChoice] = useState<'random' | 'w' | 'b'>('random');
  
  const { mutate: createChallenge, isPending } = useCreateChallenge();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let pubkey = opponentInput.trim();
    
    // Try to decode npub
    if (pubkey.startsWith('npub')) {
      try {
        const decoded = nip19.decode(pubkey);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        }
      } catch {
        toast({
          title: 'Invalid npub',
          description: 'Please enter a valid npub or hex pubkey',
          variant: 'destructive',
        });
        return;
      }
    }

    // Validate hex pubkey
    if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
      toast({
        title: 'Invalid pubkey',
        description: 'Please enter a valid npub or 64-character hex pubkey',
        variant: 'destructive',
      });
      return;
    }

    const timeControl = TIME_CONTROLS[parseInt(timeControlIndex)].value;

    createChallenge(
      {
        challenged: pubkey,
        timeControl,
        challengerColor: colorChoice,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Challenge sent!',
            description: 'Waiting for opponent to accept...',
          });
          onOpenChange(false);
          setOpponentInput('');
        },
        onError: (error) => {
          toast({
            title: 'Failed to send challenge',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Challenge a Player
          </DialogTitle>
          <DialogDescription>
            Send a chess challenge to another Nostr user. The game begins once they accept.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opponent">Opponent (npub or hex pubkey)</Label>
            <Input
              id="opponent"
              placeholder="npub1... or hex pubkey"
              value={opponentInput}
              onChange={(e) => setOpponentInput(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-control">Time Control</Label>
            <Select value={timeControlIndex} onValueChange={setTimeControlIndex}>
              <SelectTrigger id="time-control">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_CONTROLS.map((tc, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {tc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Your Color</Label>
            <Select value={colorChoice} onValueChange={(v) => setColorChoice(v as typeof colorChoice)}>
              <SelectTrigger id="color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="w">White</SelectItem>
                <SelectItem value="b">Black</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !opponentInput.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Challenge'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
