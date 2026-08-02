import { describe, expect, it } from 'vitest';
import { passwordIsStrong } from '../src/features/auth';

describe('authentication policy', () => {
  it('requires length, upper, lower and numeric characters', () => {
    expect(passwordIsStrong('StrongPassword1')).toBe(true);
    expect(passwordIsStrong('shortA1')).toBe(false);
    expect(passwordIsStrong('alllowercase1')).toBe(false);
    expect(passwordIsStrong('NOLOWERCASE1')).toBe(false);
    expect(passwordIsStrong('NoDigitsHere!')).toBe(false);
  });
});
