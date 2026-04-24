# Plano de migração para React + Vite por etapas

Este documento define uma migração gradual do Ryxen para uma arquitetura mais expansível usando React + Vite como padrão principal de frontend, sem reescrever o app inteiro de uma vez.

A meta é transformar o projeto de um MVP funcional em uma base de produto escalável para atleta, coach, admin, billing, benchmarks, importação, OCR e futuras superfícies.

## Objetivo

Padronizar o frontend em torno de:

- React para novas telas e componentes interativos
- Vite como build/dev tool principal
- Tailwind/design system compartilhado
- packages internos para UI, domínio, API e parsers
- migração incremental das telas antigas

## Decisão arquitetural

O Ryxen deve seguir uma arquitetura de monorepo simples dentro do mesmo repositório:

```txt
apps/
├── hub/
├── athlete/
├── coach/
└── admin/

packages/
├── ui/
├── domain/
├── api-client/
├── parsers/
└── shared-web/
```

## Regra principal

Não migrar tudo de uma vez.

Cada etapa deve terminar com o app rodando, buildando e testável.

O fluxo correto é:

```txt
criar base -> criar componentes -> migrar tela pequena -> validar -> migrar tela crítica -> limpar legado
```

## O que não fazer

Evitar:

- migrar parser, backend e UI na mesma etapa
- trocar framework e design system ao mesmo tempo sem controle
- apagar telas antigas antes das novas estarem equivalentes
- editar CSS gerado manualmente
- transformar tudo em React sem separar domínio/API
- mover arquivos sem atualizar testes/imports

## Estado atual resumido

O projeto já possui:

- React e React DOM como dependências
- Vite usado no Coach Portal
- Tailwind v4
- Capacitor para Android
- frontend modular em HTML/CSS/JS
- backend Node/Express/Postgres
- parser próprio para PDF/treinos
- scripts separados de build

Isso permite uma migração segura sem trocar toda a stack.

## Arquitetura alvo

### Apps

Cada app representa uma superfície de produto:

```txt
apps/hub       -> entrada, marketing leve, escolha de superfície
apps/athlete   -> experiência principal do atleta
apps/coach     -> portal do coach
apps/admin     -> administração interna
```

Cada app deve ter:

```txt
main.tsx ou main.jsx
App.tsx ou App.jsx
routes/
pages/
components/
```

Exemplo:

```txt
apps/athlete/
├── main.jsx
├── App.jsx
├── routes/
├── pages/
│   ├── TodayPage.jsx
│   ├── ImportPage.jsx
│   ├── BenchmarksPage.jsx
│   └── AccountPage.jsx
└── components/
```

### Packages

#### `packages/ui`

Componentes visuais reutilizáveis:

```txt
Button
Card
Input
Modal
BottomNav
PageShell
Badge
Toast
EmptyState
LoadingState
WorkoutBlock
ImportPreviewCard
```

Não deve conter regra de negócio pesada.

#### `packages/domain`

Regras puras do produto:

```txt
workouts
benchmarks
subscriptions
access
gyms
users
```

Exemplo:

```txt
packages/domain/workouts/
├── normalizeWorkout.js
├── workoutTypes.js
├── workoutFormat.js
└── workoutValidation.js
```

#### `packages/api-client`

Cliente para backend:

```txt
authClient
workoutClient
benchmarkClient
billingClient
gymClient
adminClient
```

Responsável por fetch, headers, token e tratamento de erro.

#### `packages/parsers`

Tudo que transforma arquivo/texto em treino estruturado:

```txt
pdf
ocr
csv
json
text
customPdfParser
```

O `CustomPdfParser` deve migrar para cá quando estiver estável.

#### `packages/shared-web`

Utilidades específicas de navegador:

```txt
storage
pwa
notifications
fileHandling
telemetry
```

## Roadmap de migração

## Fase 0 — Preparação e segurança

Objetivo: garantir que qualquer migração tenha como voltar atrás.

