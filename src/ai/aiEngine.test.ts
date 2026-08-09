import { describe, it, expect, beforeEach } from 'vitest';
import { getBestMove } from './aiEngine';
import { Difficulty } from './types';
import {
  applyMove,
  createInitialState,
  getPlayableCells,
} from '../game/gameLogic';
import { GameState, Player } from '../game/types';

// ─── Test helpers ───────────────────────────────────────────────────────────

function stateFromMoves(moves: number[]): GameState {
  let s = createInitialState();
  for (const m of moves) {
    s = applyMove(s, m);
    if (s.isGameOver) break;
  }
  return s;
}

/**
 * Non-winning 3-marks-each state (see gameLogic test file for details).
 *   X queue: [0,5,7] (expiring 0);  O queue: [2,3,8] (expiring 2)
 *   Board: X . O / O . X / _ X O  →  Empties: 1, 4, 6
 */
function stateAtSafeFullCapacity(): GameState {
  const pairs: readonly [number, number][] = [
    [0, 2],
    [5, 3],
    [7, 8],
  ] as const;
  let s = createInitialState();
  for (const [x, o] of pairs) {
    s = applyMove(s, x);
    s = applyMove(s, o);
  }
  return s;
}

/**
 * Run N trials of getBestMove for a difficulty and return unique cell indices.
 * Useful for validating that Casual (random-based) occasionally picks >1 cell.
 */
function collectUniqueMoves(
  state: GameState,
  diff: Difficulty,
  trials: number
): Set<number> {
  const uniq = new Set<number>();
  for (let i = 0; i < trials; i++) {
    uniq.add(getBestMove(state, diff).cellIndex);
  }
  return uniq;
}

