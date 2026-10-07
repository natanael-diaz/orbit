import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Orbit — X Research Desk',
  description: 'Riset creator, koneksi komunitas, dan peluang stream assets.',
  icons: { icon: '/favicon.svg' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
