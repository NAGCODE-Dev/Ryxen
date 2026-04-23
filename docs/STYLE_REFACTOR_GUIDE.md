# Guia de refactor visual do Ryxen

Este documento guia um refactor completo e controlado do CSS/UI do Ryxen sem reescrever as funcionalidades do app.

A ideia principal é transformar o visual atual em um design system consistente, premium e mobile-first, mantendo o app funcional durante todo o processo.

## Objetivo

Criar uma camada visual unificada para todo o ecossistema Ryxen:

- Hub
- App do atleta
- Sports surfaces
- Coach Portal
- Telas de importação, preview e revisão
- Componentes de treino, benchmark, conta e assinatura

O objetivo não é apenas “deixar bonito”. O objetivo é reduzir inconsistência, facilitar manutenção e fazer qualquer tela nova parecer parte do mesmo produto.

## Princípio do refactor

Não refatorar tudo ao mesmo tempo.

O app já está próximo de pronto. Por isso, o caminho certo é tratar o CSS como uma camada de produto:

```txt
funcionalidade existente -> tokens -> componentes base -> telas -> limpeza
```

Evitar mexer em regra de negócio durante o refactor visual.

## Diagnóstico atual

O projeto já tem uma base boa:

- Tailwind v4
- Tokens centralizados em `src/styles/tailwind.shared.css`
- Bundle visual separado para hub e atleta
- Build dedicado para `hub` e `athlete`
- Estrutura PWA/mobile-first

Arquivos relevantes:

```txt
src/styles/tailwind.shared.css
src/hub/tailwind.css
src/hub/styles.css
src/ui/tailwind.css
src/ui/styles.css
apps/athlete/layoutShell.js
coach-portal/
```

O problema esperado não é falta de CSS. O problema é falta de uma linguagem visual fechada e reaproveitável.

## Direção visual

O Ryxen deve parecer:

```txt
dark, premium, esportivo, técnico, claro, forte, rápido, confiável
```

Evitar:

- excesso de sombras diferentes
- cards com estilos muito variados
- botões com hierarquia confusa
- telas com espaçamentos diferentes sem motivo
- cores usadas fora dos tokens
- componentes importantes montados só com classes soltas

Buscar:

- contraste alto
- cards grandes e legíveis
- cantos arredondados consistentes
- separação clara entre ação principal e ação secundária
- boa leitura em celular
- bottom nav estável
- telas de treino com hierarquia muito clara

## Arquitetura CSS desejada

Separar o CSS por responsabilidade:

```txt
src/styles/
├── tailwind.shared.css
├── tokens.css
├── base.css
├── components.css
├── utilities.css
└── app-surfaces.css
```

### `tokens.css`

Deve conter apenas variáveis de design:

- cores
- espaçamentos
- radius
- shadows
- altura de nav
- safe area
- tipografia
- z-index

Exemplo:

```css
:root {
  --rx-bg: #0f1218;
  --rx-bg-alt: #10151d;
  --rx-surface: #171c24;
  --rx-surface-2: #1d2430;
  --rx-border: rgba(255, 255, 255, 0.08);
  --rx-border-strong: rgba(167, 186, 214, 0.18);

  --rx-text: #f5f7fb;
  --rx-text-soft: rgba(211, 220, 232, 0.9);
  --rx-text-muted: rgba(172, 186, 206, 0.72);

  --rx-accent: #8ab4ff;
  --rx-accent-strong: #6f9cff;
  --rx-energy: #f2b88b;
  --rx-ok: #71d39a;
  --rx-warn: #f0c27b;
  --rx-danger: #f18e96;

  --rx-radius-sm: 14px;
  --rx-radius-md: 18px;
  --rx-radius-lg: 24px;
  --rx-radius-xl: 32px;

  --rx-page-x: clamp(16px, 4vw, 32px);
  --rx-nav-height: 72px;
  --rx-safe-top: env(safe-area-inset-top, 0px);
  --rx-safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

### `base.css`

Deve conter reset e padrões globais:

```css
html {
  min-height: 100%;
  -webkit-text-size-adjust: 100%;
}

