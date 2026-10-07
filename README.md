# Orbit — X Research Desk

Dashboard lokal untuk riset creator VTuber, kebutuhan stream assets, percakapan komunitas, dan pencatatan hasil. Aplikasi menggunakan X API resmi. Ia menyarankan draft balasan; pengguna selalu meninjau dan mengirim sendiri.

## Jalankan di Linux

Butuh Node.js 22.13 atau lebih baru dan pnpm.

```bash
pnpm install
cp .env.example .env
```

Isi `.env` di komputermu:

```dotenv
X_BEARER_TOKEN=token_bearer_dari_x_developer_console
OPENAI_API_KEY=key_dari_openai_platform
```

Lalu jalankan:

```bash
pnpm run local
```

Buka `http://127.0.0.1:5173`. Bila belum menyiapkan API key, buka **Koneksi & budget** lalu muat **demo fiktif**. Demo tidak menggunakan API dan diberi label jelas.

## Akses dan biaya

- X API: `GET` saja untuk akun, timeline, dan pencarian. Tidak ada batas anggaran internal; Orbit mengirim request lalu menampilkan penolakan dari X bila saldo, akses, atau spending limit tidak mencukupi.
- OpenAI API: analisis melalui `gpt-5.4-mini`. Tidak ada batas anggaran internal; Orbit meneruskan request dan menampilkan penolakan dari OpenAI bila saldo, akses, atau spending limit tidak mencukupi.
- Nilai penggunaan di aplikasi adalah estimasi lokal, bukan pembacaan halaman billing provider. Tetapkan spending cap di Developer Console X dan platform OpenAI jika ingin pengaman di sisi akun.
- Anggaran dihitung sebelum request; bila hasil tagihan tidak pasti, cadangan biaya dipertahankan. Cocokkan pemakaian di dashboard provider.
- Server lokal hanya bind ke loopback. Jangan menaruh `.env`, `.dev.vars`, `.wrangler/state`, atau token di file yang dibagikan.

## Fitur

1. Analisis akun: jumlah sampel dapat dipilih 5–100 original/quote terbaru; replies dan repost tetap diambil terpisah dari 50 aktivitas terbaru, metrik, pinned post, kategori konten, tone, positioning, dan kesan personal/studio.
2. Topik percakapan dari hasil pencarian recent. Satu snapshot menunjukkan topik pada sampel, bukan tren naik; bandingkan beberapa tanggal untuk membaca perubahan.
3. Kandidat post untuk dibalas dengan alasan dan draft reply yang bisa diedit atau disalin.
4. Potential Leads mencari calon pembeli yang menunjukkan niat mencari atau membeli stream assets; artist yang mempromosikan open commission tidak dihitung sebagai lead. Status pre-debut saja tidak cukup. Kebutuhan, waktu, dan budget ditampilkan jika tertulis jelas.
5. Connection untuk artist, rigger, designer, musisi, dan komunitas relevan.
6. Pencatatan manual inquiry, DM, dan order. Metrik engagement tidak pernah otomatis diartikan sebagai lead atau penjualan.
7. Impor/ekspor dataset JSON dan ekspor catatan hasil.

## Data dan batas cakupan

- Sampel post hanya mencakup data yang tersedia dari endpoint dan akses API akun.
- Pencarian memakai hasil recent, 10–100 post per pengambilan sesuai pilihan di dashboard (analisis akun: 5–100). Makin banyak post dapat meningkatkan biaya API.
- Replies/repost diambil dari 50 aktivitas terbaru; ini bukan keseluruhan histori.
- Views bisa tidak tersedia untuk data publik.
- Analisis AI versi ini membaca teks. Media, banner, atau visual post belum dikirim ke model untuk dianalisis.
- Setiap hasil menampilkan tanggal, sumber jika tersedia, dan alasan. Impor tanpa link ditandai tanpa sumber.
- Data tersimpan lokal di `.wrangler/state`; folder tersebut mencakup database riset dan harus dicadangkan bila ingin memindahkan data.

## Struktur project

```text
app/          UI Next/Vinext dan route API lokal
components/   Komponen UI reusable
lib/          Logika domain, X API, OpenAI, demo data, dan storage lokal
db/           Schema database D1/Drizzle
drizzle/      SQL migration dan metadata Drizzle
scripts/      Helper install, run lokal, dan build
vendor/       File pihak ketiga yang sengaja di-vendor
tests/        Test domain dan aturan klasifikasi
```

File rahasia dan state lokal (`.env`, `.dev.vars`, `.wrangler/`, `.sites-runtime/`) tidak boleh masuk Git.

## Workflow Git

```bash
git status
git add .
git commit -m "Initial project setup"
```

Sebelum commit fitur/perubahan perilaku, jalankan check yang relevan:

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

API keys jangan dibagikan dalam chat atau dimasukkan ke repository.
