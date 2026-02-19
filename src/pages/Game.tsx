import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { ChessClock } from '@/components/chess/ChessClock';
import { useChessGame } from '@/hooks/useChessGame';
import { useChessGameData, usePublishMove, useGameSubscription } from '@/hooks/useNostrChessGame';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { getResultText, type Square, type Color } from '@/lib/chess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { ArrowLeft, Flag, Handshake, RotateCcw, Share2, Loader2 } from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';

function PlayerInfo({ 
  pubkey, 
  isWhite, 
  isCurrentTurn,
  isCurrentUser 
}: { 
  pubkey: string; 
  isWhite: boolean; 
  isCurrentTurn: boolean;
  isCurrentUser: boolean;
}) {
  const { data: authorData, isLoading } = useAuthor(pubkey);
  const displayName = authorData?.metadata?.name || genUserName(pubkey);
  const profilePicture = authorData?.metadata?.picture;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
      isCurrentTurn ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-muted/50'
    }`}>
      <div className={`w-4 h-4 rounded-sm shrink-0 ${
        isWhite ? 'bg-white border border-gray-300 dark:border-gray-600' : 'bg-gray-900 dark:bg-gray-800'
      }`} />
      <Avatar className="h-8 w-8 shrink-0">
        {profilePicture && <AvatarImage src={profilePicture} alt={displayName} />}
        <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {isLoading ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{displayName}</p>
          {isCurrentUser && (
            <p className="text-xs text-muted-foreground">You</p>
          )}
        </div>
      )}
      {isCurrentTurn && (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
          Turn
        </Badge>
      )}
    </div>
  );
}

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  
  const { data: gameData, isLoading: loadingGame } = useChessGameData(gameId);
  const { mutate: publishMove, isPending: isPublishing } = usePublishMove();

  useSeoMeta({
    title: 'Chess Game | Nostr Chess',
    description: 'Play chess over Nostr - cryptographically signed moves',
  });

  // Initialize game state
  const game = useChessGame({
    initialPgn: gameData?.pgn,
    white: gameData?.white,
    black: gameData?.black,
    timeControl: gameData?.timeControl || { initial: 300, increment: 0 },
    currentUserPubkey: user?.pubkey,
    onGameEnd: (result) => {
      toast({
        title: 'Game Over',
        description: getResultText(result),
      });
    },
  });

  // Subscribe to game updates
  const handleGameUpdate = useCallback((pgn: string) => {
    if (pgn !== game.pgn) {
      game.loadPgn(pgn);
    }
  }, [game]);

  useGameSubscription(gameId, handleGameUpdate);

  // Sync with gameData when it changes
  useEffect(() => {
    if (gameData?.pgn && gameData.pgn !== '*' && gameData.pgn !== game.pgn) {
      game.loadPgn(gameData.pgn);
    }
  }, [gameData?.pgn]);

  // Handle making a move
  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (!game.isMyTurn || isPublishing) return false;
    
    // Make the move locally first
    const success = game.makeMove(from, to, promotion);
    
    if (success && gameData && gameId) {
      // Publish the move to Nostr
      // We need to get the updated PGN after the move
      setTimeout(() => {
        publishMove({
          gameId,
          pgn: game.pgn,
          white: gameData.white,
          black: gameData.black,
          timeControl: gameData.timeControl,
          result: game.result,
        }, {
          onError: (error) => {
            toast({
              title: 'Failed to publish move',
              description: error.message,
              variant: 'destructive',
            });
          },
        });
      }, 0);
    }
    
    return success;
  }, [game, gameData, gameId, isPublishing, publishMove, toast]);

  const handleResign = useCallback(() => {
    if (!game.isMyTurn && game.result === '*') {
      // Can resign even if not your turn
    }
    game.resign();
    
    if (gameData && gameId) {
      publishMove({
        gameId,
        pgn: game.pgn,
        white: gameData.white,
        black: gameData.black,
        timeControl: gameData.timeControl,
        result: game.result,
      });
    }
  }, [game, gameData, gameId, publishMove]);

  if (loadingGame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Game not found</p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canPlay = user && game.playerColor && game.result === '*';
  const isSpectator = !game.playerColor;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            {game.result !== '*' && (
              <Badge variant="secondary" className="text-sm">
                {getResultText(game.result)}
              </Badge>
            )}
            {isPublishing && (
              <Badge variant="outline" className="text-sm animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Signing move...
              </Badge>
            )}
          </div>

          <LoginArea className="max-w-40" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,340px] gap-6 max-w-5xl mx-auto">
          {/* Main game area */}
          <div className="space-y-4">
            {/* Opponent (top) */}
            <PlayerInfo
              pubkey={game.orientation === 'w' ? gameData.black : gameData.white}
              isWhite={game.orientation !== 'w'}
              isCurrentTurn={game.turn !== game.orientation}
              isCurrentUser={false}
            />

            {/* Chess Board */}
            <div className="relative">
              <ChessBoard
                chess={game.chess}
                orientation={game.orientation}
                onMove={canPlay ? handleMove : undefined}
                disabled={!canPlay || !game.isMyTurn || isPublishing}
                lastMove={game.lastMove}
              />
              
              {/* Spectator overlay */}
              {isSpectator && (
                <div className="absolute top-2 left-2 right-2">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    Spectating
                  </Badge>
                </div>
              )}

              {/* Game over overlay */}
              {game.isGameOver && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <Card className="max-w-xs">
                    <CardContent className="pt-6 text-center space-y-4">
                      <h3 className="text-xl font-bold">{getResultText(game.result)}</h3>
                      <Button onClick={() => navigate('/')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Home
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Current player (bottom) */}
            <PlayerInfo
              pubkey={game.orientation === 'w' ? gameData.white : gameData.black}
              isWhite={game.orientation === 'w'}
              isCurrentTurn={game.turn === game.orientation}
              isCurrentUser={!!game.playerColor}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Clock */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Clock</CardTitle>
              </CardHeader>
              <CardContent>
                <ChessClock
                  timeControl={gameData.timeControl}
                  turn={game.turn}
                  gameStarted={game.gameStarted}
                  gameOver={game.isGameOver}
                  onTimeout={game.handleTimeout}
                  onTimeUpdate={game.handleTimeUpdate}
                />
              </CardContent>
            </Card>

            {/* Move History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Moves</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {game.moveHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No moves yet
                    </p>
                  ) : (
                    <div className="space-y-1 font-mono text-sm">
                      {Array.from({ length: Math.ceil(game.moveHistory.length / 2) }, (_, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="w-6 text-muted-foreground">{i + 1}.</span>
                          <span className="w-16">{game.moveHistory[i * 2]?.san}</span>
                          <span className="w-16">{game.moveHistory[i * 2 + 1]?.san || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Game Actions */}
            {canPlay && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleResign}
                    disabled={game.isGameOver}
                  >
                    <Flag className="h-4 w-4 mr-2 text-red-500" />
                    Resign
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Not logged in prompt */}
            {!user && (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Log in to play chess or challenge others
                  </p>
                  <LoginArea className="w-full" />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
