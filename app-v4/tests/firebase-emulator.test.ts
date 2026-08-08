import { describe, expect, it } from 'vitest';
import { useFirebaseEmulators } from '../src/services/firebase';
import { firebaseConfig } from '../src/services/firebase-config';

describe('Firebase emulator safety', () => {
  it('does not connect to local emulators without explicit opt-in', () => {
    expect(useFirebaseEmulators()).toBe(false);
    expect(firebaseConfig.projectId).toBe('traincontrollog');
  });
});
