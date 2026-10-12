import test from 'node:test';
import assert from 'node:assert/strict';
import { stats, engagement, queryFor, sourceUrl, DatasetSchema } from '../lib/domain.ts';
function post(id, date, kind = 'original', likes = 10) {
  return {
    id,
    text: 'Sample',
    author: 'creator',
    created_at: date,
    kind,
    url: 'https://x.com/creator/status/123',
    metrics: { likes, replies: 2, reposts: 1, quotes: 1, views: 100 },
    media: [],
    references: [],
  };
}
test('engagement excludes incomplete metrics instead of treating missing as zero', () => {
  const p = post('1', '2026-10-01T00:00:00Z');
  assert.equal(engagement(p), 14);
  p.metrics.likes = null;
  assert.equal(engagement(p), null);
});
test('frequency and averages include quotes but exclude replies/reposts/context', () => {
  const s = stats([
    post('1', '2026-10-01T00:00:00Z'),
    post('2', '2026-10-08T00:00:00Z', 'quote', 20),
    post('3', '2026-10-09T00:00:00Z', 'reply', 500),
  ]);
  assert.equal(s.count, 2);
  assert.equal(s.frequency, 1);
  assert.equal(s.mean, 19);
  assert.equal(s.best.id, '2');
});
test('single post does not imply posting frequency', () =>
  assert.equal(stats([post('1', '2026-10-01T00:00:00Z')]).frequency, null));
test('same-time sample does not divide by zero', () =>
  assert.equal(
    stats([post('1', '2026-10-01T00:00:00Z'), post('2', '2026-10-01T00:00:00Z')]).frequency,
    null,
  ));
test('account sample defaults to and can override 50 newest posts', () => {
  const posts = Array.from({ length: 120 }, (_, i) =>
    post(String(i), new Date(Date.UTC(2026, 0, i + 1)).toISOString()),
  );
  assert.equal(stats(posts).count, 50);
  assert.equal(stats(posts, 75).count, 75);
  assert.equal(stats(posts, 100).count, 100);
});
test('unsafe source links never render', () => {
  const p = post('1', '2026-10-01T00:00:00Z');
  p.url = 'javascript:alert(1)';
  assert.equal(sourceUrl(p), '');
  p.url = 'https://x.com.evil.test/a/status/123';
  assert.equal(sourceUrl(p), '');
});
test('impossible imported metrics rejected', () => {
  const p = post('1', '2026-10-01T00:00:00Z');
  p.metrics.likes = -1;
  assert.equal(DatasetSchema.safeParse({ profile: null, posts: [p] }).success, false);
});
test('lead discovery queries retain niche and language', () => {
  const q = queryFor('leads', 'VTuber', 'en');
  assert.match(q, /VTuber/);
  assert.match(q, /lang:en/);
  assert.match(q, /looking for/);
  assert.doesNotMatch(q, /stream assets|looking for artist/);
  assert.match(q, /-is:retweet/);
});

test('lead discovery query supports DnD preset intent', () => {
  const q = queryFor('leads', 'DnD OR TTRPG', 'en', 'dnd');
  assert.match(q, /DnD OR TTRPG/);
  assert.match(q, /character art/);
  assert.match(q, /party portrait/);
  assert.match(q, /lang:en/);
  assert.match(q, /-is:retweet/);
});

test('imported datasets may persist lead preset metadata', () => {
  const p = post('1', '2026-10-01T00:00:00Z');
  const parsed = DatasetSchema.parse({ profile: null, posts: [p], lead_preset: 'dnd' });
  assert.equal(parsed.lead_preset, 'dnd');
});
