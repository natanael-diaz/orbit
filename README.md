# Orbit — X Research Desk

Dashboard lokal untuk riset akun, topik, kebutuhan produk/jasa, dan komunitas X lintas bidang. Konteks riset ditentukan pengguna, bukan dibatasi ke VTuber atau jasa kreatif. Aplikasi menggunakan X API resmi. Ia menyarankan draft balasan; pengguna selalu meninjau dan mengirim sendiri.

## Jalankan di Linux

Butuh Node.js 22.13 atau lebih baru dan pnpm.

```bash
pnpm install
cp .env.example .env
```

Untuk operator server, isi `.env` di komputermu (user biasa memakai kredit dari admin, bukan key sendiri):

```dotenv
X_BEARER_TOKEN=token_bearer_dari_x_developer_console
OPENAI_API_KEY=key_dari_openai_platform
```

Lalu jalankan:

```bash
pnpm run local
```

Buka `http://127.0.0.1:5173`. Login diperlukan; tidak ada registrasi publik. User memakai saldo USD gabungan yang diberikan admin, tanpa mengisi key provider sendiri. Buka **Kredit & penggunaan** untuk melihat saldo, total kredit diberikan, pemakaian, cadangan, serta riwayat pemberian/pemakaian akun sendiri. Riwayat menampilkan 100 entri terbaru; ringkasan tetap kumulatif dan biaya historis tidak mengurangi kredit baru. Muat **demo fiktif** untuk mencoba tanpa memakai kredit. Konfigurasi layanan tetap dikelola operator server, bukan lewat halaman kredit user.

## Setup admin & user

1. **Sebelum upgrade:** cadangkan `.wrangler/state` secara privat. Jalankan `pnpm run db:local` untuk migrasi, atau `pnpm run local` yang otomatis menjalankan migrasi lokal.
2. Buat setup token acak di komputermu, misalnya `openssl rand -hex 32`. Isi `ORBIT_SETUP_TOKEN` di `.env` (minimal 32 karakter), lalu jalankan ulang `pnpm run local`. Jangan bagikan token.
3. Pada layar **Setup admin pertama**, masukkan nama, email, password minimal 12 karakter, dan setup token. Tidak ada akun/password default. Setup ditutup setelah akun pertama dibuat. Riset/catatan/ledger lama tanpa pemilik akan menjadi milik admin pertama; estimasi biaya historis tidak mengurangi kredit baru.
4. Hapus `ORBIT_SETUP_TOKEN` dari environment setelah setup dan restart server. Di deployment Workers gunakan secret server, bukan konfigurasi publik. Gunakan HTTPS untuk deployment non-lokal.
5. Buka **Admin → Users & kredit** (`/admin/users`) untuk membuat user, mengedit/reset password, atau menonaktifkan/mengaktifkan. Akun dibuat admin, bukan registrasi publik. Setiap edit mengakhiri sesi akun tersebut; admin tidak bisa menonaktifkan/menurunkan role sendiri atau menghilangkan admin aktif terakhir.
6. Pilih user, jumlah USD dan catatan audit untuk memberi kredit. **Saldo $3 adalah satu saldo gabungan** untuk X dan AI. Ini kredit internal Orbit, bukan transfer uang ke X/OpenAI. Provider keys tetap dikelola server.
7. **Admin → Dashboard** (`/admin`) menampilkan total/per-user, rincian X/AI, cadangan belum pasti dan riwayat request. User biasa hanya melihat data dan penggunaan sendiri. Sesi berakhir setelah 12 jam; logout/reset/deaktivasi mencabut akses.

Tidak ada hapus permanen user atau email pemulihan password pada MVP; admin mereset password melalui halaman user. Jika kehilangan semua akses admin, lakukan pemulihan database secara privat bersama operator (setup token tidak membuka registrasi ulang). Jangan membuka deployment publik tanpa review keamanan operasional.

## Akses dan biaya

