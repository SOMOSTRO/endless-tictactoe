import { describe, expect, it } from 'vitest';
import { parsePwaShortcutParams } from './pwaShortcut';

describe('parsePwaShortcutParams', () => {
  it('parses pass-and-play shortcut mode', () => {
    const config = parsePwaShortcutParams('?mode=pass-and-play');
    expect(config).toEqual({
      mode: 'hvh',
      difficulty: 'casual',
    });
  });

  it('parses AI shortcut mode with explicit grandmaster difficulty', () => {
    const config = parsePwaShortcutParams('?mode=ai&difficulty=grandmaster');
    expect(config).toEqual({
      mode: 'hvai',
      difficulty: 'grandmaster',
    });
  });

  it('defaults to grandmaster difficulty when mode=ai and difficulty is omitted', () => {
    const config = parsePwaShortcutParams('?mode=ai');
    expect(config).toEqual({
      mode: 'hvai',
      difficulty: 'grandmaster',
    });
  });

  it('parses AI shortcut mode with tactical difficulty', () => {
    const config = parsePwaShortcutParams('?mode=ai&difficulty=tactical');
    expect(config).toEqual({
      mode: 'hvai',
      difficulty: 'tactical',
    });
  });

  it('parses AI shortcut mode with casual difficulty', () => {
    const config = parsePwaShortcutParams('?mode=ai&difficulty=casual');
    expect(config).toEqual({
      mode: 'hvai',
      difficulty: 'casual',
    });
  });

  it('defaults to grandmaster difficulty when mode=ai and invalid difficulty is provided', () => {
    const config = parsePwaShortcutParams('?mode=ai&difficulty=superhard');
    expect(config).toEqual({
      mode: 'hvai',
      difficulty: 'grandmaster',
    });
  });

  it('returns default hvh and casual settings for empty query string', () => {
    const config = parsePwaShortcutParams('');
    expect(config).toEqual({
      mode: 'hvh',
      difficulty: 'casual',
    });
  });

  it('returns default hvh and casual settings for unrecognized mode', () => {
    const config = parsePwaShortcutParams('?mode=online&difficulty=casual');
    expect(config).toEqual({
      mode: 'hvh',
      difficulty: 'casual',
    });
  });
});
