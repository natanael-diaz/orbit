'use client';
import { useEffect, useState } from 'react';

export async function logoutSession() {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  if (!response.ok) throw Error('Logout gagal. Coba lagi.');
  // Full navigation clears account-specific React state on logout.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/');
}
export default function AuthPanel({ onReady }: { onReady: () => Promise<void> }) {
  const [status, setStatus] = useState<{ initialized: boolean; setupAvailable: boolean } | null>(
    null,
  );
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/auth')
      .then(async (response) => {
        const data = (await response.json()) as {
          initialized: boolean;
          setupAvailable: boolean;
          error: string;
        };
        if (!response.ok) throw Error(data.error);
        setStatus(data);
      })
      .catch((e) => setError(e.message));
  }, []);
  const setup = status && !status.initialized;
  return (
    <main className="auth-layout">
      <section className="card auth-card">
        <span className="eyebrow">ORBIT RESEARCH DESK</span>
        <h1>{setup ? 'Setup admin pertama' : 'Login'}</h1>
        <p className="muted">Akun dibuat oleh admin. Tidak ada registrasi publik.</p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {!status && <p>Memeriksa database… Jalankan migrasi jika database belum siap.</p>}
        {setup && !status.setupAvailable && (
          <p className="notice">
            Operator perlu mengisi <code>ORBIT_SETUP_TOKEN</code> (minimal 32 karakter acak) di
            environment server, lalu restart aplikasi. Tidak ada password default.
          </p>
        )}
        {status && (!setup || status.setupAvailable) && (
          <form
            className="account-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                const response = await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: setup ? 'setup' : 'login',
                    email,
                    password,
                    name,
                    setupToken: token,
                  }),
                });
                const data = (await response.json()) as { error: string };
                if (!response.ok) throw Error(data.error);
                setPassword('');
                setToken('');
                await onReady();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {setup && (
              <label>
                Nama admin
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={setup ? 12 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={setup ? 'new-password' : 'current-password'}
              />
            </label>
            {setup && (
              <label>
                Setup token
                <input
                  type="password"
                  required
                  maxLength={256}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy ? 'Memproses…' : setup ? 'Buat admin pertama' : 'Login'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