body {
  min-height: 100%;
  margin: 0;
  background: var(--rx-bg);
  color: var(--rx-text);
  font-family: var(--font-sans);
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

button,
input,
select,
textarea {
  font: inherit;
}
```

### `components.css`

Deve conter classes semânticas reutilizáveis.

Exemplos:

```css
.rx-page {
  min-height: 100dvh;
  padding: calc(var(--rx-safe-top) + 16px) var(--rx-page-x)
    calc(var(--rx-safe-bottom) + var(--rx-nav-height) + 16px);
}

.rx-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025));
  border: 1px solid var(--rx-border);
  border-radius: var(--rx-radius-lg);
  box-shadow: 0 18px 44px rgba(4, 9, 18, 0.2);
}

.rx-btn {
  min-height: 44px;
  border: 0;
  border-radius: var(--rx-radius-md);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.rx-btn-primary {
  background: var(--rx-accent);
  color: #071427;
}

.rx-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: var(--rx-text);
  border: 1px solid var(--rx-border);
}

.rx-input {
  width: 100%;
  min-height: 48px;
  border-radius: var(--rx-radius-md);
  border: 1px solid var(--rx-border);
  background: rgba(255,255,255,0.045);
  color: var(--rx-text);
  padding: 0 14px;
}
```

### `utilities.css`

Deve conter utilitários que não são bons como componente:

```css
.rx-muted {
  color: var(--rx-text-muted);
}

.rx-soft-divider {
  border-top: 1px solid var(--rx-border);
}

