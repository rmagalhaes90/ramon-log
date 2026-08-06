export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'kyro-theme';

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function loadTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
