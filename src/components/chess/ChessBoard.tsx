import { useState, useMemo, useCallback } from 'react';
import { Chess, type Square, type Color, SQUARES, getFlippedSquares, isLightSquare, PIECE_UNICODE } from '@/lib/chess';
import { cn } from '@/lib/utils';

interface ChessBoardProps {
  chess: Chess;
  orientation?: Color;
  onMove?: (from: Square, to: Square, promotion?: string) => boolean;
  disabled?: boolean;
  lastMove?: { from: Square; to: Square } | null;
  highlightSquares?: Square[];
}

export function ChessBoard({
  chess,
  orientation = 'w',
  onMove,
  disabled = false,
  lastMove,
  highlightSquares = [],
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square } | null>(null);

  const squares = useMemo(() => {
    return orientation === 'w' ? SQUARES : getFlippedSquares();
  }, [orientation]);

  const board = useMemo(() => chess.board(), [chess]);

  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return chess.moves({ square: selectedSquare, verbose: true }).map(m => m.to);
  }, [chess, selectedSquare]);

  const isInCheck = chess.isCheck();
  const turn = chess.turn();

  const getKingSquare = useCallback((): Square | null => {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === 'k' && piece.color === turn) {
          return piece.square;
        }
      }
    }
    return null;
  }, [board, turn]);

  const kingSquare = isInCheck ? getKingSquare() : null;

  const handleSquareClick = useCallback((square: Square) => {
    if (disabled) return;

    const piece = chess.get(square);

    // If we have a selected square
    if (selectedSquare) {
      // If clicking the same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      // If the move is legal
      if (legalMoves.includes(square)) {
        // Check for pawn promotion
        const selectedPiece = chess.get(selectedSquare);
        if (
          selectedPiece?.type === 'p' &&
          ((selectedPiece.color === 'w' && square[1] === '8') ||
           (selectedPiece.color === 'b' && square[1] === '1'))
        ) {
          setPromotionMove({ from: selectedSquare, to: square });
          return;
        }

        // Make the move
        if (onMove?.(selectedSquare, square)) {
          setSelectedSquare(null);
        }
        return;
      }

      // If clicking on own piece, select it
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        return;
      }

      // Otherwise deselect
      setSelectedSquare(null);
      return;
    }

    // No square selected - select if it's current player's piece
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
    }
  }, [chess, disabled, legalMoves, onMove, selectedSquare]);

  const handlePromotion = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!promotionMove) return;
    if (onMove?.(promotionMove.from, promotionMove.to, piece)) {
      setSelectedSquare(null);
    }
    setPromotionMove(null);
  }, [onMove, promotionMove]);

  const getPieceAtSquare = useCallback((square: Square) => {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    return board[rank]?.[file] || null;
  }, [board]);

  return (
    <div className="relative select-none">
      {/* Board */}
      <div className="grid grid-cols-8 aspect-square w-full max-w-[560px] rounded-lg overflow-hidden shadow-2xl border-4 border-amber-900/50 dark:border-amber-700/30">
        {squares.map((square) => {
          const piece = getPieceAtSquare(square);
          const isLight = isLightSquare(square);
          const isSelected = selectedSquare === square;
          const isLegalMove = legalMoves.includes(square);
          const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
          const isHighlighted = highlightSquares.includes(square);
          const isKingInCheck = kingSquare === square;

          return (
            <button
              key={square}
              className={cn(
                'aspect-square relative flex items-center justify-center transition-all duration-150',
                isLight
                  ? 'bg-amber-100 dark:bg-amber-200/90'
                  : 'bg-amber-700 dark:bg-amber-800',
                isSelected && 'ring-4 ring-inset ring-emerald-500/70',
                isLastMoveSquare && !isSelected && 'bg-yellow-300/50 dark:bg-yellow-400/30',
                isHighlighted && 'bg-blue-300/50 dark:bg-blue-400/30',
                isKingInCheck && 'bg-red-500/60 dark:bg-red-600/60',
                !disabled && 'hover:brightness-110 cursor-pointer',
                disabled && 'cursor-default'
              )}
              onClick={() => handleSquareClick(square)}
              disabled={disabled}
            >
              {/* Legal move indicator */}
              {isLegalMove && !piece && (
                <div className="absolute w-1/3 h-1/3 rounded-full bg-black/20 dark:bg-black/30" />
              )}
              {isLegalMove && piece && (
                <div className="absolute inset-0 ring-4 ring-inset ring-black/20 dark:ring-black/30 rounded-sm" />
              )}
              
              {/* Piece */}
              {piece && (
                <span
                  className={cn(
                    'text-[min(10vw,4.5rem)] leading-none drop-shadow-md transition-transform',
                    piece.color === 'w' 
                      ? 'text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]' 
                      : 'text-gray-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.3)]',
                    isSelected && 'scale-110'
                  )}
                >
                  {PIECE_UNICODE[piece.color][piece.type]}
                </span>
              )}

              {/* Coordinates */}
              {(orientation === 'w' ? square[1] === '1' : square[1] === '8') && (
                <span className={cn(
                  'absolute bottom-0.5 right-1 text-[10px] font-semibold',
                  isLight ? 'text-amber-800/70' : 'text-amber-100/70'
                )}>
                  {square[0]}
                </span>
              )}
              {(orientation === 'w' ? square[0] === 'a' : square[0] === 'h') && (
                <span className={cn(
                  'absolute top-0.5 left-1 text-[10px] font-semibold',
                  isLight ? 'text-amber-800/70' : 'text-amber-100/70'
                )}>
                  {square[1]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Promotion Dialog */}
      {promotionMove && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg z-10">
          <div className="bg-card rounded-xl p-4 shadow-2xl border">
            <p className="text-center text-sm font-medium mb-3 text-foreground">Promote pawn to:</p>
            <div className="flex gap-2">
              {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                <button
                  key={piece}
                  onClick={() => handlePromotion(piece)}
                  className="w-14 h-14 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-200 hover:bg-amber-200 dark:hover:bg-amber-300 transition-colors"
                >
                  <span className="text-4xl text-gray-900">
                    {PIECE_UNICODE[chess.turn()][piece]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
