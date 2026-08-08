import { afterEach, describe, expect, it, vi } from 'vitest';
import { barcodeCameraSupported } from '../src/features/nutrition/camera';
afterEach(() => vi.unstubAllGlobals());
describe('barcode camera', () => {
  it('detects capability from getUserMedia alone (works on every browser via ZXing)', () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    expect(barcodeCameraSupported()).toBe(true);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it('fails closed without a camera API', () => {
    vi.stubGlobal('navigator', {});
    expect(barcodeCameraSupported()).toBe(false);
  });
});
