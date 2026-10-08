import { z } from 'zod';
import { db, state, getRun, saveRun } from '../../../lib/store';
import { DatasetSchema, modes, AnalysisSchema, leadPresetFor } from '../../../lib/domain';
import { demo } from '../../../lib/demo';
import { collectAccount, collectSearch } from '../../../lib/x-api';
import { analyze } from '../../../lib/ai';
export async function GET() {
  try {
    return Response.json(await state(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      {
        error: 'Database belum siap. Jalankan npm run db:local, lalu muat ulang.',
      },
      { status: 503 },
    );
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
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(request.url).host)
      return Response.json({ error: 'Origin ditolak' }, { status: 403 });
    if (request.headers.get('sec-fetch-site') === 'cross-site')
      return Response.json({ error: 'Origin ditolak' }, { status: 403 });
    if (!request.headers.get('content-type')?.includes('application/json'))
      throw Error('JSON diperlukan.');
    const raw = await request.text();
    if (raw.length > 2000000) throw Error('Impor maksimal 2 MB.');
    const b = JSON.parse(raw);
    let id = '';
    if (b.action === 'demo') {
      const d = demo();
      id = await saveRun('account', 'Sample Creator', 'demo', d.payload, d.analysis);
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
      const data =
        p.mode === 'account'
          ? await collectAccount(p.target.replace(/^@/, ''), p.postLimit)
          : await collectSearch(
              p.mode,
              p.niche,
              p.language,
              p.query,
              p.postLimit,
              p.mode === 'leads' ? leadPresetFor(p.leadPreset) : undefined,
            );
      id = await saveRun(p.mode, p.mode === 'account' ? p.target : p.query || p.niche, 'x', data);
    } else if (b.action === 'import') {
      const data = DatasetSchema.parse(b.data);
      id = await saveRun(
        z.enum(modes).parse(b.mode || 'account'),
        String(b.target || 'Impor').slice(0, 100),
        'import',
        data,
      );
    } else if (b.action === 'analyze') {
      const run = await getRun(z.string().parse(b.id));
      if (run.source === 'demo')
        throw Error('Data demo sudah memiliki analisis contoh; tidak memakai kredit AI.');
      if (!run.payload.posts.length) throw Error('Tidak ada post untuk dianalisis.');
      if (run.analysis && !b.force) return Response.json({ id: run.id, cached: true });
      const a = await analyze(
        run,
        z
          .string()
          .regex(/^[a-z]{2}$/)
          .parse(b.language),
        z.string().max(200).parse(b.niche),
      );
      await db()
        .prepare('UPDATE runs SET analysis=? WHERE id=?')
        .bind(JSON.stringify(a), run.id)
        .run();
      id = run.id;
    } else if (b.action === 'draft') {
      const run = await getRun(z.string().parse(b.id));
      const postId = z.string().parse(b.post_id);
      const type = z.enum(['lead', 'connection', 'reply']).parse(b.type);
      const draft = z.string().max(3000).parse(b.draft);
      const a = run.analysis;
      if (!a) throw Error('Analisis belum tersedia.');
      a.candidates = a.candidates.map((c) =>
        c.post_id === postId && c.type === type ? { ...c, draft } : c,
      );
      await db()
        .prepare('UPDATE runs SET analysis=? WHERE id=?')
        .bind(JSON.stringify(AnalysisSchema.parse(a)), run.id)
        .run();
      id = run.id;
    } else if (b.action === 'outcome') {
      const p = Outcome.parse(b.data);
      if (b.id) {
        await db()
          .prepare('UPDATE outcomes SET payload=? WHERE id=?')
          .bind(JSON.stringify(p), z.string().parse(b.id))
          .run();
      } else {
        await db()
          .prepare('INSERT INTO outcomes(id,created,payload) VALUES(?,?,?)')
          .bind(crypto.randomUUID(), new Date().toISOString(), JSON.stringify(p))
          .run();
      }
    } else if (b.action === 'deleteOutcome') {
      await db().prepare('DELETE FROM outcomes WHERE id=?').bind(z.string().parse(b.id)).run();
    } else if (b.action === 'deleteRun') {
      await db().prepare('DELETE FROM runs WHERE id=?').bind(z.string().parse(b.id)).run();
    } else throw Error('Aksi tidak dikenal.');
    return Response.json({ id });
  } catch (e) {
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
