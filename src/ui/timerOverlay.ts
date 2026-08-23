import { TIMER_CONFIG } from '../constants';

export type TimerOverlayType = 'ai' | 'penalty';

export interface TimerOverlayInstance {
  readonly cellIndex: number;
  readonly type: TimerOverlayType;
  updateText(val: number | string): void;
  remove(): void;
}

interface MockOverlay {
  className: string;
  remove: () => void;
  querySelector: (
    sel: string
  ) => { className: string; textContent: string } | null;
}

interface MockCell extends HTMLElement {
  _children?: MockOverlay[];
}

/**
 * Injects a lightweight `<div class="cell-timer-overlay">` inside targeted empty cell.
 * Features an SVG circular progress ring and central countdown text ("2", then "1").
 */
export function createTimerOverlay(
  cellElement: HTMLElement,
  cellIndex: number,
  type: TimerOverlayType
): TimerOverlayInstance {
  let removeFn: () => void = () => {};
  let updateTextFn: (val: number | string) => void = () => {};

  if (typeof document !== 'undefined') {
    const existing = cellElement?.querySelector?.('.cell-timer-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = `cell-timer-overlay cell-timer-overlay--${type}`;
    overlay.dataset.type = type;
    overlay.setAttribute('aria-hidden', 'true');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'cell-timer-svg');
    svg.setAttribute('viewBox', '0 0 100 100');

    const bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('class', 'cell-timer-bg');
    bgCircle.setAttribute('cx', '50');
    bgCircle.setAttribute('cy', '50');
    bgCircle.setAttribute('r', '42');

    const ringCircle = document.createElementNS(svgNS, 'circle');
    ringCircle.setAttribute('class', 'cell-timer-ring');
    ringCircle.setAttribute('cx', '50');
    ringCircle.setAttribute('cy', '50');
    ringCircle.setAttribute('r', '42');
    ringCircle.style.strokeDasharray = `${TIMER_CONFIG.SVG_RING_CIRCUMFERENCE}`;
    ringCircle.style.strokeDashoffset = '0';

    svg.appendChild(bgCircle);
    svg.appendChild(ringCircle);

    const textSpan = document.createElement('span');
    textSpan.className = 'cell-timer-text';
    textSpan.textContent = '2';

    overlay.appendChild(svg);
    overlay.appendChild(textSpan);

    cellElement.appendChild(overlay);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            overlay.classList.add('cell-timer-overlay--animating');
          });
        }
      });
    }

    removeFn = () => overlay.remove();
    updateTextFn = (val) => {
      textSpan.textContent = String(val);
    };
  } else if (cellElement) {
    const textSpan = { className: 'cell-timer-text', textContent: '2' };
    const mockCell = cellElement as MockCell;
    const overlay: MockOverlay = {
      className: `cell-timer-overlay cell-timer-overlay--${type}`,
      remove() {
        if (typeof mockCell.removeChild === 'function') {
          mockCell.removeChild(overlay as unknown as Node);
        } else if (Array.isArray(mockCell._children)) {
          const idx = mockCell._children.indexOf(overlay);
          if (idx !== -1) mockCell._children.splice(idx, 1);
        }
      },
      querySelector(sel: string) {
        if (sel.includes('cell-timer-text')) return textSpan;
        return null;
      },
    };
    if (typeof cellElement.appendChild === 'function') {
      cellElement.appendChild(overlay as unknown as Node);
    }

    removeFn = () => overlay.remove();
    updateTextFn = (val) => {
      textSpan.textContent = String(val);
    };
  }

  return {
    cellIndex,
    type,
    updateText(val: number | string) {
      updateTextFn(val);
    },
    remove() {
      removeFn();
    },
  };
}

/**
 * Clears all timer overlays from all cells on the board instantly.
 */
export function removeAllTimerOverlays(cells: HTMLElement[]): void {
  cells.forEach((cell) => {
    if (cell && typeof cell.querySelectorAll === 'function') {
      const overlays = cell.querySelectorAll('.cell-timer-overlay');
      overlays.forEach((el) => el.remove?.());
    }
  });
}
