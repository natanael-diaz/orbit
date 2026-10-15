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
const jsonSchema = obj({
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

  const instructions =
    researchInstructions(run.mode, run.payload.post_limit || 50, run.payload.lead_preset) +
    '\n\nReturn ONLY a JSON object matching this schema (no markdown, no backticks, no wrapping): ' +
    JSON.stringify(jsonSchema);

  const body: Record<string, unknown> = {
    model: modelName,
    messages: [
      { role: 'system', content: instructions },
      {
        role: 'user',
        content: `Analyze the following data. Return valid JSON only:\n\n${payload}`,
      },
    ],
    max_tokens: 10000,
  };

  // Some providers support response_format for JSON mode. Use it when available.
  try {
    body.response_format = { type: 'json_object' };
  } catch {
    // older providers ignore unknown keys
  }

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

  const text = await res.text();
  // Some providers wrap in SSE even on non-streaming requests.
  let result: any;
  if (text.startsWith('event:')) {
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));
    const last = dataLines[dataLines.length - 1];
    if (last && last !== '[DONE]') result = JSON.parse(last);
    else throw Error('Provider mengembalikan SSE tanpa data. Periksa endpoint/model.');
  } else {
    result = JSON.parse(text);
  }

  if (result.error) {
    await settle(ticket, 0);
    throw Error(
      `AI error: ${String(result.error.message || result.error.type || JSON.stringify(result.error)).slice(0, 800)}`,
    );
  }

  if (result.usage) {
    await settle(
      ticket,
      ((result.usage.prompt_tokens || result.usage.input_tokens || 0) * 0.75 +
        (result.usage.completion_tokens || result.usage.output_tokens || 0) * 4.5) /
        1e6,
    );
  }

  // Chat Completions response: result.choices[0].message.content
  const output =
    result.choices?.[0]?.message?.content ||
    // Fallback: Responses API format
    (result.output || [])
      .flatMap((o: any) => o.content || [])
      .filter((c: any) => c.type === 'output_text')
      .map((c: any) => c.text)
      .join('');

  if (!output)
    throw Error('Analisis AI belum lengkap. Pemakaian yang terjadi tetap dicatat.');

  // Clean markdown code fences if the model wrapped JSON in them
  const cleaned = output.replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
  const parsed = AnalysisSchema.parse(JSON.parse(cleaned));

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