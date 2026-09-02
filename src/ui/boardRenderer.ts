import { Board, CellMark, Player } from '../game/types';
import { getWinLine } from '../game/gameLogic';
import {
  ANIMATION,
  FLIP_MIDPOINT_DELAY_MS,
} from '../constants';
import {
  requireHtmlElement,
  safeSetAttribute,
  safeSetTextContent,
  safeToggleClass,
} from '../utils/dom';

// ─── Board init ─────────────────────────────────────────────────────────────

export function initBoard(): HTMLElement[] {
  const boardEl = requireHtmlElement('board');
  boardEl.innerHTML = '';

  const cells: HTMLElement[] = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.dataset.index = String(i);
    cell.setAttribute('aria-label', `Cell ${i + 1}, Empty`);
    cell.setAttribute('tabindex', '0');
    boardEl.appendChild(cell);
    cells.push(cell);
  }
  return cells;
}

// ─── Board render ───────────────────────────────────────────────────────────

export function renderBoard(board: Board, cells: HTMLElement[]): void {
  cells.forEach((cell, i) => {
    const mark = board[i];
    updateCell(cell, mark, i);
  });
}

// ─── SVG Mark Factory ────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createMarkSvgElement(
  player: Player,
  className = 'cell-mark-svg'
): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');

  if (player === 'X') {
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 5 5 L 19 19 M 19 5 L 5 19');
    svg.appendChild(path);
  } else {
    svg.setAttribute('stroke-width', '1.5');
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '7');
    svg.appendChild(circle);
  }

  return svg;
}

function updateCell(
  cell: HTMLElement,
  mark: CellMark | null,
  index: number
): void {
  const ghosts = Array.from(cell.querySelectorAll<HTMLElement>('.cell-evict-ghost'));

  const isFlipping = cell.classList.contains('cell--flip-out');

  cell.className = isFlipping ? 'cell cell--flip-out' : 'cell';
  cell.innerHTML = '';

  ghosts.forEach((g) => cell.appendChild(g));

  if (!mark) {
    cell.setAttribute('aria-label', `Cell ${index + 1}, Empty`);
    cell.removeAttribute('data-player');
    cell.removeAttribute('data-state');
    return;
  }

  cell.setAttribute('data-player', mark.player);
  cell.setAttribute('data-state', mark.state);
  cell.setAttribute(
    'aria-label',
    `Cell ${index + 1}, Player ${mark.player}, ${mark.state}`
  );

  const inner = document.createElement('span');
  inner.className = 'cell-mark';
  inner.setAttribute('aria-hidden', 'true');
  inner.appendChild(createMarkSvgElement(mark.player));
  cell.appendChild(inner);
}

// ─── Placement animation ────────────────────────────────────────────────────

export function animatePlacement(cell: HTMLElement): void {
  cell.classList.add('cell--bounce');
  cell.addEventListener(
    'animationend',
    () => cell.classList.remove('cell--bounce'),
    { once: true }
  );
}

// ─── Expiry animation ───────────────────────────────────────────────────────

export function animateExpiry(cell: HTMLElement): void {
  const existingMark = cell.querySelector('.cell-mark');
  if (!existingMark) return;

  const player = (cell.dataset.player as Player | undefined) ?? 'X';

  const ghost = document.createElement('span');
  ghost.className = 'cell-evict-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.dataset.player = player;
  ghost.appendChild(createMarkSvgElement(player, 'cell-mark-svg'));

  // Capture the mark's final computed color (player-dependent) as a single
  // inline style. All layout lives in .cell-evict-ghost CSS class — this
  // replaces the old cssText block while still getting the exact player color.
  const markColor = window.getComputedStyle(
    existingMark as HTMLElement
  ).color;
  ghost.style.color = markColor;

  cell.style.position = 'relative';
  cell.appendChild(ghost);

  ghost.classList.add('cell--expire');
  ghost.addEventListener('animationend', () => ghost.remove(), {
    once: true,
  });
}

// ─── Win highlight ──────────────────────────────────────────────────────────

export function highlightWin(board: Board, cells: HTMLElement[]): void {
  const line = getWinLine(board);
  if (!line) return;

  cells.forEach((cell, i) => {
    if (!line.includes(i)) {
      cell.classList.add('cell--dimmed');
    } else {
      cell.classList.add('cell--winner', 'winning');
    }
  });
}

