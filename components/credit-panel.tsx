'use client';
import { useState } from 'react';
import {
  Wallet,
  CircleDollarSign,
  Activity,
  Clock3,
  Info,
  RefreshCw,
  ArrowUpRight,
} from 'lucide-react';
import type { PersonalCredit, PersonalUsage } from '../lib/credit-store';
import { formatUSD } from '../lib/currency';
import './credit-panel.css';

const date = (value: string) =>
  new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export default function CreditPanel({
  credit,
  ledger,
  isAdmin,
  busy,
  onRefresh,
}: {
  credit?: PersonalCredit;
  ledger: PersonalUsage[];
  isAdmin: boolean;
  busy: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  if (!credit)
    return (
      <section className="card">
        <h2>Kredit belum tersedia</h2>
        <p>Muat ulang halaman atau hubungi admin untuk memeriksa data kredit.</p>
      </section>
    );
  const noCredit = credit.balance <= 0;
  return (
    <div className="credit-page">
      <section className="credit-wallet card" aria-label="Saldo kredit">
        <div className="credit-wallet-heading">
          <span className="credit-wallet-icon">
            <Wallet size={23} />
          </span>
          <div>
            <span className="tiny-label">KREDIT WORKSPACE</span>
            <h2>Saldo tersedia</h2>
          </div>
          <span className="badge">USD gabungan</span>
        </div>
        <strong className={`credit-balance${credit.balance < 0 ? ' credit-negative' : ''}`}>
          {formatUSD(credit.balance)}
        </strong>
        <p>
          Kredit dari admin untuk pengambilan data X dan analisis AI. Kamu tidak perlu mengatur
          koneksi layanan sendiri.
        </p>
        <div className="credit-wallet-bottom">
          <span>
            <CircleDollarSign size={15} /> Satu saldo untuk kedua aktivitas
          </span>
          <button
            className="secondary"
            disabled={busy || refreshing}
            onClick={async () => {
              setRefreshing(true);
              setError('');
              try {
                await onRefresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Memuat…' : 'Perbarui saldo'}
          </button>
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {noCredit && (
        <div className="credit-balance-notice" role="status">
          <Info size={18} />
          <div>
            <strong>
              {credit.balance < 0 ? 'Saldo perlu ditambahkan' : 'Belum ada kredit tersedia'}
            </strong>
            <p>
              {credit.balance < 0
                ? 'Estimasi biaya yang tercatat melebihi kredit tersedia. Hubungi admin untuk memeriksa pemakaian dan menambah kredit.'
                : 'Hubungi admin untuk menambah kredit sebelum mengambil data atau menjalankan analisis AI.'}{' '}
              Demo, riwayat, impor/ekspor, dan catatan manual tetap gratis.
            </p>
          </div>
        </div>
      )}
      <div className="credit-summary">
        {[
          {
            label: 'Kredit diberikan',
            value: credit.granted,
            note: 'Total kredit dari admin',
            icon: <CircleDollarSign size={18} />,
          },
          {
            label: 'Kredit terpakai',
            value: credit.spent,
            note: 'Estimasi pemakaian yang diselesaikan',
            icon: <Activity size={18} />,
          },
          {
            label: 'Dicadangkan',
            value: credit.reserved,
            note: 'Tagihan belum pasti · mengurangi saldo',
            icon: <Clock3 size={18} />,
          },
        ].map((item) => (
          <section className="card credit-summary-card" key={item.label}>
            <div>
              <span>{item.label}</span>
              {item.icon}
            </div>
            <strong>{formatUSD(item.value)}</strong>
            <small>{item.note}</small>
          </section>
        ))}
      </div>
      <section className="card credit-rules">
        <div>
          <h2>Dikelola oleh admin</h2>
          <p>
            Penambahan kredit dilakukan oleh admin. Saldo bukan saldo akun provider dan tidak bisa
            diisi sendiri dari workspace ini.
          </p>
        </div>
        {isAdmin && (
          <a className="secondary" href="/admin/users">
            Kelola kredit <ArrowUpRight size={15} />
          </a>
        )}
        <div className="credit-rules-note">
          <Info size={16} />
          <p>
            Angka pemakaian adalah estimasi lokal, bukan tagihan resmi. Request berbayar membutuhkan
            saldo cukup untuk cadangan biaya. Selisih cadangan dikembalikan setelah biaya diketahui;
            cadangan yang belum pasti tetap ditahan. Biaya historis sebelum fitur kredit tidak
            mengurangi saldo baru.
          </p>
        </div>
      </section>
      <section className="card credit-history">
        <div className="section-head">
          <div>
            <h2>Riwayat pemberian kredit</h2>
            <p className="muted small">
              100 pemberian terbaru untuk akunmu · total kredit di atas tetap kumulatif.
            </p>
          </div>
        </div>
        {credit.grants.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Riwayat pemberian kredit"
          >
            <p className="mobile-table-hint">Geser tabel untuk melihat nilai dan catatan kredit.</p>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kredit USD</th>
                  <th>Catatan admin</th>
                </tr>
              </thead>
              <tbody>
                {credit.grants.map((grant) => (
                  <tr key={grant.id}>
                    <td>{date(grant.created)}</td>
                    <td className="credit-money credit-positive">+{formatUSD(grant.amount)}</td>
                    <td className="credit-note">{grant.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="credit-empty">
            <Wallet size={25} />
            <strong>Belum ada pemberian kredit</strong>
            <p>Kredit yang ditambahkan admin akan tampil di sini bersama tanggal dan catatannya.</p>
          </div>
        )}
      </section>
      <section className="card credit-history">
        <div className="section-head">
          <div>
            <h2>Riwayat pemakaian kredit</h2>
            <p className="muted small">
              100 entri terbaru untuk akunmu · penggunaan di atas dihitung dari seluruh riwayat.
            </p>
          </div>
        </div>
        {ledger.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Riwayat pemakaian kredit"
          >
            <p className="mobile-table-hint">
              Geser tabel untuk melihat estimasi dan status pemakaian.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Aktivitas</th>
                  <th>Estimasi USD</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td>{date(entry.created)}</td>
                    <td>{entry.provider === 'ai' ? 'Analisis AI' : 'Pengambilan data X'}</td>
                    <td className="credit-money">{formatUSD(entry.cost)}</td>
                    <td>
                      <span
                        className={`credit-status${entry.status === 'reserved' ? ' credit-status-reserved' : entry.status === 'legacy' ? ' credit-status-legacy' : ''}`}
                      >
                        {entry.status === 'reserved'
                          ? 'Dicadangkan · belum pasti'
                          : entry.status === 'legacy'
                            ? 'Historis · tidak mengurangi kredit'
                            : 'Diselesaikan'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="credit-empty">
            <Activity size={25} />
            <strong>Belum ada pemakaian berbayar</strong>
            <p>
              Pengambilan data dan analisis AI akan dicatat di sini. Demo dan impor tidak memotong
              kredit.
            </p>
          </div>
        )}
        {credit.historical > 0 && (
          <p className="credit-history-note">
            Estimasi historis {formatUSD(credit.historical)} ditampilkan sebagai referensi, tidak
            termasuk kredit terpakai atau saldo yang dipotong.
          </p>
        )}
      </section>
    </div>
  );
}
