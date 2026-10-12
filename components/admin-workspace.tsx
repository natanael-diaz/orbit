'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Native page navigation is verified in the built Vinext runtime and rechecks authorization. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Orbit,
  LayoutDashboard,
  Users,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowLeft,
  RefreshCw,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  CircleDollarSign,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Power,
  X,
  Info,
  ArrowDownLeft,
  Sparkles,
  Check,
  History,
  ChevronDown,
} from 'lucide-react';
import AuthPanel, { logoutSession } from './auth-panel';
import {
  type AdminData,
  type AdminUser,
  type LedgerEntry,
  type CreditGrant,
  formatUSD as usd,
  initials,
  providerTotals,
  filterUsers,
  filterLedger,
  paginate,
} from '../lib/admin-view';

const date = (value: string) =>
  new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const blank = {
  id: '',
  name: '',
  email: '',
  password: '',
  role: 'user' as 'admin' | 'user',
  active: true,
};
type Modal = 'user' | 'credit' | null;

export default function AdminWorkspace({ view }: { view: 'dashboard' | 'users' }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [auth, setAuth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updated, setUpdated] = useState('');
  const [tab, setTab] = useState<'overview' | 'requests'>('overview');
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState(blank);
  const [creditUser, setCreditUser] = useState('');
  const [amount, setAmount] = useState('3');
  const [note, setNote] = useState('');
  const [grantId, setGrantId] = useState('');
  async function load() {
    const response = await fetch('/api/admin');
    const result = (await response.json()) as AdminData & { error: string };
    if (response.status === 401 || response.status === 403) {
      setData(null);
      setModal(null);
      setForm(blank);
      if (response.status === 401) {
        setAuth(false);
        return;
      }
    }
    if (!response.ok) throw Error(result.error);
    setAuth(true);
    setData(result);
    setUpdated(new Date().toISOString());
    setGrantId((existing) => existing || crypto.randomUUID());
  }
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((e) => setError(e.message));
  }, []);
  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error: string; sessionRevoked?: boolean };
      if (response.status === 401 || response.status === 403) {
        await load();
        throw Error(result.error);
      }
      if (!response.ok) throw Error(result.error);
      if (result.sessionRevoked) {
        // Full navigation clears account-specific React state after session revocation.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/');
        return true;
      }
      await load();
      setMessage('Tersimpan.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function editUser(user?: AdminUser) {
    setError('');
    setMessage('');
    setForm(
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            active: !!user.active,
            password: '',
          }
        : blank,
    );
    setModal('user');
  }
  function openCredit(user?: AdminUser) {
    setError('');
    setMessage('');
    setCreditUser(user?.id || '');
    setNote('');
    setModal('credit');
  }
  function closeModal() {
    if (!busy) {
      setModal(null);
      setForm((old) => ({ ...old, password: '' }));
    }
  }
  if (!auth) return <AuthPanel onReady={load} />;
  const disabled = busy || refreshing;
  const total = (field: 'balance' | 'granted' | 'reserved') =>
    data?.users.reduce((sum, user) => sum + user[field], 0) || 0;
  const x = providerTotals(data?.usage || [], 'x');
  const ai = providerTotals(data?.usage || [], 'ai');
  const spending = x.total + ai.total;
  const active = data?.users.filter((user) => user.active).length || 0;
  return (
    <div className="oa-shell">
      <a className="oa-skip" href="#oa-main">
        Lewati navigasi
      </a>
      <aside className="oa-sidebar">
        <a className="oa-brand" href="/admin" aria-label="Orbit Admin">
          <span className="oa-brand-mark">
            <Orbit size={23} />
          </span>
          <span>
            <strong>
              orbit<span>.</span>
            </strong>
            <small>Admin workspace</small>
          </span>
        </a>
        <div className="oa-nav-label">PENGELOLAAN</div>
        <nav className="oa-nav" aria-label="Admin">
          <a href="/admin" aria-current={view === 'dashboard' ? 'page' : undefined}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </a>
          <a href="/admin/users" aria-current={view === 'users' ? 'page' : undefined}>
            <Users size={18} />
            <span>Users & kredit</span>
            {data && <span className="oa-nav-count">{data.users.length}</span>}
          </a>
        </nav>
        <div className="oa-sidebar-note">
          <Wallet size={18} />
          <strong>Satu saldo, dua provider</strong>
          <p>Kredit USD gabungan untuk riset X dan analisis AI.</p>
          <span>Tanpa registrasi publik</span>
        </div>
        <div className="oa-sidebar-bottom">
          <a className="oa-workspace-link" href="/">
            <ArrowLeft size={16} /> Kembali ke workspace <ArrowUpRight size={14} />
          </a>
          {data && (
            <div className="oa-account">
              <Avatar name={data.user.name} />
              <div>
                <strong>{data.user.name}</strong>
                <small>{data.user.email}</small>
              </div>
              <ShieldCheck size={16} aria-label="Admin" />
            </div>
          )}
          <button
            className="oa-logout"
            disabled={disabled}
            onClick={() => logoutSession().catch((e) => setError(e.message))}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <div className="oa-workspace">
        <header className="oa-topbar">
          <div className="oa-breadcrumb">
            Admin <span>/</span>{' '}
            <strong>{view === 'dashboard' ? 'Ringkasan' : 'Users & kredit'}</strong>
          </div>
          <div className="oa-top-actions">
            <span className="oa-local">
              <span /> Estimasi lokal
            </span>
            <button
              className="oa-button oa-button-quiet"
              disabled={disabled}
              onClick={() => void refresh()}
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'oa-spin' : ''} />
              <span>Refresh</span>
            </button>
            {data && <Avatar name={data.user.name} />}
          </div>
        </header>
        <main id="oa-main" className="oa-main" tabIndex={-1}>
          <div className="oa-page-heading">
            <div>
              <span className="oa-eyebrow">
                {view === 'dashboard' ? 'WORKSPACE OVERVIEW' : 'ACCOUNT MANAGEMENT'}
              </span>
              <h1>{view === 'dashboard' ? 'Dashboard penggunaan' : 'Kelola user'}</h1>
              <p>
                {view === 'dashboard'
                  ? 'Pantau penggunaan, saldo, dan aktivitas kredit dalam satu tempat.'
                  : 'Kelola akses dan kredit. Setiap user memiliki ruang riset sendiri.'}
              </p>
            </div>
            <div className="oa-heading-actions">
              {view === 'dashboard' ? (
                <a className="oa-button oa-button-primary" href="/admin/users">
                  <Users size={16} /> Kelola user <ArrowUpRight size={15} />
                </a>
              ) : (
                data && (
                  <>
                    <button className="oa-button" disabled={disabled} onClick={() => openCredit()}>
                      <Wallet size={16} /> Beri kredit
                    </button>
                    <button
                      className="oa-button oa-button-primary"
                      disabled={disabled}
                      onClick={() => editUser()}
                    >
                      <Plus size={17} /> Tambah user
                    </button>
                  </>
                )
              )}
            </div>
          </div>
          {error && (
            <div className="oa-alert oa-alert-error" role="alert">
              <Info size={17} />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="oa-alert oa-alert-success" role="status">
              <Check size={17} />
              <span>{message}</span>
            </div>
          )}
          {!data && !error && (
            <div className="oa-loading" role="status">
              <RefreshCw size={20} className="oa-spin" /> Memuat data admin…
            </div>
          )}
          {data && (
            <>
              {view === 'dashboard' && (
                <>
                  <div className="oa-tabs" role="tablist" aria-label="Tampilan dashboard">
                    {(['overview', 'requests'] as const).map((id, index) => (
                      <button
                        key={id}
                        id={`oa-tab-${id}`}
                        role="tab"
                        aria-selected={tab === id}
                        aria-controls={`oa-panel-${id}`}
                        tabIndex={tab === id ? 0 : -1}
                        onClick={() => setTab(id)}
                        onKeyDown={(event) => {
                          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();
                            const next =
                              event.key === 'Home'
                                ? 'overview'
                                : event.key === 'End'
                                  ? 'requests'
                                  : index === 0
                                    ? 'requests'
                                    : 'overview';
                            setTab(next);
                            document.getElementById(`oa-tab-${next}`)?.focus();
                          }
                        }}
                      >
                        {id === 'overview' ? <LayoutDashboard size={15} /> : <History size={15} />}
                        {id === 'overview' ? 'Ringkasan' : 'Request & reservasi'}
                      </button>
                    ))}
                  </div>
                  <div className="oa-metrics">
                    <Metric
                      label="Saldo tersedia"
                      value={usd(total('balance'))}
                      detail="Gabungan X + AI · seluruh user"
                      icon={<Wallet size={18} />}
                      negative={total('balance') < 0}
                    />
                    <Metric
                      label="Estimasi penggunaan"
                      value={usd(spending)}
                      detail={`${x.requests + ai.requests} entri request · kumulatif`}
                      icon={<Activity size={18} />}
                    />
                    <Metric
                      label="Dicadangkan"
                      value={usd(total('reserved'))}
                      detail="Tagihan belum pasti · mengurangi saldo"
                      icon={<Clock3 size={18} />}
                      tone="amber"
                    />
                    <Metric
                      label="User aktif"
                      value={String(active)}
                      detail={`${data.users.length} akun total · ${data.users.length - active} nonaktif`}
                      icon={<Users size={18} />}
                    />
                  </div>
                  <div
                    id="oa-panel-overview"
                    role="tabpanel"
                    aria-labelledby="oa-tab-overview"
                    hidden={tab !== 'overview'}
                  >
                    <div className="oa-overview-grid">
                      <section className="oa-card oa-provider-card">
                        <SectionHeading
                          title="Distribusi penggunaan"
                          description="Estimasi kumulatif dari ledger lokal."
                          aside={<span className="oa-badge">X + AI</span>}
                        />
                        <div className="oa-provider-total">
                          <span>Total tercatat</span>
                          <strong>{usd(spending)}</strong>
                        </div>
                        {[
                          { label: 'X API', key: 'x', ...x },
                          { label: 'OpenAI', key: 'ai', ...ai },
                        ].map((provider) => (
                          <div
                            className={`oa-provider oa-provider-${provider.key}`}
                            key={provider.key}
                          >
                            <div className="oa-provider-label">
                              <span className="oa-provider-icon">
                                {provider.key === 'x' ? <span>𝕏</span> : <Sparkles size={17} />}
                              </span>
                              <div>
                                <strong>{provider.label}</strong>
                                <small>{provider.requests} entri request</small>
                              </div>
                              <strong>{usd(provider.total)}</strong>
                            </div>
                            <div
                              className="oa-bar"
                              role="img"
                              aria-label={`${provider.label}: ${usd(provider.total)} dari ${usd(spending)}`}
                            >
                              <span
                                style={{
                                  width: `${spending > 0 ? Math.max(0, Math.min(100, (provider.total / spending) * 100)) : 0}%`,
                                }}
                              />
                            </div>
                            <div className="oa-provider-meta">
                              <span>
                                {spending > 0
                                  ? `${((provider.total / spending) * 100).toFixed(1)}% dari total estimasi`
                                  : 'Belum ada penggunaan'}
                              </span>
                              <span>Cadangan {usd(provider.reserved)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="oa-inline-note">
                          <Info size={15} />
                          <span>
                            Termasuk cadangan dan biaya historis. Bukan tagihan resmi provider atau
                            tren bulanan.
                          </span>
                        </div>
                      </section>
                      <section className="oa-card">
                        <SectionHeading
                          title="Aktivitas kredit"
                          description="Pemberian kredit terbaru oleh admin."
                          aside={<Wallet size={18} />}
                        />
                        <div className="oa-credit-summary">
                          <span>Total kredit diberikan</span>
                          <strong>{usd(total('granted'))}</strong>
                        </div>
                        {data.grants.length ? (
                          <ul className="oa-activity-list">
                            {data.grants.slice(0, 5).map((grant) => (
                              <li key={grant.id}>
                                <span className="oa-activity-icon">
                                  <ArrowDownLeft size={17} />
                                </span>
                                <div>
                                  <strong>{grant.email}</strong>
                                  <small>{date(grant.created)}</small>
                                  <p>{grant.note}</p>
                                </div>
                                <strong className="oa-credit-amount">+{usd(grant.amount)}</strong>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyState
                            title="Belum ada aktivitas kredit"
                            description="Tambahkan kredit dari halaman Users & kredit. Setiap pemberian akan tercatat di sini."
                            icon={<Wallet size={24} />}
                          />
                        )}
                        <a className="oa-text-link" href="/admin/users">
                          Kelola kredit & lihat audit <ArrowUpRight size={14} />
                        </a>
                      </section>
                    </div>
                    <UserTable users={data.users} busy={disabled} actorId={data.user.id} />
                  </div>
                  <div
                    id="oa-panel-requests"
                    role="tabpanel"
                    aria-labelledby="oa-tab-requests"
                    hidden={tab !== 'requests'}
                  >
                    <RequestTable entries={data.ledger} />
                  </div>
                </>
              )}
              {view === 'users' && (
                <>
                  <div className="oa-user-summary">
                    <span>
                      <Users size={16} />
                      <strong>{data.users.length}</strong> akun
                    </span>
                    <span>
                      <i className="oa-dot" />
                      <strong>{active}</strong> aktif
                    </span>
                    <span>
                      <Wallet size={16} />
                      Kredit diberikan <strong>{usd(total('granted'))}</strong>
                    </span>
                    <span className="oa-summary-end">
                      <ShieldCheck size={16} /> Akses hanya dari admin
                    </span>
                  </div>
                  <UserTable
                    users={data.users}
                    busy={disabled}
                    actorId={data.user.id}
                    onEdit={editUser}
                    onCredit={openCredit}
                    onToggle={(user) => {
                      if (confirm(`${user.active ? 'Nonaktifkan' : 'Aktifkan'} ${user.email}?`))
                        void act({
                          action: 'updateUser',
                          id: user.id,
                          name: user.name,
                          email: user.email,
                          role: user.role,
                          active: !user.active,
                        });
                    }}
                  />
                  <details className="oa-card oa-audit">
                    <summary>
                      <span className="oa-audit-icon">
                        <History size={18} />
                      </span>
                      <div>
                        <strong>Audit kredit</strong>
                        <span>100 pemberian terbaru · admin, tanggal, dan catatan</span>
                      </div>
                      <span className="oa-badge">{data.grants.length} entri</span>
                      <ChevronDown size={18} />
                    </summary>
                    <GrantTable grants={data.grants} />
                  </details>
                </>
              )}
              <div className="oa-policy-note">
                <Info size={17} />
                <p>
                  <strong>Kredit internal, bukan saldo provider.</strong> Satu saldo USD dipakai
                  untuk X dan AI. Cadangan yang belum pasti tetap ditahan; biaya historis tidak
                  mengurangi kredit baru. Riwayat, demo, impor/ekspor, dan catatan manual tetap
                  gratis.
                </p>
              </div>
              <footer className="oa-footer">
                <span>
                  orbit. <span>Admin workspace</span>
                </span>
                <span>{updated ? `Diperbarui ${date(updated)}` : 'Estimasi lokal'}</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {data && modal && (
        <AdminDialog
          title={
            modal === 'user' ? (form.id ? 'Edit user' : 'Tambah user') : 'Beri kredit gabungan'
          }
          description={
            modal === 'user'
              ? 'Kelola identitas dan akses ke workspace Orbit.'
              : 'Satu saldo USD untuk request X dan analisis AI.'
          }
          busy={busy}
          onClose={closeModal}
        >
          {error && (
            <div className="oa-alert oa-alert-error" role="alert">
              <Info size={16} />
              <span>{error}</span>
            </div>
          )}
          {modal === 'user' ? (
            <form
              className="oa-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await act({
                    ...form,
                    password: form.password || undefined,
                    action: form.id ? 'updateUser' : 'createUser',
                  })
                ) {
                  setForm(blank);
                  setModal(null);
                }
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Nama
                  <input
                    required
                    maxLength={100}
                    value={form.name}
                    placeholder="Nama lengkap"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={form.email}
                    autoComplete="off"
                    placeholder="nama@example.com"
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label>
                  {form.id
                    ? 'Password baru (kosongkan jika tetap)'
                    : 'Password (minimal 12 karakter)'}
                  <input
                    type="password"
                    required={!form.id}
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
                <div className="oa-form-grid">
                  <label>
                    Role
                    <select
                      aria-label="Role"
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value as 'admin' | 'user' })
                      }
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  {form.id && (
                    <label>
                      Status
                      <select
                        aria-label="Status"
                        value={form.active ? 'active' : 'inactive'}
                        onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}
                      >
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                      </select>
                    </label>
                  )}
                </div>
                <div className="oa-inline-note">
                  <ShieldCheck size={16} />
                  <span>
                    Setiap edit mengakhiri sesi user. Tidak ada hapus permanen; riwayat dan audit
                    tetap disimpan. Edit akun sendiri meminta login ulang.
                  </span>
                </div>
                <div className="oa-dialog-actions">
                  <button type="button" className="oa-button" onClick={closeModal}>
                    Batal
                  </button>
                  <button className="oa-button oa-button-primary">
                    {busy ? 'Menyimpan…' : 'Simpan user'}
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            <form
              className="oa-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  !confirm(
                    `Tambah $${amount} untuk ${data.users.find((user) => user.id === creditUser)?.email}?`,
                  )
                )
                  return;
                if (
                  await act({
                    action: 'grantCredit',
                    id: grantId,
                    userId: creditUser,
                    amount: Number(amount),
                    note,
                  })
                ) {
                  setNote('');
                  setGrantId(crypto.randomUUID());
                  setModal(null);
                }
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  User
                  <select
                    aria-label="User"
                    required
                    value={creditUser}
                    onChange={(e) => setCreditUser(e.target.value)}
                  >
                    <option value="">Pilih user</option>
                    {data.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                        {user.active ? '' : ' (nonaktif)'}
                      </option>
                    ))}
                  </select>
                </label>
                {creditUser && (
                  <div className="oa-balance-preview">
                    <span>Saldo saat ini</span>
                    <strong>
                      {usd(data.users.find((user) => user.id === creditUser)?.balance || 0)}
                    </strong>
                  </div>
                )}
                <label>
                  Tambah USD
                  <div className="oa-amount-input">
                    <span>$</span>
                    <input
                      required
                      type="number"
                      aria-label="Tambah USD"
                      min="0.000001"
                      max="1000000"
                      step="0.000001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </label>
                <label>
                  Catatan audit
                  <input
                    required
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: kredit awal"
                  />
                </label>
                <div className="oa-inline-note">
                  <Info size={16} />
                  <span>
                    Kredit ditambahkan, bukan mengganti saldo. Pemberian tercatat permanen; ini
                    bukan top-up akun provider.
                  </span>
                </div>
                <div className="oa-dialog-actions">
                  <button type="button" className="oa-button" onClick={closeModal}>
                    Batal
                  </button>
                  <button className="oa-button oa-button-primary" disabled={!grantId}>
                    {busy ? 'Menyimpan…' : 'Tambah kredit'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </AdminDialog>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="oa-avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}
function SectionHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="oa-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {aside}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
  negative,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  negative?: boolean;
  tone?: string;
}) {
  return (
    <section className={`oa-metric${tone ? ` oa-metric-${tone}` : ''}`}>
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong className={negative ? 'oa-negative' : ''}>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="oa-empty">
      {icon || <Search size={24} />}
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`oa-badge ${active ? 'oa-badge-green' : ''}`}>
      <i className="oa-dot" />
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}
function LedgerBadge({ status }: { status: string }) {
  return (
    <span
      className={`oa-badge ${status === 'reserved' ? 'oa-badge-amber' : status === 'settled' ? 'oa-badge-green' : ''}`}
    >
      {status === 'reserved' ? (
        <Clock3 size={12} />
      ) : status === 'settled' ? (
        <Check size={12} />
      ) : (
        <History size={12} />
      )}
      {status === 'reserved'
        ? 'Dicadangkan · belum pasti'
        : status === 'legacy'
          ? 'Historis · bebas kredit'
          : 'Diselesaikan'}
    </span>
  );
}
function TablePager({
  page,
  pages,
  from,
  to,
  total,
  size,
  onPage,
  onSize,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  return (
    <div className="oa-pager">
      <span>
        {from}–{to} dari {total} hasil
      </span>
      <div>
        <label>
          Baris{' '}
          <select value={size} onChange={(e) => onSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </label>
        <span>
          {page} / {pages}
        </span>
        <button
          className="oa-icon-button"
          aria-label="Halaman sebelumnya"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className="oa-icon-button"
          aria-label="Halaman berikutnya"
          disabled={page === pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function UserTable({
  users,
  actorId,
  busy,
  onEdit,
  onCredit,
  onToggle,
}: {
  users: AdminUser[];
  actorId: string;
  busy: boolean;
  onEdit?: (user: AdminUser) => void;
  onCredit?: (user: AdminUser) => void;
  onToggle?: (user: AdminUser) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const filtered = filterUsers(users, search, status, role);
  const result = paginate(filtered, page, size);
  const management = !!onEdit;
  return (
    <section className="oa-card oa-table-card">
      <SectionHeading
        title={management ? 'Daftar user' : 'Penggunaan per user'}
        description={
          management
            ? 'Akses, saldo gabungan, dan estimasi penggunaan.'
            : 'Total kumulatif setiap akun, termasuk cadangan dan historis.'
        }
        aside={<span className="oa-badge">{users.length} akun</span>}
      />
      <div className="oa-table-toolbar">
        <div className="oa-search">
          <Search size={16} />
          <input
            aria-label="Cari user"
            placeholder="Cari nama atau email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Filter status user"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <select
          aria-label="Filter role user"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Semua role</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        {(search || status !== 'all' || role !== 'all') && (
          <button
            className="oa-button oa-button-quiet"
            onClick={() => {
              setSearch('');
              setStatus('all');
              setRole('all');
              setPage(1);
            }}
          >
            <X size={14} /> Reset filter
          </button>
        )}
      </div>
      <div
        className="oa-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={management ? 'Daftar user' : 'Penggunaan per user'}
      >
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th className="oa-align-right">Saldo USD</th>
              {management ? (
                <>
                  <th className="oa-align-right">Estimasi X + AI</th>
                  <th>Aksi</th>
                </>
              ) : (
                <>
                  <th className="oa-align-right">X</th>
                  <th className="oa-align-right">AI</th>
                  <th className="oa-align-right">Dicadangkan</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {result.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="oa-user-cell">
                    <Avatar name={user.name} />
                    <div>
                      <strong>
                        {user.name}
                        {user.id === actorId && <span className="oa-you">Anda</span>}
                      </strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="oa-role">
                    {user.role === 'admin' ? <ShieldCheck size={14} /> : <Users size={14} />}
                    {user.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>
                  <StatusBadge active={!!user.active} />
                </td>
                <td className={`oa-align-right oa-money${user.balance < 0 ? ' oa-negative' : ''}`}>
                  {usd(user.balance)}
                </td>
                {management ? (
                  <>
                    <td className="oa-align-right oa-money">{usd(user.x + user.ai)}</td>
                    <td>
                      <div className="oa-row-actions">
                        <button
                          className="oa-button oa-button-small"
                          disabled={busy}
                          onClick={() => onEdit?.(user)}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className="oa-icon-button"
                          aria-label={`Beri kredit ke ${user.email}`}
                          title="Beri kredit"
                          disabled={busy}
                          onClick={() => onCredit?.(user)}
                        >
                          <Wallet size={15} />
                        </button>
                        <button
                          className="oa-icon-button"
                          aria-label={user.active ? 'Nonaktifkan' : 'Aktifkan'}
                          title={
                            user.id === actorId
                              ? 'Tidak dapat menonaktifkan akun sendiri'
                              : `${user.active ? 'Nonaktifkan' : 'Aktifkan'} ${user.email}`
                          }
                          disabled={busy || user.id === actorId}
                          onClick={() => onToggle?.(user)}
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="oa-align-right oa-money">{usd(user.x)}</td>
                    <td className="oa-align-right oa-money">{usd(user.ai)}</td>
                    <td className="oa-align-right oa-money">{usd(user.reserved)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.items.length && (
        <EmptyState
          title="Tidak ada user yang cocok"
          description="Ubah pencarian atau filter untuk melihat akun lainnya."
        />
      )}
      <TablePager
        {...result}
        size={size}
        onPage={setPage}
        onSize={(value) => {
          setSize(value);
          setPage(1);
        }}
      />
    </section>
  );
}
function RequestTable({ entries }: { entries: LedgerEntry[] }) {
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const result = paginate(filterLedger(entries, search, provider, status), page, size);
  return (
    <section className="oa-card oa-table-card">
      <SectionHeading
        title="Request & reservasi"
        description="100 entri terbaru. Filter hanya berlaku pada daftar ini, bukan total kumulatif."
        aside={<span className="oa-badge">{entries.length} entri</span>}
      />
      <div className="oa-request-note">
        <Clock3 size={16} />
        <span>
          Cadangan belum pasti tetap ditahan. Cocokkan dengan billing provider sebelum mencoba
          ulang.
        </span>
      </div>
      <div className="oa-table-toolbar">
        <div className="oa-search">
          <Search size={16} />
          <input
            aria-label="Cari request"
            placeholder="Cari email atau catatan…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Filter provider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Semua provider</option>
          <option value="x">X API</option>
          <option value="ai">OpenAI</option>
        </select>
        <select
          aria-label="Filter status request"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Semua status</option>
          <option value="reserved">Dicadangkan</option>
          <option value="settled">Diselesaikan</option>
          <option value="legacy">Historis</option>
        </select>
        {(search || provider !== 'all' || status !== 'all') && (
          <button
            className="oa-button oa-button-quiet"
            onClick={() => {
              setSearch('');
              setProvider('all');
              setStatus('all');
              setPage(1);
            }}
          >
            <X size={14} /> Reset filter
          </button>
        )}
      </div>
      <div className="oa-table-scroll" tabIndex={0} role="region" aria-label="Request & reservasi">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>User</th>
              <th>Provider</th>
              <th className="oa-align-right">Estimasi USD</th>
              <th>Status</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((entry) => (
              <tr key={entry.id}>
                <td className="oa-date">{date(entry.created)}</td>
                <td>{entry.email || 'Pemilik historis belum tersedia'}</td>
                <td>
                  <span className={`oa-badge ${entry.provider === 'ai' ? 'oa-badge-teal' : ''}`}>
                    {entry.provider === 'ai' ? 'OpenAI' : 'X API'}
                  </span>
                </td>
                <td className="oa-align-right oa-money">{usd(entry.cost)}</td>
                <td>
                  <LedgerBadge status={entry.status} />
                </td>
                <td className="oa-note-cell">{entry.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.items.length && (
        <EmptyState
          title={entries.length ? 'Tidak ada request yang cocok' : 'Belum ada request berbayar'}
          description={
            entries.length
              ? 'Ubah pencarian atau filter. Total dashboard tidak berubah.'
              : 'Penggunaan X dan AI akan tampil setelah user menjalankan request berbayar.'
          }
          icon={<Activity size={24} />}
        />
      )}
      <TablePager
        {...result}
        size={size}
        onPage={setPage}
        onSize={(value) => {
          setSize(value);
          setPage(1);
        }}
      />
    </section>
  );
}
function GrantTable({ grants }: { grants: CreditGrant[] }) {
  return grants.length ? (
    <div className="oa-table-scroll" tabIndex={0} role="region" aria-label="Audit kredit">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>User</th>
            <th className="oa-align-right">Kredit USD</th>
            <th>Admin</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((grant) => (
            <tr key={grant.id}>
              <td className="oa-date">{date(grant.created)}</td>
              <td>{grant.email}</td>
              <td className="oa-align-right oa-money oa-credit-amount">+{usd(grant.amount)}</td>
              <td>{grant.actor}</td>
              <td className="oa-note-cell">{grant.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="Belum ada pemberian kredit"
      description="Setiap pemberian kredit akan tersimpan bersama admin, tanggal, dan catatan."
      icon={<Wallet size={24} />}
    />
  );
}
function AdminDialog({
  title,
  description,
  busy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    const opener = document.activeElement;
    element?.showModal();
    element?.querySelector<HTMLElement>('input, select')?.focus();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="oa-dialog"
      aria-labelledby="oa-dialog-title"
      aria-describedby="oa-dialog-description"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
          ),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="oa-dialog-heading">
        <div>
          <span className="oa-dialog-icon">
            {title.includes('kredit') ? <CircleDollarSign size={20} /> : <Users size={20} />}
          </span>
          <h2 id="oa-dialog-title">{title}</h2>
          <p id="oa-dialog-description">{description}</p>
        </div>
        <button
          type="button"
          className="oa-icon-button"
          aria-label="Tutup dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
