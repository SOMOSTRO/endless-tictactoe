import { Difficulty } from '../ai/types';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from '../constants';
import {
  playClick_SciFi,
  playMode_SciFi,
} from '../soundEngine';
import {
  requireButtonElement,
  requireHtmlElement,
  safeAddEventListener,
  safeSetAttribute,
  safeSetTextContent,
  safeToggleClass,
} from '../utils/dom';

export type GameMode = 'hvh' | 'hvai';

// ─── Mode switcher ──────────────────────────────────────────────────────────

export function initModeControls(
  onModeChange: (mode: GameMode) => void
): (mode: GameMode) => void {
  const btnHvH = requireButtonElement('btn-mode-hvh');
  const btnHvAI = requireButtonElement('btn-mode-hvai');
  const diffBar = requireHtmlElement('difficulty-bar');
  let currentMode: GameMode = 'hvh';

  function syncModeUI(mode: GameMode): void {
    currentMode = mode;
    const isAI = mode === 'hvai';
    safeToggleClass(btnHvH, 'active', !isAI);
    safeSetAttribute(btnHvH, 'aria-pressed', String(!isAI));
    safeToggleClass(btnHvAI, 'active', isAI);
    safeSetAttribute(btnHvAI, 'aria-pressed', String(isAI));

    if (isAI) {
      diffBar.removeAttribute('hidden');
    } else {
      safeSetAttribute(diffBar, 'hidden', '');
    }
  }

  function setMode(mode: GameMode): void {
    if (mode === currentMode) {
      playClick_SciFi();
      return;
    }
    playMode_SciFi();
    syncModeUI(mode);
    onModeChange(mode);
  }

  safeAddEventListener(btnHvH, 'click', () => setMode('hvh'));
  safeAddEventListener(btnHvAI, 'click', () => setMode('hvai'));

  return syncModeUI;
}

// ─── Difficulty pill controls ───────────────────────────────────────────────

export function initDifficultyControls(
  onDifficultyChange: (diff: Difficulty) => void
): void {
  const pillTrack = requireHtmlElement('pill-track');
  const pillSlider = requireHtmlElement('pill-slider');
  const mobileDiffBtn = requireButtonElement('mobile-diff-btn');
  const mobileDiffLabel = requireHtmlElement('mobile-diff-label');

  let currentDiff: Difficulty = 'casual';

  function positionSlider(diff: Difficulty): void {
    const idx = DIFFICULTY_ORDER.indexOf(diff);
    pillSlider.style.transform = `translateX(${idx * 100}%)`;
  }

  function applyDifficulty(
    diff: Difficulty,
    triggerChange = true
  ): void {
    const isChange = diff !== currentDiff;
    currentDiff = diff;

    DIFFICULTY_ORDER.forEach((d) => {
      const btn = document.getElementById(`diff-${d}`) as HTMLButtonElement | null;
      if (btn) {
        const isActive = d === diff;
        safeToggleClass(btn, 'active', isActive);
        safeSetAttribute(btn, 'aria-pressed', String(isActive));
      }
    });

    positionSlider(diff);

    safeSetTextContent(mobileDiffLabel, DIFFICULTY_LABELS[diff]);
    safeSetAttribute(mobileDiffBtn, 'data-diff', diff);

    if (triggerChange && isChange) {
      playMode_SciFi();
      onDifficultyChange(diff);
    }
  }

  safeAddEventListener(pillTrack, 'click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-diff]');
    if (!target) return;
    const diff = (target as HTMLElement).dataset.diff as Difficulty;
    if (DIFFICULTY_ORDER.includes(diff)) {
      if (diff === currentDiff) {
        playClick_SciFi();
        return;
      }
      applyDifficulty(diff);
    }
  });

  safeAddEventListener(mobileDiffBtn, 'click', () => {
    const idx = DIFFICULTY_ORDER.indexOf(currentDiff);
    const next = DIFFICULTY_ORDER[(idx + 1) % DIFFICULTY_ORDER.length];
    mobileDiffLabel.classList.add('mobile-label--fade');
    mobileDiffLabel.addEventListener(
      'animationend',
      () => {
        mobileDiffLabel.classList.remove('mobile-label--fade');
        applyDifficulty(next);
      },
      { once: true }
    );
  });

  applyDifficulty('casual', false);
}

// ─── Restart button ─────────────────────────────────────────────────────────

export function initRestartControl(onRestart: () => void): void {
  const btnRestart = requireButtonElement('btn-restart');
  const btnPlayAgain = requireButtonElement('btn-play-again');

  safeAddEventListener(btnRestart, 'click', () => {
    playClick_SciFi();
    onRestart();
  });
  safeAddEventListener(btnPlayAgain, 'click', () => {
    playClick_SciFi();
    onRestart();
  });
}

// ─── Score / label helpers ──────────────────────────────────────────────────

export function setPlayerLabels(mode: GameMode): void {
  const labelO = requireHtmlElement('score-label-o');
  safeSetTextContent(labelO, mode === 'hvai' ? 'AI' : 'Player O');
}
