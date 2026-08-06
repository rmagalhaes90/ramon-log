import { describe, expect, it } from 'vitest';
import {
  createTemplate,
  moveExercise,
  pickExercises,
  reorderExercise,
} from '../src/features/workouts/templates';
import { trainingStreak, unlockedAchievements, weeklyReport } from '../src/features/reports/model';
import { sessionsCsv } from '../src/features/backup/csv';

describe('templates reports and CSV', () => {
  it('builds bounded plans and reorders without mutation', () => {
    const plan = createTemplate('ppl');
    expect(Object.keys(plan)).toHaveLength(6);
    expect(plan.segunda?.exercises.length).toBeGreaterThan(0);
    const moved = moveExercise(plan, 'segunda', 0, 1);
    expect(moved.segunda?.exercises[1]?.name).toBe(plan.segunda?.exercises[0]?.name);
    expect(pickExercises(['chest'], 3)).toHaveLength(3);
  });
  it('varies exercises across repeated days of the same template', () => {
    const fullbody = createTemplate('fullbody');
    const a = fullbody.segunda?.exercises.map((item) => item.name).join(',');
    const b = fullbody.quarta?.exercises.map((item) => item.name).join(',');
    const c = fullbody.sexta?.exercises.map((item) => item.name).join(',');
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    const ppl = createTemplate('ppl');
    expect(ppl.segunda?.exercises.map((item) => item.name).join(',')).not.toBe(
      ppl.quinta?.exercises.map((item) => item.name).join(','),
    );
  });
  it('builds the new five-day templates with sensible day counts', () => {
    expect(Object.keys(createTemplate('pplUpperLower'))).toHaveLength(5);
    expect(Object.keys(createTemplate('broSplit'))).toHaveLength(5);
    expect(Object.keys(createTemplate('fullBody5x'))).toHaveLength(5);
    const broSplit = createTemplate('broSplit');
    expect(broSplit.segunda?.exercises.length).toBeGreaterThan(0);
    expect(broSplit.terca?.exercises.length).toBeGreaterThan(0);
  });
  it('drags exercises to an arbitrary position without mutating the source', () => {
    const plan = createTemplate('ppl');
    const originalFirst = plan.segunda?.exercises[0]?.name;
    const originalLast = plan.segunda?.exercises.at(-1)?.name;
    const lastIndex = (plan.segunda?.exercises.length ?? 1) - 1;
    const dragged = reorderExercise(plan, 'segunda', 0, lastIndex);
    expect(dragged.segunda?.exercises.at(-1)?.name).toBe(originalFirst);
    expect(plan.segunda?.exercises[0]?.name).toBe(originalFirst);
    expect(dragged.segunda?.exercises).toHaveLength(plan.segunda?.exercises.length ?? 0);
    expect(reorderExercise(plan, 'segunda', 0, 0).segunda?.exercises[0]?.name).toBe(originalFirst);
    expect(reorderExercise(plan, 'segunda', -1, 1)).toBe(plan);
    expect(reorderExercise(plan, 'segunda', 0, 99)).toBe(plan);
    expect(reorderExercise(plan, 'domingo', 0, 1)).toBe(plan);
    expect(originalLast).toBeDefined();
  });
  it('calculates weekly totals streaks and achievements', () => {
    const sessions = [
      {
        id: 'a',
        date: '2026-08-02',
        day: 'domingo',
        title: 'A',
        startedAt: null,
        endedAt: null,
        durationSec: 1800,
        volume: 6000,
        exerciseCount: 5,
      },
      {
        id: 'b',
        date: '2026-08-01',
        day: 'sabado',
        title: 'B',
        startedAt: null,
        endedAt: null,
        durationSec: 1200,
        volume: 5000,
        exerciseCount: 4,
      },
    ];
    expect(weeklyReport(sessions, new Date('2026-08-02T12:00:00')).volume).toBe(11000);
    expect(trainingStreak(sessions, new Date('2026-08-02T12:00:00'))).toBe(2);
    expect(unlockedAchievements(10, 11000, 3)).toEqual(['first', 'ten', 'volume10k', 'streak3']);
  });
  it('escapes spreadsheet formulas as inert CSV text boundaries', () => {
    const output = sessionsCsv([
      {
        date: '2026-08-02',
        day: 'sun',
        title: '=A, "B"',
        durationSec: 60,
        volume: 10,
        exerciseCount: 1,
      },
    ]);
    expect(output).toContain('"\'=A, ""B"""');
    expect(output.startsWith('\uFEFF')).toBe(true);
  });
});