- X API: `GET` saja untuk akun, timeline, dan pencarian. OpenAI: analisis teks melalui `gpt-5.4-mini`, `store:false`.
- Admin menentukan kredit USD gabungan per user. Sebelum setiap request berbayar, Orbit mencadangkan estimasi biaya secara atomik; saldo kurang berarti request tersebut tidak dikirim. Setelah selesai, selisih cadangan dikembalikan. Ini kuota user yang dikonfigurasi admin, bukan spend ceiling global hard-coded.
- Riwayat, impor/ekspor, demo, edit draft dan catatan manual tetap tersedia tanpa kredit. Analisis yang sudah tersimpan tidak dikenakan biaya ulang kecuali pengguna memilih analisis ulang.
- Tidak ada batas belanja global internal untuk akun provider. X/OpenAI tetap dapat menolak request karena saldo, akses, atau spending limit provider meskipun user punya kredit Orbit.
- Nilai penggunaan di aplikasi adalah estimasi lokal, bukan pembacaan halaman billing provider. Tetapkan spending cap di Developer Console X dan platform OpenAI jika ingin pengaman di sisi akun.
- Cadangan dihitung sebelum request; timeout, status server/provider tidak pasti, atau respons tanpa usage mempertahankan cadangan. Penolakan provider yang diketahui dibebaskan. Cocokkan di dashboard provider sebelum mencoba ulang. Biaya aktual yang diperkirakan dapat melebihi cadangan dan menyebabkan saldo negatif; request berbayar berikutnya ditolak sampai admin menambah kredit. Tarif lokal tidak otomatis tersinkron dengan billing provider; tidak ada markup, pajak atau kurs.
- Kredit dan biaya baru dihitung dalam integer micro-USD (6 desimal). Audit pemberian kredit dan riwayat request menampilkan 100 entri terbaru; total penggunaan tetap kumulatif.
- Server lokal hanya bind ke loopback. Jangan menaruh `.env`, `.dev.vars`, `.wrangler/state`, atau token di file yang dibagikan.

## Fitur

1. Analisis akun: jumlah sampel dapat dipilih 5–100 original/quote terbaru; replies dan repost tetap diambil terpisah dari 50 aktivitas terbaru, metrik, pinned post, kategori konten, tone, positioning, dan kesan personal/profesional/organisasi.
2. Topik percakapan dari hasil pencarian recent. Satu snapshot menunjukkan topik pada sampel, bukan tren naik; bandingkan beberapa tanggal untuk membaca perubahan.
3. Kandidat post untuk dibalas dengan alasan dan draft reply yang bisa diedit atau disalin.
4. Potential Leads mencari calon pembeli produk, jasa, solusi, atau supplier yang menunjukkan niat eksplisit sesuai konteks. **General** adalah preset bawaan; VTuber, D&D, streamer, indie game, podcast dan Custom tetap pilihan opsional. Promosi produk/jasa sendiri (termasuk open commission) bukan buying intent. Kebutuhan, waktu, dan budget ditampilkan hanya jika tertulis jelas.
5. Community untuk individu, profesional, tim, organisasi dan komunitas dengan bukti relevansi atau kolaborasi; tidak otomatis dianggap client.
6. Pencatatan manual inquiry, DM, dan order. Metrik engagement tidak pernah otomatis diartikan sebagai lead atau penjualan.
7. Impor/ekspor dataset JSON dan ekspor catatan hasil.
8. Login admin/user, dashboard penggunaan, CRUD non-destruktif user dan pemberian kredit USD gabungan X + AI dengan audit.

## Data dan batas cakupan

- Sampel post hanya mencakup data yang tersedia dari endpoint dan akses API akun.
- Isi niche/keyword atau query kustom sebelum pencarian; tidak ada niche fallback tersembunyi. Analisis akun menerima konteks opsional dan mengikuti bukti akun jika kosong. Reply/Community tidak memaksakan kata VTuber/debut/artist. Query bawaan buyer berisi contoh ungkapan Inggris/Indonesia, bukan cakupan semua bahasa/niat; edit query untuk kebutuhan lain. Riset/analisis lama tetap tersimpan dengan preset/hasil sebelumnya, tanpa analisis berbayar otomatis.
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
