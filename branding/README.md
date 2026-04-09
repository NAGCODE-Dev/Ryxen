# Ryxen Branding Kit

Fonte oficial da identidade do Ryxen dentro do repo.

## Hierarquia oficial

- wordmark principal oficial:
  - `branding/sources/ryxen-wordmark-primary.png`
- app icon oficial:
  - `branding/sources/ryxen-app-icon-master.png`
- Nyx oficial do produto:
  - `branding/sources/nyx-base.png`
  - `branding/sources/nyx-mentor.png`
- referência alternativa, fora do runtime principal:
  - `branding/sources/ryxen-wordmark-alt.png`

## Estrutura

- `branding/sources/`
  - masters aprovados e tratados como fonte de verdade
- `branding/exports/`
  - exports gerados para web, PWA, Android e peças públicas
- `branding/*.svg`
  - legado e compatibilidade visual

## Regra de uso

- landing, hub, páginas públicas e headers institucionais:
  - use `branding/exports/ryxen-logo-horizontal.png`
- favicon, PWA, launcher Android, splash e usos compactos de marca:
  - use `branding/exports/ryxen-icon-*.png`
- Nyx:
  - use os PNGs oficiais exportados, nunca o wordmark ou app icon no lugar dele

## Pipeline oficial

Gere os assets oficiais com:

```bash
npm run generate:brand-assets
```

Esse pipeline produz, entre outros:

- `branding/exports/ryxen-icon-32.png`
- `branding/exports/ryxen-icon-64.png`
- `branding/exports/ryxen-icon-180.png`
- `branding/exports/ryxen-icon-192.png`
- `branding/exports/ryxen-icon-512.png`
- `branding/exports/ryxen-icon-1024.png`
- `branding/exports/ryxen-logo-horizontal.png`
- `branding/exports/ryxen-logo-horizontal@2x-half.png`
- `branding/exports/nyx-base.png`
- `branding/exports/nyx-mentor.png`
- `icons/icon-192.png`
- `icons/icon-512.png`
- launcher icons em `android/app/src/main/res/mipmap-*`
- splash assets em `android/app/src/main/res/drawable*/splash.png`

## Observação

Os SVGs antigos continuam no repo para fallback técnico e compatibilidade, mas não são mais a fonte principal da identidade visual do Ryxen.
