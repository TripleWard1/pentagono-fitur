import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pentágono Urbano | FITUR 2027',
  description: 'Plataforma de coordenação dos horários do stand conjunto do Pentágono Urbano na FITUR 2027.',
  manifest: '/manifest.webmanifest?v=9',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pentágono FITUR' },
  icons: {
    icon: [
      { url: '/favicon-pentagono-v9.ico', type: 'image/x-icon', sizes: '16x16 32x32 48x48 64x64' },
      { url: '/pentagono-favicon-v9.png', type: 'image/png', sizes: '64x64' },
    ],
    shortcut: [{ url: '/favicon-pentagono-v9.ico', type: 'image/x-icon' }],
    // The Apple icon is provided by app/apple-icon.png (Next.js file convention).
    // This avoids stale manually defined URLs taking priority on iOS Safari.
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        {/* Explicit conventional icon URL for iOS versions that probe apple-touch-icon directly. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-pentagono-v9.png" />
        <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-pentagono-v9.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
