# Pentágono Urbano - FITUR 2027

Aplicação Next.js para coordenar o calendário de ações dos cinco municípios do Pentágono Urbano na FITUR 2027.

## O que inclui

- Calendário de 19 a 24 de janeiro de 2027, em blocos de 30 minutos (10:00–19:00).
- Limite de 3 reservas por município/dia; cada atividade ocupa 30 minutos e bloqueia apenas os 30 minutos seguintes para arrumação (ex.: reserva às 16:00 bloqueia 16:30; a próxima atividade pode começar às 17:00).
- Reservas partilhadas em tempo real através do Cloud Firestore, quando configurado.
- Modo local com `localStorage` para pré-visualização sem Firebase.
- Ecrã público para a televisão do stand em `/ecran`, que roda automaticamente entre dias com atividades.
- Símbolo multicolorido do Pentágono Urbano como favicon e ícone de instalação em dispositivos móveis, com novos nomes de ficheiro para evitar cache dos ícones antigos.
- Logótipos experimentais de Braga e Barcelos carregados dos URLs fornecidos, ampliados e sem fundo branco aplicado por CSS.
- Verdana como fonte principal; campos de formulário com 16 px em mobile para evitar zoom automático do Safari.

## Executar localmente

Requer Node.js 20 ou superior recomendado.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`. Sem variáveis Firebase, a app funciona em modo local, mas os dados não são partilhados entre browsers ou dispositivos.

## Configurar Firebase / Cloud Firestore

### 1. Criar a base de dados

1. Abre a [Firebase Console](https://console.firebase.google.com/) e seleciona o projeto.
2. Em **Build → Firestore Database** (ou **Databases & Storage → Firestore**), clica em **Create database**.
3. Escolhe **Production mode** (as regras do projeto devem substituir as regras iniciais antes de testar).
4. Escolhe a localização europeia que melhor se adequa ao projeto. A localização da base de dados não pode ser alterada depois de criada; confirma a opção antes de continuar.
5. Conclui a criação.

### 2. Ativar autenticação anónima

A versão atual inicia uma sessão Firebase anónima automaticamente (não mostra ecrã de login):

1. Na consola, abre **Build → Authentication → Get started**.
2. Em **Sign-in method**, ativa **Anonymous**.

Isto é para facilitar um piloto interno. Não identifica cada município nem impede que um visitante público da aplicação consiga obter uma sessão anónima.

### 3. Registar a app Web e copiar a configuração

1. Nas definições do projeto Firebase, em **Your apps**, adiciona uma aplicação **Web** (ícone `</>`), se ainda não existir.
2. Regista a aplicação e copia os valores do `firebaseConfig`.
3. Copia `.env.example` para `.env.local` e preenche os campos:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Não publiques o ficheiro `.env.local` no Git. As variáveis `NEXT_PUBLIC_` ficam visíveis no cliente; são identificadores de configuração do SDK Web, não chaves de conta de serviço. **Nunca** coloques uma chave privada/JSON de service account nestas variáveis.

### 4. Aplicar as regras do Firestore

No projeto Firebase, abre **Firestore Database → Rules**, substitui as regras pelo conteúdo de `firestore.rules` desta versão e clica em **Publish**. Esta atualização é obrigatória porque a versão usa as coleções `slotLocksV2` e `system/slotLockSchema`. As mesmas regras estão incluídas no ZIP para revisão.

O modelo de dados é criado automaticamente pela app à medida que as reservas são feitas; não precisas de criar coleções manualmente. A app usa:

- `reservations` - os dados de cada ação;
- `slotLocksV2` - bloqueios transacionais do próprio horário e do bloco seguinte para arrumação;
- `system/slotLockSchema` - versão do esquema de bloqueios, com migração automática dos agendamentos existentes. A primeira abertura depois desta atualização migra os bloqueios dentro de uma transação; mantém a página aberta até surgir “Sincronizado”.
- `dailyCounters` - contagem transacional para o limite diário por município.

### 5. Testar localmente

Depois de guardar `.env.local`, reinicia `npm run dev`. O topo da plataforma deve mostrar **Sincronizado**. Cria uma reserva, abre outro browser ou uma janela privada e entra no mesmo endereço: com Firebase ligado, a reserva deve aparecer nos dois sítios.

Se aparecer **Erro de sincronização**, confirma que o projeto ID e as variáveis estão certos, a autenticação anónima está ativada, o Firestore foi criado e as regras foram publicadas.

### 6. Configurar no Vercel

No Vercel, abre o projeto → **Settings → Environment Variables** e adiciona as mesmas seis variáveis `NEXT_PUBLIC_FIREBASE_...` para Production (e Preview, se necessário). Depois faz **Redeploy**: novas variáveis só entram no deployment seguinte.

## Ecrã gigante da FITUR

A página para a televisão fica numa rota diferente da aplicação de gestão:

- Gestão: `https://pentagono-fitur.vercel.app/`
- Ecrã do stand: `https://pentagono-fitur.vercel.app/ecran`

