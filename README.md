# Pentágono Urbano · FITUR 2027

Interface de planeamento redesenhada para coordenar as ações dos cinco municípios no stand conjunto da FITUR 2027.

## Executar localmente

Requer Node.js 18.17 ou superior.

```bash
npm install
npm run dev
```

Abrir http://localhost:3000. Para gerar a versão de produção: `npm run build` e `npm start`.

## O que mudou

- Direção visual editorial e institucional, com hierarquia tipográfica, paleta natural, espaço em branco e estados visuais distintos.
- Layout adaptável a desktop, tablet e telemóvel.
- Seleção dos cinco municípios e navegação pelos seis dias (19–24 de janeiro de 2027).
- Grelha com 18 blocos de 30 minutos entre as 10:00 e as 19:00.
- Regra de máximo de três reservas por município/dia.
- Bloqueio dos blocos imediatamente anterior e posterior a cada reserva.
- Criação, edição e remoção de ações com responsável, contacto e notas.
- Pesquisa, vista de um município ou de todos e exportação CSV.
- Persistência das reservas no armazenamento local do browser.

## Nota importante sobre dados partilhados

Esta versão guarda os dados **no browser/dispositivo onde é utilizada**. Não existe ainda uma base de dados central nem sincronização em tempo real entre computadores. Para uso operacional simultâneo pelos cinco municípios, é necessário ligar a aplicação a um backend partilhado (por exemplo, PostgreSQL/Supabase) e validar as regras de reserva no servidor. A interface apresenta a persistência local explicitamente para não criar a impressão de que os dados já estão sincronizados.

## Regras do calendário

- Um slot corresponde a 30 minutos; o último começa às 18:30 e termina às 19:00.
- O máximo diário é de três slots por município.
- Os slots adjacentes a uma reserva ficam indisponíveis para todos os municípios.
- A exportação gera um CSV UTF-8 com separador `;`, adequado para abrir em folhas de cálculo.
