import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Pentágono Urbano | FITUR 2027',
  description: 'Plataforma de coordenação dos horários do stand conjunto do Pentágono Urbano na FITUR 2027.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pentágono FITUR' },
  icons: {
    icon: [
      { url: '/favicon-pentagono-v9.ico', type: 'image/x-icon', sizes: '16x16 32x32 48x48 64x64' },
      { url: '/pentagono-favicon-v9.png', type: 'image/png', sizes: '64x64' },
    ],
    shortcut: [{ url: '/favicon-pentagono-v9.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