A rota `/ecran` usa a mesma base de dados, apresenta as atividades em cartões grandes e roda automaticamente entre dias/páginas. É o mesmo deployment e domínio, mas um URL próprio. Depois do deploy, abre esse endereço no computador ligado ao ecrã e coloca o browser em ecrã inteiro.

## Favicon e instalação no telemóvel

O projeto referencia ícones com nomes novos `favicon-v8.ico`, `pentagono-favicon-v8.png`, `pentagono-app-icon-192-v8.png`, `pentagono-app-icon-512-v8.png` e `pentagono-apple-touch-icon-v8.png` para invalidar a cache do favicon anterior. Depois do deploy, se o ícone antigo continuar a aparecer, remove o atalho antigo do ecrã principal e adiciona novamente a aplicação; os browsers podem conservar o ícone da instalação antiga.

## Segurança importante antes de uso oficial

A autenticação anónima é conveniente para uma demonstração, mas **não constitui controlo de acesso aos municípios**: qualquer pessoa que consiga abrir o site pode criar uma sessão anónima. As regras fornecidas validam parte da estrutura dos documentos, mas as operações de slots/counters continuam expostas a utilizadores autenticados anonimamente.

Antes de divulgar o endereço publicamente ou utilizar o calendário como registo oficial, recomendo acrescentar login real (contas por município), permissões por papel, validação crítica no servidor/Cloud Functions e Firebase App Check. Assim, só pessoas autorizadas podem criar/editar reservas e o limite de horários deixa de depender exclusivamente do cliente.

## Logótipos dos municípios

Os logótipos experimentais de Braga e Barcelos são carregados dos URLs Imgur fornecidos. Os três restantes municípios continuam a usar o quadrado de cor, até serem fornecidos os respetivos logótipos.


### ESLint / build

O projeto inclui `eslint` e `eslint-config-next` como dependências de desenvolvimento e uma configuração `.eslintrc.json`. Executa `npm install` antes de `npm run build`.

## Correção do ícone no ecrã principal do iPhone (V9)

Esta versão define o ícone Apple explicitamente no `head` e inclui também `app/apple-icon.png` e `app/icon.png`, seguindo as convenções do Next.js. O ícone Apple é um PNG opaco de 180×180 px e usa um URL novo para evitar cache antiga.

Depois de publicar:
1. No iPhone, remove o atalho antigo do ecrã principal (manter premido → Remover marcador/apagar app, consoante a versão do iOS).
2. Abre o endereço diretamente na app **Safari** - não a partir do browser interno de outra app.
3. Confirma que `https://pentagono-fitur.vercel.app/apple-touch-icon-pentagono-v9.png` mostra o símbolo correto.
4. No Safari, Partilhar → Adicionar ao ecrã principal → Adicionar.
5. Se ainda aparecer o ícone anterior, vai a Definições → Apps → Safari → Limpar histórico e dados dos sites (o texto pode variar conforme o iOS), abre novamente o site e repete.

O iOS não atualiza necessariamente o ícone de um atalho já instalado quando um novo deployment é publicado; é necessário remover e voltar a adicionar o atalho.


## Correção V10 do ícone de instalação iOS

Esta versão declara explicitamente `icons.apple` na API de Metadata do Next.js e usa o ficheiro versionado `/apple-touch-icon-pentagono-v10.png` (180×180) para evitar conflito/cache com ícones de versões anteriores. O manifest usa ícones 192×192 e 512×512 versionados.

Após publicar, confirma que o deployment está associado ao domínio Production; abre diretamente `/apple-touch-icon-pentagono-v10.png`, apaga o atalho antigo do iPhone e volta a adicioná-lo pelo Safari. Não é necessário alterar as variáveis Firebase.
