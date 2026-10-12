import type { Run, Dataset, Analysis, Mode } from './domain';

type StoredRun = Omit<Run, 'payload' | 'analysis'> & { payload: string; analysis: string | null };
type StoredOutcome = { id: string; created: string; payload: string };
export function parseRun(row: StoredRun): Run {
  return {
    id: row.id,
    mode: row.mode,
    target: row.target,
    source: row.source,
    created: row.created,
    payload: JSON.parse(row.payload),
    analysis: row.analysis ? JSON.parse(row.analysis) : null,
  };
}
export async function researchState(database: D1Database, userId: string) {
  const [runs, outcomes, usage, ledger] = await Promise.all([
    database
      .prepare('SELECT * FROM runs WHERE user_id=? ORDER BY created DESC LIMIT 100')
      .bind(userId)
      .all<StoredRun>(),
    database
      .prepare('SELECT * FROM outcomes WHERE user_id=? ORDER BY created DESC')
      .bind(userId)
      .all<StoredOutcome>(),
    database
      .prepare(
        'SELECT provider,SUM(cost_micros)/1000000.0 AS total FROM ledger WHERE user_id=? GROUP BY provider',
      )
      .bind(userId)
      .all(),
    database
      .prepare(
        'SELECT id,provider,cost_micros/1000000.0 AS cost,status,created,note FROM ledger WHERE user_id=? ORDER BY created DESC LIMIT 100',
      )
      .bind(userId)
      .all(),
  ]);
  return {
    runs: runs.results.map(parseRun),
    outcomes: outcomes.results.map((row) => ({
      ...JSON.parse(row.payload),
      id: row.id,
      created: row.created,
    })),
    usage: usage.results,
    ledger: ledger.results,
  };
}
export async function readRun(database: D1Database, userId: string, id: string) {
  const row = await database
    .prepare('SELECT * FROM runs WHERE id=? AND user_id=?')
    .bind(id, userId)
    .first<StoredRun>();
  if (!row) throw Error('Riset tidak ditemukan.');
  return parseRun(row);
}
export async function insertRun(
  database: D1Database,
  userId: string,
  mode: Mode,
  target: string,
  source: string,
  payload: Dataset,
  analysis: Analysis | null = null,
) {
  const id = crypto.randomUUID();
  await database
    .prepare(
      'INSERT INTO runs(id,mode,target,source,created,payload,analysis,user_id) VALUES(?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      mode,
      target,
      source,
      new Date().toISOString(),
      JSON.stringify(payload),
      analysis ? JSON.stringify(analysis) : null,
      userId,
    )
    .run();
  return id;
}
export async function writeAnalysis(
  database: D1Database,
  userId: string,
  id: string,
  analysis: Analysis,
) {
  await database
    .prepare('UPDATE runs SET analysis=? WHERE id=? AND user_id=?')
    .bind(JSON.stringify(analysis), id, userId)
    .run();
}
export async function writeOutcome(
  database: D1Database,
  userId: string,
  input: unknown,
  id?: string,
) {
  if (id) {
    const row = await database
      .prepare('UPDATE outcomes SET payload=? WHERE id=? AND user_id=? RETURNING id')
      .bind(JSON.stringify(input), id, userId)
      .first();
    if (!row) throw Error('Catatan tidak ditemukan.');
  } else {
    await database
      .prepare('INSERT INTO outcomes(id,created,payload,user_id) VALUES(?,?,?,?)')
      .bind(crypto.randomUUID(), new Date().toISOString(), JSON.stringify(input), userId)
      .run();
  }
}
export async function deleteOwned(
  database: D1Database,
  userId: string,
  table: 'runs' | 'outcomes',
  id: string,
) {
  await database.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(id, userId).run();
}
