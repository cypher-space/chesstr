import { useEffect, useRef, useState, useCallback } from 'react';
import { type Color, type TimeControl, formatTime } from '@/lib/chess';
import { cn } from '@/lib/utils';

interface ChessClockProps {
  timeControl: TimeControl;
  turn: Color;
  gameStarted: boolean;
  gameOver: boolean;
  onTimeout?: (color: Color) => void;
  whiteTime?: number;
  blackTime?: number;
  onTimeUpdate?: (white: number, black: number) => void;
}

export function ChessClock({
  timeControl,
  turn,
  gameStarted,
  gameOver,
  onTimeout,
  whiteTime: externalWhiteTime,
  blackTime: externalBlackTime,
  onTimeUpdate,
}: ChessClockProps) {
  const [whiteTime, setWhiteTime] = useState(externalWhiteTime ?? timeControl.initial);
  const [blackTime, setBlackTime] = useState(externalBlackTime ?? timeControl.initial);
  const lastTickRef = useRef<number>(Date.now());
  const animationRef = useRef<number | null>(null);

  // Reset times when time control changes
  useEffect(() => {
    if (!gameStarted) {
      setWhiteTime(timeControl.initial);
      setBlackTime(timeControl.initial);
    }
  }, [timeControl, gameStarted]);

  // Sync with external time if provided
  useEffect(() => {
    if (externalWhiteTime !== undefined) {
      setWhiteTime(externalWhiteTime);
    }
    if (externalBlackTime !== undefined) {
      setBlackTime(externalBlackTime);
    }
  }, [externalWhiteTime, externalBlackTime]);

  const tick = useCallback(() => {
    if (!gameStarted || gameOver || timeControl.initial === 0) return;

    const now = Date.now();
    const delta = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;

    if (turn === 'w') {
      setWhiteTime((prev) => {
        const newTime = Math.max(0, prev - delta);
        if (newTime === 0 && prev > 0) {
          onTimeout?.('w');
        }
        return newTime;
      });
    } else {
      setBlackTime((prev) => {
        const newTime = Math.max(0, prev - delta);
        if (newTime === 0 && prev > 0) {
          onTimeout?.('b');
        }
        return newTime;
      });
    }

    animationRef.current = requestAnimationFrame(tick);
  }, [gameStarted, gameOver, turn, onTimeout, timeControl.initial]);

  useEffect(() => {
    if (gameStarted && !gameOver && timeControl.initial > 0) {
      lastTickRef.current = Date.now();
      animationRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [tick, gameStarted, gameOver, timeControl.initial]);

  // Report time updates
  useEffect(() => {
    onTimeUpdate?.(whiteTime, blackTime);
  }, [whiteTime, blackTime, onTimeUpdate]);

  // Add increment when turn changes (after a move)
  const prevTurnRef = useRef(turn);
  useEffect(() => {
    if (gameStarted && prevTurnRef.current !== turn && timeControl.increment > 0) {
      // The player who just moved gets the increment
      if (prevTurnRef.current === 'w') {
        setWhiteTime(prev => prev + timeControl.increment);
      } else {
        setBlackTime(prev => prev + timeControl.increment);
      }
    }
    prevTurnRef.current = turn;
  }, [turn, gameStarted, timeControl.increment]);

  if (timeControl.initial === 0) {
    return (
      <div className="flex justify-between gap-4">
        <ClockDisplay
          label="White"
          time={null}
          isActive={gameStarted && !gameOver && turn === 'w'}
          isWhite
        />
        <ClockDisplay
          label="Black"
          time={null}
          isActive={gameStarted && !gameOver && turn === 'b'}
          isWhite={false}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4">
      <ClockDisplay
        label="White"
        time={whiteTime}
        isActive={gameStarted && !gameOver && turn === 'w'}
        isLow={whiteTime < 30}
        isWhite
      />
      <ClockDisplay
        label="Black"
        time={blackTime}
        isActive={gameStarted && !gameOver && turn === 'b'}
        isLow={blackTime < 30}
        isWhite={false}
      />
    </div>
  );
}

interface ClockDisplayProps {
  label: string;
  time: number | null;
  isActive: boolean;
  isLow?: boolean;
  isWhite: boolean;
}

function ClockDisplay({ label, time, isActive, isLow, isWhite }: ClockDisplayProps) {
  return (
    <div
      className={cn(
        'flex-1 rounded-xl p-4 transition-all duration-300',
        isWhite 
          ? 'bg-white dark:bg-gray-100 text-gray-900' 
          : 'bg-gray-900 dark:bg-gray-950 text-white',
        isActive && 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20',
        isLow && isActive && 'ring-red-500 shadow-red-500/30 animate-pulse'
      )}
    >
      <div className={cn(
        'text-xs uppercase tracking-wider mb-1 font-medium',
        isWhite ? 'text-gray-500' : 'text-gray-400'
      )}>
        {label}
      </div>
      <div className={cn(
        'text-3xl sm:text-4xl font-mono font-bold tabular-nums tracking-tight',
        isLow && time !== null && 'text-red-500'
      )}>
        {time !== null ? formatTime(time) : '--:--'}
      </div>
    </div>
  );
}
