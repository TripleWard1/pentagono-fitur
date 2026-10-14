import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pentágono Urbano — FITUR 2027',
    short_name: 'Pentágono FITUR',
    description: 'Coordenação das ações dos cinco municípios do Pentágono Urbano na FITUR 2027.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#087443',
    icons: [
      { src: '/pentagono-app-icon-192-v11.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pentagono-app-icon-512-v11.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pentagono-app-icon-maskable-512-v11.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
