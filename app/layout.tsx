import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pentágono Urbano | FITUR 2027',
  description: 'Plataforma de coordenação dos horários do stand conjunto do Pentágono Urbano na FITUR 2027.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-PT"><body>{children}</body></html>;
}
