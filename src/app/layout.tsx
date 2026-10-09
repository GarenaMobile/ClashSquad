import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clash Squad - 4v4 Tactical Top-Down Shooter',
  description: 'Game tembak-tembakan taktis 4v4 berbasis ronde di browser',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