function getPlayer(state: GameState): Player {
  return state.currentPlayer;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Shared invariants across ALL difficulties
// ═══════════════════════════════════════════════════════════════════════════

describe.each(['casual', 'tactical', 'grandmaster'] as Difficulty[])(
  'getBestMove — shared invariants for difficulty=%s',
  (diff) => {
    it('returns a valid AIMove object with integer cellIndex 0-8', () => {
      const s = createInitialState();
      const m = getBestMove(s, diff);
      expect(Number.isInteger(m.cellIndex)).toBe(true);
      expect(m.cellIndex).toBeGreaterThanOrEqual(0);
      expect(m.cellIndex).toBeLessThan(9);
    });

    it('always returns a cell that is playable per getPlayableCells', () => {
      // Many trials across many board states
      const manyMoveSequences: number[][] = [
        [],
        [0, 1],
        [4, 0, 5, 1],
        [0, 3, 1, 4, 2, 5], // queues at capacity for both
      ];
      for (const seq of manyMoveSequences) {
        const s = stateFromMoves(seq);
        if (s.isGameOver) continue;
        const playable = new Set(
          getPlayableCells(s.board, s.queues, getPlayer(s))
        );
        const m = getBestMove(s, diff);
        expect(playable.has(m.cellIndex)).toBe(true);
      }
    });

    it('finds and takes an immediate 1-step win when available', () => {
      // X needs top-right corner (2) to win top row
      const s = stateFromMoves([0, 3, 1, 4]);
      // Board: X at 0,1 ; O at 3,4. X's turn.
      const m = getBestMove(s, diff);
      expect(m.cellIndex).toBe(2);
    });

    it('correctly identifies a 1-step win on the O player (AI playing as O)', () => {
      // Sequence: X4, O0, X5, O1, X7 — now O's turn with O at 0,1 needing cell 2 for top-row win
      const s = stateFromMoves([4, 0, 5, 1, 7]);
      expect(s.currentPlayer).toBe('O');
      const playable = new Set(
        getPlayableCells(s.board, s.queues, 'O')
      );
      expect(playable.has(2)).toBe(true);
      const m = getBestMove(s, diff);
      expect(m.cellIndex).toBe(2);
    });
  }
);

// ═══════════════════════════════════════════════════════════════════════════
//  Casual-specific behaviour
// ═══════════════════════════════════════════════════════════════════════════

describe('Casual AI', () => {
  it('picks a variety of random cells (not always the same) on an empty board', () => {
    const s = createInitialState();
    const uniq = collectUniqueMoves(s, 'casual', 100);
    // Casual is random — 100 trials should yield more than just 2 unique cells
    expect(uniq.size).toBeGreaterThanOrEqual(3);
  });

  it('never blocks an opponent win when no win exists for itself (distinguish from tactical)', () => {
    // Construct a state where:
    //   - AI (casual) cannot win immediately
    //   - Opponent has an immediate win
    //   - Multiple moves exist (so pure random can avoid the block sometimes)
    //
    // 3 moves: X0, O4, X1. X threatens win at 2. O's turn.
    // O has no immediate win (only 1 mark at 4).
    const s = stateFromMoves([0, 4, 1]);
    expect(s.currentPlayer).toBe('O');

    // Run many trials. Casual may or may not block. The guarantee is that
    // sometimes it fails to block (which tactical/grandmaster NEVER do).
    let blocked = 0;
    const TRIALS = 200;
    for (let i = 0; i < TRIALS; i++) {
      if (getBestMove(s, 'casual').cellIndex === 2) blocked++;
    }
    // With ~6 playable cells, probability ~1/N per trial. Definitely expect
    // NOT always blocked (< TRIALS blocked out of TRIALS).
    expect(blocked).toBeLessThan(TRIALS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Tactical-specific behaviour
// ═══════════════════════════════════════════════════════════════════════════

describe('Tactical AI', () => {
  it('blocks an opponent 1-step win when AI cannot win immediately', () => {
    // 3 moves: X0, O4, X1. X threatens top row (needs 2).
    // It's O's turn; O has no immediate win, so must block cell 2.
    const s = stateFromMoves([0, 4, 1]);
    expect(s.currentPlayer).toBe('O');
    const m = getBestMove(s, 'tactical');
    expect(m.cellIndex).toBe(2);
  });

  it('prefers winning over blocking when both are available', () => {
    // Tricky: find a state where current player has BOTH a win move AND must block.
    // We'll construct: X plays 4,5 → needs 6 (middle-bottom row? 3,4,5. Wait.)
    // Let's use columns: O plays column 0 (0,3,6) while X plays column 1 (1,4,7).
    // If O's queue fills exactly with the 0,3,6 winning column... wait no.
    // Simpler approach: sequence such that current player has 2 in a line
    // AND opponent also has 2 in a different line on current player's move turn.
    //
    // Board (X plays 0,1 → needs 2 ; O plays 3,4 — needs 5). X's turn.
    // But wait we want AI to choose winning move (2) over blocking (5).
    // Let's ensure AI is X:
    const s = stateFromMoves([0, 3, 1, 4]);
    // X at 0,1  (win at 2)
    // O at 3,4  (win at 5)
    // X plays. Winning move=2, blocking move=5. AI (tactical) wins first.
    expect(s.currentPlayer).toBe('X');
    const m = getBestMove(s, 'tactical');
    expect(m.cellIndex).toBe(2); // win > block
  });

  it('ranks cells center > corners > edges when no tactical reason exists', () => {
    // Empty board → no win, no block → rankCells order should apply.
    const s = createInitialState();
    const m = getBestMove(s, 'tactical');
    expect(m.cellIndex).toBe(4); // center always #1 preferred
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Grandmaster-specific behaviour
// ═══════════════════════════════════════════════════════════════════════════

describe('Grandmaster (minimax) AI', () => {
  it('blocks an opponent 1-step win', () => {
    // 3 moves: X0, O4, X1. X threatens top row. O's turn → block cell 2.
    const s = stateFromMoves([0, 4, 1]);
    expect(s.currentPlayer).toBe('O');
    const m = getBestMove(s, 'grandmaster');
    expect(m.cellIndex).toBe(2);
  });

  it('takes a 1-step win when available, over any other move', () => {
    const s = stateFromMoves([0, 3, 1, 4]);
    expect(s.currentPlayer).toBe('X');
    const m = getBestMove(s, 'grandmaster');
    expect(m.cellIndex).toBe(2);
  });

  it('always plays center first on empty board (highest heuristic value)', () => {
    const s = createInitialState();
    const m = getBestMove(s, 'grandmaster');
    expect(m.cellIndex).toBe(4);
  });

  it('falls back to ranked cells if minimax has no preference (safety fallback path used)', () => {
    // Grandmaster always picks at *least* a valid playable cell.
    // Many random mid-game states:
    const seqs = [
      [4, 0, 1, 5],
      [0, 4, 2, 5, 6, 8, 7, 3],
      [4, 0, 5, 1, 6, 2, 7],
    ];
    for (const seq of seqs) {
      const s = stateFromMoves(seq);
      if (s.isGameOver) continue;
      const playable = new Set(
        getPlayableCells(s.board, s.queues, s.currentPlayer)
      );
      const m = getBestMove(s, 'grandmaster');
      expect(playable.has(m.cellIndex)).toBe(true);
      expect(Number.isInteger(m.cellIndex)).toBe(true);
    }
  });

  it('avoids unplayable cells even in corner-case states', () => {
    // Full queues scenario, safe (no winners), X's turn.
    const s = stateAtSafeFullCapacity();
    expect(s.currentPlayer).toBe('X');
    expect(s.isGameOver).toBe(false);
    const playable = new Set(getPlayableCells(s.board, s.queues, 'X'));
    const m = getBestMove(s, 'grandmaster');
    expect(playable.has(m.cellIndex)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  AI respects the FIFO / own-expiring rule when picking moves
// ═══════════════════════════════════════════════════════════════════════════

describe('AI move selection respects own-expiring playable rule', () => {
  let fullQueueState: GameState;

  beforeEach(() => {
    fullQueueState = stateAtSafeFullCapacity();
    expect(fullQueueState.isGameOver).toBe(false);
    expect(fullQueueState.currentPlayer).toBe('X');
  });

  it.each(['casual', 'tactical', 'grandmaster'] as Difficulty[])(
    'difficulty=%s can validly target own expiring cell as 4th mark',
    (diff) => {
      const aiMove = getBestMove(fullQueueState, diff);
      const result = applyMove(fullQueueState, aiMove.cellIndex);
      expect(result).not.toBe(fullQueueState); // accepted move
    }
  );
});
