import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './d1-fixture.mjs';
import {
  UserInput,
  UserUpdate,
  GrantInput,
  hashPassword,
  createSession,
  verifyPassword,
  digest,
  setupAdmin,
  login,
  requireIdentity,
  requireAdmin,
  addUser,
  updateUser,
  grantCredit,
  balance,
  reserveCredit,
  settleCredit,
  adminState,
  throttle,
  micros,
} from '../lib/accounts.ts';
import {
  researchState,
  insertRun,
  readRun,
  writeAnalysis,
  writeOutcome,
  deleteOwned,
} from '../lib/research-store.ts';
const password = 'synthetic-password-only';
const input = (email = 'admin@example.test', role = 'admin') =>
  UserInput.parse({ email, name: 'Test User', password, role });
async function setup(options) {
  const { database, sqlite } = fixture(options);
  const admin = await setupAdmin(database, input());
  const userId = await addUser(database, admin.user, input('user@example.test', 'user'));
  const user = { id: userId, email: 'user@example.test', name: 'Test User', role: 'user' };
  return { database, sqlite, admin, user };
}
const grant = (userId, amount = 3) =>
  GrantInput.parse({ id: crypto.randomUUID(), userId, amount, note: 'synthetic test credit' });

test('password hashing uses distinct salts, rejects wrong passwords and schema normalizes email', async () => {
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(!a.includes(password));
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('wrong', a), false);
  assert.equal(await verifyPassword(password, 'invalid'), false);
  assert.equal(input(' ADMIN@EXAMPLE.TEST ').email, 'admin@example.test');
  assert.equal(UserInput.safeParse({ ...input(), password: 'short' }).success, false);
});
test('one-time admin setup preserves and adopts legacy rows without charging new balance', async () => {
  const { database, sqlite } = fixture({ legacy: true });
  const admin = await setupAdmin(database, input());
  assert.equal((await researchState(database, admin.user.id)).runs[0].id, 'old-run');
  assert.equal((await researchState(database, admin.user.id)).usage[0].total, 0.123456);
  assert.equal(await balance(database, admin.user.id), 0);
  await assert.rejects(setupAdmin(database, input('other@example.test')), /Setup sudah selesai/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
  assert.equal(sqlite.prepare('SELECT user_id FROM ledger').get().user_id, admin.user.id);
});
test('login requires correct active account; opaque session is hashed, expires and roles are checked', async () => {
  const { database, sqlite, user } = await setup();
  const result = await login(database, user.email, password);
  const stored = sqlite
    .prepare('SELECT token_hash,expires FROM sessions WHERE user_id=?')
    .get(user.id);
  assert.notEqual(stored.token_hash, result.token);
  assert.equal(stored.token_hash, await digest(result.token));
  assert.deepEqual(await requireIdentity(database, result.token), user);
  await assert.rejects(requireIdentity(database, result.token, stored.expires), /Sesi berakhir/);
  await assert.rejects(requireIdentity(database, undefined), /login/);
  await assert.rejects(login(database, user.email, 'bad'), /Email atau password/);
  await assert.rejects(login(database, 'missing@example.test', password), /Email atau password/);
  assert.throws(() => requireAdmin(user), /admin/);
  sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(user.id);
  await assert.rejects(requireIdentity(database, result.token), /Sesi berakhir/);
  await assert.rejects(login(database, user.email, password), /Email atau password/);
});
test('create/update/deactivate enforce roles, duplicates and session revocation without deleting history', async () => {
  const { database, sqlite, admin, user } = await setup();
  await assert.rejects(addUser(database, user, input('extra@example.test')), /admin/);
  await assert.rejects(addUser(database, admin.user, input(user.email)), /Email sudah/);
  const logged = await login(database, user.email, password);
  const previousHash = sqlite
    .prepare('SELECT password_hash FROM users WHERE id=?')
    .get(user.id).password_hash;
  await updateUser(
    database,
    admin.user,
    UserUpdate.parse({ ...user, active: false, password: 'new-synthetic-password' }),
  );
  await assert.rejects(requireIdentity(database, logged.token), /Sesi berakhir/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM users').get().n, 2);
  await assert.rejects(createSession(database, user.id, previousHash), /Akun berubah/);
  await assert.rejects(
    updateUser(database, admin.user, UserUpdate.parse({ ...admin.user, active: false })),
    /sendiri/,
  );
  await assert.rejects(
    updateUser(
      database,
      admin.user,
      UserUpdate.parse({ ...admin.user, role: 'user', active: true }),
    ),
    /sendiri/,
  );
  await assert.rejects(
    updateUser(
      database,
      { ...user, role: 'admin' },
      UserUpdate.parse({ ...admin.user, active: false }),
    ),
    /Admin aktif terakhir/,
  );
  await updateUser(database, admin.user, UserUpdate.parse({ ...user, active: true }));
  await assert.rejects(createSession(database, user.id, previousHash), /Akun berubah/);
  await assert.rejects(login(database, user.email, password), /Email atau password/);
  assert.ok((await login(database, user.email, 'new-synthetic-password')).token);
});
test('shared $3 funds X and AI; unused reserves refund once, zero-cost rejects refund fully', async () => {
  const { database, admin, user } = await setup();
  await grantCredit(database, admin.user, grant(user.id));
  const x = await reserveCredit(database, user.id, 'x', 1.5, 'test X');
  const ai = await reserveCredit(database, user.id, 'ai', 0.2, 'test AI');
  assert.equal(await balance(database, user.id), 1.3);
  await settleCredit(database, x, 0.5);
  await settleCredit(database, ai, 0.1);
  assert.equal(await balance(database, user.id), 2.4);
  await settleCredit(database, x, 0); // Duplicate settlement cannot refund already billed work.
  assert.equal(await balance(database, user.id), 2.4);
  const rejected = await reserveCredit(database, user.id, 'ai', 0.1, 'provider rejected');
  await settleCredit(database, rejected, 0);
  assert.equal(await balance(database, user.id), 2.4);
  const summary = await adminState(database, admin.user);
  assert.equal(summary.users.find((u) => u.id === user.id).x, 0.5);
  assert.equal(summary.users.find((u) => u.id === user.id).ai, 0.1);
  assert.ok(!JSON.stringify(summary).includes('password_hash'));
  assert.ok(!JSON.stringify(summary).includes('token_hash'));
});
test('concurrent atomic reservations cannot overspend and uncertain billing stays reserved', async () => {
  const { database, admin, user } = await setup();
  await grantCredit(database, admin.user, grant(user.id, 1));
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => reserveCredit(database, user.id, 'x', 0.2, 'parallel')),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  assert.equal(await balance(database, user.id), 0);
  await assert.rejects(
    reserveCredit(database, user.id, 'ai', 0.001, 'denied'),
    (e) => e.status === 402,
  );
  assert.equal(
    (await adminState(database, admin.user)).users.find((u) => u.id === user.id).reserved,
    1,
  );
});
test('settlement above reservation records charge honestly and blocks subsequent paid work', async () => {
  const { database, admin, user } = await setup();
  await grantCredit(database, admin.user, grant(user.id, 0.1));
  const ticket = await reserveCredit(database, user.id, 'ai', 0.1, 'test');
  await settleCredit(database, ticket, 0.2);
  assert.equal(await balance(database, user.id), -0.1);
  await assert.rejects(
    reserveCredit(database, user.id, 'ai', 0.000001, 'test'),
    /Kredit tidak cukup/,
  );
});
test('grants are audited/idempotent by ID and reject malformed/unauthorized amounts', async () => {
  const { database, admin, user } = await setup();
  for (const amount of [-1, 0, Infinity, NaN, 0.0000001, 1000001])
    assert.equal(GrantInput.safeParse({ ...grant(user.id), amount }).success, false);
  assert.equal(micros(0.015000000000000001), 15000);
  assert.equal(micros(0.0000001), 1);
  await assert.rejects(grantCredit(database, user, grant(user.id)), /admin/);
  const entry = grant(user.id);
  await grantCredit(database, admin.user, entry);
  await grantCredit(database, admin.user, entry); // Safe retry after a lost response.
  await assert.rejects(
    grantCredit(database, admin.user, { ...entry, amount: 4 }),
    /ID kredit sudah/,
  );
  assert.equal(await balance(database, user.id), 3);
  const audit = (await adminState(database, admin.user)).grants[0];
  assert.equal(audit.actor, admin.user.email);
  assert.equal(audit.amount, 3);
  assert.equal(audit.note, entry.note);
});
test('research, analysis, outcomes, deletes and usage are owner-scoped; free operations work at zero credit', async () => {
  const { database, admin, user } = await setup();
  const payload = { profile: null, posts: [], warnings: [], post_limit: 50 };
  const run = await insertRun(database, user.id, 'account', 'test', 'import', payload);
  assert.equal(await balance(database, user.id), 0);
  assert.equal((await researchState(database, admin.user.id)).runs.length, 0);
  await assert.rejects(readRun(database, admin.user.id, run), /Riset tidak ditemukan/);
  await writeAnalysis(database, admin.user.id, run, { summary: 'cross-owner' });
  assert.equal((await readRun(database, user.id, run)).analysis, null);
  await deleteOwned(database, admin.user.id, 'runs', run);
  assert.equal((await researchState(database, user.id)).runs.length, 1);
  await writeOutcome(database, user.id, { account: 'manual' });
  const note = (await researchState(database, user.id)).outcomes[0];
  await assert.rejects(
    writeOutcome(database, admin.user.id, { account: 'cross-owner' }, note.id),
    /tidak ditemukan/,
  );
  await deleteOwned(database, admin.user.id, 'outcomes', note.id);
  assert.equal((await researchState(database, user.id)).outcomes.length, 1);
  await deleteOwned(database, user.id, 'runs', run);
  assert.equal((await researchState(database, user.id)).runs.length, 0);
});
test('throttle limits repeated attempts and reopens in next window', async () => {
  const { database } = fixture();
  for (let i = 0; i < 10; i++) await throttle(database, ['ip-hash', 'email-hash'], 100);
  await assert.rejects(
    throttle(database, ['ip-hash', 'other-email'], 100),
    (e) => e.status === 429,
  );
  await throttle(database, ['ip-hash', 'email-hash'], 15 * 60 * 1000);
});
