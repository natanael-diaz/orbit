import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './d1-fixture.mjs';
import {
  setupAdmin,
  addUser,
  UserInput,
  GrantInput,
  grantCredit,
  reserveCredit,
  settleCredit,
  balance,
} from '../lib/accounts.ts';
import { personalCredit } from '../lib/credit-store.ts';
async function setup() {
  const { database, sqlite } = fixture();
  const input = (email, role) =>
    UserInput.parse({ name: 'Fixture', email, role, password: 'synthetic-credit-password' });
  const admin = await setupAdmin(database, input('admin@example.test', 'admin'));
  const userId = await addUser(database, admin.user, input('user@example.test', 'user'));
  return { database, sqlite, admin: admin.user, userId };
}
test('personal credit starts empty and keeps reservation/settled/refunded figures aligned with shared balance', async () => {
  const { database, admin, userId } = await setup();
  assert.deepEqual(await personalCredit(database, userId), {
    balance: 0,
    granted: 0,
    spent: 0,
    reserved: 0,
    historical: 0,
    grants: [],
  });
  await grantCredit(
    database,
    admin,
    GrantInput.parse({ id: crypto.randomUUID(), userId, amount: 3, note: 'Welcome credit' }),
  );
  const ticket = await reserveCredit(database, userId, 'x', 1.5, 'Fixture X request');
  const reserved = await personalCredit(database, userId);
  assert.equal(reserved.balance, 1.5);
  assert.equal(reserved.reserved, 1.5);
  assert.equal(reserved.spent, 0);
  await settleCredit(database, ticket, 0.25);
  const settled = await personalCredit(database, userId);
  assert.equal(settled.balance, 2.75);
  assert.equal(settled.spent, 0.25);
  assert.equal(settled.reserved, 0);
  assert.equal(settled.balance, await balance(database, userId));
  const rejected = await reserveCredit(database, userId, 'ai', 0.1, 'Fixture rejected');
  await settleCredit(database, rejected, 0);
  assert.equal((await personalCredit(database, userId)).spent, 0.25);
});
test('credit totals are cumulative beyond100 and legacy history does not consume new grants', async () => {
  const { database, sqlite, admin, userId } = await setup();
  const insertGrant = sqlite.prepare(
    'INSERT INTO credit_grants(id,user_id,actor_id,amount_micros,note,created) VALUES(?,?,?,?,?,?)',
  );
  for (let i = 0; i < 105; i++)
    insertGrant.run(
      `grant-${i}`,
      userId,
      admin.id,
      1000000,
      `Own grant ${i}`,
      new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    );
  const insertLedger = sqlite.prepare(
    'INSERT INTO ledger(id,provider,cost,cost_micros,created,note,user_id,status) VALUES(?,?,?,?,?,?,?,?)',
  );
  for (let i = 0; i < 101; i++)
    insertLedger.run(
      `spent-${i}`,
      'x',
      0.01,
      10000,
      '2026-10-01',
      'Fixture settled',
      userId,
      'settled',
    );
  insertLedger.run(
    'pending',
    'ai',
    0.125,
    125000,
    '2026-10-02',
    'Fixture pending',
    userId,
    'reserved',
  );
  for (let i = 0; i < 7; i++)
    insertLedger.run(
      `legacy-${i}`,
      'x',
      0.08,
      80000,
      '2026-01-01',
      'Fixture historical',
      userId,
      'legacy',
    );
  const result = await personalCredit(database, userId);
  assert.equal(result.granted, 105);
  assert.equal(result.spent, 1.01);
  assert.equal(result.reserved, 0.125);
  assert.equal(result.historical, 0.56);
  assert.equal(result.balance, 103.865);
  assert.equal(result.grants.length, 100);
  assert.equal(result.grants[0].note, 'Own grant 104');
  assert.equal(result.balance, await balance(database, userId));
});
test('own grant receipts exclude other users/admin metadata and preserve tiny/negative balances', async () => {
  const { database, admin, userId } = await setup();
  await grantCredit(
    database,
    admin,
    GrantInput.parse({
      id: crypto.randomUUID(),
      userId: admin.id,
      amount: 99,
      note: 'Private admin note',
    }),
  );
  await grantCredit(
    database,
    admin,
    GrantInput.parse({
      id: crypto.randomUUID(),
      userId,
      amount: 0.000001,
      note: 'Own micro credit <not HTML>',
    }),
  );
  const tiny = await personalCredit(database, userId);
  assert.equal(tiny.balance, 0.000001);
  assert.equal(tiny.granted, 0.000001);
  assert.equal(tiny.grants[0].note, 'Own micro credit <not HTML>');
  assert.deepEqual(Object.keys(tiny.grants[0]).sort(), ['amount', 'created', 'id', 'note']);
  assert.ok(!JSON.stringify(tiny).includes('Private admin note'));
  assert.ok(!JSON.stringify(tiny).includes(admin.email));
  const ticket = await reserveCredit(database, userId, 'ai', 0.000001, 'Fixture usage');
  await settleCredit(database, ticket, 0.000002);
  assert.equal((await personalCredit(database, userId)).balance, -0.000001);
  await assert.rejects(
    personalCredit(database, crypto.randomUUID()),
    (error) => error.status === 404,
  );
});
