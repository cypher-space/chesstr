import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Chess, type Square, type Color, type TimeControl, generatePGN, parsePGNHeaders } from '@/lib/chess';
import { type ChessGame, type GameResult, formatTimeControlHeader } from '@/lib/gameTypes';

interface UseChessGameOptions {
  initialPgn?: string;
  white?: string;
  black?: string;
  timeControl?: TimeControl;
  currentUserPubkey?: string;
  onGameEnd?: (result: GameResult) => void;
}

export function useChessGame(options: UseChessGameOptions = {}) {
  const {
    initialPgn,
    white,
    black,
    timeControl = { initial: 300, increment: 0 },
    currentUserPubkey,
    onGameEnd,
  } = options;

  const [chess] = useState(() => {
    const c = new Chess();
    if (initialPgn) {
      try {
        c.loadPgn(initialPgn);
      } catch {
        // Invalid PGN, start fresh
      }
    }
    return c;
  });

  const [, setMoveCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(!!initialPgn);
  const [result, setResult] = useState<GameResult>('*');
  const [whiteTime, setWhiteTime] = useState(timeControl.initial);
  const [blackTime, setBlackTime] = useState(timeControl.initial);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  const gameEndedRef = useRef(false);

  // Determine if current user is white or black
  const playerColor = useMemo((): Color | null => {
    if (!currentUserPubkey) return null;
    if (currentUserPubkey === white) return 'w';
    if (currentUserPubkey === black) return 'b';
    return null;
  }, [currentUserPubkey, white, black]);

  // Check if it's the current user's turn
  const isMyTurn = useMemo(() => {
    if (!playerColor) return false;
    return chess.turn() === playerColor;
  }, [chess, playerColor]);

  // Get the board orientation for the current user
  const orientation = useMemo((): Color => {
    return playerColor === 'b' ? 'b' : 'w';
  }, [playerColor]);

  // Check game end conditions
  const checkGameEnd = useCallback(() => {
    if (gameEndedRef.current) return;

    let newResult: GameResult = '*';

    if (chess.isCheckmate()) {
      newResult = chess.turn() === 'w' ? '0-1' : '1-0';
    } else if (chess.isDraw()) {
      newResult = '1/2-1/2';
    } else if (chess.isStalemate()) {
      newResult = '1/2-1/2';
    }

    if (newResult !== '*') {
      gameEndedRef.current = true;
      setResult(newResult);
      onGameEnd?.(newResult);
    }
  }, [chess, onGameEnd]);

  // Make a move
  const makeMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        setLastMove({ from, to });
        setMoveCount(c => c + 1);
        if (!gameStarted) {
          setGameStarted(true);
        }
        checkGameEnd();
        return true;
      }
    } catch {
      // Invalid move
    }
    return false;
  }, [chess, gameStarted, checkGameEnd]);

  // Handle timeout
  const handleTimeout = useCallback((color: Color) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    const newResult: GameResult = color === 'w' ? '0-1' : '1-0';
    setResult(newResult);
    onGameEnd?.(newResult);
  }, [onGameEnd]);

  // Handle time updates
  const handleTimeUpdate = useCallback((wt: number, bt: number) => {
    setWhiteTime(wt);
    setBlackTime(bt);
  }, []);

  // Resign
  const resign = useCallback(() => {
    if (gameEndedRef.current || !playerColor) return;
    gameEndedRef.current = true;
    const newResult: GameResult = playerColor === 'w' ? '0-1' : '1-0';
    setResult(newResult);
    onGameEnd?.(newResult);
  }, [playerColor, onGameEnd]);

  // Offer draw (simplified - just ends as draw)
  const offerDraw = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setResult('1/2-1/2');
    onGameEnd?.('1/2-1/2');
  }, [onGameEnd]);

  // Load a new PGN (for syncing from Nostr)
  const loadPgn = useCallback((pgn: string) => {
    try {
      chess.loadPgn(pgn);
      setMoveCount(c => c + 1);
      
      const history = chess.history({ verbose: true });
      if (history.length > 0) {
        const lastMoveData = history[history.length - 1];
        setLastMove({ from: lastMoveData.from, to: lastMoveData.to });
        setGameStarted(true);
      }

      // Check headers for result
      const headers = parsePGNHeaders(pgn);
      if (headers.result && headers.result !== '*') {
        setResult(headers.result as GameResult);
        gameEndedRef.current = true;
      }

      checkGameEnd();
    } catch {
      console.error('Failed to load PGN');
    }
  }, [chess, checkGameEnd]);

  // Generate current PGN
  const pgn = useMemo(() => {
    return generatePGN(chess, {
      event: 'Nostr Chess Game',
      site: 'nostr',
      date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      round: '?',
      white: white || '?',
      black: black || '?',
      result: result,
      timeControl: formatTimeControlHeader(timeControl),
    });
  }, [chess, white, black, result, timeControl]);

  // Get FEN
  const fen = useMemo(() => chess.fen(), [chess]);

  // Get turn
  const turn = chess.turn();

  // Get move history
  const moveHistory = useMemo(() => chess.history({ verbose: true }), [chess]);

  // Is game over?
  const isGameOver = result !== '*';

  // Reset game
  const reset = useCallback(() => {
    chess.reset();
    setMoveCount(0);
    setGameStarted(false);
    setResult('*');
    setLastMove(null);
    setWhiteTime(timeControl.initial);
    setBlackTime(timeControl.initial);
    gameEndedRef.current = false;
  }, [chess, timeControl.initial]);

  return {
    chess,
    pgn,
    fen,
    turn,
    moveHistory,
    lastMove,
    result,
    isGameOver,
    gameStarted,
    playerColor,
    isMyTurn,
    orientation,
    whiteTime,
    blackTime,
    makeMove,
    handleTimeout,
    handleTimeUpdate,
    resign,
    offerDraw,
    loadPgn,
    reset,
  };
}
