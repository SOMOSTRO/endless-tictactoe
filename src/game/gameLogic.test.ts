import { describe, it, expect } from 'vitest';
import {
  applyMove,
  checkWinner,
  cloneState,
  createInitialState,
  getEmptyCells,
  getExpiringIndex,
  getPlayableCells,
  getWinLine,
  rankCells,
  tryPlaceMark,
} from './gameLogic';
import { Board, GameState, MAX_MARKS, Player, WIN_LINES } from './types';

// ─── Test helpers ───────────────────────────────────────────────────────────

function buildBoard(marks: Partial<Record<number, Player>>): Board {
  const board: Board = Array.from({ length: 9 }, () => null);
  for (const [idxStr, player] of Object.entries(marks)) {
    if (!player) continue;
    const idx = Number(idxStr);
    board[idx] = { player, state: 'active' };
  }
  return board;
}

/**
 * Build a GameState from a sequence of moves (X plays first, alternating).
 * Uses applyMove so the queues and expiring states are realistic.
 */
function stateFromMoves(moves: number[]): GameState {
  let s = createInitialState();
  for (const m of moves) {
    s = applyMove(s, m);
    if (s.isGameOver) break;
  }
  return s;
}

/**
 * Pairs of (X-move, O-move) played alternately that deliberately avoid any
 * 3-in-a-row. Use this instead of hardcoded line-producing sequences when
 * you need both players at MAX_MARKS capacity with the game still running.
 *
 * Resulting state:
 *   X queue: [0, 5, 7]  (expiring = 0)
 *   O queue: [2, 3, 8]  (expiring = 2)
 *   Board:  X . O
 *           O . X
 *           . X O
 *   Empties: 1, 4, 6
 */
const SAFE_CAPACITY_PAIRS: readonly [number, number][] = [
  [0, 2],
  [5, 3],
  [7, 8],
] as const;

/** Play SAFE_CAPACITY_PAIRS into a fresh GameState and return it. */
function stateAtSafeFullCapacity(): GameState {
  let s = createInitialState();
  for (const [x, o] of SAFE_CAPACITY_PAIRS) {
    s = applyMove(s, x);
    s = applyMove(s, o);
  }
  return s;
}

// ─── Initialization & cloning ───────────────────────────────────────────────

describe('createInitialState', () => {
  it('produces a fully empty board of size 9', () => {
    const s = createInitialState();
    expect(s.board).toHaveLength(9);
    expect(s.board.every((c) => c === null)).toBe(true);
  });

  it('has empty queues for both players', () => {
    const s = createInitialState();
    expect(s.queues.X).toEqual([]);
    expect(s.queues.O).toEqual([]);
  });

  it('starts with player X and no winner', () => {
    const s = createInitialState();
    expect(s.currentPlayer).toBe('X');
    expect(s.winner).toBeNull();
    expect(s.isGameOver).toBe(false);
  });
});

describe('cloneState', () => {
  it('produces a deep-equal but distinct state', () => {
    const s = stateFromMoves([0, 1, 2]);
    const c = cloneState(s);

    expect(c).not.toBe(s);
    expect(c.board).not.toBe(s.board);
    expect(c.queues).not.toBe(s.queues);
    expect(c).toEqual(s);
  });

  it('mutations to clone do not touch original', () => {
    const s = stateFromMoves([0]);
    const c = cloneState(s);
    c.board[0] = null;
    c.queues.X.pop();

    expect(s.board[0]?.player).toBe('X');
    expect(s.queues.X).toEqual([0]);
  });
});

// ─── Basic move application ────────────────────────────────────────────────

