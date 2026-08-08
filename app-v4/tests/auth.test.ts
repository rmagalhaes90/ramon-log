import { describe, expect, it } from 'vitest';
import { oauthStrategy, parseEmailAction, passwordIsStrong } from '../src/features/auth';

describe('authentication policy', () => {
  it('requires length, upper, lower and numeric characters', () => {
    expect(passwordIsStrong('StrongPassword1')).toBe(true);
    expect(passwordIsStrong('shortA1')).toBe(false);
    expect(passwordIsStrong('alllowercase1')).toBe(false);
    expect(passwordIsStrong('NOLOWERCASE1')).toBe(false);
    expect(passwordIsStrong('NoDigitsHere!')).toBe(false);
  });
});

describe('OAuth strategy', () => {
  it('uses popup when GitHub Pages and the Firebase helper are cross-site', () => {
    expect(oauthStrategy('rmagalhaes90.github.io', 'traincontrollog.firebaseapp.com')).toBe(
      'popup',
    );
  });

  it('uses redirect only when the auth helper is first-party', () => {
    expect(oauthStrategy('auth.kyro.app', 'auth.kyro.app')).toBe('redirect');
  });

  it('fails safely to popup when the auth domain is unavailable', () => {
    expect(oauthStrategy('rmagalhaes90.github.io')).toBe('popup');
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
