import { describe, expect, it } from 'vitest';
import { entitlementsSchema } from '../src/features/subscriptions';

describe('server entitlements', () => {
  it('accepts known plans/features and rejects arbitrary premium flags', () => {
    expect(
      entitlementsSchema.parse({ plan: 'pro', status: 'active', features: ['progression'] }),
    ).toMatchObject({ plan: 'pro' });
    expect(() =>
      entitlementsSchema.parse({ plan: 'free', status: 'active', features: ['unlimited-admin'] }),
    ).toThrow();
  });
});
