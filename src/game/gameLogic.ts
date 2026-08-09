import {
  Board,
  CellIndex,
  CellMark,
  GameState,
  MAX_MARKS,
  Player,
  PlayerQueue,
  WIN_LINES,
} from './types';
import { PREFERRED_CELL_ORDER } from '../constants';

// ─── Factory ───────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    board: Array.from({ length: 9 }, () => null),
    queues: { X: [], O: [] },
    currentPlayer: 'X',
    winner: null,
    isGameOver: false,
  };
}

// ─── State helpers ─────────────────────────────────────────────────────────

/** Deep-clone game state (cheap — no class instances) */
export function cloneState(state: GameState): GameState {
  return {
    board: state.board.map((c) =>
      c ? { player: c.player, state: c.state } : null
    ),
    queues: {
      X: [...state.queues.X],
      O: [...state.queues.O],
    },
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    isGameOver: state.isGameOver,
  };
}

/**
 * Returns the index that will be EVICTED for a player when they place their
 * next mark (i.e. their oldest mark / front of queue), or null if < MAX_MARKS.
 */
export function getExpiringIndex(
  queues: PlayerQueue,
  player: Player
): CellIndex | null {
  const q = queues[player];
  if (q.length < MAX_MARKS) return null;
  return q[0];
}

// ─── Shared Placement Logic (used by applyMove AND AI simulation) ────────────

/**
 * Result of a placement attempt.
 *   ok = true:  placement was valid — board reflects the new state,
 *               queueUpdatedQueue is the new queue for the player
 *   ok = false: placement was invalid (cell occupied, game over, etc.)
 */
export interface PlacementResult {
  readonly ok: boolean;
  readonly board: Board;
  readonly updatedQueue: CellIndex[];
  readonly evictedIdx: CellIndex | null;
}

/**
 * Performs the atomic FIFO eviction + placement steps (applyMove steps 1-3).
 *
 * This is the single source of truth for placement mechanics:
 *   1. Evict oldest mark first if queue at capacity
 *   2. Validate target cell is now empty (post-eviction)
 *   3. Place new mark
 *
 * Does NOT: refresh expiring visual states, check wins, or switch players.
 *
 * @param board The current board (will NOT be mutated)
 * @param queue The current player's placement queue (will NOT be mutated)
 * @param player The player placing the mark
 * @param cellIndex Target cell
 */
export function tryPlaceMark(
  board: Board,
  queue: readonly CellIndex[],
  player: Player,
  cellIndex: CellIndex
): PlacementResult {
  const newBoard: Board = [...board];
  const newQueue: CellIndex[] = [...queue];
  const oldestIdx: CellIndex | null =
    newQueue.length >= MAX_MARKS ? newQueue[0] : null;
  let evictedIdx: CellIndex | null = null;

  if (oldestIdx !== null && cellIndex === oldestIdx) {
    return {
      ok: false,
      board,
      updatedQueue: [...queue],
      evictedIdx: null,
    };
  }

  // Step 1: Atomically evict the oldest mark BEFORE any cell check
  if (newQueue.length >= MAX_MARKS) {
    evictedIdx = newQueue.shift()!;
    newBoard[evictedIdx] = null;
  }

  // Step 2: Validate target cell (now reflects post-eviction board)
  if (newBoard[cellIndex] !== null) {
    // Rejected — return original data untouched
    return {
      ok: false,
      board,
      updatedQueue: [...queue],
      evictedIdx: null,
    };
  }

  // Step 3: Place new mark
  newBoard[cellIndex] = { player, state: 'active' };
  newQueue.push(cellIndex);

  return {
    ok: true,
    board: newBoard,
    updatedQueue: newQueue,
    evictedIdx,
  };
}

// ─── Core move application ──────────────────────────────────────────────────

/**
 * Applies a placement move and returns the new state atomically.
 *
 * Order of operations (CRITICAL — must not be changed):
 *   1. Evict oldest mark first (via tryPlaceMark shared helper)
 *   2. Validate target cell is now empty (post-eviction)
 *   3. Place new mark
 *   4. Refresh expiring visual states
 *   5. Check win
 *
 * Eviction happens before placement, but the just-evicted cell is not a valid
 * target for that same placement.
 */
export function applyMove(
  state: GameState,
  cellIndex: CellIndex
): GameState {
  if (state.isGameOver) return state;

  const currentPlayer = state.currentPlayer;
  const queue = state.queues[currentPlayer];

  // Steps 1-3 via shared helper — tryPlaceMark handles its own immutability
  const placement = tryPlaceMark(state.board, queue, currentPlayer, cellIndex);
  if (!placement.ok) return state; // rejected — return original state

  // Build next state from the placement result
  const next: GameState = {
    board: placement.board,
    queues: {
      X: currentPlayer === 'X' ? placement.updatedQueue : [...state.queues.X],
      O: currentPlayer === 'O' ? placement.updatedQueue : [...state.queues.O],
    },
    currentPlayer,
    winner: null,
    isGameOver: false,
  };

  // Step 4: Refresh expiring visual states
  refreshExpiringStates(next.board, next.queues);

  // Step 5: Check win
  const winner = checkWinner(next.board);
  if (winner) {
    next.winner = winner;
    next.isGameOver = true;
    clearExpiringStates(next.board);
  } else {
    next.currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  }

  return next;
}

// ─── Win detection ──────────────────────────────────────────────────────────

export function checkWinner(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES) {
    const ca = board[a];
    const cb = board[b];
    const cc = board[c];
    if (ca && cb && cc && ca.player === cb.player && cb.player === cc.player) {
      return ca.player;
    }
  }
  return null;
}

/** Returns the winning line indices if a winner exists */
export function getWinLine(board: Board): [number, number, number] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const ca = board[a];
    const cb = board[b];
    const cc = board[c];
    if (ca && cb && cc && ca.player === cb.player && cb.player === cc.player) {
      return line;
    }
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Updates the `state` field on marks to reflect which one is expiring */
function refreshExpiringStates(board: Board, queues: PlayerQueue): void {
  (['X', 'O'] as Player[]).forEach((p) => {
    const q = queues[p];
    q.forEach((idx, i) => {
      const mark = board[idx] as CellMark;
      mark.state =
        q.length >= MAX_MARKS && i === 0 ? 'expiring' : 'active';
    });
  });
}

/** Terminal boards are static; no mark should continue warning or pulsing. */
function clearExpiringStates(board: Board): void {
  board.forEach((mark) => {
    if (mark) mark.state = 'active';
  });
}

/** Returns all strictly empty cell indices */
export function getEmptyCells(board: Board): CellIndex[] {
  return board.reduce<CellIndex[]>((acc, cell, i) => {
    if (cell === null) acc.push(i);
    return acc;
  }, []);
}

/**
 * Returns cells that are valid targets for `player` on their next turn.
 *
 * A cell is valid only if it is currently empty.
 */
export function getPlayableCells(
  board: Board,
  _queues: PlayerQueue,
  _player: Player
): CellIndex[] {
  return board.reduce<CellIndex[]>((acc, cell, i) => {
    if (cell === null) {
      acc.push(i);
    }
    return acc;
  }, []);
}

/** Rank playable cells by strategic value (center > corners > edges) */
export function rankCells(
  board: Board,
  queues: PlayerQueue,
  player: Player
): CellIndex[] {
  const playable = new Set(getPlayableCells(board, queues, player));
  return PREFERRED_CELL_ORDER.filter((i) => playable.has(i));
}
