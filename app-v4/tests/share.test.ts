import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareOrFallback } from '../src/features/share';

afterEach(() => vi.unstubAllGlobals());

describe('Web Share', () => {
  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => false, clipboard: { writeText: vi.fn() } });
    await expect(shareOrFallback({ title: 'KYRO', text: 'Progress' })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'KYRO', text: 'Progress' });
  });

  it('copies text when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(shareOrFallback({ title: 'KYRO', text: 'Progress' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Progress');
  });
});
