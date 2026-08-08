import { describe, expect, it } from 'vitest';
import { resetKeys } from '../src/features/settings/reset';
describe('selective reset', () => {
  it('keeps destructive scopes explicit and disjoint', () => {
    const groups = Object.values(resetKeys);
    expect(new Set(groups.flat()).size).toBe(groups.flat().length);
    expect(resetKeys.training).toContain('workouts');
    expect(resetKeys.progress).not.toContain('photoIndex');
  });
});