describe('applyMove — basics', () => {
  it('places a mark and alternates player', () => {
    let s = createInitialState();
    s = applyMove(s, 4);
    expect(s.board[4]?.player).toBe('X');
    expect(s.currentPlayer).toBe('O');

    s = applyMove(s, 0);
    expect(s.board[0]?.player).toBe('O');
    expect(s.currentPlayer).toBe('X');
  });

  it('populates the FIFO queues in placement order', () => {
    const s = stateFromMoves([4, 1, 5, 2]);
    expect(s.queues.X).toEqual([4, 5]);
    expect(s.queues.O).toEqual([1, 2]);
  });

  it('rejects a move onto an opponent-occupied cell (same object returned)', () => {
    const s = stateFromMoves([4]); // X at center
    const after = applyMove(s, 4); // O tries to play on center
    expect(after).toBe(s);
  });

  it('rejects a move onto own mark that is NOT the expiring one', () => {
    // X plays: 4, 5, 6  (all 3 marks, none expiring when queue<3 until third)
    // After 3 X moves: 4 is the expiring. Now X tries to play on 5 which is occupied.
    const s = stateFromMoves([4, 0, 5, 1, 6, 2]);
    // It's X's turn again. X's queue = [4,5,6], expiring = 4
    const after = applyMove(s, 5);
    expect(after).toBe(s);
  });

  it('rejects moves once game is over', () => {
    const winMoves = [0, 3, 1, 4, 2]; // X wins top row
    const s = stateFromMoves(winMoves);
    expect(s.isGameOver).toBe(true);
    expect(s.winner).toBe('X');

    const after = applyMove(s, 5);
    expect(after).toBe(s);
  });
});

// ─── FIFO eviction (4th mark rule) ─────────────────────────────────────────

describe('applyMove — FIFO eviction on 4th mark', () => {
  it('evicts the oldest X mark when X places a 4th', () => {
    // Build state without triggering any 3-in-a-row win
    let s = stateAtSafeFullCapacity();
    expect(s.queues.X).toEqual([0, 5, 7]);
    expect(s.queues.O).toEqual([2, 3, 8]);
    expect(s.currentPlayer).toBe('X');
    expect(s.isGameOver).toBe(false);

    // X places 6 — oldest (0) should be evicted
    s = applyMove(s, 6);
    expect(s.board[0]).toBeNull();
    expect(s.board[6]?.player).toBe('X');
    expect(s.queues.X).toEqual([5, 7, 6]);
  });

  it('evicts the oldest O mark when O places a 4th', () => {
    // First get to safe capacity, then X plays 6 (4th X move → evicts X's oldest = 0)
    let s = stateAtSafeFullCapacity();
    s = applyMove(s, 6);
    expect(s.board[0]).toBeNull();
    expect(s.currentPlayer).toBe('O');
    expect(s.isGameOver).toBe(false);

    s = applyMove(s, 1); // O's 4th mark — oldest O was 2
    expect(s.board[2]).toBeNull();
    expect(s.board[1]?.player).toBe('O');
    expect(s.queues.O).toEqual([3, 8, 1]);
  });

  it('marks the NEW queue[0] as expiring visually after eviction', () => {
    let s = stateAtSafeFullCapacity();
    s = applyMove(s, 6); // X's 4th — queue becomes [5, 7, 6]
    expect(s.board[5]?.state).toBe('expiring'); // new queue[0] = 5
    expect(s.board[7]?.state).toBe('active');
    expect(s.board[6]?.state).toBe('active');
  });
});

// ─── Placement rules: expiring/occupied cells are invalid ──────────────────

describe('applyMove — placing on own expiring cell is invalid', () => {
  it('rejects X attempting to place on their own oldest/expiring mark as 4th placement', () => {
    const s = stateAtSafeFullCapacity();
    // X queue = [0, 5, 7] → expiring = 0
    expect(getExpiringIndex(s.queues, 'X')).toBe(0);
    expect(s.isGameOver).toBe(false);

    // X tries to play 0 (their own expiring mark). Invalid.
    const s2 = applyMove(s, 0);
    expect(s2).toBe(s);
  });

  it('does NOT allow a player to overwrite an opponent cell, even if opponents mark is expiring for them', () => {
    const s = stateAtSafeFullCapacity();
    // O's expiring = 2
    expect(getExpiringIndex(s.queues, 'O')).toBe(2);
    expect(s.isGameOver).toBe(false);

    // X's turn; tries cell 2 (opponent O's expiring mark)
    // INVALID because X's eviction step 1 only evicts X's marks, not O's.
    const s2 = applyMove(s, 2);
    expect(s2).toBe(s);
  });
});

