import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DualPhaseTimer } from './dualPhaseTimer';
import { TIMER_CONFIG } from '../constants';

interface MockChild {
  className?: string;
  querySelector?: (sel: string) => MockChild | null;
  querySelectorAll?: (sel: string) => MockChild[];
  remove?: () => void;
  textContent?: string;
}

function createMockCell(): HTMLElement {
  const children: MockChild[] = [];
  const cell = {
    _children: children,
    appendChild(child: MockChild) {
      children.push(child);
    },
    removeChild(child: MockChild) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
    },
    querySelector(selector: string): MockChild | null {
      const targetClass = selector.replace('.', '');
      for (const child of children) {
        if (child.className?.includes(targetClass)) return child;
        if (typeof child.querySelector === 'function') {
          const sub = child.querySelector(selector);
          if (sub) return sub;
        }
      }
      return null;
    },
    querySelectorAll(selector: string): MockChild[] {
      const targetClass = selector.replace('.', '');
      const results: MockChild[] = [];
      for (const child of children) {
        if (child.className?.includes(targetClass)) results.push(child);
        if (typeof child.querySelectorAll === 'function') {
          results.push(...child.querySelectorAll(selector));
        }
      }
      return results;
    },
  } as unknown as HTMLElement;
  return cell;
}

describe('DualPhaseTimer', () => {
  let timer: DualPhaseTimer;
  let cells: HTMLElement[];

  beforeEach(() => {
    vi.useFakeTimers();
    cells = Array.from({ length: 9 }, () => createMockCell());
    timer = new DualPhaseTimer();
    timer.setCells(cells);
  });

  afterEach(() => {
    timer.abort();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    expect(timer.getPhase()).toBe('idle');
    expect(timer.getType()).toBeNull();
  });

  it('transitions to hidden phase when started', () => {
    const getTargetCell = vi.fn().mockReturnValue(4);
    const onTimerComplete = vi.fn();

    timer.start('ai', TIMER_CONFIG.LAZY_START_HIDDEN_MS, {
      getTargetCell,
      onTimerComplete,
    });

    expect(timer.getPhase()).toBe('hidden');
    expect(timer.getType()).toBe('ai');
    expect(getTargetCell).not.toHaveBeenCalled();
  });

  it('transitions to visible phase after hidden delay and injects overlay', () => {
    const getTargetCell = vi.fn().mockReturnValue(4);
    const onTimerComplete = vi.fn();

    timer.start('ai', TIMER_CONFIG.LAZY_START_HIDDEN_MS, {
      getTargetCell,
      onTimerComplete,
    });

    vi.advanceTimersByTime(TIMER_CONFIG.LAZY_START_HIDDEN_MS);

    expect(timer.getPhase()).toBe('visible');
    expect(getTargetCell).toHaveBeenCalledWith('ai');
    expect(cells[4].querySelector('.cell-timer-overlay')).not.toBeNull();
  });

  it('updates text to 1 mid-way through visible phase and completes when visible time expires', () => {
    const getTargetCell = vi.fn().mockReturnValue(2);
    const onTimerComplete = vi.fn();

    timer.start('penalty', TIMER_CONFIG.PENALTY_HIDDEN_MS, {
      getTargetCell,
      onTimerComplete,
    });

    vi.advanceTimersByTime(TIMER_CONFIG.PENALTY_HIDDEN_MS);
    expect(timer.getPhase()).toBe('visible');

    const textSpan = cells[2].querySelector('.cell-timer-text');
    expect(textSpan?.textContent).toBe('2');

    // Advance 1000ms
    vi.advanceTimersByTime(TIMER_CONFIG.VISIBLE_COUNTDOWN_MS / 2);
    expect(textSpan?.textContent).toBe('1');

    // Advance remaining 1000ms
    vi.advanceTimersByTime(TIMER_CONFIG.VISIBLE_COUNTDOWN_MS / 2);
    expect(onTimerComplete).toHaveBeenCalledWith(2, 'penalty');
    expect(timer.getPhase()).toBe('idle');
    expect(cells[2].querySelector('.cell-timer-overlay')).toBeNull();
  });

  it('aborts cleanly and purges DOM overlays when abort is called', () => {
    const getTargetCell = vi.fn().mockReturnValue(0);
    const onTimerComplete = vi.fn();

    timer.start('ai', 1500, { getTargetCell, onTimerComplete });
    vi.advanceTimersByTime(1500);

    expect(cells[0].querySelector('.cell-timer-overlay')).not.toBeNull();

    timer.abort();

    expect(timer.getPhase()).toBe('idle');
    expect(cells[0].querySelector('.cell-timer-overlay')).toBeNull();
    expect(onTimerComplete).not.toHaveBeenCalled();
  });
});
