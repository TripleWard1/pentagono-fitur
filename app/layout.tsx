import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pentágono Urbano | FITUR 2027',
  description: 'Plataforma de coordenação dos horários do stand conjunto do Pentágono Urbano na FITUR 2027.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pentágono FITUR' },
  icons: {
    icon: [
      { url: '/favicon-v8.ico', type: 'image/x-icon', sizes: '16x16 32x32 48x48 64x64' },
      { url: '/pentagono-favicon-v8.png', type: 'image/png', sizes: '64x64' },
    ],
    shortcut: [{ url: '/pentagono-favicon-v8.png', type: 'image/png', sizes: '64x64' }],
    apple: [{ url: '/pentagono-apple-touch-icon-v8.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-PT"><body>{children}</body></html>;
}