// ─── Shared tryPlaceMark helper ─────────────────────────────────────────────

describe('tryPlaceMark — shared placement helper', () => {
  it('returns ok=true with evictedIdx=null when queue not at capacity', () => {
    const board = buildBoard({ 4: 'X' });
    const queue: number[] = [4];
    const r = tryPlaceMark(board, queue, 'X', 0);
    expect(r.ok).toBe(true);
    expect(r.evictedIdx).toBeNull();
    expect(r.board[0]?.player).toBe('X');
    expect(r.updatedQueue).toEqual([4, 0]);
  });

  it('returns ok=true with correct evictedIdx at capacity', () => {
    const board = buildBoard({ 0: 'X', 1: 'X', 2: 'X', 3: 'O' });
    const queue = [0, 1, 2];
    const r = tryPlaceMark(board, queue, 'X', 5);
    expect(r.ok).toBe(true);
    expect(r.evictedIdx).toBe(0);
    expect(r.board[0]).toBeNull();
    expect(r.board[5]?.player).toBe('X');
    expect(r.updatedQueue).toEqual([1, 2, 5]);
  });

  it('rejects placing onto own expiring cell at capacity', () => {
    const board = buildBoard({ 0: 'X', 1: 'X', 2: 'X' });
    const queue = [0, 1, 2];
    const r = tryPlaceMark(board, queue, 'X', 0);
    expect(r.ok).toBe(false);
    expect(r.evictedIdx).toBeNull();
    expect(r.updatedQueue).toEqual([0, 1, 2]);
    expect(r.board).toBe(board);
  });

  it('returns ok=false without mutating inputs when cell is still occupied post-eviction', () => {
    // Opponent cell
    const board = buildBoard({ 0: 'X', 1: 'X', 2: 'X', 3: 'O' });
    const queue: readonly number[] = [0, 1, 2];
    const r = tryPlaceMark(board, queue, 'X', 3); // cell 3 has O, post-eviction still O
    expect(r.ok).toBe(false);
    // Input board and queue unchanged
    expect(board[3]?.player).toBe('O');
    expect(queue).toEqual([0, 1, 2]);
  });
});

// ─── Win detection ─────────────────────────────────────────────────────────

describe('checkWinner / getWinLine — all 8 winning lines', () => {
  it.each(WIN_LINES)(
    'detects X win on line [%i,%i,%i]',
    (a, b, c) => {
      const board = buildBoard({ [a]: 'X', [b]: 'X', [c]: 'X' });
      expect(checkWinner(board)).toBe('X');
      const line = getWinLine(board);
      expect(line).toBeTruthy();
      expect(line).toContain(a);
      expect(line).toContain(b);
      expect(line).toContain(c);
    }
  );

  it.each(WIN_LINES)(
    'detects O win on line [%i,%i,%i]',
    (a, b, c) => {
      const board = buildBoard({ [a]: 'O', [b]: 'O', [c]: 'O' });
      expect(checkWinner(board)).toBe('O');
      const line = getWinLine(board);
      expect(line).toBeTruthy();
      expect(line).toContain(a);
      expect(line).toContain(b);
      expect(line).toContain(c);
    }
  );

  it('returns null when no winner (empty board / mixed line / partial line)', () => {
    expect(checkWinner(buildBoard({}))).toBeNull();
    expect(checkWinner(buildBoard({ 0: 'X', 1: 'X', 2: 'O' }))).toBeNull();
    expect(checkWinner(buildBoard({ 0: 'X', 1: 'X' }))).toBeNull();
    expect(getWinLine(buildBoard({ 0: 'X', 1: 'X' }))).toBeNull();
  });
});

