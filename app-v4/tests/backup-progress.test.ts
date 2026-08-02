import { describe, expect, it } from 'vitest';
import { parseBackup } from '../src/features/backup';
import { chartPoints } from '../src/features/progress/chart';

describe('backup and progress charts', () => {
  it('validates a strict versioned backup and rejects unknown payloads', () => {
    const valid={format:'kyro-v4-backup',version:1,exportedAt:'2026-08-02T12:00:00.000Z',data:{bodyWeights:[{d:'2026-08-02',kg:80}]}};
    expect(parseBackup(JSON.stringify(valid)).data.bodyWeights).toHaveLength(1);
    expect(()=>parseBackup(JSON.stringify({...valid,data:{admin:true}}))).toThrow('backupInvalid');
    expect(()=>parseBackup('{oops')).toThrow('backupInvalid');
  });

  it('produces bounded chronological SVG points without NaN', () => {
    expect(chartPoints([{d:'2026-08-02',value:80},{d:'2026-08-01',value:80}],100,50)).toEqual([
      {d:'2026-08-01',value:80,x:0,y:50},{d:'2026-08-02',value:80,x:100,y:50},
    ]);
  });
});
