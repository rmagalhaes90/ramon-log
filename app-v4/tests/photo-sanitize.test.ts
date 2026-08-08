import { describe, expect, it } from 'vitest';
import { fittedPhotoSize } from '../src/features/photos/sanitize';

describe('photo sanitization sizing', () => {
  it('preserves aspect ratio and bounds the longest edge', () => {
    expect(fittedPhotoSize(4000, 3000)).toEqual({ width: 2560, height: 1920 });
    expect(fittedPhotoSize(1200, 1600)).toEqual({ width: 1200, height: 1600 });
  });
});
