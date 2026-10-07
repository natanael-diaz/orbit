import {env} from 'cloudflare:workers';
import type {Run,Dataset,Analysis,Mode} from './domain';
export function db(){if(!env.DB)throw Error('Database belum siap. Jalankan npm run db:local.');return env.DB}
export const secrets=()=>({x:env.X_BEARER_TOKEN||'',ai:env.OPENAI_API_KEY||''});
export async function state(){const [r,o,l]=await Promise.all([db().prepare('SELECT * FROM runs ORDER BY created DESC LIMIT 100').all(),db().prepare('SELECT * FROM outcomes ORDER BY created DESC').all(),db().prepare('SELECT provider,SUM(cost) total FROM ledger GROUP BY provider').all()]);return {runs:r.results.map(parseRun),outcomes:o.results.map((x:any)=>({id:x.id,created:x.created,...JSON.parse(x.payload)})),usage:l.results,configured:{x:!!secrets().x,ai:!!secrets().ai}}}
export function parseRun(x:any):Run{return {...x,payload:JSON.parse(x.payload),analysis:x.analysis?JSON.parse(x.analysis):null}}
export async function getRun(id:string){const row=await db().prepare('SELECT * FROM runs WHERE id=?').bind(id).first();if(!row)throw Error('Riset tidak ditemukan.');return parseRun(row)}
export async function saveRun(mode:Mode,target:string,source:string,payload:Dataset,analysis:Analysis|null=null){const id=crypto.randomUUID();await db().prepare('INSERT INTO runs(id,mode,target,source,created,payload,analysis) VALUES(?,?,?,?,?,?,?)').bind(id,mode,target,source,new Date().toISOString(),JSON.stringify(payload),analysis?JSON.stringify(analysis):null).run();return id}
export async function reserve(provider:'x'|'ai',amount:number,note:string){const id=crypto.randomUUID();await db().prepare('INSERT INTO ledger(id,provider,cost,created,note) VALUES(?,?,?,?,?)').bind(id,provider,amount,new Date().toISOString(),note).run();return id}
export async function settle(id:string,cost:number){await db().prepare('UPDATE ledger SET cost=? WHERE id=?').bind(cost,id).run()}
