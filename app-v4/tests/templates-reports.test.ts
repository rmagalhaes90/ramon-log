import { describe,expect,it } from 'vitest';
import { createTemplate,moveExercise,pickExercises } from '../src/features/workouts/templates';
import { trainingStreak,unlockedAchievements,weeklyReport } from '../src/features/reports/model';
import { sessionsCsv } from '../src/features/backup/csv';

describe('templates reports and CSV',()=>{
  it('builds bounded plans and reorders without mutation',()=>{const plan=createTemplate('ppl');expect(Object.keys(plan)).toHaveLength(6);expect(plan.segunda?.exercises.length).toBeGreaterThan(0);const moved=moveExercise(plan,'segunda',0,1);expect(moved.segunda?.exercises[1]?.name).toBe(plan.segunda?.exercises[0]?.name);expect(pickExercises(['chest'],3)).toHaveLength(3);});
  it('calculates weekly totals streaks and achievements',()=>{const sessions=[{id:'a',date:'2026-08-02',day:'domingo',title:'A',startedAt:null,endedAt:null,durationSec:1800,volume:6000,exerciseCount:5},{id:'b',date:'2026-08-01',day:'sabado',title:'B',startedAt:null,endedAt:null,durationSec:1200,volume:5000,exerciseCount:4}];expect(weeklyReport(sessions,new Date('2026-08-02T12:00:00')).volume).toBe(11000);expect(trainingStreak(sessions,new Date('2026-08-02T12:00:00'))).toBe(2);expect(unlockedAchievements(10,11000,3)).toEqual(['first','ten','volume10k','streak3']);});
  it('escapes spreadsheet formulas as inert CSV text boundaries',()=>{const output=sessionsCsv([{date:'2026-08-02',day:'sun',title:'=A, "B"',durationSec:60,volume:10,exerciseCount:1}]);expect(output).toContain('"\'=A, ""B"""');expect(output.startsWith('\uFEFF')).toBe(true);});
});
