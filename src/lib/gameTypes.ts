import { type TimeControl, type GameResult } from './chess';

export type { GameResult };

// Game challenge event structure
export interface GameChallenge {
  id: string;
  challenger: string; // pubkey
  challenged: string; // pubkey
  timeControl: TimeControl;
  challengerColor: 'w' | 'b' | 'random';
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

// Active game state
export interface ChessGame {
  id: string; // The event ID of the accepted challenge or initial game event
  white: string; // pubkey
  black: string; // pubkey
  pgn: string;
  timeControl: TimeControl;
  whiteTime: number;
  blackTime: number;
  result: GameResult;
  lastMoveAt: number;
  moveEvents: GameMoveEvent[];
}

// Move event
export interface GameMoveEvent {
  id: string;
  gameId: string;
  player: string;
  pgn: string;
  createdAt: number;
}

// NIP-64 kind
export const CHESS_GAME_KIND = 64;

// Custom kinds for game management (we'll use kind 30064 for challenges - addressable)
export const CHESS_CHALLENGE_KIND = 30064;

// Generate a unique game identifier
export function generateGameId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Parse time control from PGN TimeControl header
export function parseTimeControlHeader(tc: string): TimeControl | null {
  if (!tc || tc === '?' || tc === '-') return null;
  
  // Try parsing "300+5" format first
  let match = tc.match(/^(\d+)\+(\d+)$/);
  if (match) {
    return {
      initial: parseInt(match[1]),
      increment: parseInt(match[2]),
    };
  }
  
  // Try parsing just seconds "300"
  match = tc.match(/^(\d+)$/);
  if (match) {
    return {
      initial: parseInt(match[1]),
      increment: 0,
    };
  }
  
  return null;
}

// Format time control for PGN header
export function formatTimeControlHeader(tc: TimeControl): string {
  if (tc.initial === 0) return '-';
  if (tc.increment > 0) {
    return `${tc.initial}+${tc.increment}`;
  }
  return `${tc.initial}`;
}
