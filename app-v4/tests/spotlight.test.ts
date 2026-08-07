import { describe, expect, it } from 'vitest';
import { shouldShowRoutineSpotlight } from '../src/core/spotlight';

describe('shouldShowRoutineSpotlight', () => {
  it('shows once the tour is done, the user has no routine yet, and it was never dismissed', () => {
    expect(
      shouldShowRoutineSpotlight({ tourDone: true, spotlightDone: false, hasRoutine: false }),
    ).toBe(true);
  });

  it('stays hidden until the intro tour is finished', () => {
    expect(
      shouldShowRoutineSpotlight({ tourDone: false, spotlightDone: false, hasRoutine: false }),
    ).toBe(false);
  });

  it('stays hidden once the user already has a routine', () => {
    expect(
      shouldShowRoutineSpotlight({ tourDone: true, spotlightDone: false, hasRoutine: true }),
    ).toBe(false);
  });

  it('stays hidden after being dismissed once', () => {
    expect(
      shouldShowRoutineSpotlight({ tourDone: true, spotlightDone: true, hasRoutine: false }),
    ).toBe(false);
  });
});
