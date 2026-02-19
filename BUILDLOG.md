# Nostr Chess Build Log

This document chronicles the development of a fully client-side Nostr chess application.

## Project Overview

**Goal:** Build a decentralized chess client that uses the Nostr protocol for game state synchronization, where every move is cryptographically signed.

**Key Requirements:**
- Fully client-side (no backend)
- NIP-64 compliant (Chess PGN format)
- Dark/light theme support
- Chess clock with configurable time controls
- Challenge system for playing against other Nostr users
- Moves only official once signed

---

## Phase 1: Research & Planning

### NIP-64 Analysis

Read the NIP-64 specification which defines:
- **Kind 64** for chess games in PGN format
- Content field contains the PGN string
- Supports full PGN specification including headers and move notation
- Clients should display content as a chessboard
- Clients should validate moves comply with chess rules

**Key insight:** NIP-64 stores the entire game state as PGN in the `content` field, not individual moves. This means each move publishes the full game history.

### Project Structure Exploration

Examined the MKStack template which provides:
- React 18.x with TypeScript
- TailwindCSS 3.x with shadcn/ui components
- Nostrify for Nostr protocol integration
- TanStack Query for data fetching
- React Router for navigation
- Existing auth components (LoginArea, LoginDialog)
- Hooks: useNostr, useCurrentUser, useAuthor, useNostrPublish

---

## Phase 2: Core Implementation

### Dependencies Added

```bash
npm add chess.js
```

chess.js provides:
- PGN parsing and generation
- Move validation
- Game state management
- Check/checkmate/stalemate detection

### Files Created

#### `/src/lib/chess.ts`
Chess utilities including:
- Re-exports from chess.js (Chess, Square, Color, PieceSymbol)
- `PIECE_UNICODE` - Unicode chess piece characters for rendering
- `SQUARES` - Board squares array (a8 to h1)
- `getFlippedSquares()` - For black's perspective
- `isLightSquare()` - Determines square color
- `parsePGNHeaders()` - Extract headers from PGN
- `generatePGN()` - Create PGN with Seven Tag Roster
- `TimeControl` interface and formatting functions
- `TIME_CONTROLS` - Preset time controls (1min to unlimited)
- `GameResult` type and display helpers

#### `/src/lib/gameTypes.ts`
Game-specific types:
- `GameChallenge` interface
- `ChessGame` interface
- `GameMoveEvent` interface
- `CHESS_GAME_KIND = 64` (NIP-64)
- `CHESS_CHALLENGE_KIND = 30064` (custom addressable kind for challenges)
- `generateGameId()` - Creates unique game identifiers

#### `/src/components/chess/ChessBoard.tsx`
Interactive chess board component:
- 8x8 grid with proper square coloring
- Piece rendering with Unicode characters
- Click-to-select and click-to-move interaction
- Legal move highlighting (dots for empty squares, rings for captures)
- Last move highlighting
- Check highlighting (red king square)
- Pawn promotion dialog
- Board orientation support (flip for black)
- Coordinate labels (files and ranks)

#### `/src/components/chess/ChessClock.tsx`
Dual chess clock component:
- Countdown timers for both players
- Increment support (e.g., 5+3 = 5 min + 3 sec per move)
- Active player highlighting
- Low time warning (< 30 seconds)
- Timeout callback
- Support for unlimited time (shows "--:--")

#### `/src/components/chess/ChallengeDialog.tsx`
Modal for creating challenges:
- npub or hex pubkey input
- Time control selector
- Color preference (White/Black/Random)
- Validation and error handling

#### `/src/components/chess/ChallengeList.tsx`
Displays pending challenges:
- Incoming challenges with Accept/Decline buttons
- Outgoing challenges with waiting indicator
- Player avatars and names from kind 0 profiles
- Time control and color preference display

#### `/src/components/chess/GameList.tsx`
Game listing components:
- `MyGamesList` - User's active and completed games
- `RecentGamesList` - Public games from the network
- Game cards with player info, result badges, turn indicators
- Links to game pages

### Hooks Created

#### `/src/hooks/useChessChallenge.ts`
Challenge management:
- `useCreateChallenge()` - Publish kind 30064 challenge event
- `useAcceptChallenge()` - Accept and start game
- `useDeclineChallenge()` - Decline challenge
- `usePendingChallenges()` - Query incoming challenges
- `useOutgoingChallenges()` - Query sent challenges + watch for acceptance
- `useWatchChallengeAcceptance()` - Auto-navigate when challenge accepted

#### `/src/hooks/useNostrChessGame.ts`
Game state management:
- `usePublishMove()` - Publish kind 64 event with updated PGN
- `useChessGameData()` - Fetch game state from Nostr
- `useGameSubscription()` - Real-time updates via subscription
- `useUserGames()` - Fetch user's games
- `useRecentGames()` - Fetch recent public games

#### `/src/hooks/useChessGame.ts`
Local game state hook (partially used):
- Chess instance management
- Move making and validation
- Game end detection
- PGN generation

### Pages Created/Modified

#### `/src/pages/Index.tsx`
Main lobby page:
- Hero section with chess pieces and tagline
- "Challenge a Player" button
- Feature cards (Signed, NIP-64, Challenge Anyone)
- Challenge list (incoming/outgoing)
- My games list
- Recent games list
- Dark/light theme toggle
- Live clock display
- About section with Shakespeare attribution

