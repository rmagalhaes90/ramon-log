import { describe, expect, it, vi } from 'vitest';
import { createI18n, messageFor } from '../src/core/i18n';

describe('i18n', () => {
  it('switches between Portuguese and English', () => {
    vi.stubGlobal('localStorage', { setItem: vi.fn() });
    vi.stubGlobal('document', { documentElement: { lang: '' } });
    const i18n = createI18n('pt');
    expect(i18n.t('online')).toBe('Online');
    i18n.setLocale('en');
    expect(i18n.t('baseline')).toBe('Open stable version');
  });
  it('looks up a message in a specific locale regardless of the active one', () => {
    expect(messageFor('pt', 'online')).toBe('Online');
    expect(messageFor('en', 'baseline')).toBe('Open stable version');
  });
});
