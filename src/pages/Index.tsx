import { useState, useEffect } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from '@/hooks/useTheme';
import { LoginArea } from '@/components/auth/LoginArea';
import { ChallengeDialog } from '@/components/chess/ChallengeDialog';
import { ChallengeList } from '@/components/chess/ChallengeList';
import { MyGamesList, RecentGamesList } from '@/components/chess/GameList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords, Moon, Sun, Crown, Shield, Zap } from 'lucide-react';

const Index = () => {
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  useSeoMeta({
    title: 'Nostr Chess - Play Chess Over Nostr',
    description: 'A decentralized chess client built on Nostr. Challenge friends, play games, and have every move cryptographically signed.',
  });

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Crown className="h-8 w-8 text-amber-500" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Nostr Chess</h1>
              <p className="text-xs text-muted-foreground">Decentralized • Signed • Sovereign</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Clock Display */}
            <div className="hidden sm:flex flex-col items-end text-sm">
              <span className="font-mono font-medium tabular-nums">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            
            <LoginArea className="max-w-48" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="mb-12">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-background to-emerald-500/10">
            <CardContent className="p-8 sm:p-12">
              <div className="max-w-2xl mx-auto text-center space-y-6">
                <div className="flex justify-center gap-2 mb-4">
                  <span className="text-6xl">♔</span>
                  <span className="text-6xl">♚</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  Chess on Nostr
                </h2>
                <p className="text-lg text-muted-foreground">
                  Every move cryptographically signed. Challenge any Nostr user.
                  Your games, your keys, your sovereignty.
                </p>
                
                {user ? (
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/20"
                    onClick={() => setChallengeDialogOpen(true)}
                  >
                    <Swords className="h-5 w-5 mr-2" />
                    Challenge a Player
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Log in with your Nostr identity to start playing
                    </p>
                    <LoginArea className="justify-center" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Features */}
        <section className="grid sm:grid-cols-3 gap-4 mb-12">
          <Card className="bg-card/50">
            <CardContent className="pt-6 text-center space-y-2">
              <Shield className="h-8 w-8 mx-auto text-emerald-500" />
              <h3 className="font-semibold">Cryptographically Signed</h3>
              <p className="text-sm text-muted-foreground">
                Every move is signed with your Nostr key. No cheating, no disputes.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="pt-6 text-center space-y-2">
              <Zap className="h-8 w-8 mx-auto text-amber-500" />
              <h3 className="font-semibold">NIP-64 Standard</h3>
              <p className="text-sm text-muted-foreground">
                Games stored in PGN format following the Nostr chess standard.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="pt-6 text-center space-y-2">
              <Swords className="h-8 w-8 mx-auto text-blue-500" />
              <h3 className="font-semibold">Challenge Anyone</h3>
              <p className="text-sm text-muted-foreground">
                Send challenges to any Nostr user. Play friends or strangers.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Challenges & My Games */}
          <div className="space-y-6">
            {user && <ChallengeList />}
            <MyGamesList />
          </div>

          {/* Right Column - Recent Games */}
          <div className="space-y-6">
            <RecentGamesList />
            
            {/* About / Footer Card */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">About Nostr Chess</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Nostr Chess is a fully client-side chess application that uses the Nostr protocol
                  for game state synchronization. All moves are published as NIP-64 events.
                </p>
                <p>
                  <a
                    href="https://shakespeare.diy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Vibed with Shakespeare
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Challenge Dialog */}
      <ChallengeDialog
        open={challengeDialogOpen}
        onOpenChange={setChallengeDialogOpen}
      />
    </div>
  );
};

export default Index;