Tarefas:

- Criar branch dedicada:

```bash
git checkout -b refactor/react-vite-migration
```

- Rodar baseline:

```bash
npm test
npm run build
```

- Registrar telas críticas que não podem quebrar:

```txt
Login/cadastro
Home do atleta
Treino do dia
Importação de PDF/imagem
Preview de importação
Benchmarks
Conta/assinatura
Coach Portal
```

- Criar checklist visual e funcional antes/depois.

Definition of Done:

- build atual funcionando
- testes passando ou falhas conhecidas documentadas
- plano de rollback claro

## Fase 1 — Design system primeiro

Objetivo: criar uma base visual compartilhada antes de migrar telas.

Depende de:

- `docs/STYLE_REFACTOR_GUIDE.md`

Tarefas:

- Separar CSS compartilhado em:

```txt
src/styles/tokens.css
src/styles/base.css
src/styles/components.css
src/styles/utilities.css
```

- Atualizar `src/styles/tailwind.shared.css` para importar esses arquivos.
- Criar classes base:

```txt
rx-page
rx-card
rx-btn
rx-input
rx-badge
rx-modal
rx-bottom-nav
rx-empty-state
rx-loading
```

- Não alterar lógica de telas ainda.

Definition of Done:

- hub e athlete continuam buildando
- nenhuma edição manual em `tailwind.generated.css`
- tokens centralizados
- componentes CSS base disponíveis

## Fase 2 — Criar `packages/ui`

Objetivo: iniciar componentes React reutilizáveis sem migrar o app inteiro.

Estrutura sugerida:

```txt
packages/ui/
├── index.js
├── Button.jsx
├── Card.jsx
├── PageShell.jsx
├── BottomNav.jsx
├── Badge.jsx
├── EmptyState.jsx
├── LoadingState.jsx
└── WorkoutBlock.jsx
```

Tarefas:

- Criar componentes simples usando classes do design system.
- Evitar estado complexo.
- Exportar tudo por `packages/ui/index.js`.

Exemplo:

```jsx
export function Button({ variant = 'primary', children, ...props }) {
  return (
    <button className={`rx-btn rx-btn-${variant}`} {...props}>
      {children}
    </button>
  );
}
```

Definition of Done:

- componentes importáveis
- nenhum fluxo antigo quebrado
- componentes conseguem renderizar em uma tela teste

## Fase 3 — Criar `packages/domain`

Objetivo: tirar regras puras de dentro da UI.

Tarefas:

- Criar helpers de treino:

```txt
packages/domain/workouts/
├── index.js
├── normalizeWorkout.js
├── formatWorkoutBlock.js
└── detectWorkoutStatus.js
```

- Mover apenas funções puras, sem mexer em storage/API.
- Criar exports estáveis.

Definition of Done:

- funções puras isoladas
- testes simples para normalização/formatação
- telas antigas ainda usam os helpers antigos ou wrappers compatíveis

## Fase 4 — Criar `packages/api-client`

Objetivo: padronizar comunicação com backend.

Tarefas:

- Criar cliente base:

```txt
packages/api-client/httpClient.js
packages/api-client/authClient.js
packages/api-client/workoutClient.js
packages/api-client/benchmarkClient.js
packages/api-client/billingClient.js
```

- Centralizar:

```txt
baseUrl
auth token
headers
json parsing
erros HTTP
retry simples quando fizer sentido
```

- Não trocar todas as chamadas antigas ainda.

Definition of Done:

- cliente novo existe
- pelo menos uma chamada simples validada
- chamadas antigas continuam funcionando

## Fase 5 — React island em tela não crítica

Objetivo: provar React dentro do app sem migrar tela crítica.

Escolher uma tela pequena, por exemplo:

```txt
Empty state
About/versão
Uma seção simples do hub
Um card de conta não crítico
```

Tarefas:

- Criar um mount React isolado.
- Renderizar componente de `packages/ui`.
- Manter fallback antigo enquanto testa.

