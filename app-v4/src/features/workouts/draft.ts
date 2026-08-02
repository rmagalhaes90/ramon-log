import type { User } from 'firebase/auth';
import { z } from 'zod';
import { exerciseSchema } from '../../domain/schemas';
import { cacheDelete, cacheGet, cacheSet } from '../../services/database';
import type { DayKey, ExerciseEntry } from './model';

const draftSetSchema=z.object({kg:z.number().finite().min(0).max(1000),reps:z.number().finite().int().min(0).max(1000),done:z.boolean()});
const draftSchema=z.object({day:z.enum(['domingo','segunda','terca','quarta','quinta','sexta','sabado']),startedAt:z.iso.datetime(),updatedAt:z.iso.datetime(),entries:z.array(z.object({exercise:exerciseSchema,sets:z.array(draftSetSchema).max(20)})).max(90)});
export type WorkoutDraft=z.infer<typeof draftSchema>;
const key=(uid:string,day:DayKey)=>`workout-draft:${uid}:${day}`;
export function parseWorkoutDraft(value:unknown):WorkoutDraft{return draftSchema.parse(value);}

export async function loadWorkoutDraft(user:User,day:DayKey,now=Date.now()):Promise<WorkoutDraft|null>{const value=await cacheGet<unknown>(key(user.uid,day));const result=draftSchema.safeParse(value);if(!result.success)return null;if(now-new Date(result.data.updatedAt).getTime()>24*60*60*1000){await cacheDelete(key(user.uid,day));return null;}return result.data;}
export async function saveWorkoutDraft(user:User,day:DayKey,startedAt:string,entries:ExerciseEntry[]):Promise<void>{await cacheSet(key(user.uid,day),parseWorkoutDraft({day,startedAt,updatedAt:new Date().toISOString(),entries}));}
export async function clearWorkoutDraft(user:User,day:DayKey):Promise<void>{await cacheDelete(key(user.uid,day));}
