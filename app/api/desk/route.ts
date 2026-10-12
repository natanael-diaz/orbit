import { z } from 'zod';
import {
  state,
  getRun,
  saveRun,
  saveAnalysis,
  saveOutcome,
  deleteRun,
  deleteOutcome,
} from '../../../lib/store';
import { currentUser } from '../../../lib/auth';
import { AccessError } from '../../../lib/accounts';
import { body, failure } from '../../../lib/http';
import { DatasetSchema, modes, AnalysisSchema, leadPresetFor } from '../../../lib/domain';
import { demo } from '../../../lib/demo';
import { collectAccount, collectSearch } from '../../../lib/x-api';
import { analyze } from '../../../lib/ai';
export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    return Response.json(
      { ...(await state(user.id)), user },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
const Outcome = z.object({
  account: z.string().trim().min(1).max(100),
  type: z.enum(['Inquiry', 'DM', 'Order']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().max(500),
  attribution: z.enum(['Dikonfirmasi client', 'Catatan pribadi', 'Tidak diketahui']),
  amount: z.number().nonnegative().nullable(),
  currency: z.enum(['USD', 'IDR']),
  notes: z.string().max(3000),
});
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const b = await body(request, 2000000);
    let id = '';
    if (b.action === 'demo') {
      const d = demo();
      id = await saveRun(user.id, 'account', 'Sample Workspace', 'demo', d.payload, d.analysis);
    } else if (b.action === 'collect') {
      const p = z
        .object({
          mode: z.enum(modes),
          target: z.string().max(450),
          niche: z.string().max(200),
          language: z.string().regex(/^[a-z]{2}$/),
          query: z.string().max(450),
          postLimit: z.number().int().min(5).max(100),
          leadPreset: z.string().optional(),
        })
        .parse(b);
      if (p.mode !== 'account' && p.postLimit < 10)
        throw Error('Pencarian recent minimal 10 hasil.');
      if (p.mode !== 'account' && !p.niche.trim() && !p.query.trim())
        throw Error('Isi niche / keyword atau query pencarian sebelum mengambil data.');
      const data =
        p.mode === 'account'
          ? await collectAccount(user.id, p.target.replace(/^@/, ''), p.postLimit)
          : await collectSearch(
              user.id,
              p.mode,
              p.niche,
              p.language,
              p.query,
              p.postLimit,
              p.mode === 'leads' ? leadPresetFor(p.leadPreset) : undefined,
            );
      id = await saveRun(
        user.id,
        p.mode,
        p.mode === 'account' ? p.target : p.query || p.niche,
        'x',
        data,
      );
    } else if (b.action === 'import') {
      const data = DatasetSchema.parse(b.data);
      id = await saveRun(
        user.id,
        z.enum(modes).parse(b.mode || 'account'),
        String(b.target || 'Impor').slice(0, 100),
        'import',
        data,
      );
    } else if (b.action === 'analyze') {
      const run = await getRun(user.id, z.string().parse(b.id));
      if (run.source === 'demo')
        throw Error('Data demo sudah memiliki analisis contoh; tidak memakai kredit AI.');
      if (!run.payload.posts.length) throw Error('Tidak ada post untuk dianalisis.');
      if (run.analysis && !b.force) return Response.json({ id: run.id, cached: true });
      const a = await analyze(
        user.id,
        run,
        z
          .string()
          .regex(/^[a-z]{2}$/)
          .parse(b.language),
        z.string().max(200).parse(b.niche),
      );
      await saveAnalysis(user.id, run.id, a);
      id = run.id;
    } else if (b.action === 'draft') {
      const run = await getRun(user.id, z.string().parse(b.id));
      const postId = z.string().parse(b.post_id);
      const type = z.enum(['lead', 'connection', 'reply']).parse(b.type);
      const draft = z.string().max(3000).parse(b.draft);
      const a = run.analysis;
      if (!a) throw Error('Analisis belum tersedia.');
      a.candidates = a.candidates.map((c) =>
        c.post_id === postId && c.type === type ? { ...c, draft } : c,
      );
      await saveAnalysis(user.id, run.id, AnalysisSchema.parse(a));
      id = run.id;
    } else if (b.action === 'outcome') {
      const p = Outcome.parse(b.data);
      await saveOutcome(user.id, p, b.id ? z.string().parse(b.id) : undefined);
    } else if (b.action === 'deleteOutcome') {
      await deleteOutcome(user.id, z.string().parse(b.id));
    } else if (b.action === 'deleteRun') {
      await deleteRun(user.id, z.string().parse(b.id));
    } else throw Error('Aksi tidak dikenal.');
    return Response.json({ id });
  } catch (e) {
    if (e instanceof AccessError) return failure(e);
    const msg =
      e instanceof z.ZodError
        ? 'Format data tidak valid: ' +
          e.issues
            .map((i) => i.path.join('.') + ' ' + i.message)
            .slice(0, 3)
            .join('; ')
        : e instanceof Error
          ? e.message
          : 'Terjadi kesalahan';
    return Response.json({ error: msg }, { status: 400 });
  }
}
