import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pentágono Urbano — FITUR 2027',
    short_name: 'Pentágono FITUR',
    description: 'Coordenação das ações dos cinco municípios do Pentágono Urbano na FITUR 2027.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#087443',
    icons: [
      { src: '/pentagono-app-icon-192.png?rev=7', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pentagono-app-icon-512.png?rev=7', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
