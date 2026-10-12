import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidates, filterOutcomes, paginate } from '../lib/workspace-view.ts';

const posts = [
  {
    id: 'one',
    author: 'Creator',
    text: 'Looking for overlays',
    created_at: '2026-10-12T00:00:00Z',
  },
  { id: 'two', author: 'Designer', text: 'Community art jam' },
];
const candidates = [
  {
    post_id: 'one',
    type: 'lead',
    fit: 'high',
    reason: 'Explicit need',
    need: 'overlay',
    timing: 'November',
    budget: '$30',
    draft: 'hello',
  },
  {
    post_id: 'two',
    type: 'connection',
    fit: 'medium',
    reason: 'Art collaboration',
    need: null,
    timing: null,
    budget: null,
    draft: 'hey',
  },
  {
    post_id: 'missing',
    type: 'reply',
    fit: 'low',
    reason: 'Missing source requires review',
    need: null,
    timing: null,
    budget: null,
    draft: '',
  },
];
test('workspace candidate filters combine evidence text/author/explicit need/timing/budget and fit without inventing data', () => {
  const before = structuredClone(candidates);
  assert.equal(filterCandidates(candidates, posts, ' CREATOR ', 'high').length, 1);
  assert.equal(filterCandidates(candidates, posts, 'overlays')[0], candidates[0]);
  assert.equal(filterCandidates(candidates, posts, 'november')[0], candidates[0]);
  assert.equal(filterCandidates(candidates, posts, '$30')[0], candidates[0]);
  assert.equal(filterCandidates(candidates, posts, 'art', 'high').length, 0);
  assert.equal(filterCandidates(candidates, posts, 'missing')[0], candidates[2]);
  assert.deepEqual(filterCandidates(candidates, posts, '', 'all'), candidates);
  assert.deepEqual(candidates, before);
});

test('manual outcome filters search owned supplied fields and type; do not infer conversions or combine amounts', () => {
  const rows = [
    {
      id: 'a',
      account: 'Buyer',
      type: 'Inquiry',
      notes: 'emote question',
      source: '',
      attribution: 'Tidak diketahui',
      amount: null,
    },
    {
      id: 'b',
      account: 'Buyer',
      type: 'Order',
      notes: 'overlay',
      source: 'https://x.com/buyer/status/123',
      attribution: 'Dikonfirmasi client',
      amount: 30,
      currency: 'USD',
    },
    {
      id: 'c',
      account: 'Other',
      type: 'DM',
      notes: '',
      source: '',
      attribution: 'Catatan pribadi',
      amount: null,
    },
  ];
  const before = structuredClone(rows);
  assert.equal(filterOutcomes(rows, ' BUYER ', 'Order')[0], rows[1]);
  assert.equal(filterOutcomes(rows, 'emote', 'Order').length, 0);
  assert.equal(filterOutcomes(rows, 'status/123')[0].id, 'b');
  assert.equal(filterOutcomes(rows, 'dikonfirmasi')[0].id, 'b');
  assert.equal(filterOutcomes(rows, '', 'DM').length, 1);
  assert.equal(filterOutcomes(rows, 'absent').length, 0);
  assert.deepEqual(rows, before);
});

test('workspace pagination clamps after filters/removals and keeps full sample untouched', () => {
  const rows = Array.from({ length: 51 }, (_, index) => index);
  assert.deepEqual(paginate(rows, 1).items, rows.slice(0, 10));
  assert.equal(paginate(rows, 2).from, 11);
  assert.equal(paginate(rows, 999).page, 6);
  assert.equal(paginate(rows, 999).to, 51);
  assert.equal(paginate(rows.slice(0, 3), 6).page, 1);
  assert.deepEqual(paginate([], 9), { items: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
  assert.equal(paginate(rows, NaN, 0).page, 1);
  assert.equal(paginate(rows, Infinity, NaN).items.length, 10);
  assert.equal(paginate(rows, 2, 5).items.length, 5);
  assert.equal(rows.length, 51);
});
