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
export const leadPresets = {
  general: {
    label: 'General / semua bidang',
    intent:
      'Prospective buyers in the supplied research context explicitly seeking a product, service, solution, supplier, or professional recommendation. Do not infer a commercial need from interest, profession, or status alone.',
    query:
      '("looking for" OR "recommendations" OR "recommend a" OR "need a" OR "need an" OR "seeking" OR "mencari" OR "butuh" OR "rekomendasi")',
  },
  vtuber: {
    label: 'VTuber / stream assets',
    intent:
      'VTuber and streamer buyers seeking emotes, overlays, stream assets, model art, logos, or artist recommendations.',
    query:
      '("looking for artist" OR "looking for an artist" OR "need an artist" OR "looking for emotes" OR "need emotes" OR "looking for an overlay" OR "need overlay" OR "need stream assets" OR "artist recommendations" OR "recommend an artist")',
  },
  dnd: {
    label: 'D&D / TTRPG art',
    intent:
      'D&D/TTRPG players, DMs, or groups seeking character art, party portraits, token art, map artists, campaign art, or artist recommendations.',
    query:
      '("looking for artist" OR "need an artist" OR "character art" OR "character commission" OR "party portrait" OR "token art" OR "map artist" OR "campaign art" OR "artist recommendations")',
  },
  streamer: {
    label: 'Streamer assets',
    intent:
      'Streamers seeking emotes, overlays, panels, alerts, logos, branding, PNGtuber assets, or artist recommendations.',
    query:
      '("looking for artist" OR "need an artist" OR "looking for emotes" OR "need emotes" OR "stream overlay" OR "twitch panels" OR "stream alerts" OR "streamer logo" OR "artist recommendations")',
  },
  indie_game: {
    label: 'Indie game assets',
    intent:
      'Indie developers seeking character design, sprites, key art, UI assets, capsule art, game logos, concept art, or artist recommendations.',
    query:
      '("looking for artist" OR "need an artist" OR "game artist" OR "character design" OR "sprite artist" OR "capsule art" OR "key art" OR "UI artist" OR "concept artist")',
  },
  podcast: {
    label: 'Podcast / branding',
    intent:
      'Podcasters or creators seeking cover art, logo design, branding, thumbnails, banners, or designer recommendations.',
    query:
      '("looking for artist" OR "need an artist" OR "cover art" OR "podcast logo" OR "logo designer" OR "thumbnail artist" OR "banner artist" OR "brand designer" OR "designer recommendations")',
  },
  custom: {
    label: 'Custom / niche pilihanmu',
    intent:
      'Prospective buyers explicitly seeking relevant products, services, solutions, or suppliers in the supplied niche or custom query. Require explicit sourcing evidence, not generic discussion or seller advertising.',
    query:
      '("looking for" OR "recommendations" OR "need a" OR "need an" OR "seeking" OR "mencari" OR "butuh" OR "rekomendasi")',
  },
} as const;
export type LeadPreset = keyof typeof leadPresets;
export function leadPresetFor(value?: string): LeadPreset {
  return value && Object.hasOwn(leadPresets, value) ? (value as LeadPreset) : 'general';
}
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
  lead_preset: z.enum(Object.keys(leadPresets) as [LeadPreset, ...LeadPreset[]]).optional(),
});
export type Dataset = z.infer<typeof DatasetSchema>;
export type Mode = (typeof modes)[number];
export const AnalysisSchema = z.object({
  summary: z.string().catch(''),
  positioning: z.string().catch(''),
  brand: z.string().catch(''),
  feel: z.string().catch(''),
  reply_pattern: z.string().catch(''),
  repost_pattern: z.string().catch(''),
  evidence_ids: z.array(z.string()).catch([]),
  posts: z
    .array(
      z.object({
        id: z.string(),
        category: z.enum(categories).catch('Engagement' as const),
        tags: z.array(z.string()).catch([]),
        tone: z.string().catch(''),
        reason: z.string().catch(''),
      }),
    )
    .catch([]),
  topics: z
    .array(
      z.object({
        name: z.string().catch(''),
        reason: z.string().catch(''),
        evidence_ids: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
  candidates: z
    .array(
      z.object({
        post_id: z.string(),
        type: z.enum(['lead', 'connection', 'reply']).catch('reply' as const),
        fit: z.enum(['high', 'medium', 'low']).catch('low' as const),
        reason: z.string().catch(''),
        need: z.string().nullable().catch(null),
        timing: z.string().nullable().catch(null),
        budget: z.string().nullable().catch(null),
        draft: z.string().catch(''),
      }),
    )
    .catch([]),
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
export function queryFor(mode: Mode, niche: string, language: string, leadPreset?: LeadPreset) {
  const lang = /^[a-z]{2}$/.test(language) ? ` lang:${language}` : '';
  const n = niche.trim();
  if (!n) return '';
  const preset = leadPresets[leadPresetFor(leadPreset)];
  const additions = {
    account: '',
    topics: '',
    replies: '',
    leads: ` ${preset.query}`,
    connections: '',
  };
  return `(${n})${additions[mode]}${lang} -is:retweet`;
}
export function sourceUrl(p: Post) {
  return /^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+$/.test(p.url) ? p.url : '';
}
