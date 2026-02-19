import { useUserGames, useRecentGames, type ActiveGame } from '@/hooks/useNostrChessGame';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { genUserName } from '@/lib/genUserName';
import { formatTimeControl, getResultText, type GameResult } from '@/lib/chess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Play, Eye, Crown, Trophy, Minus } from 'lucide-react';

interface GameCardProps {
  game: ActiveGame;
  currentUserPubkey?: string;
}

function PlayerDisplay({ pubkey, isWhite }: { pubkey: string; isWhite: boolean }) {
  const { data: authorData, isLoading } = useAuthor(pubkey);
  const displayName = authorData?.metadata?.name || genUserName(pubkey);
  const profilePicture = authorData?.metadata?.picture;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-sm ${isWhite ? 'bg-white border border-gray-300' : 'bg-gray-900'}`} />
      <Avatar className="h-6 w-6">
        {profilePicture && <AvatarImage src={profilePicture} alt={displayName} />}
        <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {isLoading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-sm font-medium truncate max-w-[100px]">{displayName}</span>
      )}
    </div>
  );
}

function ResultBadge({ result, userColor }: { result: GameResult; userColor?: 'w' | 'b' | null }) {
  if (result === '*') {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        <Play className="h-3 w-3 mr-1" />
        In Progress
      </Badge>
    );
  }

  if (result === '1/2-1/2') {
    return (
      <Badge variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20">
        <Minus className="h-3 w-3 mr-1" />
        Draw
      </Badge>
    );
  }

  const whiteWon = result === '1-0';
  const userWon = userColor && ((userColor === 'w' && whiteWon) || (userColor === 'b' && !whiteWon));

  if (userWon) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        <Trophy className="h-3 w-3 mr-1" />
        Victory
      </Badge>
    );
  }

  if (userColor) {
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        Defeat
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-gray-500/10">
      <Crown className="h-3 w-3 mr-1" />
      {whiteWon ? 'White wins' : 'Black wins'}
    </Badge>
  );
}

function GameCard({ game, currentUserPubkey }: GameCardProps) {
  const userColor = currentUserPubkey === game.white ? 'w' : currentUserPubkey === game.black ? 'b' : null;
  const isMyGame = !!userColor;
  const isMyTurn = game.result === '*' && (
    (userColor === 'w' && !game.pgn.includes('...')) || // Very simplified turn check
    (userColor === 'b' && game.pgn.includes('.'))
  );

  return (
    <Link to={`/game/${game.id}`} className="block">
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <PlayerDisplay pubkey={game.white} isWhite />
            <span className="text-muted-foreground text-sm hidden sm:inline">vs</span>
            <PlayerDisplay pubkey={game.black} isWhite={false} />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <ResultBadge result={game.result} userColor={userColor} />
            <span className="text-xs text-muted-foreground">
              {formatTimeControl(game.timeControl)}
            </span>
            {isMyTurn && game.result === '*' && (
              <Badge className="bg-emerald-500 text-white animate-pulse">
                Your turn!
              </Badge>
            )}
          </div>
        </div>

        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
          {isMyGame && game.result === '*' ? (
            <>
              <Play className="h-4 w-4 mr-1" />
              Play
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              View
            </>
          )}
        </Button>
      </div>
    </Link>
  );
}

export function MyGamesList() {
  const { user } = useCurrentUser();
  const { data: games, isLoading } = useUserGames(user?.pubkey);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Games</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!games || games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Games</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No games yet. Challenge someone to play!
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeGames = games.filter(g => g.result === '*');
  const completedGames = games.filter(g => g.result !== '*');

  return (
    <div className="space-y-4">
      {activeGames.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-500" />
              Active Games
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeGames.map((game) => (
              <GameCard key={game.id} game={game} currentUserPubkey={user.pubkey} />
            ))}
          </CardContent>
        </Card>
      )}

      {completedGames.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Completed Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedGames.slice(0, 5).map((game) => (
              <GameCard key={game.id} game={game} currentUserPubkey={user.pubkey} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function RecentGamesList() {
  const { user } = useCurrentUser();
  const { data: games, isLoading } = useRecentGames();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Games</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!games || games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Games</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No games found on the network yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Games</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {games.slice(0, 10).map((game) => (
          <GameCard key={game.id} game={game} currentUserPubkey={user?.pubkey} />
        ))}
      </CardContent>
    </Card>
  );
}
