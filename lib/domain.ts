import { z } from 'zod';
export const categories = [
  'Showcase',
  'Sales',
  'Personal',
  'Education',
  'Engagement',
  'Community',
] as const;
export const modes = ['account', 'topics', 'replies', 'leads', 'connections'] as const;
export const PostSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().max(16000),
  author: z.string().max(100),
  created_at: z.string().datetime({ offset: true }),
  kind: z.enum(['original', 'quote', 'reply', 'repost', 'context']),
  url: z.string().max(500).default(''),
  metrics: z.object({
    likes: z.number().nonnegative().nullable(),
    replies: z.number().nonnegative().nullable(),
    reposts: z.number().nonnegative().nullable(),
    quotes: z.number().nonnegative().nullable(),
    views: z.number().nonnegative().nullable(),
  }),
  media: z.array(z.string().url()).max(4).default([]),
  references: z.array(z.string()).default([]),
});
export type Post = z.infer<typeof PostSchema>;
export const DatasetSchema = z.object({
  profile: z
    .object({
      username: z.string(),
      name: z.string(),
      bio: z.string(),
      pinned_id: z.string().nullable(),
    })
    .nullable(),
  posts: z.array(PostSchema).max(300),
  warnings: z.array(z.string()).default([]),
  post_limit: z.number().int().min(5).max(100).optional(),
});
export type Dataset = z.infer<typeof DatasetSchema>;
export type Mode = (typeof modes)[number];
export const AnalysisSchema = z.object({
  summary: z.string(),
  positioning: z.string(),
  brand: z.string(),
  feel: z.string(),
  reply_pattern: z.string(),
  repost_pattern: z.string(),
  evidence_ids: z.array(z.string()),
  posts: z.array(
    z.object({
      id: z.string(),
      category: z.enum(categories),
      tags: z.array(z.string()),
      tone: z.string(),
      reason: z.string(),
    }),
  ),
  topics: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
      evidence_ids: z.array(z.string()),
    }),
  ),
  candidates: z.array(
    z.object({
      post_id: z.string(),
      type: z.enum(['lead', 'connection', 'reply']),
      fit: z.enum(['high', 'medium', 'low']),
      reason: z.string(),
      need: z.string().nullable(),
      timing: z.string().nullable(),
      budget: z.string().nullable(),
      draft: z.string(),
    }),
  ),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
export type Run = {
  id: string;
  mode: Mode;
  target: string;
  source: string;
  created: string;
  payload: Dataset;
  analysis: Analysis | null;
};
export function engagement(p: Post) {
  const m = p.metrics;
  const a = [m.likes, m.replies, m.reposts, m.quotes];
  return a.some((x) => x === null) ? null : a.reduce<number>((s, n) => s + n!, 0);
}
export function stats(posts: Post[], limit = 50) {
  const original = posts
    .filter((p) => ['original', 'quote'].includes(p.kind))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  const valid = original.filter((p) => engagement(p) !== null);
  const dates = original.map((p) => p.created_at);
  const days =
    dates.length > 1 ? (Date.parse(dates[0]) - Date.parse(dates[dates.length - 1])) / 86400000 : 0;
  const best = [...valid].sort((a, b) => engagement(b)! - engagement(a)!)[0];
  const rates = valid
    .filter((p) => (p.metrics.views ?? 0) > 0)
    .sort((a, b) => engagement(b)! / b.metrics.views! - engagement(a)! / a.metrics.views!);
  return {
    count: original.length,
    mean: valid.length ? valid.reduce((s, p) => s + engagement(p)!, 0) / valid.length : null,
    metricCount: valid.length,
    frequency: days > 0 ? ((original.length - 1) / days) * 7 : null,
    from: dates.at(-1),
    to: dates[0],
    best,
    rateBest: rates[0],
  };
}
export function queryFor(mode: Mode, niche: string, language: string) {
  const lang = /^[a-z]{2}$/.test(language) ? ` lang:${language}` : '';
  const n = niche.trim() || 'VTuber';
  const additions = {
    account: '',
    topics: '',
    replies: ' ("debut" OR "VTuber" OR "stream")',
    leads:
      ' ("looking for artist" OR "looking for an artist" OR "need an artist" OR "looking for emotes" OR "need emotes" OR "looking for an overlay" OR "need overlay" OR "need stream assets" OR "artist recommendations" OR "recommend an artist")',
    connections: ' (artist OR rigger OR designer OR musician)',
  };
  return `${n}${additions[mode]}${lang} -is:retweet`;
}
export function sourceUrl(p: Post) {
  return /^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+$/.test(p.url) ? p.url : '';
}
