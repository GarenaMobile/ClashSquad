import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Menetapkan akar proyek secara eksplisit. Tanpa ini Next.js bisa salah memilih folder induk
  // jika ada package-lock.json lain di atasnya (muncul sebagai peringatan "multiple lockfiles").
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
