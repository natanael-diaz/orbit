'use client';
import { useEffect, useMemo, useState } from 'react';
import AuthPanel, { logoutSession } from '../components/auth-panel';
import CreditPanel from '../components/credit-panel';
import WorkspacePagination from '../components/workspace-pagination';
import { filterCandidates, filterOutcomes, paginate } from '../lib/workspace-view';
import './workspace.css';
import { formatUSD as money } from '../lib/currency';
import {
  Orbit,
  UserRound,
  MessagesSquare,
  ChartNoAxesCombined,
  Users,
  Target,
  NotebookPen,
  Search,
  Download,
  Upload,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Pin,
  Wallet,
  LoaderCircle,
} from 'lucide-react';
import {
  categories,
  stats,
  engagement,
  sourceUrl,
  queryFor,
  leadPresets,
  type LeadPreset,
  type Run,
  type Post,
  type Mode,
  type Analysis,
} from '../lib/domain';
type View = Mode | 'outcomes' | 'settings';
const nav = [
  ['account', 'Analisis akun', UserRound],
  ['topics', 'Topik percakapan', ChartNoAxesCombined],
  ['replies', 'Peluang reply', MessagesSquare],
  ['leads', 'Potential leads', Target],
  ['connections', 'Community', Users],
  ['outcomes', 'Inquiry & order', NotebookPen],
  ['settings', 'Kredit & penggunaan', Wallet],
] as const;
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const num = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
function Link({ post }: { post?: Post }) {
  if (!post) return null;
  const url = sourceUrl(post);
  return url ? (
    <a className="source" href={url} target="_blank" rel="noreferrer">
      Lihat di X <ExternalLink size={13} />
    </a>
  ) : (
    <span className="muted small">Sumber tidak tersedia</span>
  );
}
function download(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const emptyOutcome = {
  account: '',
  type: 'Inquiry',
  date: new Date().toISOString().slice(0, 10),
  source: '',
  attribution: 'Tidak diketahui',
  amount: '',
  currency: 'USD',
  notes: '',
};
export default function Page() {
  const [view, setView] = useState<View>('account');
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [state, setState] = useState<any>({
    runs: [],
    outcomes: [],
    usage: [],
    configured: { x: false, ai: false },
  });
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [handle, setHandle] = useState('');
  const [niche, setNiche] = useState('');
  const [leadPreset, setLeadPreset] = useState<LeadPreset>('general');
  const [language, setLanguage] = useState('en');
  const [query, setQuery] = useState('');
  const [postLimit, setPostLimit] = useState(50);
  const [kind, setKind] = useState('original');
  const [category, setCategory] = useState('All');
  const [filter, setFilter] = useState('');
  const [outcome, setOutcome] = useState<any>(emptyOutcome);
  const [editId, setEditId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('posts');
  const [postPageIndex, setPostPageIndex] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateFit, setCandidateFit] = useState('all');
  const [candidatePageIndex, setCandidatePageIndex] = useState(1);
  const [outcomeSearch, setOutcomeSearch] = useState('');
  const [outcomeType, setOutcomeType] = useState('all');
  const [outcomePageIndex, setOutcomePageIndex] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  function changeView(next: View) {
    setView(next);
    setQuery('');
    setError('');
    setMessage('');
    setCandidateSearch('');
    setCandidateFit('all');
    setCandidatePageIndex(1);
    setPostPageIndex(1);
    if (next !== 'account') setPostLimit((old) => (old < 10 ? 10 : old));
  }
  async function load() {
    const res = await fetch('/api/desk');
    const data: any = await res.json();
    if (res.status === 401) {
      setAuthenticated(false);
      setState({ runs: [], outcomes: [], usage: [], configured: { x: false, ai: false } });
      setSelected('');
      setDrafts({});
      setOutcome(emptyOutcome);
      setShowForm(false);
      setEditId('');
      setOutcomeSearch('');
      setOutcomeType('all');
      setOutcomePageIndex(1);
      return;
    }
    if (!res.ok) throw Error(data.error);
    setAuthenticated(true);
    setState(data);
    setSelected((old) => (data.runs.some((r: Run) => r.id === old) ? old : data.runs[0]?.id || ''));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(action: string, data: any = {}) {
    setBusy(action);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const j: any = await r.json();
      if (r.status === 401) {
        await load();
        throw Error(j.error);
      }
      if (!r.ok) throw Error(j.error);
      await load();
      if (j.id) {
        setSelected(j.id);
        if (['collect', 'demo', 'import'].includes(action)) {
          setPostPageIndex(1);
          setCandidatePageIndex(1);
        }
      }
      setMessage(
        action === 'collect'
          ? 'Data tersimpan. Pilih Analisis AI untuk menilai konten.'
          : action === 'analyze'
            ? 'Analisis tersimpan.'
            : 'Tersimpan.',
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  }
  const runs: Run[] = state.runs;
  const run = runs.find((r) => r.id === selected);
  const a = run?.analysis;
  const posts = run?.payload.posts || [];
  const postCount = run?.payload.post_limit || 50;
  const stat = useMemo(() => stats(posts, postCount), [posts, postCount]);
  const classified = new Map(a?.posts.map((p) => [p.id, p]));
  const visible = posts.filter(
    (p) =>
      (kind === 'all' ||
        (kind === 'original' ? ['original', 'quote'].includes(p.kind) : p.kind === kind)) &&
      (category === 'All' || classified.get(p.id)?.category === category) &&
      `${p.text} ${p.author}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const candidateType = view === 'leads' ? 'lead' : view === 'connections' ? 'connection' : 'reply';
  const candidates = a?.candidates.filter((c) => c.type === candidateType) || [];
  const postPage = paginate(visible, postPageIndex);
  const matchingCandidates = filterCandidates(candidates, posts, candidateSearch, candidateFit);
  const candidatePage = paginate(matchingCandidates, candidatePageIndex, 5);
  const matchingOutcomes = filterOutcomes(state.outcomes, outcomeSearch, outcomeType);
  const outcomePage = paginate(matchingOutcomes, outcomePageIndex);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      await act('import', {
        mode: view === 'settings' || view === 'outcomes' ? 'account' : view,
        target: file.name,
        data: raw.payload || raw,
      });
    } catch {
      setError('File harus JSON dengan format dataset. Unduh contoh di Kredit & penggunaan.');
    }
  }
  const title = nav.find((n) => n[0] === view)?.[1];
  if (authenticated === null)
    return (
      <main className="auth-layout">
        <section className="card">
          <h1>Orbit</h1>
          <p>{error || 'Memuat workspace…'}</p>
        </section>
      </main>
    );
  if (!authenticated) return <AuthPanel onReady={load} />;
  return (
    <div className="shell research-workspace">
      <a className="workspace-skip" href="#workspace-content">
        Lewati ke konten
      </a>
      <aside className="sidebar">
        <div className="brand">
          <Orbit size={31} />
          <span>
            orbit<span className="brand-dot">.</span>
          </span>
        </div>
        <p className="workspace-label">{state.user?.name}&apos;S WORKSPACE</p>
        <p className="nav-section-label">WORKSPACE RISET</p>
        <nav aria-label="Navigasi workspace">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => changeView(id)}
              aria-current={view === id ? 'page' : undefined}
              className={view === id ? 'active' : ''}
            >
              <Icon size={19} />
              {label}
              {id === 'leads' && a && (
                <span className="nav-count">
                  {a.candidates.filter((c) => c.type === 'lead').length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <label className="mobile-navigation">
          Navigasi workspace
          <select value={view} onChange={(event) => changeView(event.target.value as View)}>
            {nav.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="side-user">
          <span className="avatar">{state.user?.name?.slice(0, 1)}</span>
          <div>
            <strong>{state.user?.name}</strong>
            <small>
              {state.user?.role === 'admin' ? 'Admin' : 'User'} · saldo {money(state.balance || 0)}
            </small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <strong>{title}</strong>
          </span>
          <div className="top-actions">
            <span className="local-pill">Saldo gabungan {money(state.balance || 0)}</span>
            {state.user?.role === 'admin' && (
              <a className="secondary" href="/admin">
                Admin
              </a>
            )}
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => logoutSession().catch((e) => setError(e.message))}
            >
              Logout
            </button>
            <button
              className="icon-button"
              title="Kredit dan penggunaan"
              onClick={() => changeView('settings')}
            >
              <Wallet size={19} />
            </button>
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">X RESEARCH DESK</span>
              <h1>{title}</h1>
              <p>
                {view === 'account'
                  ? 'Pahami kontennya. Temukan pola komunikasinya.'
                  : view === 'topics'
                    ? 'Topik yang muncul dalam sampel percakapanmu.'
                    : view === 'replies'
                      ? 'Mulai percakapan yang relevan, dengan suaramu sendiri.'
                      : view === 'leads'
                        ? 'Cari bukti kebutuhan, bukan sekadar profil yang cocok.'
                        : view === 'connections'
                          ? 'Temukan orang, organisasi, dan komunitas yang relevan.'
                          : view === 'outcomes'
                            ? 'Catat hasil nyata dan dari mana percakapan dimulai.'
                            : 'Pantau kredit dari admin dan pemakaian workspace-mu.'}
              </p>
            </div>
            <div className="row">
              <button
                className="secondary"
                disabled={!run}
                onClick={() =>
                  run && download(run, `orbit-${run.target.replace(/[^\w-]/g, '_')}.json`)
                }
              >
                <Download size={16} />
                Ekspor
              </button>
              <label className="secondary import-label">
                <Upload size={16} />
                Impor
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    importFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="notice success">
              {message}
            </div>
          )}
          {busy && (
            <div role="status" className="notice">
              <LoaderCircle className="spin" size={17} />{' '}
              {busy === 'analyze'
                ? 'AI sedang membaca sampel. Bisa memerlukan 1–2 menit…'
                : 'Memproses…'}
            </div>
          )}
          {view !== 'settings' && view !== 'outcomes' && (
            <>
              <section className="research-panel" aria-labelledby="research-title">
                <div className="panel-heading">
                  <div>
                    <h2 id="research-title">Parameter riset</h2>
                    <p>Ambil sampel terlebih dahulu, lalu pilih analisis AI secara terpisah.</p>
                  </div>
                  <span className="badge">Menggunakan kredit</span>
                </div>
                <div className="research-bar">
                  <div className="field">
                    <label htmlFor="research-target">
                      {view === 'account' ? 'Username akun' : 'Niche / keyword'}
                    </label>
                    <div className="input-icon">
                      <Search size={17} />
                      <input
                        id="research-target"
                        value={view === 'account' ? handle : niche}
                        onChange={(e) =>
                          view === 'account' ? setHandle(e.target.value) : setNiche(e.target.value)
                        }
                        placeholder={
                          view === 'account' ? '@username' : 'Contoh: SaaS, kuliner, pendidikan'
                        }
                      />
                    </div>
                  </div>
                  <div className="field compact">
                    <label htmlFor="research-language">Bahasa reply</label>
                    <select
                      id="research-language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="id">Indonesia</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </div>
                  <div className="field compact sample-count">
                    <label htmlFor="post-limit">Jumlah post</label>
                    <input
                      id="post-limit"
                      type="number"
                      min={view === 'account' ? 5 : 10}
                      max="100"
                      step="1"
                      value={postLimit}
                      onChange={(e) => setPostLimit(Number(e.target.value))}
                    />
                    <small>
                      {view === 'account'
                        ? 'original + quote; replies/repost tetap 50 · maks 100'
                        : 'hasil recent · maks 100'}
                    </small>
                  </div>
                  <button
                    className="primary"
                    disabled={
                      !!busy ||
                      !state.configured.x ||
                      state.balance <= 0 ||
                      !Number.isInteger(postLimit) ||
                      postLimit < (view === 'account' ? 5 : 10) ||
                      postLimit > 100 ||
                      (view === 'account' ? !handle.trim() : !niche.trim() && !query.trim())
                    }
                    onClick={() =>
                      act('collect', {
                        mode: view,
                        target: handle,
                        niche,
                        language,
                        query,
                        postLimit,
                        leadPreset,
                      })
                    }
                  >
                    <Search size={17} />
                    Ambil data X
                  </button>
                </div>
                {view === 'account' && (
                  <div className="research-context">
                    <label htmlFor="research-context">Konteks riset (opsional)</label>
                    <input
                      id="research-context"
                      value={niche}
                      onChange={(event) => setNiche(event.target.value)}
                      placeholder="Contoh: industri, produk, profesi, atau tujuan riset"
                    />
                    <small className="muted">
                      Tanpa konteks, analisis mengikuti bukti pada akun; tidak mengasumsikan niche
                      tertentu.
                    </small>
                  </div>
                )}
                {state.balance <= 0 && (
                  <p className="notice">
                    Kredit belum tersedia untuk request berbayar. Hubungi admin untuk menambah
                    kredit; demo dan impor tetap gratis.
                  </p>
                )}
                {!state.configured.x && (
                  <p className="notice">
                    Layanan pengambilan data belum tersedia. Hubungi admin untuk memeriksa layanan.
                  </p>
                )}
                {view === 'leads' && (
                  <section className="research-bar preset-bar">
                    <div className="field">
                      <label htmlFor="lead-preset">Lead preset</label>
                      <select
                        id="lead-preset"
                        value={leadPreset}
                        onChange={(e) => setLeadPreset(e.target.value as LeadPreset)}
                      >
                        {Object.entries(leadPresets).map(([id, preset]) => (
                          <option key={id} value={id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="muted small">{leadPresets[leadPreset].intent}</p>
                  </section>
                )}
                {view !== 'account' && (
                  <details className="query-box">
                    <summary>Edit query pencarian X</summary>
                    <input
                      aria-label="Query pencarian X"
                      value={query}
                      placeholder={queryFor(view as Mode, niche, language, leadPreset)}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <small>
                      Default mencari post recent; bahasa bisa diubah. Edit query untuk kebutuhan
                      lebih spesifik.
                    </small>
                  </details>
                )}
              </section>
              <div className="context-row">
                <div className="row">
                  <label htmlFor="run-select">Riset tersimpan</label>
                  <select
                    id="run-select"
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setPostPageIndex(1);
                      setCandidatePageIndex(1);
                    }}
                  >
                    <option value="">Pilih riset</option>
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.source === 'demo' ? '[DEMO] ' : ''}
                        {r.target} · {r.mode} · {fmt(r.created)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="muted small">
                  {run ? 'Diambil ' + fmt(run.created) : 'Belum ada pengambilan'}
                </span>
              </div>
              {!run ? (
                <section className="empty card">
                  <Orbit size={44} />
                  <h2>
                    {view === 'account'
                      ? 'Mulai dari satu akun.'
                      : view === 'topics'
                        ? 'Temukan topik percakapan.'
                        : view === 'leads'
                          ? 'Cari kebutuhan yang nyata.'
                          : view === 'connections'
                            ? 'Kenali komunitas yang relevan.'
                            : 'Temukan percakapan untuk disapa.'}
                  </h2>
                  <p>
                    Gunakan kredit dari admin untuk mengambil data, atau coba data fiktif gratis
                    untuk menjelajahi seluruh alur.
                  </p>
                  <button className="primary" disabled={!!busy} onClick={() => act('demo')}>
                    Coba data demo
                  </button>
                  <button className="text-button" onClick={() => changeView('settings')}>
                    Lihat kredit & format impor
                  </button>
                </section>
              ) : (
                <>
                  {run.source === 'demo' && (
                    <div className="demo-strip">
                      DEMO FIKTIF{' '}
                      <span>
                        Contoh untuk mencoba dashboard. Bukan akun, metrik, atau leads nyata.
                      </span>
                    </div>
                  )}
                  <div className="analysis-actions">
                    <span className="small muted">
                      {run.payload.profile ? '@' + run.payload.profile.username : run.target} ·{' '}
                      {posts.length} record · {a ? 'Analisis tersedia' : 'Belum dianalisis'}
                      <span className="analysis-scope">AI membaca teks, bukan gambar.</span>
                    </span>
                    <div className="row">
                      <button
                        className="secondary"
                        disabled={
                          !!busy ||
                          !state.configured.ai ||
                          state.balance <= 0 ||
                          run.source === 'demo' ||
                          !!a
                        }
                        onClick={() => act('analyze', { id: run.id, language, niche })}
                      >
                        <Sparkles size={15} />
                        {a ? 'Analisis tersimpan' : 'Analisis AI'}
                      </button>
                      <button
                        className="icon-button"
                        title="Hapus riset ini"
                        disabled={!!busy}
                        onClick={() => {
                          if (confirm('Hapus riset ini? Catatan inquiry dan biaya tetap disimpan.'))
                            act('deleteRun', { id: run.id });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {!state.configured.ai && run.source !== 'demo' && !a && (
                    <p className="notice">
                      Layanan analisis AI belum tersedia. Hubungi admin untuk memeriksa layanan.
                    </p>
                  )}
                  {view === 'account' && (
                    <>
                      <div className="stats-grid">
                        <Metric
                          label="POST ORIGINAL + QUOTE"
                          value={`${stat.count} / ${postCount}`}
                          note={
                            stat.count < postCount
                              ? 'Sampel belum mencapai target'
                              : 'Sampel analisis utama'
                          }
                        />
                        <Metric
                          label="FREKUENSI POSTING"
                          value={stat.frequency === null ? '—' : num(stat.frequency)}
                          note={`post / minggu · ${fmt(stat.from)}–${fmt(stat.to)}`}
                        />
                        <Metric
                          label="RATA-RATA INTERAKSI"
                          value={num(stat.mean)}
                          note={`${stat.metricCount} post bermetrik lengkap`}
                        />
                        <Metric
                          label="INTERAKSI TERTINGGI"
                          value={num(stat.best ? engagement(stat.best) : null)}
                          note="likes + replies + reposts + quotes"
                        />
                      </div>
                      <div className="two-column">
                        <section className="card profile-card">
                          <div className="section-head">
                            <h2>Profil & positioning</h2>
                            <span className="badge">
                              {run.source === 'demo' ? 'Contoh' : 'Interpretasi AI'}
                            </span>
                          </div>
                          <div className="profile-line">
                            <span className="profile-avatar">
                              {(run.payload.profile?.name || '?').slice(0, 1)}
                            </span>
                            <div>
                              <h3>{run.payload.profile?.name || 'Profil tidak tersedia'}</h3>
                              <p>{run.payload.profile?.bio || 'Bio belum diambil.'}</p>
                            </div>
                          </div>
                          <dl>
                            <dt>Positioning</dt>
                            <dd>
                              {a?.positioning || 'Jalankan analisis AI untuk membaca positioning.'}
                            </dd>
                            <dt>Kesan akun</dt>
                            <dd>{a?.feel || 'Belum dianalisis'}</dd>
                            <dt>Brand / identitas</dt>
                            <dd>{a?.brand || 'Belum dianalisis'}</dd>
                          </dl>
                          <div className="evidence">
                            {a?.evidence_ids.map((id) => {
                              const post = posts.find((item) => item.id === id);
                              return post ? (
                                <div className="evidence-item" key={id}>
                                  <span className="small muted">
                                    @{post.author} · {fmt(post.created_at)}
                                  </span>
                                  <Link post={post} />
                                </div>
                              ) : null;
                            })}
                          </div>
                        </section>
                        <section className="card">
                          <div className="section-head">
                            <h2>Content mix</h2>
                            <span className="small muted">Kategori utama</span>
                          </div>
                          <div className="mix">
                            {categories.map((c, i) => {
                              const count =
                                a?.posts.filter(
                                  (p) =>
                                    p.category === c &&
                                    posts.some(
                                      (x) =>
                                        x.id === p.id && ['original', 'quote'].includes(x.kind),
                                    ),
                                ).length || 0;
                              return (
                                <div key={c} className="mix-line">
                                  <span>{c}</span>
                                  <div className="track">
                                    <div
                                      style={{
                                        width: `${stat.count ? (count / stat.count) * 100 : 0}%`,
                                        background: [
                                          '#e97051',
                                          '#176c63',
                                          '#7388a0',
                                          '#589ea4',
                                          '#b0aa67',
                                          '#805e94',
                                        ][i],
                                      }}
                                    />
                                  </div>
                                  <strong>{count}</strong>
                                </div>
                              );
                            })}
                          </div>
                          {!a && (
                            <p className="muted small">Kategori tersedia setelah analisis AI.</p>
                          )}
                          <p className="footnote">
                            Satu kategori utama per post. Tag tambahan muncul di tabel.
                          </p>
                        </section>
                      </div>
                      <div
                        className="tabs"
                        role="tablist"
                        aria-label="Detail analisis akun"
                        onKeyDown={(event) => {
                          const options = ['posts', 'behavior', 'highlights'];
                          const index = options.indexOf(tab);
                          const next =
                            event.key === 'ArrowRight'
                              ? (index + 1) % 3
                              : event.key === 'ArrowLeft'
                                ? (index + 2) % 3
                                : event.key === 'Home'
                                  ? 0
                                  : event.key === 'End'
                                    ? 2
                                    : -1;
                          if (next < 0) return;
                          event.preventDefault();
                          setTab(options[next]);
                          (event.currentTarget.children[next] as HTMLButtonElement).focus();
                        }}
                      >
                        <button
                          role="tab"
                          id="tab-posts"
                          aria-selected={tab === 'posts'}
                          aria-controls="account-detail"
                          tabIndex={tab === 'posts' ? 0 : -1}
                          className={tab === 'posts' ? 'chosen' : ''}
                          onClick={() => setTab('posts')}
                        >
                          Post & tone
                        </button>
                        <button
                          role="tab"
                          id="tab-behavior"
                          aria-selected={tab === 'behavior'}
                          aria-controls="account-detail"
                          tabIndex={tab === 'behavior' ? 0 : -1}
                          className={tab === 'behavior' ? 'chosen' : ''}
                          onClick={() => setTab('behavior')}
                        >
                          Replies & repost
                        </button>
                        <button
                          role="tab"
                          id="tab-highlights"
                          aria-selected={tab === 'highlights'}
                          aria-controls="account-detail"
                          tabIndex={tab === 'highlights' ? 0 : -1}
                          className={tab === 'highlights' ? 'chosen' : ''}
                          onClick={() => setTab('highlights')}
                        >
                          Pinned & highlights
                        </button>
                      </div>
                      <div role="tabpanel" id="account-detail" aria-labelledby={`tab-${tab}`}>
                        {tab === 'posts' ? (
                          <section className="card table-card">
                            <div className="table-tools">
                              <div className="row">
                                <select
                                  aria-label="Jenis post"
                                  value={kind}
                                  onChange={(e) => {
                                    setKind(e.target.value);
                                    setPostPageIndex(1);
                                  }}
                                >
                                  <option value="original">Original + quote</option>
                                  <option value="reply">Replies</option>
                                  <option value="repost">Reposts</option>
                                  <option value="context">Konteks</option>
                                  <option value="all">Semua</option>
                                </select>
                                <select
                                  aria-label="Kategori"
                                  value={category}
                                  onChange={(e) => {
                                    setCategory(e.target.value);
                                    setPostPageIndex(1);
                                  }}
                                >
                                  <option>All</option>
                                  {categories.map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                                </select>
                              </div>
                              <input
                                aria-label="Cari post"
                                placeholder="Cari teks atau akun…"
                                value={filter}
                                onChange={(e) => {
                                  setFilter(e.target.value);
                                  setPostPageIndex(1);
                                }}
                              />
                            </div>
                            <p className="mobile-table-hint">
                              Geser tabel ke samping untuk melihat semua kolom.
                            </p>
                            <div
                              className="table-scroll"
                              tabIndex={0}
                              role="region"
                              aria-label="Tabel post"
                            >
                              <table>
                                <thead>
                                  <tr>
                                    <th>POST / TANGGAL</th>
                                    <th>KATEGORI & TONE</th>
                                    <th>LIKES</th>
                                    <th>REPLIES</th>
                                    <th>REPOSTS</th>
                                    <th>QUOTES</th>
                                    <th>VIEWS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {postPage.items.map((p) => {
                                    const c = classified.get(p.id);
                                    return (
                                      <tr key={p.id}>
                                        <td className="post-cell">
                                          <p>{p.text}</p>
                                          <div className="row small muted">
                                            <span>
                                              @{p.author} · {fmt(p.created_at)}
                                            </span>
                                            <Link post={p} />
                                          </div>
                                        </td>
                                        <td className="tone-cell">
                                          <span
                                            className={
                                              'category category-' + (c?.category || 'none')
                                            }
                                          >
                                            {c?.category || 'Belum dianalisis'}
                                          </span>
                                          <p>{c?.tone || '—'}</p>
                                          {c?.tags.length ? (
                                            <small>{c.tags.join(' · ')}</small>
                                          ) : null}
                                          <details>
                                            <summary>Alasan</summary>
                                            {c?.reason || 'Belum tersedia'}
                                          </details>
                                        </td>
                                        <td>{num(p.metrics.likes)}</td>
                                        <td>{num(p.metrics.replies)}</td>
                                        <td>{num(p.metrics.reposts)}</td>
                                        <td>{num(p.metrics.quotes)}</td>
                                        <td>{num(p.metrics.views)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {!visible.length && (
                              <p className="empty-small">
                                Tidak ada post yang cocok. Ubah kata pencarian atau filter kategori.
                              </p>
                            )}
                            <WorkspacePagination
                              page={postPage}
                              onChange={setPostPageIndex}
                              label="post"
                            />
                          </section>
                        ) : tab === 'behavior' ? (
                          <div className="two-column">
                            <section className="card">
                              <h2>Replies · {posts.filter((p) => p.kind === 'reply').length}</h2>
                              <p>{a?.reply_pattern || 'Belum dianalisis.'}</p>
                              {posts
                                .filter((p) => p.kind === 'reply')
                                .map((p) => (
                                  <PostCard key={p.id} post={p} />
                                ))}
                            </section>
                            <section className="card">
                              <h2>Reposts · {posts.filter((p) => p.kind === 'repost').length}</h2>
                              <p>{a?.repost_pattern || 'Belum dianalisis.'}</p>
                              {posts
                                .filter((p) => p.kind === 'repost')
                                .map((p) => (
                                  <PostCard key={p.id} post={p} />
                                ))}
                            </section>
                          </div>
                        ) : (
                          <div className="highlight-grid">
                            <section className="card">
                              <h2>
                                <Pin size={17} /> Pinned post
                              </h2>
                              {posts.find((p) => p.id === run.payload.profile?.pinned_id) ? (
                                <PostCard
                                  post={posts.find((p) => p.id === run.payload.profile?.pinned_id)!}
                                />
                              ) : (
                                <p className="muted">
                                  Tidak ada pinned post yang tersedia dalam data.
                                </p>
                              )}
                            </section>
                            <section className="card">
                              <h2>Interaksi terbanyak</h2>
                              {stat.best && <PostCard post={stat.best} />}
                            </section>
                            <section className="card">
                              <h2>Rasio terhadap views</h2>
                              {stat.rateBest ? (
                                <>
                                  <strong className="big-number">
                                    {num(
                                      (engagement(stat.rateBest)! / stat.rateBest.metrics.views!) *
                                        100,
                                    )}
                                    %
                                  </strong>
                                  <PostCard post={stat.rateBest} />
                                </>
                              ) : (
                                <p>Views tidak tersedia.</p>
                              )}
                            </section>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {view === 'topics' && (
                    <>
                      <div className="notice">
                        Topik dominan dalam sampel — belum menyatakan tren meningkat. Gunakan
                        periode dan query yang sebanding untuk evaluasi lanjutan.
                      </div>
                      <div className="stats-grid discovery-stats">
                        <Metric
                          label="TOPIK DALAM SAMPEL"
                          value={String(a?.topics.length || 0)}
                          note="Hasil interpretasi teks"
                        />
                        <Metric
                          label="POST DALAM SAMPEL"
                          value={String(posts.length)}
                          note="Bukan seluruh riwayat X"
                        />
                        <Metric
                          label="POST BUKTI UNIK"
                          value={String(
                            new Set(
                              a?.topics.flatMap((topic) =>
                                topic.evidence_ids.filter((id) =>
                                  posts.some((post) => post.id === id),
                                ),
                              ) || [],
                            ).size,
                          )}
                          note="Sumber untuk ditinjau"
                        />
                      </div>
                      <div className="topic-grid">
                        {a?.topics.map((t, i) => (
                          <section key={i} className="card topic-card">
                            <span className="topic-number">{String(i + 1).padStart(2, '0')}</span>
                            <h2>{t.name}</h2>
                            <p>{t.reason}</p>
                            <span className="badge">{t.evidence_ids.length} post bukti</span>
                            <div
                              className="topic-evidence"
                              aria-label={`Bukti ${t.name}`}
                              tabIndex={0}
                            >
                              {t.evidence_ids.map((id) => (
                                <PostCard key={id} post={posts.find((p) => p.id === id)} />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                      {!a?.topics.length && (
                        <div className="empty card">
                          Belum ada topik. Ambil sampel lalu jalankan analisis AI.
                        </div>
                      )}
                    </>
                  )}
                  {['leads', 'connections', 'replies'].includes(view) && (
                    <>
                      <div className="list-heading">
                        <h2>{candidates.length} kandidat dalam sampel</h2>
                        <span className="muted small">
                          Penilaian AI perlu ditinjau • Tidak ada pengiriman otomatis
                        </span>
                      </div>
                      <div className="stats-grid discovery-stats">
                        <Metric
                          label="KANDIDAT DALAM SAMPEL"
                          value={String(candidates.length)}
                          note={
                            view === 'leads'
                              ? 'Periksa bukti buying intent'
                              : view === 'connections'
                                ? 'Koneksi, bukan otomatis client'
                                : 'Percakapan untuk ditinjau'
                          }
                        />
                        <Metric
                          label="KECOCOKAN KUAT"
                          value={String(
                            candidates.filter((candidate) => candidate.fit === 'high').length,
                          )}
                          note="Penilaian AI, bukan kepastian"
                        />
                        <Metric
                          label="POST DALAM SAMPEL"
                          value={String(posts.length)}
                          note="Pencarian recent, bukan histori lengkap"
                        />
                      </div>
                      <div className="table-tools candidate-tools">
                        <input
                          aria-label="Cari kandidat"
                          placeholder="Cari akun, post, atau alasan…"
                          value={candidateSearch}
                          onChange={(event) => {
                            setCandidateSearch(event.target.value);
                            setCandidatePageIndex(1);
                          }}
                        />
                        <select
                          aria-label="Kecocokan kandidat"
                          value={candidateFit}
                          onChange={(event) => {
                            setCandidateFit(event.target.value);
                            setCandidatePageIndex(1);
                          }}
                        >
                          <option value="all">Semua kecocokan</option>
                          <option value="high">Kecocokan kuat</option>
                          <option value="medium">Perlu ditinjau</option>
                          <option value="low">Bukti terbatas</option>
                        </select>
                      </div>
                      <div className="candidate-list">
                        {candidatePage.items.map((c) => (
                          <Candidate
                            key={run.id + c.post_id + c.type}
                            candidate={c}
                            draft={drafts[run.id + c.post_id + c.type] ?? c.draft}
                            onDraftChange={(draft) =>
                              setDrafts((previous) => ({
                                ...previous,
                                [run.id + c.post_id + c.type]: draft,
                              }))
                            }
                            post={posts.find((p) => p.id === c.post_id)}
                            onSave={(draft) =>
                              act('draft', {
                                id: run.id,
                                post_id: c.post_id,
                                type: c.type,
                                draft,
                              })
                            }
                            onRecord={() => {
                              const post = posts.find((p) => p.id === c.post_id);
                              setEditId('');
                              setError('');
                              setMessage('');
                              setOutcomeSearch('');
                              setOutcomeType('all');
                              setOutcomePageIndex(1);
                              setOutcome({
                                ...emptyOutcome,
                                account: post?.author || '',
                                source: post ? sourceUrl(post) : '',
                              });
                              setShowForm(true);
                              setView('outcomes');
                            }}
                          />
                        ))}
                      </div>
                      {!matchingCandidates.length && (
                        <div className="empty card">
                          <Target size={32} />
                          <h2>
                            {candidates.length
                              ? 'Tidak ada kandidat yang cocok.'
                              : 'Belum ada kandidat.'}
                          </h2>
                          <p>
                            {candidates.length
                              ? 'Ubah kata pencarian atau kecocokan untuk melihat hasil lain.'
                              : 'Ambil sampel lalu jalankan analisis; hanya kandidat dengan alasan berbasis bukti yang ditampilkan.'}
                          </p>
                        </div>
                      )}
                      <WorkspacePagination
                        page={candidatePage}
                        onChange={setCandidatePageIndex}
                        label="kandidat"
                      />
                    </>
                  )}
                  <details className="method">
                    <summary>Catatan data & metode</summary>
                    <ul>
                      {run.payload.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    <p>
                      Frequency = (jumlah post − 1) ÷ selisih hari antar post terlama/terbaru × 7.
                      Sampel bukan kalender mingguan lengkap. Engagement = likes + replies + reposts
                      + quotes; data kosong tidak dianggap nol. Kategori, brand, dan penilaian
                      kandidat adalah interpretasi. Inquiry, DM, order hanya berasal dari catatan
                      manual.
                    </p>
                  </details>
                </>
              )}
            </>
          )}
          {view === 'outcomes' && (
            <>
              <div className="stats-grid">
                <Metric
                  label="INQUIRY TERCATAT"
                  value={String(state.outcomes.filter((o: any) => o.type === 'Inquiry').length)}
                  note="Input manual"
                />
                <Metric
                  label="DM TERCATAT"
                  value={String(state.outcomes.filter((o: any) => o.type === 'DM').length)}
                  note="Input manual"
                />
                <Metric
                  label="ORDER TERCATAT"
                  value={String(state.outcomes.filter((o: any) => o.type === 'Order').length)}
                  note="Input manual"
                />
                <Metric
                  label="ATRIBUSI DIKONFIRMASI"
                  value={String(
                    state.outcomes.filter((o: any) => o.attribution === 'Dikonfirmasi client')
                      .length,
                  )}
                  note="Sumber dikonfirmasi client"
                />
              </div>
              <div className="list-heading">
                <p>Angka ini tidak diturunkan dari views atau likes.</p>
                <button
                  className="primary"
                  onClick={() => {
                    setEditId('');
                    setOutcome(emptyOutcome);
                    setShowForm(true);
                  }}
                >
                  <Plus size={16} />
                  Tambah catatan
                </button>
              </div>
              {showForm && (
                <form
                  className="card outcome-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await act('outcome', {
                        id: editId || undefined,
                        data: {
                          ...outcome,
                          amount: outcome.amount === '' ? null : Number(outcome.amount),
                        },
                      })
                    ) {
                      setShowForm(false);
                      setEditId('');
                      setOutcome(emptyOutcome);
                    }
                  }}
                >
                  <h2>{editId ? 'Edit' : 'Tambah'} catatan hasil</h2>
                  <div className="form-grid">
                    {[
                      ['account', 'Akun'],
                      ['date', 'Tanggal'],
                      ['source', 'Link sumber (opsional)'],
                      ['amount', 'Nilai order (opsional)'],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          required={key === 'account' || key === 'date'}
                          type={key === 'date' ? 'date' : key === 'amount' ? 'number' : 'text'}
                          min={key === 'amount' ? '0' : undefined}
                          step={key === 'amount' ? '0.01' : undefined}
                          value={outcome[key]}
                          onChange={(e) => setOutcome({ ...outcome, [key]: e.target.value })}
                        />
                      </label>
                    ))}
                    <label>
                      Jenis
                      <select
                        aria-label="Jenis"
                        value={outcome.type}
                        onChange={(e) => setOutcome({ ...outcome, type: e.target.value })}
                      >
                        {['Inquiry', 'DM', 'Order'].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Atribusi
                      <select
                        aria-label="Atribusi"
                        value={outcome.attribution}
                        onChange={(e) =>
                          setOutcome({
                            ...outcome,
                            attribution: e.target.value,
                          })
                        }
                      >
                        {['Tidak diketahui', 'Catatan pribadi', 'Dikonfirmasi client'].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Mata uang
                      <select
                        aria-label="Mata uang"
                        value={outcome.currency}
                        onChange={(e) => setOutcome({ ...outcome, currency: e.target.value })}
                      >
                        <option>USD</option>
                        <option>IDR</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Catatan
                    <textarea
                      value={outcome.notes}
                      onChange={(e) => setOutcome({ ...outcome, notes: e.target.value })}
                    />
                  </label>
                  <div className="row">
                    <button disabled={!!busy} className="primary">
                      Simpan catatan
                    </button>
                    <button type="button" className="secondary" onClick={() => setShowForm(false)}>
                      Batal
                    </button>
                  </div>
                </form>
              )}
              <section className="card table-card outcome-table">
                <div className="table-tools">
                  <div>
                    <h2>Catatan hasil</h2>
                    <span className="small muted">
                      Dicatat manual · tidak dihitung dari engagement
                    </span>
                  </div>
                  <div className="row">
                    <input
                      aria-label="Cari catatan hasil"
                      placeholder="Cari akun atau catatan…"
                      value={outcomeSearch}
                      onChange={(event) => {
                        setOutcomeSearch(event.target.value);
                        setOutcomePageIndex(1);
                      }}
                    />
                    <select
                      aria-label="Jenis catatan hasil"
                      value={outcomeType}
                      onChange={(event) => {
                        setOutcomeType(event.target.value);
                        setOutcomePageIndex(1);
                      }}
                    >
                      <option value="all">Semua jenis</option>
                      <option>Inquiry</option>
                      <option>DM</option>
                      <option>Order</option>
                    </select>
                  </div>
                </div>
                <p className="mobile-table-hint">
                  Geser tabel ke samping untuk melihat semua kolom.
                </p>
                <div className="table-scroll" tabIndex={0} role="region" aria-label="Catatan hasil">
                  <table>
                    <thead>
                      <tr>
                        <th>TANGGAL</th>
                        <th>AKUN / JENIS</th>
                        <th>SUMBER & ATRIBUSI</th>
                        <th>NILAI</th>
                        <th>CATATAN</th>
                        <th>AKSI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outcomePage.items.map((o: any) => (
                        <tr key={o.id}>
                          <td>{fmt(o.date)}</td>
                          <td>
                            <strong>{o.account}</strong>
                            <p>
                              <span className="badge">{o.type}</span>
                            </p>
                          </td>
                          <td>
                            {/^https:\/\/(x\.com|twitter\.com)\//.test(o.source) ? (
                              <a href={o.source} target="_blank" rel="noreferrer">
                                Link sumber
                              </a>
                            ) : (
                              <span>{o.source || 'Tidak diketahui'}</span>
                            )}
                            <p className="small muted">{o.attribution}</p>
                          </td>
                          <td>{o.amount === null ? '—' : o.currency + ' ' + num(o.amount)}</td>
                          <td>{o.notes || '—'}</td>
                          <td>
                            <div className="row">
                              <button
                                className="text-button"
                                onClick={() => {
                                  setOutcome({ ...o, amount: o.amount ?? '' });
                                  setEditId(o.id);
                                  setShowForm(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                title="Hapus catatan"
                                className="icon-button"
                                onClick={() => {
                                  if (confirm('Hapus catatan ini?'))
                                    act('deleteOutcome', { id: o.id });
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!matchingOutcomes.length && (
                  <div className="empty-small">
                    {state.outcomes.length
                      ? 'Tidak ada catatan yang cocok dengan filter.'
                      : 'Belum ada inquiry, DM, atau order yang dicatat.'}
                  </div>
                )}
                <WorkspacePagination
                  page={outcomePage}
                  onChange={setOutcomePageIndex}
                  label="catatan"
                />
              </section>
              <button
                className="text-button"
                onClick={() => download(state.outcomes, 'orbit-outcomes.json')}
              >
                Ekspor catatan hasil
              </button>
            </>
          )}
          {view === 'settings' && (
            <>
              <CreditPanel
                credit={state.credit}
                ledger={state.ledger || []}
                isAdmin={state.user?.role === 'admin'}
                busy={!!busy}
                onRefresh={load}
              />
              <section className="card">
                <h2>Coba tanpa menggunakan kredit</h2>
                <p>
                  Demo memakai 50 post original fiktif, contoh replies/repost, dan kandidat. Impor
                  memakai format JSON yang sama; data impor tetap ditandai sebagai impor.
                </p>
                <div className="row">
                  <button
                    className="primary"
                    disabled={!!busy}
                    onClick={async () => {
                      if (await act('demo')) setView('account');
                    }}
                  >
                    Muat demo fiktif
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        {
                          profile: {
                            username: 'your_handle',
                            name: 'Creator',
                            bio: '',
                            pinned_id: null,
                          },
                          posts: [
                            {
                              id: 'REAL_POST_ID',
                              text: 'Isi teks post',
                              author: 'your_handle',
                              created_at: new Date().toISOString(),
                              kind: 'original',
                              url: '',
                              metrics: {
                                likes: null,
                                replies: null,
                                reposts: null,
                                quotes: null,
                                views: null,
                              },
                              media: [],
                              references: [],
                            },
                          ],
                          warnings: ['Data diimpor manual.'],
                        },
                        'orbit-import-template.json',
                      )
                    }
                  >
                    Unduh template JSON
                  </button>
                </div>
              </section>
            </>
          )}
          <footer>
            <span>
              orbit. <span className="muted">Research with context.</span>
            </span>
            <span>Data → bukti → percakapan</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="metric">
      <span className="tiny-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
function PostCard({ post }: { post?: Post }) {
  if (!post) return null;
  return (
    <div className="post-card">
      <p>{post.text}</p>
      <span className="small muted">
        @{post.author} · {fmt(post.created_at)}
      </span>
      <div>
        <Link post={post} />
      </div>
    </div>
  );
}
function Candidate({
  candidate: c,
  post,
  draft,
  onDraftChange,
  onSave,
  onRecord,
}: {
  candidate: Analysis['candidates'][number];
  draft: string;
  onDraftChange: (draft: string) => void;
  post?: Post;
  onSave: (draft: string) => Promise<boolean>;
  onRecord: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <section className="card candidate">
      <div>
        <div className="section-head">
          <h2>@{post?.author || 'unknown'}</h2>
          <span className={'fit ' + c.fit}>
            {c.fit === 'high'
              ? 'Kecocokan kuat'
              : c.fit === 'medium'
                ? 'Perlu ditinjau'
                : 'Bukti terbatas'}
          </span>
        </div>
        <PostCard post={post} />
        <p className="reason">
          <strong>Alasan relevansi</strong>
          {c.reason}
        </p>
        {c.type === 'lead' && (
          <dl className="lead-details">
            <dt>Kebutuhan</dt>
            <dd>{c.need || 'Tidak disebutkan'}</dd>
            <dt>Waktu</dt>
            <dd>{c.timing || 'Tidak disebutkan'}</dd>
            <dt>Budget</dt>
            <dd>{c.budget || 'Tidak disebutkan'}</dd>
          </dl>
        )}
        <button className="text-button" onClick={onRecord}>
          Catat inquiry / DM / order
        </button>
      </div>
      <div className="draft-box">
        <label htmlFor={`draft-${c.type}-${c.post_id}`}>
          <Sparkles size={16} /> Draft reply · edit sebelum digunakan
        </label>
        <textarea
          id={`draft-${c.type}-${c.post_id}`}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
        />
        <div className="row">
          <button
            className="secondary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Menyimpan…' : 'Simpan draft'}
          </button>
          <button
            className="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(draft);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                alert('Clipboard tidak tersedia. Pilih dan salin teks secara manual.');
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <small className="muted">Kamu yang mengirim. Tidak ada auto-reply.</small>
      </div>
    </section>
  );
}
