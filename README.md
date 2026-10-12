# Grand Turismo Racing

Game balapan 3D di browser (Next.js + Three.js + Supabase). Pilih satu dari 4 supercar, balapan melawan bot
atau time trial dengan ghost lap, lalu kirim waktumu ke papan peringkat online.

## Menjalankan di komputer

```bash
npm install
npm run dev          # buka http://localhost:3000
```

Perintah lain:

```bash
npm run build        # build produksi (sama seperti di Vercel)
npm test             # tes logika: fisika/belok, kelayakan sirkuit, dan protokol multiplayer
npm run typecheck    # cek tipe TypeScript
```

## Multiplayer

Menu **Multiplayer** di beranda. Satu pemain menekan **Buat Room Baru** dan mendapat kode 5 karakter
(contoh `K7M2X`). Teman memasukkan kode itu di kolom **Gabung**, lalu semua pemain memilih mobil dan menekan
**Saya Siap**. Host (pembuat room) mengatur jumlah lap dan menekan **Mulai Balapan**. Semua pemain memuat
aset, lalu hitung mundur berjalan serempak.

- Room hidup selama ada pemain di dalamnya (tanpa tabel database). Maksimal 8 pemain per room.
- Jika host keluar, pemain tertua berikutnya otomatis jadi host.
- Mobil tidak saling bertabrakan (tembus), jadi tidak ada konflik fisika antar pemain.
- Posisi dikirim 10 kali per detik lewat Supabase Realtime Broadcast. Pada paket Free, batasnya 100 pesan/detik
  dan 200 koneksi untuk seluruh proyek, jadi targetkan 4-6 pemain per room.
- Butuh Supabase (lihat bagian di bawah). Tanpa itu, mode solo tetap jalan.
- Uji sendiri: buka dua tab browser, buat room di tab pertama, gabung dengan kodenya di tab kedua.

## Mengaktifkan Supabase (leaderboard online + multiplayer)

Mode solo tetap bisa dimainkan tanpa ini (waktu disimpan di browser). Multiplayer membutuhkannya.

1. Salin `.env.example` menjadi `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Supabase Dashboard > Project Settings > API Keys). Kunci boleh bernama `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (format baru `sb_publishable_...`) atau `NEXT_PUBLIC_SUPABASE_ANON_KEY` (format lama). Kamu bisa memakai nilai yang sama dengan proyek lama.
2. Buka **SQL Editor** di Supabase, jalankan isi `supabase/migrations/20261011_grand_turismo_lap_times.sql`.
   File ini aman dijalankan berulang kali dan **tidak menghapus tabel apa pun** secara default
   (perintah penghapusan tabel lama ada di bagian bawah dalam bentuk komentar).
3. Supabase > Authentication > Providers: aktifkan **Allow anonymous sign-ins**.

## Deploy ke Vercel

Push ke GitHub, impor repo di Vercel, isi dua variabel lingkungan di atas. Tidak ada pengaturan lain.

## Kontrol

| Tombol | Fungsi |
|---|---|
| W / ↑ | Gas |
| S / ↓ | Rem, setelah berhenti = mundur |
| A D / ← → | Belok kiri / kanan |
| Spasi | Handbrake |
| R | Kembali ke lintasan |
| C | Ganti kamera (belakang / kap) |
| M | Suara hidup/mati |
| Esc / P | Jeda |

## Struktur kode

```
src/game/track.ts        sirkuit (spline), lokasi mobil di lintasan, grid start
src/game/physics.ts      fisika mobil (satu-satunya tempat arah belok dihitung)
src/game/ai.ts           pembalap otomatis (bot, waktu acuan medali, autopilot setelah finish)
src/game/RaceGame.ts     pengatur balapan: lap, kamera, input, HUD, efek, mobil pemain lain
src/net/                 multiplayer: protokol, room (host, lobby, mulai serempak), transport Supabase
src/game/render/         dunia 3D, pemuat model mobil, asap ban
src/lib/cars.ts          daftar mobil + semua angka performa (mudah disetel)
src/lib/supabase.ts      leaderboard + Anonymous Auth
src/components/          tampilan HUD, garasi, papan peringkat
tests/sim.test.ts        tes fisika dan sirkuit
tests/collision.test.ts  tes tabrakan antar mobil
tests/race.test.ts       tes balapan penuh 4 mobil dengan tabrakan
tools/optimize-car.mjs   alat untuk mengoptimasi model mobil baru
tests/net.test.ts        tes multiplayer (beberapa pemain simulasi, jam perangkat berbeda)
```

## Fitur balapan

- **9 mobil** dengan performa berbeda (kecepatan, akselerasi, rem, cengkeraman). Angkanya adalah angka permainan, bukan data resmi.
- **Tabrakan antar mobil**: saling mendorong, menggesek, dan berputar jika terkena di ujung, lengkap dengan percikan api,
  getaran kamera, dan suara benturan. Berlaku untuk bot dan pemain lain di multiplayer.
- Gas dan rem naik bertahap (tombol keyboard tidak langsung 0 ke 100%), jadi pengereman lebih halus.
- **Bantuan berkendara** (Garasi): *Mudah* (grip dan rem lebih kuat, kerikil lebih ringan, bawaan), *Normal*, dan *Pro*.
  Dari 240 km/h, tikungan U pertama cukup diawali rem ±45 m (Mudah) / ±80 m (Normal) sebelum tikungan; tes otomatis menjaga angka ini.
- Mode **Balapan vs Bot** (3 bot dengan mobil acak) dan **Time Trial + Ghost**.

## Menambah mobil baru

1. Siapkan file `.glb` (bagian depan menghadap +Z).
2. Optimasi: `cd tools && npm install && node optimize-car.mjs asli.glb ../public/models/car_idbaru.glb`
   (hasil ±1-2 MB; file mentah 10-20 MB terlalu berat untuk web).
3. Tambahkan satu blok di `src/lib/cars.ts` (salin salah satu blok yang ada, ganti `id`, `file`, dan angka performa).
4. Jalankan `npm test`. Tes fisika dan balapan penuh otomatis ikut memeriksa mobil barumu.
5. Cek lisensi model sebelum game dipublikasikan umum (kebanyakan model Sketchfab/komunitas meminta atribusi).

## Menyetel

- **Performa/handling mobil:** `src/lib/cars.ts` (`stats` dan `tuning`).
- **Rasa berkendara:** objek `FEEL` di bagian atas `src/game/physics.ts` (kecepatan kemudi, kehalusan gas dan rem, kekuatan rem),
  serta tabel `ASSIST` (pengali grip/rem tiap tingkat bantuan). Tabrakan: `RESTITUTION` dan `FRICTION` di `src/game/collision.ts`.
- **Bentuk sirkuit:** daftar `CONTROL` di `src/game/track.ts`. Jalankan `npm test` setelah mengubahnya,
  tes akan memberi tahu jika bot tidak bisa menyelesaikan lap.
- **Kesulitan bot:** `BOT_PACE` di `src/game/RaceGame.ts`.
- **Jumlah lap dan kualitas grafis:** diatur di halaman Garasi.

## Jika ada yang terlihat aneh

- **Mobil tampak menghadap terbalik:** di Garasi klik "Balik 180°" (disimpan per mobil).
- **Game patah-patah:** pilih kualitas **Rendah** di Garasi. Game juga menurunkan resolusi otomatis jika FPS rendah.
- **Tidak ada suara:** suara baru aktif setelah menekan MULAI (aturan browser). Tekan M untuk mengecek tombol bisu.
