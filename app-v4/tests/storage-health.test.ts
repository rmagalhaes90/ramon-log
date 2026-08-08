import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBytes, storageHealth } from '../src/features/offline/storage';
afterEach(() => vi.unstubAllGlobals());
describe('storage health', () => {
  it('calculates bounded quota usage', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: () => Promise.resolve({ usage: 25, quota: 100 }),
        persisted: () => Promise.resolve(true),
      },
    });
    await expect(storageHealth()).resolves.toEqual({
      usage: 25,
      quota: 100,
      percent: 25,
      persistent: true,
    });
  });
  it('formats local usage', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });
});
