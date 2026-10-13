import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pentágono Urbano | FITUR 2027',
  description: 'Plataforma de coordenação dos horários do stand conjunto do Pentágono Urbano na FITUR 2027.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pentágono FITUR' },
  icons: {
    icon: [
      { url: '/favicon.ico?rev=7', type: 'image/x-icon' },
      { url: '/pentagono-favicon.png?rev=7', type: 'image/png', sizes: '64x64' },
    ],
    apple: [{ url: '/pentagono-apple-touch-icon.png?rev=7', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-PT"><body>{children}</body></html>;
}
