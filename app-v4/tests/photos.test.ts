import { describe, expect, it } from 'vitest';
import {
  comparisonReady,
  MAX_PHOTO_BYTES,
  photoFileName,
  validatePhoto,
} from '../src/features/photos/model';

describe('progress photos', () => {
  it('accepts bounded JPEG files and rejects unsafe formats', () => {
    expect(
      validatePhoto({ name: 'progress.jpg', type: 'image/jpeg', size: MAX_PHOTO_BYTES }),
    ).toBeNull();
    expect(validatePhoto({ name: 'progress.png', type: 'image/png', size: 10 })).toBe('photoType');
    expect(
      validatePhoto({ name: 'large.jpg', type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1 }),
    ).toBe('photoSize');
  });

  it('uses opaque identifiers and requires exactly two comparison photos', () => {
    expect(photoFileName('abc-123')).toBe('abc-123.jpg');
    expect(comparisonReady(new Set(['a', 'b']))).toBe(true);
    expect(comparisonReady(new Set(['a']))).toBe(false);
  });
});
