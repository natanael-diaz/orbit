import { AnalysisSchema, categories, type Analysis, type Run } from './domain';
import { reserve, settle, secrets, aiEndpoint, aiModel } from './store';
import { researchInstructions } from './research-instructions';
const str = { type: 'string', default: '' },
  strs = { type: 'array', items: str, default: [] },
  nullable = { type: ['string', 'null'], default: null };
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const schema = obj({
  summary: str,
  positioning: str,
  brand: str,
  feel: str,
  reply_pattern: str,
  repost_pattern: str,
  evidence_ids: strs,
  posts: {
    type: 'array',
    items: obj({
      id: str,
      category: { type: 'string', enum: categories },
      tags: strs,
      tone: str,
      reason: str,
    }),
  },
  topics: {
    type: 'array',
    items: obj({ name: str, reason: str, evidence_ids: strs }),
  },
  candidates: {
    type: 'array',
    items: obj({
      post_id: str,
      type: { type: 'string', enum: ['lead', 'connection', 'reply'] },
      fit: { type: 'string', enum: ['high', 'medium', 'low'] },
      reason: str,
      need: nullable,
      timing: nullable,
      budget: nullable,
      draft: str,
    }),
  },
});
export async function analyze(
  userId: string,
  run: Run,
  language: string,
  niche: string,
): Promise<Analysis> {
  if (!secrets().ai) throw Error('OpenAI API key belum diisi di .env.');
  const modelName = aiModel();
  const payload = JSON.stringify({
    mode: run.mode,
    niche,
    language,
    profile: run.payload.profile,
    posts: run.payload.posts.map(({ media, ...p }) => p),
  });
  if (payload.length > 160000)
    throw Error('Data terlalu panjang untuk satu analisis. Kurangi jumlah/panjang post.');
  const body = {
    model: modelName,
    store: false,
    reasoning: { effort: 'none' },
    instructions: researchInstructions(
      run.mode,
      run.payload.post_limit || 50,
      run.payload.lead_preset,
    ),
    input: payload,
    max_output_tokens: 10000,
    text: {
      format: { type: 'json_schema', name: 'research', strict: true, schema },
    },
  };
  const ceiling =
    ((new TextEncoder().encode(JSON.stringify(body)).length + 2000) * 0.75) / 1e6 +
    (10000 * 4.5) / 1e6;
  const ticket = await reserve(userId, 'ai', ceiling, modelName + ' analysis');
  let res: Response;
  try {
    res = await fetch(aiEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secrets().ai,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw Error(
      'Koneksi AI terputus. Reservasi dipertahankan; cek pemakaian sebelum mencoba lagi.',
    );
  }
  if (!res.ok) {
    const errorBody: any = await res.json().catch(() => null);
    if ([400, 401, 402, 403, 429].includes(res.status)) await settle(ticket, 0);
    const providerMessage = errorBody?.error?.message;
    throw Error(
      `OpenAI HTTP ${res.status}.${providerMessage ? ` ${String(providerMessage).slice(0, 800)}` : ' Periksa key, akses model, saldo atau rate limit.'}`,
    );
  }
  const result = (await res.json()) as any;
  if (result.usage) {
    await settle(
      ticket,
      ((result.usage.input_tokens || 0) * 0.75 + (result.usage.output_tokens || 0) * 4.5) / 1e6,
    );
  }
  if (result.status !== 'completed')
    throw Error('Analisis AI belum lengkap. Pemakaian yang terjadi tetap dicatat.');
  const output = (result.output || [])
    .flatMap((o: any) => o.content || [])
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('');
  const parsed = AnalysisSchema.parse(JSON.parse(output));
  const ids = new Set(run.payload.posts.map((p) => p.id));
  const cited = [
    ...parsed.evidence_ids,
    ...parsed.posts.map((p) => p.id),
    ...parsed.topics.flatMap((t) => t.evidence_ids),
    ...parsed.candidates.map((c) => c.post_id),
  ];
  if (cited.some((id) => !ids.has(id)))
    throw Error('AI mengembalikan sumber yang tidak valid. Hasil tidak disimpan.');
  return parsed;
}
