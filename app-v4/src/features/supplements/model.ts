import type { UserSupplement } from '../../domain/schemas';

export function normalizeTimes(times:string[]):string[]{return [...new Set(times.filter((time)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))].sort().slice(0,10);}
export function dosesTakenToday(supplements:UserSupplement[],log:Record<string,boolean[]>):{taken:number;total:number}{
  let taken=0,total=0;for(const supplement of supplements){const doses=log[supplement.id]??[];total+=supplement.times.length;taken+=supplement.times.filter((_,index)=>doses[index]===true).length;}return{taken,total};
}
