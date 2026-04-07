# Android Capacitor Setup

Base Android nativa para empacotar o app web atual com Capacitor.

## Scripts

```bash
npm run android:sync
npm run android:open
```

Fluxo usual:

1. `npm run android:sync`
2. `npm run android:open`
3. abrir o projeto no Android Studio
4. gerar `APK` ou `AAB`

## Observações

- O `webDir` usado pelo Capacitor é `dist/`
- O build Android reaproveita o mesmo fluxo atual do frontend
- O app abre a versão embutida do site, não depende da Play Store
- Para autenticação Google, priorize o fluxo por redirect/callback já existente no backend quando necessário

## App ID

Atual:

```txt
com.nagcode.ryxen
```

Se quiser publicar depois, troque para o identificador final antes de subir para a Play Store.
Esse identificador continua legado por compatibilidade com o app Android já sincronizado. Se quiser publicar uma versão nova do Ryxen na Play Store, planeje a troca com migração explícita de package id.
