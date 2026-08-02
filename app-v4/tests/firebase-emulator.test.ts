import { describe, expect, it } from 'vitest';
import { useFirebaseEmulators } from '../src/services/firebase';

describe('Firebase emulator safety', () => {
  it('does not connect to local emulators without explicit opt-in', () => {
    expect(useFirebaseEmulators()).toBe(false);
  });
});
