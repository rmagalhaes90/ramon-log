import { describe, expect, it } from 'vitest';
import { dosesTakenToday, normalizeTimes } from '../src/features/supplements/model';

describe('supplements', () => {
  it('normalizes unique valid times', () =>
    expect(normalizeTimes(['20:00', '08:00', '08:00', '99:00'])).toEqual(['08:00', '20:00']));
  it('counts scheduled and completed doses', () => {
    const supplements = [
      {
        id: 'creatine',
        name: 'Creatina',
        category: 'performance',
        times: ['08:00', '20:00'],
        custom: false,
      },
    ];
    expect(dosesTakenToday(supplements, { creatine: [true, false] })).toEqual({
      taken: 1,
      total: 2,
    });
  });
});
