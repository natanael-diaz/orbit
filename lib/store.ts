import { env } from 'cloudflare:workers';
import type { Dataset, Analysis, Mode } from './domain';
import { reserveCredit, settleCredit } from './accounts';
import { personalCredit } from './credit-store';
import {
  researchState,
  readRun,
  insertRun,
  writeAnalysis,
  writeOutcome,
  deleteOwned,
} from './research-store';
export function db() {
  if (!env.DB) throw Error('Database belum siap. Jalankan pnpm run db:local.');
  return env.DB;
}
export const secrets = () => ({ x: env.X_BEARER_TOKEN || '', ai: env.OPENAI_API_KEY || '' });
export const aiModel = () => env.OPENAI_MODEL || 'gpt-5.4-mini';
export const aiEndpoint = () =>
  (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
export async function state(userId: string) {
  const [research, credit] = await Promise.all([
    researchState(db(), userId),
    personalCredit(db(), userId),
  ]);
  return {
    ...research,
    credit,
    balance: credit.balance,
    configured: { x: !!secrets().x, ai: !!secrets().ai },
  };
}
export const getRun = (userId: string, id: string) => readRun(db(), userId, id);
export const saveRun = (
  userId: string,
  mode: Mode,
  target: string,
  source: string,
  payload: Dataset,
  analysis: Analysis | null = null,
) => insertRun(db(), userId, mode, target, source, payload, analysis);
export const saveAnalysis = (userId: string, id: string, analysis: Analysis) =>
  writeAnalysis(db(), userId, id, analysis);
export const saveOutcome = (userId: string, payload: unknown, id?: string) =>
  writeOutcome(db(), userId, payload, id);
export const deleteRun = (userId: string, id: string) => deleteOwned(db(), userId, 'runs', id);
export const deleteOutcome = (userId: string, id: string) =>
  deleteOwned(db(), userId, 'outcomes', id);
export const reserve = (userId: string, provider: 'x' | 'ai', amount: number, note: string) =>
  reserveCredit(db(), userId, provider, amount, note);
export const settle = (id: string, cost: number) => settleCredit(db(), id, cost);
