// ═══════════════════════════════════════════════════════════════════════════
// Centralized application constants
// ═══════════════════════════════════════════════════════════════════════════

import type { Player, CellIndex } from './game/types';
import type { Difficulty } from './ai/types';

// ─── Game Board ────────────────────────────────────────────────────────────

export const BOARD_SIZE = 3;
export const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE; // 9

export const CELL_INDICES: CellIndex[] = Array.from(
  { length: TOTAL_CELLS },
  (_, i) => i
);

export const CORNERS: CellIndex[] = [0, 2, 6, 8];
export const CENTER: CellIndex = 4;
export const EDGES: CellIndex[] = [1, 3, 5, 7];

// Strategic cell preference order: center > corners > edges
export const PREFERRED_CELL_ORDER: CellIndex[] = [
  CENTER,
  ...CORNERS,
  ...EDGES,
];

// ─── AI Configuration ──────────────────────────────────────────────────────

export const MINIMAX_DEPTH = 4;

export interface AIThinkingDelay {
  readonly casual: number;
  readonly tactical: number;
  readonly grandmaster: number;
}

export const AI_THINKING_DELAY: AIThinkingDelay = {
  casual: 350,
  tactical: 350,
  grandmaster: 600,
} as const;

export const DIFFICULTY_ORDER: Difficulty[] = [
  'casual',
  'tactical',
  'grandmaster',
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  casual: 'Casual',
  tactical: 'Tactical',
  grandmaster: 'Grandmaster',
} as const;

// ─── Animation Timing ──────────────────────────────────────────────────────

export const ANIMATION = {
  STAGGER_MS: 38,
  FLIP_DURATION_MS: 300,
  FLIP_MIDPOINT_RATIO: 0.45,
  WIN_OVERLAY_DELAY_MS: 400,
  PLACEMENT_DURATION_MS: 260,
  EXPIRY_DURATION_MS: 280,
  SHAKE_DURATION_MS: 280,
  MOBILE_LABEL_FADE_MS: 150,
} as const;

export const FLIP_MIDPOINT_DELAY_MS = Math.round(
  ANIMATION.FLIP_DURATION_MS * ANIMATION.FLIP_MIDPOINT_RATIO
);

// ─── Heuristic Evaluation Weights ──────────────────────────────────────────

export const HEURISTIC = {
  LINE_TWO_AI: 5,
  LINE_ONE_AI: 1,
  LINE_TWO_HUMAN: -5,
  LINE_ONE_HUMAN: -1,
  CENTER_AI: 3,
  CENTER_HUMAN: -3,
  CORNER_AI: 2,
  CORNER_HUMAN: -2,
  OPPONENT_EXPIRING: 2,
  OWN_EXPIRING: -1,
  WIN_BASE_MULTIPLIER: 10,
} as const;

// ─── Game Mode ─────────────────────────────────────────────────────────────

export const DEFAULT_PLAYER: Player = 'X';
export const AI_PLAYER: Player = 'O';

// ─── Dual-Phase Timer Configuration ───────────────────────────────────────

export const TIMER_CONFIG = {
  LAZY_START_HIDDEN_MS: 1500,
  PENALTY_HIDDEN_MS: 1000,
  VISIBLE_COUNTDOWN_MS: 2000,
  SVG_RING_CIRCUMFERENCE: 263.8937, // 2 * pi * 42
} as const;

