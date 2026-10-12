# Rundown: dari file zip sampai game online di Vercel

Dibuat untuk Windows + Antigravity/VS Code. Ikuti berurutan. Tanda ☐ = langkah yang kamu kerjakan.
Perkiraan total: 30-40 menit.

---

## BAGIAN 1. Yang boleh dan tidak boleh dihapus di folder lama

Di folder proyek lama, **JANGAN hapus dua item ini:**

| Item | Kenapa penting |
|---|---|
| `.git` (folder tersembunyi) | Riwayat commit + sambungan ke repo GitHub. Kalau terhapus, kamu harus menyambungkan ulang ke GitHub dan Vercel. |
| `.env.local` | Kunci Supabase milikmu. File ini TIDAK ada di GitHub, jadi kalau terhapus kamu harus mengisinya lagi. |

**Semua yang lain boleh dihapus:** `node_modules`, `.next`, `src`, `public`, `supabase`, `tests`, `bug`, `scratch`,
`AGENTS.md`, `README.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
`.gitignore`, `next-env.d.ts`, file `.glb` yang tergeletak di luar folder, dan sisa proyek lama lainnya.
(Jika ada folder `.vercel`, simpan juga. Itu tanda proyek sudah tersambung ke Vercel dari komputermu.)

Supaya `.git` dan `.env.local` terlihat: File Explorer → tab **View** → **Show** → centang **Hidden items**.

---

## BAGIAN 2. Pindah ke folder baru

☐ **2.1 Backup.** Salin seluruh folder lama ke tempat lain (misalnya Desktop, beri nama `clashsquad-BACKUP`).
Ini jaring pengaman: kalau ada yang salah, kamu bisa kembali.

☐ **2.2 Bersihkan folder lama.** Buka folder lama di File Explorer (Hidden items aktif). Pilih semua isi,
lalu **batalkan pilihan** `.git` dan `.env.local` (tahan Ctrl dan klik keduanya). Hapus sisanya.
Jika Windows menolak menghapus karena "sedang dipakai", hentikan dulu semua terminal `npm run dev` (Ctrl+C) dan tutup Antigravity/VS Code.

☐ **2.3 Ekstrak zip.** Ekstrak `grand-turismo-racing-v2.3.zip` ke tempat sementara (misalnya Downloads). Hasilnya satu folder
bernama `grand-turismo-racing`.

☐ **2.4 Salin ISI folder baru ke folder lama.** Buka `grand-turismo-racing`, pilih semua isinya (Ctrl+A), salin, lalu tempel di folder lama.
Salin **isinya**, bukan folder pembungkusnya. Hasil akhir yang benar:

```
folder-lama/
  .git/              <- dipertahankan
  .env.local         <- dipertahankan
  package.json       <- dari zip (harus ada langsung di sini)
  src/  public/  supabase/  tests/  tools/
  README.md  RUNDOWN-SETUP.md  next.config.ts  tsconfig.json  .gitignore  .env.example
```

Cek cepat: `package.json` harus ada **langsung** di folder proyek, bukan di dalam folder `grand-turismo-racing` di dalamnya.
Jika kamu melihat dua lapis nama yang sama, kamu menempel satu tingkat terlalu dalam.

☐ **2.5 Buka folder itu di Antigravity/VS Code** (File → Open Folder). Pastikan Explorer menampilkan `package.json` di baris paling atas.

---

## BAGIAN 3. Pastikan `.env.local` benar

☐ **3.1** Buka `.env.local`. Isinya harus dua baris seperti ini (nilai milikmu sendiri):

```
NEXT_PUBLIC_SUPABASE_URL=https://kode-proyekmu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

