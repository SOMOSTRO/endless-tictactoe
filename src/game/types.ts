/** The two players */
export type Player = 'X' | 'O';

/** A cell index 0-8 on the 3x3 board */
export type CellIndex = number;

/** Visual state of a placed mark */
export type MarkState = 'active' | 'expiring';

/** What occupies a single cell */
export interface CellMark {
  player: Player;
  state: MarkState;
}

/** The board: null means empty, CellMark means occupied */
export type Board = (CellMark | null)[];

/** FIFO queue for each player — stores cell indices in placement order */
export interface PlayerQueue {
  X: CellIndex[];
  O: CellIndex[];
}

/** Full game state */
export interface GameState {
  board: Board;
  queues: PlayerQueue;
  currentPlayer: Player;
  winner: Player | null;
  isGameOver: boolean;
}

/** All winning line combinations */
export const WIN_LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const MAX_MARKS = 3;
