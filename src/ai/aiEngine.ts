import {
  applyMove,
  checkWinner,
  getExpiringIndex,
  getPlayableCells,
  rankCells,
  tryPlaceMark,
} from '../game/gameLogic';
import {
  Board,
  CellIndex,
  GameState,
  Player,
  PlayerQueue,
  WIN_LINES,
} from '../game/types';
import { AIMove, Difficulty } from './types';
import {
  AI_THINKING_DELAY,
  CENTER,
  CORNERS,
  HEURISTIC,
  MINIMAX_DEPTH,
} from '../constants';

export { AI_THINKING_DELAY };

// ─── Public entry point ─────────────────────────────────────────────────────

export function getBestMove(
  state: GameState,
  difficulty: Difficulty
): AIMove {
  switch (difficulty) {
    case 'casual':
      return casualMove(state);
    case 'tactical':
      return tacticalMove(state);
    case 'grandmaster':
      return grandmasterMove(state);
  }
}

// ─── Casual (random + instant 1-step win check) ─────────────────────────────

function casualMove(state: GameState): AIMove {
  const ai = state.currentPlayer;

  const winMove = findImmediateWin(state.board, state.queues, ai);
  if (winMove !== null) return { cellIndex: winMove };

  const playable = getPlayableCells(state.board, state.queues, ai);
  const cellIndex = playable[Math.floor(Math.random() * playable.length)];
  return { cellIndex };
}

// ─── Tactical (blocks + queue-expiry awareness) ─────────────────────────────

function tacticalMove(state: GameState): AIMove {
  const ai = state.currentPlayer;
  const human: Player = ai === 'X' ? 'O' : 'X';

  const winMove = findImmediateWin(state.board, state.queues, ai);
  if (winMove !== null) return { cellIndex: winMove };

  const blockMove = findImmediateWin(state.board, state.queues, human);
  if (blockMove !== null) return { cellIndex: blockMove };

  const ranked = rankCells(state.board, state.queues, ai);
  return { cellIndex: ranked[0] };
}

// ─── Grandmaster (Minimax with alpha-beta pruning) ──────────────────────────

function grandmasterMove(state: GameState): AIMove {
  const ai = state.currentPlayer;
  let bestScore = -Infinity;
  let bestCell = -1;

  const playable = getPlayableCells(state.board, state.queues, ai);

  for (const cell of playable) {
    const next = applyMove(state, cell);
    if (next === state) continue;

    const score = minimax(next, MINIMAX_DEPTH - 1, false, ai, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  if (bestCell === -1) {
    const fallback = rankCells(state.board, state.queues, ai);
    bestCell = fallback[0] ?? playable[0];
  }

  return { cellIndex: bestCell };
}

function minimax(
  state: GameState,
  depth: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  alpha: number,
  beta: number
): number {
  if (state.isGameOver) {
    const base = (depth + 1) * HEURISTIC.WIN_BASE_MULTIPLIER;
    return state.winner === aiPlayer ? base : -base;
  }
  if (depth === 0) {
    return evaluate(state.board, state.queues, aiPlayer);
  }

  const currentP = state.currentPlayer;
  const playable = getPlayableCells(state.board, state.queues, currentP);

  if (playable.length === 0) {
    return evaluate(state.board, state.queues, aiPlayer);
  }

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const cell of playable) {
      const next = applyMove(state, cell);
      if (next === state) continue;
      const score = minimax(next, depth - 1, false, aiPlayer, alpha, beta);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxScore === -Infinity
      ? evaluate(state.board, state.queues, aiPlayer)
      : maxScore;
  } else {
    let minScore = Infinity;
    for (const cell of playable) {
      const next = applyMove(state, cell);
      if (next === state) continue;
      const score = minimax(next, depth - 1, true, aiPlayer, alpha, beta);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minScore === Infinity
      ? evaluate(state.board, state.queues, aiPlayer)
      : minScore;
  }
}

// ─── Heuristic evaluation ───────────────────────────────────────────────────

function evaluate(
  board: Board,
  queues: PlayerQueue,
  aiPlayer: Player
): number {
  const human: Player = aiPlayer === 'X' ? 'O' : 'X';
  let score = 0;

  for (const [a, b, c] of WIN_LINES) {
    score += evalLine(board, [a, b, c], aiPlayer, human);
  }

  if (board[CENTER]?.player === aiPlayer) score += HEURISTIC.CENTER_AI;
  else if (board[CENTER]?.player === human) score += HEURISTIC.CENTER_HUMAN;

  CORNERS.forEach((i) => {
    if (board[i]?.player === aiPlayer) score += HEURISTIC.CORNER_AI;
    else if (board[i]?.player === human) score += HEURISTIC.CORNER_HUMAN;
  });

  const humanExpiring = getExpiringIndex(queues, human);
  if (humanExpiring !== null) score += HEURISTIC.OPPONENT_EXPIRING;
  const aiExpiring = getExpiringIndex(queues, aiPlayer);
  if (aiExpiring !== null) score += HEURISTIC.OWN_EXPIRING;

  return score;
}

function evalLine(
  board: Board,
  line: [number, number, number],
  ai: Player,
  human: Player
): number {
  let aiCount = 0;
  let humanCount = 0;

  for (const idx of line) {
    const cell = board[idx];
    if (cell?.player === ai) aiCount++;
    else if (cell?.player === human) humanCount++;
  }

  if (aiCount > 0 && humanCount > 0) return 0;
  if (aiCount === 2) return HEURISTIC.LINE_TWO_AI;
  if (aiCount === 1) return HEURISTIC.LINE_ONE_AI;
  if (humanCount === 2) return HEURISTIC.LINE_TWO_HUMAN;
  if (humanCount === 1) return HEURISTIC.LINE_ONE_HUMAN;
  return 0;
}

// ─── Utility functions ──────────────────────────────────────────────────────

/**
 * Returns the target cell index that wins immediately for `player`, or null.
 * Uses the shared tryPlaceMark helper for single-source-of-truth eviction logic.
 */
function findImmediateWin(
  board: Board,
  queues: PlayerQueue,
  player: Player
): CellIndex | null {
  const playable = getPlayableCells(board, queues, player);
  const queue = queues[player];
  for (const cell of playable) {
    const result = tryPlaceMark(board, queue, player, cell);
    if (result.ok && checkWinner(result.board) === player) {
      return cell;
    }
  }
  return null;
}
