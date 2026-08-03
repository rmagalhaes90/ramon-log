import { describe, expect, it } from 'vitest';
import { hasRemoteConflict, unwrapQueuedPayload } from '../src/services/user-data';

describe('multi-device conflict protection', () => {
  it('detects a newer divergent cloud version', () => {
    expect(
      hasRemoteConflict(
        '2026-08-03T12:01:00.000Z',
        '2026-08-03T12:00:00.000Z',
        { value: 'cloud' },
        { value: 'local' },
      ),
    ).toBe(true);
    expect(
      hasRemoteConflict(
        '2026-08-03T12:01:00.000Z',
        '2026-08-03T12:00:00.000Z',
        { value: 'same' },
        { value: 'same' },
      ),
    ).toBe(false);
  });

  it('does not invent conflicts without a known base revision', () => {
    expect(hasRemoteConflict('2026-08-03T12:01:00.000Z', undefined, {}, {})).toBe(false);
    expect(
      unwrapQueuedPayload(
        {
          value: [],
          updatedAt: '2026-08-03T12:02:00.000Z',
          baseUpdatedAt: '2026-08-03T12:00:00.000Z',
        },
        1,
      ),
    ).toEqual({
      value: [],
      updatedAt: '2026-08-03T12:02:00.000Z',
      baseUpdatedAt: '2026-08-03T12:00:00.000Z',
    });
  });
});
