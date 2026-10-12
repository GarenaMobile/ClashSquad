import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grand Turismo Racing',
  description: 'Game balapan 3D di browser: pilih mobil, taklukkan sirkuit, rebut posisi pertama papan peringkat.',
};

export const viewport: Viewport = {
  themeColor: '#0b0d14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
