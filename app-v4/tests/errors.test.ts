import { afterEach, describe, expect, it, vi } from 'vitest';
import { onError, reportBackgroundError, reportError } from '../src/core/errors';

describe('error reporting', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps recoverable background failures out of the global error UI', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const listener = vi.fn();
    const unsubscribe = onError(listener);

    reportBackgroundError(new Error('offline'), 'offline-sync');
    expect(listener).not.toHaveBeenCalled();

    reportError(new Error('visible'), 'action');
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
