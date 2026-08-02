import { describe,expect,it } from 'vitest';
import { exerciseCatalog,searchExercises,supplementCatalog } from '../src/features/catalog';

describe('legacy catalogs',()=>{
  it('extracts and validates the complete baselines',()=>{expect(exerciseCatalog).toHaveLength(170);expect(supplementCatalog).toHaveLength(50);});
  it('searches exercises without mutating the catalog',()=>{const before=exerciseCatalog.length;expect(searchExercises('supino','pt').length).toBeGreaterThan(0);expect(exerciseCatalog).toHaveLength(before);});
});
