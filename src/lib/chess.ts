import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';

export type { Square, PieceSymbol, Color };
export { Chess };

// Chess piece Unicode characters
export const PIECE_UNICODE: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    k: '♔',
    q: '♕',
    r: '♖',
    b: '♗',
    n: '♘',
    p: '♙',
  },
  b: {
    k: '♚',
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞',
    p: '♟',
  },
};

// Board squares in order (a8 to h1)
export const SQUARES: Square[] = [
  'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
  'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
  'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
  'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
  'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
  'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
  'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
  'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1',
];

// Get flipped squares (for playing as black)
export function getFlippedSquares(): Square[] {
  return [...SQUARES].reverse();
}

// Check if square is light or dark
export function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
  const rank = parseInt(square[1]) - 1;
  return (file + rank) % 2 === 1;
}

// Parse PGN headers
export interface PGNHeaders {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  result?: string;
  whiteElo?: string;
  blackElo?: string;
  timeControl?: string;
  [key: string]: string | undefined;
}

export function parsePGNHeaders(pgn: string): PGNHeaders {
  const headers: PGNHeaders = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  
  while ((match = headerRegex.exec(pgn)) !== null) {
    const key = match[1].toLowerCase();
    headers[key] = match[2];
  }
  
  return headers;
}

// Generate PGN with headers
export function generatePGN(chess: Chess, headers: PGNHeaders): string {
  const headerLines: string[] = [];
  
  // Standard Seven Tag Roster in order
  const standardTags = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
  
  for (const tag of standardTags) {
    const key = tag.toLowerCase();
    const value = headers[key] || (tag === 'Result' ? '*' : '?');
    headerLines.push(`[${tag} "${value}"]`);
  }
  
  // Add other headers
  for (const [key, value] of Object.entries(headers)) {
    if (!standardTags.map(t => t.toLowerCase()).includes(key) && value) {
      const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
      headerLines.push(`[${capitalizedKey} "${value}"]`);
    }
  }
  
  const moves = chess.pgn({ maxWidth: 80, newline: '\n' });
  
  return headerLines.join('\n') + '\n\n' + moves;
}

// Time control formats
export interface TimeControl {
  initial: number; // Initial time in seconds
  increment: number; // Increment in seconds
}

export function parseTimeControl(tc: string): TimeControl | null {
  // Format: "300+5" or "600" or "180+2"
  const match = tc.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return null;
  
  return {
    initial: parseInt(match[1]),
    increment: match[2] ? parseInt(match[2]) : 0,
  };
}

export function formatTimeControl(tc: TimeControl): string {
  if (tc.initial === 0) return 'Unlimited';
  const mins = Math.floor(tc.initial / 60);
  if (tc.increment > 0) {
    return `${mins}+${tc.increment}`;
  }
  return `${mins} min`;
}

// Format time for display (mm:ss)
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Common time controls
export const TIME_CONTROLS: { label: string; value: TimeControl }[] = [
  { label: '1 min', value: { initial: 60, increment: 0 } },
  { label: '1+1', value: { initial: 60, increment: 1 } },
  { label: '3 min', value: { initial: 180, increment: 0 } },
  { label: '3+2', value: { initial: 180, increment: 2 } },
  { label: '5 min', value: { initial: 300, increment: 0 } },
  { label: '5+3', value: { initial: 300, increment: 3 } },
  { label: '10 min', value: { initial: 600, increment: 0 } },
  { label: '10+5', value: { initial: 600, increment: 5 } },
  { label: '15+10', value: { initial: 900, increment: 10 } },
  { label: '30 min', value: { initial: 1800, increment: 0 } },
  { label: 'Unlimited', value: { initial: 0, increment: 0 } },
];

// Game result types
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export function getResultText(result: GameResult): string {
  switch (result) {
    case '1-0': return 'White wins';
    case '0-1': return 'Black wins';
    case '1/2-1/2': return 'Draw';
    case '*': return 'In progress';
    default: return 'Unknown';
  }
}
