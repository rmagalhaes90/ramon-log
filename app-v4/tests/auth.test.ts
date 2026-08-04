import { describe, expect, it } from 'vitest';
import { parseEmailAction, passwordIsStrong } from '../src/features/auth';

describe('authentication policy', () => {
  it('requires length, upper, lower and numeric characters', () => {
    expect(passwordIsStrong('StrongPassword1')).toBe(true);
    expect(passwordIsStrong('shortA1')).toBe(false);
    expect(passwordIsStrong('alllowercase1')).toBe(false);
    expect(passwordIsStrong('NOLOWERCASE1')).toBe(false);
    expect(passwordIsStrong('NoDigitsHere!')).toBe(false);
  });
});

describe('email action links', () => {
  it('accepts supported Firebase actions', () => {
    expect(parseEmailAction('?mode=verifyEmail&oobCode=abc123')).toEqual({
      mode: 'verifyEmail',
      code: 'abc123',
    });
  });

  it('rejects missing codes and unsupported actions', () => {
    expect(parseEmailAction('?mode=verifyEmail')).toBeNull();
    expect(parseEmailAction('?mode=signIn&oobCode=abc123')).toBeNull();
  });
});