.rx-scroll-safe {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
```

## Componentes que precisam virar padrão

Prioridade alta:

1. Page shell
2. App header
3. Bottom navigation
4. Card
5. Button
6. Input/select/textarea
7. Modal/drawer
8. Toast/alert
9. Badge/status pill
10. Empty state
11. Loading/skeleton
12. Workout block
13. Import preview card
14. Benchmark card
15. Account/subscription card

Cada componente deve ter:

- classe base
- variações
- estado hover/focus/disabled/loading
- comportamento mobile
- uso documentado

## Regras de design

### Cores

Toda cor nova precisa virar token.

Não usar hex solto em telas finais, exceto casos temporários durante migração.

Ruim:

```css
color: #8ab4ff;
background: #171c24;
```

Bom:

```css
color: var(--rx-accent);
background: var(--rx-surface);
```

### Espaçamento

Usar escala previsível:

```txt
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Evitar valores aleatórios como `17px`, `23px`, `37px`, a não ser que exista motivo específico.

### Radius

Usar apenas tokens:

```txt
sm: chips, badges
md: inputs, botões
lg: cards
xl: containers grandes/modais
```

### Botões

Hierarquia recomendada:

```txt
primary: ação principal da tela
secondary: ação alternativa
ghost: ação leve
danger: ação destrutiva
```

Uma tela não deve ter vários botões com aparência de ação principal.

### Cards

Cards devem ter estrutura consistente:

```txt
header
conteúdo
metadados/status
ações
```

Para treino, a leitura precisa ser mais importante que decoração.

### Mobile

Tudo deve ser pensado primeiro para celular:

- toque mínimo de 44px
- bottom nav respeitando safe-area
- forms sem campos pequenos
- modais como bottom sheet quando fizer sentido
- textos sem quebra estranha
- telas longas com seções claras

## Plano de migração

### Fase 1 — Inventário

Mapear telas principais:

```txt
Hub
Login/cadastro
Onboarding
Home do atleta
Treino do dia
Importação
Preview de treino
Benchmarks
Conta
Assinatura
Coach Portal
Admin básico
```

Para cada tela, anotar:

- componentes usados
- classes duplicadas
- problemas visuais
- prioridade

### Fase 2 — Tokens

Criar ou reorganizar:

```txt
src/styles/tokens.css
src/styles/base.css
src/styles/components.css
src/styles/utilities.css
```

Depois atualizar `tailwind.shared.css` para importar esses arquivos.

Exemplo:

```css
@import "./tokens.css";
@import "./base.css";
@import "./components.css";
@import "./utilities.css";
```

### Fase 3 — Shell mobile

Padronizar:

- padding de página
- header
- bottom nav
- safe areas
- largura máxima em desktop
- scroll container

Meta: todas as telas parecerem estar no mesmo app antes mesmo de mexer nos cards internos.

### Fase 4 — Componentes base

Criar classes para:

```txt
rx-card
rx-btn
rx-input
rx-badge
rx-section
rx-modal
rx-empty-state
rx-loading
```

Só depois aplicar nas telas.

### Fase 5 — Telas críticas

Ordem recomendada:

1. Home do atleta
2. Treino do dia
3. Importação/preview
4. Benchmarks
5. Conta/assinatura
6. Hub inicial
7. Coach Portal

### Fase 6 — Limpeza

Remover:

- CSS morto
- classes duplicadas
- tokens antigos não usados
- componentes visuais que foram substituídos
- overrides temporários

Rodar:

```bash
npm run build
npm test
```

## Estratégia para não quebrar o app

Criar refactor por branch:

```bash
git checkout -b refactor/design-system-css
```

Não alterar lógica de parser, backend, autenticação ou storage na mesma branch.

Commits sugeridos:

```txt
1. docs: add visual refactor guide
2. style: split shared css into tokens and base layers
3. style: add reusable ui component classes
4. style: refactor athlete shell layout
5. style: refactor workout cards
6. style: refactor import preview screens
7. style: remove legacy visual overrides
```

## Checklist por tela

Antes de considerar uma tela pronta:

- Usa tokens, não cores soltas
- Tem padding consistente
- Respeita safe-area no celular
- Botões têm hierarquia clara
- Inputs têm foco visível
- Cards usam padrão único
- Estado vazio existe
- Estado loading existe
- Erros são visíveis e legíveis
- Funciona em 360px de largura
- Funciona em desktop sem ficar esticado demais
- Não depende de `tailwind.generated.css` editado manualmente

## Checklist de acessibilidade

- Contraste suficiente em texto principal
- Foco visível em links, botões e inputs
- Área de toque mínima de 44px
- Texto não menor que 12px em informação útil
- Não usar apenas cor para indicar erro/sucesso
- Modais devem ser fáceis de fechar
- Botões desabilitados devem ser visualmente claros

## Guia para workout blocks

Treinos são a parte mais importante do produto. Eles devem ser muito legíveis.

Estrutura recomendada:

```txt
Dia + período
Tipo do bloco
Formato/time cap
Movimentos
Objetivo
Notas
Ações
```

Visual recomendado:

```txt
Quarta · tarde
WOD
16 MIN AMRAP
15 cal row
20 CTBS
15 GHD sit ups
40 DUs
Objetivo: acima de 4 rounds
```

Evitar jogar tudo como texto cru quando o parser já conseguiu separar dados.

## Guia para importação/OCR

A tela de importação deve ser tratada como fluxo crítico.

Estados necessários:

```txt
selecionar arquivo
lendo arquivo
extraindo texto
organizando semanas
preview
corrigir manualmente
salvar
erro
```

Para imagem/OCR, mostrar confiança e permitir revisão:

```txt
Texto reconhecido
Treino estruturado
Campos suspeitos
Editar antes de salvar
```

O design precisa assumir que OCR pode errar.

## Definition of Done

O refactor visual está pronto quando:

- hub, atleta e telas principais compartilham tokens
- não há edição manual de CSS gerado
- componentes base substituem estilos duplicados
- mobile parece nativo/PWA real
- treino do dia é fácil de ler em poucos segundos
- importação tem preview claro
- `npm run build` passa
- `npm test` passa

## Regra final

Refactor visual bom não é trocar tudo.

É fazer o app parecer intencional.

Cada tela deve responder:

```txt
Onde estou?
Qual é a informação principal?
Qual é a próxima ação?
O que mudou ou precisa da minha atenção?
```

Se a tela responder isso rápido, o CSS está cumprindo o papel dele.