describe('applyMove — terminal state after win', () => {
  it('sets isGameOver and winner, clears expiring visual states', () => {
    // X wins the top row in a realistic game
    const s = stateFromMoves([0, 3, 1, 4, 2]);
    expect(s.isGameOver).toBe(true);
    expect(s.winner).toBe('X');
    // No player alternation after a win
    expect(s.currentPlayer).toBe('X');
    // No mark should be marked "expiring" once game ends
    for (const c of s.board) {
      if (c) expect(c.state).toBe('active');
    }
  });

  it('does not switch player after a winning move', () => {
    // If the next-to-play would be O but X just won, keep player at X
    const s = stateFromMoves([0, 3, 1, 4, 2]);
    expect(s.currentPlayer).toBe('X');
  });
});

// ─── getEmptyCells / getPlayableCells / getExpiringIndex ───────────────────

describe('cell-index utility helpers', () => {
  it('getEmptyCells returns only truly-null cells', () => {
    const board = buildBoard({ 0: 'X', 5: 'O' });
    const empties = getEmptyCells(board);
    expect(empties).toEqual([1, 2, 3, 4, 6, 7, 8]);
  });

  it('getExpiringIndex returns null below MAX_MARKS', () => {
    const s = stateFromMoves([0, 1]);
    expect(getExpiringIndex(s.queues, 'X')).toBeNull();
    expect(getExpiringIndex(s.queues, 'O')).toBeNull();
  });

  it('getExpiringIndex returns queue[0] at capacity', () => {
    const s = stateAtSafeFullCapacity();
    expect(s.isGameOver).toBe(false);
    expect(getExpiringIndex(s.queues, 'X')).toBe(0);
    expect(getExpiringIndex(s.queues, 'O')).toBe(2);
  });

  it('getPlayableCells returns only empty cells (expiring cells are not playable)', () => {
    const s = stateAtSafeFullCapacity();
    expect(s.isGameOver).toBe(false);
    // Board layout:
    //   0:X  1:_  2:O
    //   3:O  4:_  5:X
    //   6:_  7:X  8:O
    // X queue: [0, 5, 7] → expiring = 0
    // O queue: [2, 3, 8] → expiring = 2
    // Empty cells: 1, 4, 6

    // Playable for X: empties (1,4,6)
    const xPlayable = new Set(getPlayableCells(s.board, s.queues, 'X'));
    expect(xPlayable).toEqual(new Set([1, 4, 6]));
    expect(xPlayable).not.toContain(2);
    expect(xPlayable).not.toContain(3);
    expect(xPlayable).not.toContain(5);
    expect(xPlayable).not.toContain(7);
    expect(xPlayable).not.toContain(8);
    expect(xPlayable).not.toContain(0);

    // Playable for O: empties (1,4,6)
    const oPlayable = new Set(getPlayableCells(s.board, s.queues, 'O'));
    expect(oPlayable).toEqual(new Set([1, 4, 6]));
    expect(oPlayable).not.toContain(0);
    expect(oPlayable).not.toContain(3);
    expect(oPlayable).not.toContain(5);
    expect(oPlayable).not.toContain(7);
    expect(oPlayable).not.toContain(8);
    expect(oPlayable).not.toContain(2);
  });

  it('rankCells orders playable cells by position preference (center > corners > edges)', () => {
    const s = createInitialState();
    const ranked = rankCells(s.board, s.queues, 'X');
    expect(ranked[0]).toBe(4); // center
    // corners follow center
    expect([0, 2, 6, 8]).toContain(ranked[1]);
    expect([0, 2, 6, 8]).toContain(ranked[2]);
    // edges last
    expect([1, 3, 5, 7]).toContain(ranked[6]);
  });
});

// ─── Atomic move identity: rejected moves return same reference ────────────

describe('applyMove — returns identity (===) for rejected moves', () => {
  it('returns original state when target cell is occupied mid-game', () => {
    const s = stateFromMoves([4, 0]);
    const s2 = applyMove(s, 4); // X tries occupied center (held by X actually at this point?)
    // state after [4, 0]: X at 4, O at 0, it's X's turn
    // X tries 4 — X's own occupied non-expiring. Reject.
    expect(s2).toBe(s);
  });
});

// ─── Ensure MAX_MARKS constant === 3 ────────────────────────────────────────

describe('game invariants / constants', () => {
  it('MAX_MARKS is 3 per spec', () => {
    expect(MAX_MARKS).toBe(3);
  });
});
