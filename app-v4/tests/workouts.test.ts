import { describe, expect, it } from 'vitest';
import { completedExerciseCount, createEntries, dateKey, workoutVolume } from '../src/features/workouts/model';

describe('workouts', () => {
  const workouts = { segunda: { title: 'Push', titleEn: '', cardioNote: '', abs: [], exercises: [{ name:'Supino', sets:2, reps:'10', rest:90, equipment:'barbell' as const, muscles:{ chest:1 }, videoUrl:'', notes:'' }] } };
  it('creates one entry per configured set', () => { expect(createEntries(workouts, 'segunda')[0]?.sets).toHaveLength(2); });
  it('calculates volume using completed sets only', () => {
    const entries = createEntries(workouts, 'segunda'); const first = entries[0]; if (!first) throw new Error('fixture');
    first.sets[0] = { kg:100, reps:5, done:true }; first.sets[1] = { kg:100, reps:5, done:false };
    expect(workoutVolume(entries)).toBe(500); expect(completedExerciseCount(entries)).toBe(1);
  });
  it('formats local dates without UTC drift', () => { expect(dateKey(new Date(2026, 7, 2, 23, 0))).toBe('2026-08-02'); });
});