Nama kunci boleh `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (format baru `sb_publishable_...`) **atau**
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (format lama `eyJ...`). Keduanya diterima.

☐ **3.2** **Simpan** file (Ctrl+S). Tab file yang masih bertitik putih berarti belum tersimpan.
Jangan pakai kunci bertuliskan `secret` atau `service_role`.

---

## BAGIAN 4. Siapkan Supabase (cek ulang, sebagian sudah kamu lakukan)

☐ **4.1** Buka dashboard Supabase → proyekmu → **Table Editor**. Pastikan tabel **`lap_times`** ada.
Jika belum: **SQL Editor → New query**, tempel isi `supabase/migrations/20261011_grand_turismo_lap_times.sql`, klik **Run**.
Hasilnya "Success. No rows returned". Aman dijalankan berulang kali dan tidak menghapus tabel apa pun.

☐ **4.2** **Authentication → Sign In / Providers** (atau *Providers*): aktifkan **Allow anonymous sign-ins**.

☐ **4.3** **Realtime → Settings**: pastikan **Allow public access** aktif. Multiplayer memakai channel publik.
Multiplayer tidak butuh tabel tambahan.

☐ **4.4 (opsional)** Tabel sisa proyek lama (`rooms`, `room_players`, `matches`, `drift_scores`) tidak dipakai lagi.
Menghapusnya tidak wajib. Jika mau, buka bagian komentar di bawah file SQL.

---

## BAGIAN 5. Jalankan dan uji di komputer

☐ **5.1** Buka terminal di Antigravity (Terminal → New Terminal) di folder proyek, lalu:

```
npm install
npm test
```

`npm test` harus berakhir dengan empat baris "SEMUA TES ... LULUS" (fisika, tabrakan, balapan penuh, multiplayer).
Butuh sekitar 1-2 menit. Peringatan `THREE_CJS_DEPRECATED` boleh diabaikan.

☐ **5.2**
```
npm run dev
```
Buka alamat yang tertera (biasanya `http://localhost:3000`; jika port 3000 dipakai program lain, Next.js memilih port lain dan menuliskannya).
Tutup server lama yang masih menyala supaya tidak tertukar.

☐ **5.3 Uji solo.** Garasi → pilih mobil → atur *Bantuan berkendara* (Mudah/Normal/Pro) → Masuk ke Trek → Mulai.
Cek: belok, rem, selesaikan satu lap, lihat hasil.

☐ **5.4 Uji leaderboard.** Setelah selesai balapan, buka Papan Peringkat. Label **● LIVE** berarti Supabase terhubung.
Label **OFFLINE (lokal)** berarti `.env.local` belum benar atau server belum dijalankan ulang setelah mengubahnya.

☐ **5.5 Uji multiplayer sendirian.** Buka **dua tab** browser.
Tab 1: Multiplayer → Buat Room Baru → catat kode 5 karakter.
Tab 2: Multiplayer → ketik kode → Gabung → Saya Siap.
Tab 1: Mulai Balapan. Kedua tab harus memuat, lalu hitung mundur bersamaan.

☐ **5.6** Jika sebuah mobil tampak menghadap terbalik: Garasi → "Balik 180°" (tersimpan per mobil).

---

## BAGIAN 6. Kirim ke GitHub

☐ **6.1** Di terminal proyek:

```
git remote -v
git branch --show-current
git status
```

`git remote -v` menunjukkan alamat repo GitHub. `git status` akan menampilkan banyak file "deleted" dan "new".
Itu normal karena kamu mengganti seluruh isi proyek. `.env.local` **tidak** boleh muncul di daftar (sudah diabaikan `.gitignore`).
Jika `.env.local` muncul, hentikan dan jangan lanjut.

☐ **6.2**
```
git add -A
git commit -m "Grand Turismo Racing: versi baru (solo, multiplayer, 9 mobil)"
git push
```

☐ **6.3** Jika `git push` ditolak ("rejected" / "non-fast-forward"):
```
git pull --rebase
git push
```
Jika muncul konflik, kirim saya pesan error-nya. Jangan memakai `git push --force` kecuali kamu paham akibatnya.

