import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, loadTheme, saveTheme } from '../src/core/theme';

function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('theme', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    vi.stubGlobal('document', { documentElement: { dataset: {} as Record<string, string> } });
  });

  it('defaults to dark when nothing is stored', () => {
    expect(loadTheme()).toBe('dark');
  });

  it('persists and reloads the chosen theme', () => {
    saveTheme('light');
    expect(loadTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('applies the theme to the document root', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
