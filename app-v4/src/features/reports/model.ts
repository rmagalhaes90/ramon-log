import type { z } from 'zod';
import type { sessionLogSchema } from '../../domain/schemas';
type Session=z.infer<typeof sessionLogSchema>[number];

export function weeklyReport(sessions:Session[],now=new Date()){
  const end=new Date(now);end.setHours(23,59,59,999);const start=new Date(end);start.setDate(start.getDate()-6);start.setHours(0,0,0,0);const recent=sessions.filter((item)=>{const date=new Date(`${item.date}T12:00:00`);return date>=start&&date<=end;});
  return{sessions:recent.length,volume:recent.reduce((sum,item)=>sum+item.volume,0),exercises:recent.reduce((sum,item)=>sum+item.exerciseCount,0),minutes:recent.reduce((sum,item)=>sum+(item.durationSec??0),0)/60};
}

export function trainingStreak(sessions:Session[],today=new Date()):number{
  const days=new Set(sessions.map(({date})=>date));let streak=0;const cursor=new Date(today);cursor.setHours(12,0,0,0);for(let offset=0;offset<366;offset++){const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`;if(days.has(key)){streak++;cursor.setDate(cursor.getDate()-1);continue;}if(offset===0){cursor.setDate(cursor.getDate()-1);continue;}break;}return streak;
}

export function unlockedAchievements(totalSessions:number,totalVolume:number,streak:number):string[]{
  return[['first',totalSessions>=1],['ten',totalSessions>=10],['fifty',totalSessions>=50],['volume10k',totalVolume>=10000],['streak3',streak>=3],['streak7',streak>=7]].filter((entry)=>entry[1]).map((entry)=>String(entry[0]));
}