☐ **6.4** Jika diminta login GitHub, ikuti jendela login di browser. Jika memakai token, pakai *Personal Access Token*, bukan password.

---

## BAGIAN 7. Deploy ke Vercel

**Kasus A: repo ini sudah tersambung ke Vercel** (kamu pernah deploy proyek lama dari repo yang sama)
☐ **7.1** Buka vercel.com → proyekmu → tab **Deployments**. Setelah `git push`, deploy baru muncul otomatis. Tunggu status **Ready**.
☐ **7.2** Buka **Settings → Environment Variables**. Pastikan ada:
`NEXT_PUBLIC_SUPABASE_URL` dan kuncinya (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` atau `NEXT_PUBLIC_SUPABASE_ANON_KEY`),
dengan nama dan nilai **sama persis** seperti `.env.local`, dicentang untuk Production, Preview, dan Development.
☐ **7.3** Jika kamu menambah atau mengubah variabel itu, nilainya baru dipakai setelah build baru:
**Deployments → ⋯ pada deploy terbaru → Redeploy**.

**Kasus B: belum pernah tersambung**
☐ **7.1** vercel.com → **Add New… → Project** → pilih repo GitHub → *Import*.
☐ **7.2** Framework otomatis terbaca **Next.js**. Jangan ubah pengaturan build.
☐ **7.3** Buka **Environment Variables**, tambahkan dua variabel seperti di atas, lalu klik **Deploy**.

☐ **7.4 Uji akhir.** Buka alamat `https://nama-proyek.vercel.app`:
1. Solo: balapan satu lap.
2. Leaderboard: tampil "● LIVE".
3. Multiplayer: buat room di komputermu, minta temanmu masuk dengan kode dari **HP atau jaringan berbeda**.

Catatan: build pertama memuat ±20 MB model mobil. Itu normal, dan mobil hanya dimuat saat dipilih atau dipakai lawan.

---

## BAGIAN 8. Jika ada masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Pesan merah "Multiplayer belum aktif: ..." | `.env.local` kosong, masih berisi contoh, atau belum disimpan | Perbaiki isi, **Ctrl+S**, hentikan server (Ctrl+C), `npm run dev` lagi |
| "Tidak bisa terhubung ke server multiplayer (detail: ...)" | Kunci/URL salah, internet putus, atau proyek Supabase gratis dijeda | Cek kunci; buka dashboard Supabase dan pulihkan proyek jika dijeda; lihat detail di Console (F12) |
| Detail `CHANNEL_ERROR` terus-menerus | Kunci format baru belum diterima Realtime di proyekmu | Pakai kunci lama (`eyJ...`) dari *API Keys → Legacy API Keys* |
| "Room tidak ditemukan" | Kode salah, atau semua pemain sudah keluar | Buat room baru |
| Leaderboard "OFFLINE (lokal)" | Variabel belum terisi / SQL belum dijalankan | Ulangi Bagian 3 dan 4.1 |
| `git push` ditolak | Repo di GitHub punya commit yang tidak ada di komputermu | `git pull --rebase`, lalu `git push` |
| Build Vercel gagal | Lihat log di Vercel → Deployments → klik deploy → *Build Logs* | Kirim log-nya ke saya |
| Peringatan "multiple lockfiles" | Ada `package-lock.json` lain di folder induk | Aman diabaikan; atau hapus file di folder induk |
| Game berat di laptop sekolah | GPU lemah | Garasi → Kualitas: Rendah |
| Terlalu sulit/mudah menikung | Pengaturan bantuan | Garasi → Bantuan berkendara |
| Putus-putus saat banyak pemain | Batas Realtime paket Free (100 pesan/detik, 200 koneksi) | Maksimal 4-6 pemain per room |

## BAGIAN 9. Kalau ingin membatalkan semuanya

Karena kamu sudah membuat backup (2.1) dan proyek ada di Git, kamu bisa kembali kapan saja:
salin ulang folder backup, atau `git log` lalu `git revert <kode-commit>`.