Definition of Done:

- React renderiza dentro do app atual
- build passa
- não altera fluxo principal do atleta

## Fase 6 — Migrar shell do atleta

Objetivo: padronizar a estrutura externa antes das telas internas.

Tarefas:

- Criar `PageShell` React.
- Criar `BottomNav` React.
- Mapear rotas/tabs atuais.
- Garantir safe-area no Android/PWA.
- Manter conteúdo antigo renderizado dentro do shell se necessário.

Definition of Done:

- navegação visual consistente
- bottom nav estável
- telas antigas ainda acessíveis
- Android/PWA sem corte em notch/barra inferior

## Fase 7 — Migrar tela “Treino do dia”

Objetivo: migrar a tela mais importante do atleta para React.

Tarefas:

- Criar `TodayPage.jsx`.
- Criar componentes:

```txt
WorkoutDayHeader
WorkoutPeriodTabs
WorkoutBlockCard
WorkoutGoal
WorkoutNotes
```

- Consumir dados já existentes sem alterar parser.
- Usar `packages/domain/workouts` para formatar blocos.

Definition of Done:

- treino do dia renderiza igual ou melhor que antes
- manhã/tarde funcionam
- blocos WOD/STRENGTH/GYMNASTICS/ACCESSORIES legíveis
- estados vazio/erro/loading existem

## Fase 8 — Migrar importação e preview

Objetivo: melhorar o fluxo mais sensível para PDF/OCR.

Tarefas:

- Criar `ImportPage.jsx`.
- Criar componentes:

```txt
ImportDropzone
ImportProgress
RecognizedTextPreview
ParsedWorkoutPreview
ImportWarnings
ManualCorrectionPanel
```

- Separar estados:

```txt
selected
reading
extracting
parsing
preview
saving
success
error
```

- Ainda usar parser atual.
- Melhorar preview antes de salvar.

Definition of Done:

- usuário vê o que foi reconhecido
- usuário entende erros de OCR/PDF
- importação não salva dados ruins sem revisão
- parser antigo continua compatível

## Fase 9 — Migrar parsers para `packages/parsers`

Objetivo: organizar PDF/OCR/text/csv/json fora da UI.

Estrutura alvo:

```txt
packages/parsers/
├── index.js
├── pdf/
│   ├── pdfReader.js
│   ├── customPdfParser.js
│   └── pdfParser.js
├── ocr/
│   ├── imagePreprocess.js
│   ├── ocrTextCleanup.js
│   └── ocrWorkoutParser.js
├── text/
├── csv/
└── json/
```

Tarefas:

- Mover parser com wrappers compatíveis.
- Criar testes com fixtures.
- Adicionar fixtures de PDF/texto/OCR.

Definition of Done:

- imports antigos têm compatibilidade ou foram atualizados
- testes do parser passam
- OCR/imagem tem camada própria de cleanup antes do parser

## Fase 10 — Migrar Benchmarks

Objetivo: transformar benchmarks em tela React expansível.

Tarefas:

- Criar `BenchmarksPage.jsx`.
- Componentes:

```txt
BenchmarkSearch
BenchmarkFilters
BenchmarkCard
LeaderboardPreview
BenchmarkResultForm
```

- Usar `packages/api-client/benchmarkClient`.

Definition of Done:

- busca/filtros funcionam
- cards usam design system
- leaderboard renderiza estado vazio/loading/erro

## Fase 11 — Migrar Conta/Assinatura

Objetivo: padronizar acesso, billing e status do usuário.

Tarefas:

- Criar `AccountPage.jsx`.
- Componentes:

```txt
ProfileCard
SubscriptionStatusCard
AccessStateBanner
BillingActionCard
DataExportCard
```

- Usar `packages/api-client/billingClient`.

Definition of Done:

- estados de assinatura claros
- ações principais óbvias
- mensagens de grace period legíveis

## Fase 12 — Migrar Coach Portal para packages compartilhados

