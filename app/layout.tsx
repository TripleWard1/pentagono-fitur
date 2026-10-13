import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pentágono Urbano | FITUR 2027',
  description: 'Plataforma de coordenação dos horários do stand conjunto do Pentágono Urbano na FITUR 2027.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Pentágono FITUR' },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-PT"><body>{children}</body></html>;
}
