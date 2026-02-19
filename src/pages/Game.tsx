import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { ChessClock } from '@/components/chess/ChessClock';
import { useChessGameData, usePublishMove, useGameSubscription } from '@/hooks/useNostrChessGame';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { getResultText, formatTimeControl, type Square, type Color, type TimeControl, type GameResult, parsePGNHeaders, generatePGN } from '@/lib/chess';
import { formatTimeControlHeader } from '@/lib/gameTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { ArrowLeft, Flag, Clock, Loader2, RefreshCw } from 'lucide-react';
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
  
  const { data: gameData, isLoading: loadingGame, refetch } = useChessGameData(gameId);
  const { mutate: publishMove, isPending: isPublishing } = usePublishMove();

  // Chess instance - recreated when gameData changes
  const [chess] = useState(() => new Chess());
  const [, forceUpdate] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [result, setResult] = useState<GameResult>('*');
  const lastLoadedPgnRef = useRef<string>('');

  useSeoMeta({
    title: 'Chess Game | Nostr Chess',
    description: 'Play chess over Nostr - cryptographically signed moves',
  });

  // Load PGN from game data
  useEffect(() => {
    if (!gameData?.pgn) return;
    
    // Only reload if PGN has changed
    if (gameData.pgn === lastLoadedPgnRef.current) return;
    
    try {
      // Handle empty or star-only PGN
      if (gameData.pgn === '*' || gameData.pgn.trim() === '') {
        chess.reset();
        setLastMove(null);
        setResult('*');
      } else {
        chess.loadPgn(gameData.pgn);
        
        // Set last move
        const history = chess.history({ verbose: true });
        if (history.length > 0) {
          const lastMoveData = history[history.length - 1];
          setLastMove({ from: lastMoveData.from, to: lastMoveData.to });
        }
        
        // Check result from PGN headers
        const headers = parsePGNHeaders(gameData.pgn);
        if (headers.result && ['1-0', '0-1', '1/2-1/2'].includes(headers.result)) {
          setResult(headers.result as GameResult);
        } else if (chess.isCheckmate()) {
          setResult(chess.turn() === 'w' ? '0-1' : '1-0');
        } else if (chess.isDraw() || chess.isStalemate()) {
          setResult('1/2-1/2');
        } else {
          setResult('*');
        }
      }
      
      lastLoadedPgnRef.current = gameData.pgn;
      forceUpdate(n => n + 1);
    } catch (err) {
      console.error('Failed to load PGN:', err);
    }
  }, [gameData?.pgn, chess]);

  // Subscribe to game updates
  const handleGameUpdate = useCallback((pgn: string) => {
    if (pgn === lastLoadedPgnRef.current) return;
    
    try {
      if (pgn === '*' || pgn.trim() === '') {
        chess.reset();
        setLastMove(null);
      } else {
        chess.loadPgn(pgn);
        const history = chess.history({ verbose: true });
        if (history.length > 0) {
          const lastMoveData = history[history.length - 1];
          setLastMove({ from: lastMoveData.from, to: lastMoveData.to });
        }
        
        // Check game end
        if (chess.isCheckmate()) {
          setResult(chess.turn() === 'w' ? '0-1' : '1-0');
        } else if (chess.isDraw() || chess.isStalemate()) {
          setResult('1/2-1/2');
        }
      }
      
      lastLoadedPgnRef.current = pgn;
      forceUpdate(n => n + 1);
    } catch {
      console.error('Failed to parse game update');
    }
  }, [chess]);

  useGameSubscription(gameId, handleGameUpdate);

  // Determine player color
  const playerColor = useMemo((): Color | null => {
    if (!user?.pubkey || !gameData) return null;
    if (user.pubkey === gameData.white) return 'w';
    if (user.pubkey === gameData.black) return 'b';
    return null;
  }, [user?.pubkey, gameData]);

  // Board orientation
  const orientation = playerColor === 'b' ? 'b' : 'w';

  // Is it my turn?
  const isMyTurn = playerColor ? chess.turn() === playerColor : false;

  // Current turn
  const turn = chess.turn();

  // Move history
  const moveHistory = useMemo(() => chess.history({ verbose: true }), [chess, forceUpdate]);

  // Is game over?
  const isGameOver = result !== '*';

  // Handle making a move
  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (!isMyTurn || isPublishing || isGameOver) return false;
    
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) return false;
      
      setLastMove({ from, to });
      
      // Check game end
      let newResult: GameResult = '*';
      if (chess.isCheckmate()) {
        newResult = chess.turn() === 'w' ? '0-1' : '1-0';
      } else if (chess.isDraw() || chess.isStalemate()) {
        newResult = '1/2-1/2';
      }
      if (newResult !== '*') {
        setResult(newResult);
      }

      // Generate PGN with proper headers
      const pgn = generatePGN(chess, {
        event: 'Nostr Chess Game',
        site: 'nostr',
        date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
        round: '?',
        white: gameData!.white,
        black: gameData!.black,
        result: newResult,
        timeControl: formatTimeControlHeader(gameData!.timeControl),
      });

      lastLoadedPgnRef.current = pgn;
      forceUpdate(n => n + 1);

      // Publish to Nostr
      publishMove({
        gameId: gameId!,
        pgn,
        white: gameData!.white,
        black: gameData!.black,
        timeControl: gameData!.timeControl,
        result: newResult,
      }, {
        onSuccess: () => {
          if (newResult !== '*') {
            toast({
              title: 'Game Over',
              description: getResultText(newResult),
            });
          }
        },
        onError: (error) => {
          toast({
            title: 'Failed to publish move',
            description: error.message,
            variant: 'destructive',
          });
        },
      });
      
      return true;
    } catch {
      return false;
    }
  }, [chess, isMyTurn, isPublishing, isGameOver, gameData, gameId, publishMove, toast]);

  const handleResign = useCallback(() => {
    if (!playerColor || isGameOver) return;
    
    const newResult: GameResult = playerColor === 'w' ? '0-1' : '1-0';
    setResult(newResult);
    
    const pgn = generatePGN(chess, {
      event: 'Nostr Chess Game',
      site: 'nostr',
      date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      round: '?',
      white: gameData!.white,
      black: gameData!.black,
      result: newResult,
      timeControl: formatTimeControlHeader(gameData!.timeControl),
    });

    publishMove({
      gameId: gameId!,
      pgn,
      white: gameData!.white,
      black: gameData!.black,
      timeControl: gameData!.timeControl,
      result: newResult,
    }, {
      onSuccess: () => {
        toast({
          title: 'You resigned',
          description: getResultText(newResult),
        });
      },
    });
  }, [chess, playerColor, isGameOver, gameData, gameId, publishMove, toast]);

  // Handle timeout - only for timed games
  const handleTimeout = useCallback((color: Color) => {
    if (isGameOver || gameData?.timeControl.initial === 0) return;
    
    const newResult: GameResult = color === 'w' ? '0-1' : '1-0';
    setResult(newResult);
    
    // Only the player whose turn it is can report timeout
    if (playerColor && playerColor !== color) {
      const pgn = generatePGN(chess, {
        event: 'Nostr Chess Game',
        site: 'nostr',
        date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
        round: '?',
        white: gameData!.white,
        black: gameData!.black,
        result: newResult,
        timeControl: formatTimeControlHeader(gameData!.timeControl),
      });

      publishMove({
        gameId: gameId!,
        pgn,
        white: gameData!.white,
        black: gameData!.black,
        timeControl: gameData!.timeControl,
        result: newResult,
      });
    }

    toast({
      title: 'Time out!',
      description: getResultText(newResult),
    });
  }, [chess, isGameOver, playerColor, gameData, gameId, publishMove, toast]);

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

  const canPlay = user && playerColor && !isGameOver;
  const isSpectator = !playerColor;
  const isUnlimited = gameData.timeControl.initial === 0;

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
            {/* Time control badge */}
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatTimeControl(gameData.timeControl)}
            </Badge>
            
            {result !== '*' && (
              <Badge variant="secondary" className="text-sm">
                {getResultText(result)}
              </Badge>
            )}
            {isPublishing && (
              <Badge variant="outline" className="text-sm animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Signing...
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <LoginArea className="max-w-40" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,340px] gap-6 max-w-5xl mx-auto">
          {/* Main game area */}
          <div className="space-y-4">
            {/* Opponent (top) */}
            <PlayerInfo
              pubkey={orientation === 'w' ? gameData.black : gameData.white}
              isWhite={orientation !== 'w'}
              isCurrentTurn={turn !== orientation && !isGameOver}
              isCurrentUser={false}
            />

            {/* Chess Board */}
            <div className="relative">
              <ChessBoard
                chess={chess}
                orientation={orientation}
                onMove={canPlay ? handleMove : undefined}
                disabled={!canPlay || !isMyTurn || isPublishing}
                lastMove={lastMove}
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
              {isGameOver && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <Card className="max-w-xs">
                    <CardContent className="pt-6 text-center space-y-4">
                      <h3 className="text-xl font-bold">{getResultText(result)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {moveHistory.length} moves played
                      </p>
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
              pubkey={orientation === 'w' ? gameData.white : gameData.black}
              isWhite={orientation === 'w'}
              isCurrentTurn={turn === orientation && !isGameOver}
              isCurrentUser={!!playerColor}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Clock - only show for timed games */}
            {!isUnlimited && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Clock</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChessClock
                    timeControl={gameData.timeControl}
                    turn={turn}
                    gameStarted={moveHistory.length > 0}
                    gameOver={isGameOver}
                    onTimeout={handleTimeout}
                  />
                </CardContent>
              </Card>
            )}

            {/* Game Info for unlimited games */}
            {isUnlimited && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Game Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Time Control</span>
                    <span>Unlimited</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Moves</span>
                    <span>{moveHistory.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span>{isGameOver ? getResultText(result) : (isMyTurn ? 'Your turn' : "Opponent's turn")}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Move History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Move History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {moveHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No moves yet - White to play
                    </p>
                  ) : (
                    <div className="space-y-1 font-mono text-sm">
                      {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="w-6 text-muted-foreground">{i + 1}.</span>
                          <span className="w-16">{moveHistory[i * 2]?.san}</span>
                          <span className="w-16">{moveHistory[i * 2 + 1]?.san || ''}</span>
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
