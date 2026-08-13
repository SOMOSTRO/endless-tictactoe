import './styles/main.css';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { AI_THINKING_DELAY, getBestMove } from './ai/aiEngine';
import { Difficulty } from './ai/types';
import { ANIMATION } from './constants';
import { applyMove, createInitialState } from './game/gameLogic';
import { GameState } from './game/types';
import { initPWA } from './pwa/registerServiceWorker';
import { parsePwaShortcutParams } from './pwa/pwaShortcut';
import {
  playError_SciFi,
  playO_SciFi,
  playReset_SciFi,
  playWin_SciFi,
  playX_SciFi,
} from './soundEngine';
import {
  animateBoardReset,
  animateExpiry,
  animatePlacement,
  disableBoard,
  enableBoard,
  freezeCellAnimations,
  hideWinOverlay,
  highlightWin,
  initBoard,
  renderBoard,
  setStatus,
  showWinOverlay,
  updateScore,
} from './ui/boardRenderer';
import {
  GameMode,
  initDifficultyControls,
  initModeControls,
  initRestartControl,
  setPlayerLabels,
} from './ui/controls';

// ─── Scores type ────────────────────────────────────────────────────────────

interface Scores {
  X: number;
  O: number;
}

const DEFAULT_SCORES: Scores = { X: 0, O: 0 };

// ─── Unified App State Manager ──────────────────────────────────────────────
//
// Encapsulates all mutable application state: game state, mode, difficulty,
// scores, cell references, animation lock, and AI abort controller.
// Exposes explicit action methods so state transitions are predictable and
// debuggable.

class AppStateManager {
  private gameState: GameState;
  private gameMode: GameMode;
  private difficulty: Difficulty;
  private scores: Scores;
  private cells: HTMLElement[];
  private uiLocked: boolean;
  private aiAbortController: AbortController | null;

  constructor() {
    this.gameState = createInitialState();
    this.gameMode = 'hvh';
    this.difficulty = 'casual';
    this.scores = { ...DEFAULT_SCORES };
    this.cells = [];
    this.uiLocked = false;
    this.aiAbortController = null;
  }

  // ─── State accessors (read-only semantic) ───────────────────────────────

  getGameState(): GameState {
    return this.gameState;
  }

  getMode(): GameMode {
    return this.gameMode;
  }

  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  getScores(): Scores {
    return { ...this.scores };
  }

  getCells(): HTMLElement[] {
    return this.cells;
  }

