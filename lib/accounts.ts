import { z } from 'zod';

export class AccessError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export type Identity = { id: string; email: string; name: string; role: 'admin' | 'user' };
type AccountRow = Identity & { active: number; password_hash: string; created: string };
export const Email = z.string().trim().toLowerCase().email().max(254);
export const Password = z.string().min(12).max(128);
export const UserInput = z.object({
  email: Email,
  name: z.string().trim().min(1).max(100),
  password: Password,
  role: z.enum(['admin', 'user']),
});
export const UserUpdate = UserInput.omit({ password: true }).extend({
  id: z.string().uuid(),
  active: z.boolean(),
  password: Password.optional(),
});
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string) {
  return hex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  );
}
export function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 100000,
          salt: new TextEncoder().encode(salt),
        },
        key,
        256,
      ),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomToken();
  return `pbkdf2-sha256$100000$${salt}$${await derive(password, salt)}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterations, salt, hash] = encoded.split('$');
  if (algorithm !== 'pbkdf2-sha256' || iterations !== '100000' || !salt || !hash) return false;
  return equal(await derive(password, salt), hash);
}
export function identity(row: Identity): Identity {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}
export function micros(amount: number) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000)
    throw new AccessError('Jumlah USD tidak valid.');
  return Math.ceil(amount * 1000000 - 1e-7);
}
export const GrantInput = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z
    .number()
    .positive()
    .max(1000000)
    .refine((n) => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 1e-6, 'Maksimal 6 desimal USD.'),
  note: z.string().trim().min(1).max(500),
});
// All balance arithmetic is integer micro-USD. Legacy estimates never debit new credit.
export const balanceSQL = `(COALESCE((SELECT SUM(amount_micros) FROM credit_grants WHERE user_id=users.id),0) - COALESCE((SELECT SUM(cost_micros) FROM ledger WHERE user_id=users.id AND status!='legacy'),0))`;
export async function balance(database: D1Database, userId: string) {
  const row = await database
    .prepare(`SELECT ${balanceSQL} AS balance FROM users WHERE id=?`)
    .bind(userId)
    .first<{ balance: number }>();
  if (!row) throw new AccessError('User tidak ditemukan.', 404);
  return row.balance / 1e6;
}
export async function reserveCredit(
  database: D1Database,
  userId: string,
  provider: 'x' | 'ai',
  amount: number,
  note: string,
) {
  const id = crypto.randomUUID();
  const cost = micros(amount);
  const row = await database
    .prepare(
      `INSERT INTO ledger(id,provider,cost,cost_micros,created,note,user_id,status)
    SELECT ?,?,?,?,?,?,id,'reserved' FROM users WHERE id=? AND active=1 AND ${balanceSQL}>=? RETURNING id`,
    )
    .bind(id, provider, cost / 1e6, cost, new Date().toISOString(), note, userId, cost)
    .first();
  if (!row)
    throw new AccessError(
      'Kredit tidak cukup untuk cadangan request ini, atau akun tidak aktif. Hubungi admin.',
      402,
    );
  return id;
}
export async function settleCredit(database: D1Database, id: string, amount: number) {
  const cost = micros(amount);
  await database
    .prepare(
      "UPDATE ledger SET cost=?,cost_micros=?,status='settled' WHERE id=? AND status='reserved'",
    )
    .bind(cost / 1e6, cost, id)
    .run();
}
export async function requireIdentity(
  database: D1Database,
  token: string | undefined,
  now = Date.now(),
): Promise<Identity> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AccessError('Silakan login.', 401);
  const row = await database
    .prepare(
      'SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>? AND active=1',
    )
    .bind(await digest(token), now)
    .first<AccountRow>();
  if (!row) throw new AccessError('Sesi berakhir atau akun tidak aktif. Silakan login.', 401);
  return identity(row);
}
export function requireAdmin(user: Identity) {
  if (user.role !== 'admin') throw new AccessError('Akses admin diperlukan.', 403);
}
export const SESSION_SECONDS = 12 * 60 * 60;
export async function createSession(database: D1Database, userId: string, expectedHash: string) {
  const token = randomToken();
  const result = await database.batch([
    database.prepare('DELETE FROM sessions WHERE expires<=?').bind(Date.now()),
    database
      .prepare(
        `INSERT INTO sessions(token_hash,user_id,expires) SELECT ?,id,? FROM users WHERE id=? AND active=1 AND password_hash=? RETURNING token_hash`,
      )
      .bind(await digest(token), Date.now() + SESSION_SECONDS * 1000, userId, expectedHash),
  ]);
  if (!result[1].results.length)
    throw new AccessError('Akun berubah saat login. Silakan login ulang.', 401);
  return token;
}
export async function throttle(database: D1Database, keys: string[], now = Date.now()) {
  const window = Math.floor(now / (15 * 60 * 1000));
  const rows = await database.batch(
    keys.map((key) =>
      database
        .prepare(
          `INSERT INTO auth_attempts(key,window,attempts) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET window=excluded.window, attempts=CASE WHEN auth_attempts.window=excluded.window THEN auth_attempts.attempts+1 ELSE 1 END RETURNING attempts`,
        )
        .bind(key, window),
    ),
  );
  if (rows.some((r) => Number((r.results[0] as { attempts: number }).attempts) > 10))
    throw new AccessError('Terlalu banyak percobaan. Coba lagi dalam 15 menit.', 429);
  await database
    .prepare('DELETE FROM auth_attempts WHERE window<?')
    .bind(window - 1)
    .run();
}
export async function login(database: D1Database, email: string, password: string) {
  const row = await database
    .prepare('SELECT * FROM users WHERE email=?')
    .bind(email)
    .first<AccountRow>();
  // Equal work for missing accounts to reduce email enumeration timing differences.
  const valid = await verifyPassword(
    password,
    row?.password_hash || 'pbkdf2-sha256$100000$missing-account-salt$' + '0'.repeat(64),
  );
  if (!row || !valid || !row.active)
    throw new AccessError('Email atau password salah, atau akun tidak aktif.', 401);
  return { user: identity(row), token: await createSession(database, row.id, row.password_hash) };
}
export async function setupAdmin(database: D1Database, input: z.infer<typeof UserInput>) {
  const id = crypto.randomUUID();
  const hash = await hashPassword(input.password);
  const result = await database.batch([
    database
      .prepare(
        `INSERT INTO users(id,email,name,password_hash,role,created) SELECT ?,?,?,?,'admin',? WHERE NOT EXISTS(SELECT 1 FROM users) RETURNING id`,
      )
      .bind(id, input.email, input.name, hash, new Date().toISOString()),
    ...['runs', 'outcomes', 'ledger'].map((table) =>
      database
        .prepare(
          `UPDATE ${table} SET user_id=? WHERE user_id IS NULL AND EXISTS(SELECT 1 FROM users WHERE id=?)`,
        )
        .bind(id, id),
    ),
  ]);
  if (!result[0].results.length)
    throw new AccessError('Setup sudah selesai. Registrasi publik tidak tersedia.', 409);
  return {
    user: { id, email: input.email, name: input.name, role: 'admin' as const },
    token: await createSession(database, id, hash),
  };
}
export async function addUser(
  database: D1Database,
  actor: Identity,
  input: z.infer<typeof UserInput>,
) {
  requireAdmin(actor);
  const id = crypto.randomUUID();
  const exists = await database
    .prepare('SELECT id FROM users WHERE email=?')
    .bind(input.email)
    .first();
  if (exists) throw new AccessError('Email sudah digunakan.', 409);
  try {
    await database
      .prepare('INSERT INTO users(id,email,name,password_hash,role,created) VALUES(?,?,?,?,?,?)')
      .bind(
        id,
        input.email,
        input.name,
        await hashPassword(input.password),
        input.role,
        new Date().toISOString(),
      )
      .run();
  } catch {
    throw new AccessError('User gagal dibuat; periksa apakah email sudah digunakan.', 409);
  }
  return id;
}
export async function updateUser(
  database: D1Database,
  actor: Identity,
  input: z.infer<typeof UserUpdate>,
) {
  requireAdmin(actor);
  if (input.id === actor.id && (!input.active || input.role !== 'admin'))
    throw new AccessError('Tidak dapat menonaktifkan atau menurunkan role sendiri.');
  const old = await database
    .prepare('SELECT * FROM users WHERE id=?')
    .bind(input.id)
    .first<AccountRow>();
  if (!old) throw new AccessError('User tidak ditemukan.', 404);
  const duplicate = await database
    .prepare('SELECT id FROM users WHERE email=? AND id!=?')
    .bind(input.email, input.id)
    .first();
  if (duplicate) throw new AccessError('Email sudah digunakan.', 409);
  const hash = input.password ? await hashPassword(input.password) : null;
  const demoting = !input.active || input.role !== 'admin';
  const queries = [
    database
      .prepare(
        `UPDATE users SET email=?,name=?,role=?,active=?,password_hash=COALESCE(?,password_hash) WHERE id=?
    AND (role!='admin' OR active=0 OR ?=0 OR (SELECT COUNT(*) FROM users WHERE role='admin' AND active=1)>1) RETURNING id`,
      )
      .bind(
        input.email,
        input.name,
        input.role,
        Number(input.active),
        hash,
        input.id,
        Number(demoting),
      ),
  ];
  // Every edit revokes sessions, including role changes and password resets.
  queries.push(
    database
      .prepare(
        `DELETE FROM sessions WHERE user_id=? AND EXISTS(
    SELECT 1 FROM users WHERE id=? AND email=? AND name=? AND role=? AND active=?
  )`,
      )
      .bind(input.id, input.id, input.email, input.name, input.role, Number(input.active)),
  );
  const result = await database.batch(queries);
  if (!result[0].results.length)
    throw new AccessError('Admin aktif terakhir harus tetap tersedia.', 409);
}
export async function grantCredit(
  database: D1Database,
  actor: Identity,
  input: z.infer<typeof GrantInput>,
) {
  requireAdmin(actor);
  const row = await database
    .prepare(
      `INSERT INTO credit_grants(id,user_id,actor_id,amount_micros,note,created)
    SELECT ?,id,?,?,?,? FROM users WHERE id=? ON CONFLICT(id) DO NOTHING RETURNING id`,
    )
    .bind(
      input.id,
      actor.id,
      micros(input.amount),
      input.note,
      new Date().toISOString(),
      input.userId,
    )
    .first();
  if (row) return;
  const existing = await database
    .prepare('SELECT * FROM credit_grants WHERE id=?')
    .bind(input.id)
    .first<{ user_id: string; actor_id: string; amount_micros: number; note: string }>();
  if (
    existing &&
    existing.user_id === input.userId &&
    existing.actor_id === actor.id &&
    existing.amount_micros === micros(input.amount) &&
    existing.note === input.note
  )
    return;
  if (existing)
    throw new AccessError(
      'ID kredit sudah digunakan untuk transaksi lain. Refresh halaman sebelum transaksi baru.',
      409,
    );
  throw new AccessError('User tidak ditemukan.', 404);
}
export async function adminState(database: D1Database, actor: Identity) {
  requireAdmin(actor);
  const [users, usage, grants, ledger] = await Promise.all([
    database
      .prepare(
        `SELECT id,email,name,role,active,created,${balanceSQL}/1000000.0 AS balance,
      COALESCE((SELECT SUM(amount_micros)/1000000.0 FROM credit_grants WHERE user_id=users.id),0) AS granted,
      COALESCE((SELECT SUM(cost_micros)/1000000.0 FROM ledger WHERE user_id=users.id AND provider='x'),0) AS x,
      COALESCE((SELECT SUM(cost_micros)/1000000.0 FROM ledger WHERE user_id=users.id AND provider='ai'),0) AS ai,
      COALESCE((SELECT SUM(cost_micros)/1000000.0 FROM ledger WHERE user_id=users.id AND status='reserved'),0) AS reserved
      FROM users ORDER BY created DESC`,
      )
      .all(),
    database
      .prepare(
        'SELECT provider,status,SUM(cost_micros)/1000000.0 AS total,COUNT(*) AS requests FROM ledger GROUP BY provider,status',
      )
      .all(),
    database
      .prepare(
        `SELECT g.id,g.user_id,u.email,g.amount_micros/1000000.0 AS amount,g.note,g.created,a.email AS actor
      FROM credit_grants g JOIN users u ON u.id=g.user_id JOIN users a ON a.id=g.actor_id ORDER BY g.created DESC LIMIT 100`,
      )
      .all(),
    database
      .prepare(
        `SELECT l.id,u.email,l.provider,l.cost_micros/1000000.0 AS cost,l.status,l.note,l.created
      FROM ledger l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created DESC LIMIT 100`,
      )
      .all(),
  ]);
  return {
    users: users.results,
    usage: usage.results,
    grants: grants.results,
    ledger: ledger.results,
    user: actor,
  };
}
