import { TIMER_CONFIG } from '../constants';
import {
  createTimerOverlay,
  removeAllTimerOverlays,
  TimerOverlayInstance,
  TimerOverlayType,
} from '../ui/timerOverlay';

export type TimerPhase = 'idle' | 'hidden' | 'visible';

export interface DualPhaseTimerCallbacks {
  getTargetCell: (type: TimerOverlayType) => number | null;
  onTimerComplete: (targetCell: number, type: TimerOverlayType) => void;
}

/**
 * Centralized Dual-Phase Timer state manager.
 * Handles Hidden Phase (no visual output) -> Visible Phase (SVG countdown ring overlay).
 */
export class DualPhaseTimer {
  private phase: TimerPhase = 'idle';
  private currentType: TimerOverlayType | null = null;
  private hiddenTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private visibleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private textTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentOverlay: TimerOverlayInstance | null = null;
  private cells: HTMLElement[] = [];

  setCells(cells: HTMLElement[]): void {
    this.cells = cells;
  }

  getPhase(): TimerPhase {
    return this.phase;
  }

  getType(): TimerOverlayType | null {
    return this.currentType;
  }

  start(
    type: TimerOverlayType,
    hiddenMs: number,
    callbacks: DualPhaseTimerCallbacks
  ): void {
    this.abort();

    this.phase = 'hidden';
    this.currentType = type;

    this.hiddenTimeoutId = setTimeout(() => {
      this.hiddenTimeoutId = null;
      if (this.phase !== 'hidden') return;

      const targetCell = callbacks.getTargetCell(type);
      if (
        targetCell === null ||
        targetCell < 0 ||
        targetCell >= this.cells.length
      ) {
        this.abort();
        return;
      }

      const cellEl = this.cells[targetCell];
      if (!cellEl) {
        this.abort();
        return;
      }

      this.phase = 'visible';
      this.currentOverlay = createTimerOverlay(cellEl, targetCell, type);

      // Change text from '2' to '1' after 1000ms
      this.textTimeoutId = setTimeout(() => {
        if (this.currentOverlay) {
          this.currentOverlay.updateText('1');
        }
      }, TIMER_CONFIG.VISIBLE_COUNTDOWN_MS / 2);

      // Visible phase completes at 2000ms
      this.visibleTimeoutId = setTimeout(() => {
        const completedCell = targetCell;
        const completedType = type;
        this.abort();
        callbacks.onTimerComplete(completedCell, completedType);
      }, TIMER_CONFIG.VISIBLE_COUNTDOWN_MS);
    }, hiddenMs);
  }

  abort(): void {
    if (this.hiddenTimeoutId !== null) {
      clearTimeout(this.hiddenTimeoutId);
      this.hiddenTimeoutId = null;
    }
    if (this.visibleTimeoutId !== null) {
      clearTimeout(this.visibleTimeoutId);
      this.visibleTimeoutId = null;
    }
    if (this.textTimeoutId !== null) {
      clearTimeout(this.textTimeoutId);
      this.textTimeoutId = null;
    }

    if (this.currentOverlay) {
      this.currentOverlay.remove();
      this.currentOverlay = null;
    }

    removeAllTimerOverlays(this.cells);
    this.phase = 'idle';
    this.currentType = null;
  }
}