  isUiLocked(): boolean {
    return this.uiLocked;
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  setCells(cells: HTMLElement[]): void {
    this.cells = cells;
  }

  setInitialConfig(mode: GameMode, difficulty: Difficulty): void {
    this.gameMode = mode;
    this.difficulty = difficulty;
    setPlayerLabels(mode);
  }

  // ─── Mode / Difficulty transitions ──────────────────────────────────────

  /**
   * Change game mode. Resets scores and board to fresh state.
   *
   * Spec requirement:
   *  - Scores reset when switching between HvH <-> HvAI
   *  - Board resets to fresh initial state
   */
  changeMode(newMode: GameMode): void {
    if (newMode === this.gameMode) return;

    this.cancelAIMove();
    this.gameMode = newMode;
    this.scores = { ...DEFAULT_SCORES };
    updateScore(this.scores);
    setPlayerLabels(newMode);
    this.resetBoard(true);
  }

  /**
   * Change AI difficulty. Preserves scores.
   *
   * Spec requirement:
   *  - Scores PRESERVED when changing AI difficulty levels
   *  - Board still resets to fresh initial state (new match)
   */
  changeDifficulty(newDifficulty: Difficulty): void {
    if (newDifficulty === this.difficulty) return;

    this.cancelAIMove();
    this.difficulty = newDifficulty;
    this.resetBoard(true);
  }

  // ─── Board / match control ───────────────────────────────────────────────

  resetBoard(animate: boolean): void {
    this.cancelAIMove();
    hideWinOverlay();
    this.gameState = createInitialState();
    this.uiLocked = false;

    if (animate) {
      playReset_SciFi();
    }

    const completeReset = () => {
      renderBoard(this.gameState.board, this.cells);
      this.updateStatusBar();
      enableBoard();
      this.maybeScheduleAI();
    };

    if (animate) {
      animateBoardReset(this.cells, completeReset);
    } else {
      completeReset();
    }
  }

  restartMatch(): void {
    this.resetBoard(true);
  }

  // ─── UI lock ─────────────────────────────────────────────────────────────

  lockUI(): void {
    this.uiLocked = true;
  }

  unlockUI(): void {
    this.uiLocked = false;
  }

  // ─── AI async handling (AbortController-based) ───────────────────────────

  private cancelAIMove(): void {
    if (this.aiAbortController) {
      this.aiAbortController.abort();
      this.aiAbortController = null;
    }
  }

  /**
   * Schedule an AI move after a think-time delay.
   * Uses AbortController so:
   *   - If user clicks restart/mode-switch mid-delay, the AI move is cancelled.
   *   - No race condition where a stale delayed move fires against a new board.
   */
  maybeScheduleAI(): void {
    if (this.gameMode !== 'hvai') return;
    if (this.gameState.isGameOver) return;
    if (this.gameState.currentPlayer !== 'O') return;

    this.cancelAIMove();

    disableBoard();
    this.lockUI();

    const controller = new AbortController();
    this.aiAbortController = controller;

    const delay = AI_THINKING_DELAY[this.difficulty];
    const timeoutId = window.setTimeout(() => {
      if (controller.signal.aborted) return;

      const move = getBestMove(this.gameState, this.difficulty);
      this.unlockUI();
      enableBoard();
      this.aiAbortController = null;
      this.placeMove(move.cellIndex);
    }, delay);

    // Ensure timeout is cleared if controller is aborted.
    controller.signal.addEventListener('abort', () => {
      window.clearTimeout(timeoutId);
    }, { once: true });
  }

  // ─── Cell interaction ────────────────────────────────────────────────────

  handleCellClick(idx: number): void {
    if (this.uiLocked || this.gameState.isGameOver) return;
    if (this.gameMode === 'hvai' && this.gameState.currentPlayer !== 'X') return;
    if (this.gameState.board[idx] !== null) {
      const cell = this.cells[idx];
      playError_SciFi();
      cell.classList.add('cell--shake');
      cell.addEventListener(
        'animationend',
        () => cell.classList.remove('cell--shake'),
        { once: true }
      );
      return;
    }

    this.placeMove(idx);
  }

  placeMove(idx: number): void {
    const currentPlayer = this.gameState.currentPlayer;
    const queue = this.gameState.queues[currentPlayer];
    const willExpire = queue.length >= 3;
    const expiringIdx = willExpire ? queue[0] : -1;

    if (willExpire && expiringIdx === idx) {
      const cell = this.cells[idx];
      playError_SciFi();
      cell.classList.add('cell--shake');
      cell.addEventListener(
        'animationend',
        () => cell.classList.remove('cell--shake'),
        { once: true }
      );
      return;
    }

    if (willExpire && expiringIdx >= 0) {
      animateExpiry(this.cells[expiringIdx]);
    }

    const prevState = this.gameState;
    this.gameState = applyMove(this.gameState, idx);
    if (this.gameState === prevState) return;

    if (currentPlayer === 'X') {
      playX_SciFi();
    } else {
      playO_SciFi();
    }

    renderBoard(this.gameState.board, this.cells);
    animatePlacement(this.cells[idx]);

    if (this.gameState.isGameOver) {
      this.handleGameOver();
      return;
    }

    this.updateStatusBar();
    this.maybeScheduleAI();
  }

  // ─── Status / Win handling ───────────────────────────────────────────────

  private handleGameOver(): void {
    if (!this.gameState.winner) return;

    this.cancelAIMove();
    playWin_SciFi();
    freezeCellAnimations(this.cells);
    highlightWin(this.gameState.board, this.cells);

    const winner = this.gameState.winner;
    this.scores[winner]++;
    updateScore(this.scores);

    const isAIWin = this.gameMode === 'hvai' && winner === 'O';
    const overlayLabel = isAIWin ? 'AI Wins!' : `Player ${winner} Wins!`;
    const statusLabel = isAIWin ? 'AI Wins!' : `Player ${winner} Wins!`;

    window.setTimeout(
      () => showWinOverlay(winner, overlayLabel),
      ANIMATION.WIN_OVERLAY_DELAY_MS
    );
    setStatus(statusLabel, winner);
    disableBoard();
  }

  private updateStatusBar(): void {
    if (this.gameState.isGameOver) return;

    const p = this.gameState.currentPlayer;
    const isAITurn = this.gameMode === 'hvai' && p === 'O';

    let msg: string;
    if (isAITurn) {
      msg = 'AI is thinking…';
    } else {
      const name = this.gameMode === 'hvai' ? 'Your' : `Player ${p}'s`;
      msg = `${name} turn`;
    }

    setStatus(msg, p);
  }
}

// ─── App instance & bootstrap ───────────────────────────────────────────────

const app = new AppStateManager();

function init(): void {
  inject();
  injectSpeedInsights();
  initPWA();
  const cells = initBoard();
  app.setCells(cells);

  const initialConfig = parsePwaShortcutParams(window.location.search);
  app.setInitialConfig(initialConfig.mode, initialConfig.difficulty);

  const syncModeUI = initModeControls((mode) => {
    app.changeMode(mode);
  });
  syncModeUI(app.getMode());

  const syncDiffUI = initDifficultyControls((diff) => {
    app.changeDifficulty(diff);
  });
  syncDiffUI(app.getDifficulty());

  initRestartControl(() => app.restartMatch());

  cells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const idx = Number(cell.dataset.index);
      app.handleCellClick(idx);
    });
  });

  app.resetBoard(false);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('preload');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);