#### `/src/pages/Game.tsx`
Game play page:
- Chess board with proper orientation
- Player info cards (top = opponent, bottom = you)
- Chess clock (for timed games) or Game Info (for unlimited)
- Move history panel
- Resign button
- Spectator mode for non-participants
- Game over overlay
- Real-time sync via Nostr subscription
- Refresh button to manually reload state

### Styling

#### `/src/index.css`
Chess-themed color palette:
- Amber/wood tones for light mode
- Dark brown/gold accents for dark mode
- Custom scrollbar styling
- Smooth theme transitions

---

## Phase 3: Refinements

### Issue: Game didn't auto-start on challenge acceptance

**Solution:** Added `useWatchChallengeAcceptance()` hook that:
1. Polls for accepted challenges every 3 seconds
2. When an acceptance is found, navigates to `/game/{gameId}`

### Issue: Games were session-based, not persistent

**Problem:** Closing the browser lost game state.

**Solution:** Refactored to treat games as persistent history:
1. On game page load, query for latest kind 64 event with matching d-tag
2. Parse PGN to reconstruct full game state
3. Re-derive move history, last move, and result from PGN
4. Subscribe for real-time updates

### Issue: Unlimited time games showed broken clock

**Solution:** 
- Check if `timeControl.initial === 0`
- Show "Game Info" card instead of clock
- Display move count and turn status

---

## Architecture Decisions

### Why Kind 64 for Game State (not individual moves)?

NIP-64 specifies storing the complete PGN, not individual moves. Benefits:
- Full game history in one event
- Standard PGN format for interoperability
- Easier to validate complete game state
- Works with existing chess software

### Why Kind 30064 for Challenges?

Used addressable event (30000-39999 range) because:
- d-tag allows updating challenge status
- Can query by game ID
- Replaceable per pubkey+kind+d-tag

### Why Polling Instead of Pure Subscriptions?

Combined approach:
- Subscriptions for real-time move updates during active games
- Polling for challenge acceptance (more reliable across relay reconnects)
- Polling for game lists (less critical latency)

---

## Event Schemas

### Challenge Event (Kind 30064)

```json
{
  "kind": 30064,
  "content": "{\"timeControl\":{\"initial\":300,\"increment\":0},\"challengerColor\":\"random\"}",
  "tags": [
    ["d", "<game-id>"],
    ["p", "<challenged-pubkey>"],
    ["status", "pending|accepted|declined"],
    ["alt", "Chess challenge: 5 min"]
  ]
}
```

### Game Event (Kind 64)

```json
{
  "kind": 64,
  "content": "[Event \"Nostr Chess Game\"]\n[Site \"nostr\"]\n[Date \"2026.02.19\"]\n...\n\n1. e4 e5 2. Nf3 *",
  "tags": [
    ["d", "<game-id>"],
    ["white", "<white-pubkey>"],
    ["black", "<black-pubkey>"],
    ["p", "<white-pubkey>"],
    ["p", "<black-pubkey>"],
    ["alt", "Chess game move - In progress"]
  ]
}
```

---

## Testing Notes

### Manual Test Cases

1. **Create Challenge**
   - Log in with Nostr
   - Click "Challenge a Player"
   - Enter opponent's npub
   - Select time control and color
   - Verify challenge appears in "Sent Challenges"

2. **Accept Challenge**
   - Log in as challenged user
   - See challenge in "Incoming Challenges"
   - Click Accept
   - Verify redirect to game page

3. **Play Game**
   - Make moves by clicking pieces
   - Verify legal move highlighting
   - Verify move published after signing
   - Verify opponent sees move in real-time

4. **Rejoin Game**
   - Close browser during active game
   - Reopen and navigate to game
   - Verify game state restored from PGN

5. **Unlimited Time**
   - Create game with "Unlimited" time control
   - Verify no clock shown
   - Verify game info card displays correctly

---

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added chess.js dependency |
| `src/AppRouter.tsx` | Added /game/:gameId route |
| `src/index.css` | Chess-themed color palette |
| `src/pages/Index.tsx` | Complete rewrite as chess lobby |
| `src/pages/Game.tsx` | New game play page |

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/chess.ts` | Chess utilities and types |
| `src/lib/gameTypes.ts` | Game-specific types and constants |
| `src/components/chess/ChessBoard.tsx` | Interactive board |
| `src/components/chess/ChessClock.tsx` | Dual timer |
| `src/components/chess/ChallengeDialog.tsx` | Challenge creation |
| `src/components/chess/ChallengeList.tsx` | Challenge display |
| `src/components/chess/GameList.tsx` | Game listings |
| `src/hooks/useChessChallenge.ts` | Challenge hooks |
| `src/hooks/useNostrChessGame.ts` | Game state hooks |
| `src/hooks/useChessGame.ts` | Local game logic |

---

## Commits

1. **feat: Nostr Chess client with NIP-64 support** (1c45b61)
   - Initial implementation with all core features

2. **fix: Improve game state as persistent history** (de75efc)
   - Auto-navigate on challenge acceptance
   - Persistent game state from PGN
   - Better unlimited time handling

---

## Future Improvements

Potential enhancements not yet implemented:

- [ ] Draw offers (currently simplified)
- [ ] Takebacks/undo requests
- [ ] Game analysis mode
- [ ] Opening book display
- [ ] Sound effects for moves
- [ ] Mobile touch drag-and-drop
- [ ] Tournament/ladder support
- [ ] Rating system
- [ ] Game export (PGN download)
- [ ] Rematch button
- [ ] Chat during game
- [ ] Premoves
- [ ] Clock sound warnings
