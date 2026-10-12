import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatUSD,
  initials,
  providerTotals,
  filterUsers,
  filterLedger,
  paginate,
} from '../lib/admin-view.ts';
const users = [
  {
    id: '1',
    name: 'Admin Alpha',
    email: 'admin@example.test',
    role: 'admin',
    active: 1,
    balance: 0,
  },
  {
    id: '2',
    name: 'Creator Beta',
    email: 'creator@example.test',
    role: 'user',
    active: 1,
    balance: -0.1,
  },
  {
    id: '3',
    name: 'Artist Gamma',
    email: 'artist@example.test',
    role: 'user',
    active: 0,
    balance: 3,
  },
];
test('USD display preserves tiny and negative balances without fabricated rounding or trends', () => {
  assert.equal(formatUSD(0), '$0.00');
  assert.equal(formatUSD(3), '$3.00');
  assert.equal(formatUSD(0.000001), '$0.000001');
  assert.equal(formatUSD(-0.00012), '-$0.00012');
  assert.equal(formatUSD(1234.123456), '$1,234.123456');
  assert.equal(initials('  Fixture Admin  '), 'FA');
  assert.equal(initials(''), 'O');
});
test('provider composition uses cumulative statuses, not latest100 ledger or fake monthly totals', () => {
  const usage = [
    { provider: 'x', status: 'settled', total: 1, requests: 120 },
    { provider: 'x', status: 'reserved', total: 0.15, requests: 1 },
    { provider: 'x', status: 'legacy', total: 0.01, requests: 2 },
    { provider: 'ai', status: 'settled', total: 0.03, requests: 5 },
  ];
  const result = providerTotals(usage, 'x');
  assert.equal(result.total, 1.16);
  assert.equal(result.requests, 123);
  assert.equal(result.reserved, 0.15);
  assert.equal(result.legacy, 0.01);
  assert.equal(result.settled, 1);
  assert.deepEqual(providerTotals([], 'ai'), {
    total: 0,
    reserved: 0,
    settled: 0,
    legacy: 0,
    requests: 0,
  });
});
test('user filters combine name/email case-insensitive search, status and role without mutating source', () => {
  assert.deepEqual(
    filterUsers(users, ' CREATOR ', 'active', 'user').map((user) => user.id),
    ['2'],
  );
  assert.deepEqual(
    filterUsers(users, '@example', 'inactive', 'user').map((user) => user.id),
    ['3'],
  );
  assert.equal(filterUsers(users, '', 'all', 'admin').length, 1);
  assert.equal(filterUsers(users, 'missing').length, 0);
  assert.equal(users.length, 3);
  assert.equal(users[1].balance, -0.1);
});
test('request filters preserve status coverage and evidence notes, handle unowned legacy', () => {
  const rows = [
    {
      id: '1',
      email: 'creator@example.test',
      provider: 'x',
      status: 'reserved',
      note: 'X: recent',
    },
    { id: '2', email: null, provider: 'x', status: 'legacy', note: 'Historical record' },
    {
      id: '3',
      email: 'admin@example.test',
      provider: 'ai',
      status: 'settled',
      note: 'Text-only analysis',
    },
  ];
  assert.equal(filterLedger(rows, ' RECENT ', 'x', 'reserved')[0].id, '1');
  assert.equal(filterLedger(rows, 'historical', 'all', 'legacy')[0].id, '2');
  assert.equal(filterLedger(rows, '', 'ai', 'reserved').length, 0);
  assert.equal(rows[2].note, 'Text-only analysis');
});
test('pagination clamps after filter/refresh shrink, handles empty/invalid boundaries and preserves order', () => {
  const rows = Array.from({ length: 23 }, (_, i) => i);
  const third = paginate(rows, 3, 10);
  assert.deepEqual(third.items, [20, 21, 22]);
  assert.equal(third.from, 21);
  assert.equal(third.to, 23);
  const shrunk = paginate(rows.slice(0, 3), 3, 10);
  assert.equal(shrunk.page, 1);
  assert.equal(shrunk.pages, 1);
  assert.deepEqual(paginate([], 4), { items: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
  assert.equal(paginate(rows, NaN, Infinity).page, 1);
  assert.equal(paginate(rows, -3, 0).items.length, 1);
  assert.equal(rows[0], 0);
  assert.equal(rows.length, 23);
});