Objetivo: evitar que o Coach Portal seja outro app com outro visual.

Tarefas:

- Consumir `packages/ui`.
- Consumir `packages/api-client`.
- Compartilhar tokens CSS.
- Não migrar tudo se o portal já estiver funcionando: começar por cards, botões e layout.

Definition of Done:

- coach e athlete parecem parte do mesmo produto
- chamadas API seguem padrão novo
- componentes duplicados removidos aos poucos

## Fase 13 — Admin

Objetivo: isolar painel admin como app próprio.

Tarefas:

```txt
apps/admin/
├── main.jsx
├── App.jsx
├── pages/
└── components/
```

- Usar `packages/ui`.
- Usar `packages/api-client/adminClient`.
- Manter permissões e segurança no backend, não só na UI.

Definition of Done:

- admin separado da experiência do atleta
- UI não expõe ações admin para usuário comum
- backend continua validando permissões

## Fase 14 — Remoção de legado

Objetivo: apagar código antigo com segurança.

Tarefas:

- Identificar telas antigas substituídas.
- Remover CSS não usado.
- Remover helpers duplicados.
- Remover imports quebrados.
- Atualizar documentação.

Rodar:

```bash
npm run lint
npm test
npm run build
```

Definition of Done:

- build limpo
- testes passam
- código antigo removido sem quebrar rotas
- documentação atualizada

## Estratégia de commits

Sugestão:

```txt
docs: add react vite migration plan
style: split shared css layers
feat(ui): add base ui package
feat(domain): add workout domain helpers
feat(api): add api client package
feat(athlete): add react shell island
feat(athlete): migrate today page
feat(import): migrate import preview flow
refactor(parsers): move parsers into package
feat(benchmarks): migrate benchmarks page
feat(account): migrate account page
refactor(coach): use shared ui and api client
refactor: remove legacy frontend code
```

## Estratégia de rollback

Cada fase deve ser reversível.

Regras:

- uma fase por PR ou por commit grande bem definido
- manter tela antiga até a nova estar validada
- não remover parser antigo antes dos testes novos passarem
- não mover API client antigo sem wrapper de compatibilidade

## Testes mínimos por fase

Sempre rodar:

```bash
npm test
npm run build
```

Quando mexer em UI crítica:

```bash
npm run test:e2e
```

Quando mexer em Android:

```bash
npm run android:doctor
npm run android:assemble:debug
```

## Ordem recomendada realista

Para não travar o projeto, a ordem prática deve ser:

```txt
1. CSS/design system
2. packages/ui
3. React island pequeno
4. shell do atleta
5. treino do dia
6. importação/preview
7. parsers
8. benchmarks
9. conta/assinatura
10. coach portal
11. admin
12. limpeza
```

## Critério para decidir migrar uma tela

Migrar quando a tela:

- é muito importante para o produto
- tem muita duplicação visual
- precisa crescer
- tem estados complexos
- vai se beneficiar de componentes React

Não migrar ainda quando:

- está funcionando bem
- é simples e raramente muda
- não tem duplicação
- migrar agora atrapalharia uma entrega maior

## Definition of Done da migração inteira

A migração pode ser considerada concluída quando:

- novas telas são feitas em React
- `packages/ui` é usado por athlete/coach/admin
- regras de domínio não ficam presas em componentes
- API client está centralizado
- parsers estão testáveis fora da UI
- CSS gerado não é editado manualmente
- Android/PWA continua funcionando
- build e testes passam
- o app parece um produto único, não várias telas juntadas

## Norte final

O Ryxen não precisa virar um app perfeito em uma reescrita gigante.

Ele precisa virar uma base onde cada nova feature seja mais fácil que a anterior.

A migração está certa se, depois dela, criar uma tela nova significar:

```txt
usar PageShell
usar componentes de packages/ui
buscar dados pelo api-client
formatar regra pelo domain
aplicar tokens do design system
```

E não começar tudo do zero de novo.
