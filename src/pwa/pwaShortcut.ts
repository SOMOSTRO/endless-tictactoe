import { Difficulty } from '../ai/types';
import { GameMode } from '../ui/controls';

export interface PwaShortcutConfig {
  mode: GameMode;
  difficulty: Difficulty;
}

const VALID_DIFFICULTIES: readonly Difficulty[] = [
  'casual',
  'tactical',
  'grandmaster',
];

/**
 * Parses URL query parameters (e.g. `?mode=pass-and-play` or `?mode=ai&difficulty=grandmaster`)
 * and returns the corresponding initial game mode and AI difficulty settings.
 */
export function parsePwaShortcutParams(search: string): PwaShortcutConfig {
  const params = new URLSearchParams(search);
  const rawMode = params.get('mode');
  const rawDiff = params.get('difficulty');

  if (rawMode === 'pass-and-play') {
    return {
      mode: 'hvh',
      difficulty: 'casual',
    };
  }

  if (rawMode === 'ai') {
    const difficulty: Difficulty =
      rawDiff && (VALID_DIFFICULTIES as readonly string[]).includes(rawDiff)
        ? (rawDiff as Difficulty)
        : 'grandmaster';

    return {
      mode: 'hvai',
      difficulty,
    };
  }

  return {
    mode: 'hvh',
    difficulty: 'casual',
  };
}