export function freezeCellAnimations(cells: HTMLElement[]): void {
  cells.forEach((cell) => {
    cell.classList.remove('cell--bounce', 'cell--shake');
    cell.querySelectorAll('.cell-evict-ghost').forEach((ghost) => ghost.remove());

    if (cell.dataset.state === 'expiring') {
      cell.dataset.state = 'active';
      const ariaLabel = cell.getAttribute('aria-label');
      if (ariaLabel) {
        cell.setAttribute(
          'aria-label',
          ariaLabel.replace('expiring', 'active')
        );
      }
    }
  });
}

// ─── Board flip reset animation ─────────────────────────────────────────────

export function animateBoardReset(
  cells: HTMLElement[],
  onComplete: () => void
): void {
  const STAGGER = ANIMATION.STAGGER_MS;

  let completed = 0;
  const total = cells.length;

  cells.forEach((cell, i) => {
    const delay = i * STAGGER;

    setTimeout(() => {
      cell.classList.remove(
        'cell--winner',
        'winning',
        'cell--dimmed',
        'cell--bounce',
        'cell--shake'
      );
      cell.querySelectorAll('.cell-evict-ghost').forEach((g) => g.remove());

      setTimeout(() => {
        updateCell(cell, null, i);
      }, FLIP_MIDPOINT_DELAY_MS);

      cell.classList.add('cell--flip-out');
      cell.addEventListener(
        'animationend',
        () => {
          cell.classList.remove('cell--flip-out');
          completed++;
          if (completed === total) onComplete();
        },
        { once: true }
      );
    }, delay);
  });
}

// ─── Status bar ─────────────────────────────────────────────────────────────

export function setStatus(text: string, player?: Player): void {
  const el = requireHtmlElement('status-text');
  safeSetTextContent(el, text);

  const bar = requireHtmlElement('status-bar');
  bar.removeAttribute('data-player');
  if (player) bar.setAttribute('data-player', player);
}

// ─── Win overlay ────────────────────────────────────────────────────────────

export function showWinOverlay(player: Player, labelOverride?: string): void {
  const overlay = requireHtmlElement('win-overlay');
  const title = requireHtmlElement('win-title');
  const winnerColor = player === 'X' ? '#F43F5E' : '#0EA5E9';
  const winnerColorDark = player === 'X' ? '#BE123C' : '#0369A1';
  const winnerColorGlow =
    player === 'X' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(14, 165, 233, 0.4)';

  safeSetTextContent(title, labelOverride ?? `Player ${player} Wins!`);
  overlay.setAttribute('data-winner', player);
  overlay.style.setProperty('--winner-color', winnerColor);
  overlay.style.setProperty('--winner-color-dark', winnerColorDark);
  overlay.style.setProperty('--winner-color-glow', winnerColorGlow);
  overlay.removeAttribute('aria-hidden');
  overlay.removeAttribute('hidden');
  overlay.classList.add('win-overlay--visible');
}

export function hideWinOverlay(): void {
  const overlay = requireHtmlElement('win-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('hidden', '');
  overlay.classList.remove('win-overlay--visible');
  overlay.removeAttribute('data-winner');
  overlay.style.removeProperty('--winner-color');
  overlay.style.removeProperty('--winner-color-dark');
  overlay.style.removeProperty('--winner-color-glow');
}

// ─── Score update ───────────────────────────────────────────────────────────

export function updateScore(scores: { X: number; O: number }): void {
  const scoreX = requireHtmlElement('score-x');
  const scoreO = requireHtmlElement('score-o');
  safeSetTextContent(scoreX, String(scores.X));
  safeSetTextContent(scoreO, String(scores.O));
}

// ─── Board enable/disable ───────────────────────────────────────────────────

export function disableBoard(): void {
  const board = requireHtmlElement('board');
  safeSetAttribute(board, 'aria-disabled', 'true');
  safeToggleClass(board, 'board--disabled', true);
}

export function enableBoard(): void {
  const board = requireHtmlElement('board');
  board.removeAttribute('aria-disabled');
  safeToggleClass(board, 'board--disabled', false);
}
