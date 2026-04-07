# Android Studio Local Setup

Nota:
- o branding do produto é `Ryxen`, mas o callback `crossapp://` e as envs `CROSSAPP_*` continuam legados por compatibilidade com o app nativo atual.

Guia objetivo para rodar o app Android no emulador com comportamento o mais próximo possível do PWA.

## 1. Backend local

Suba a stack local:

```bash
docker compose up -d
```

Valide:

```bash
curl http://localhost:8787/health
curl http://localhost:8000/api/health
```

## 2. Como o app Android encontra a API

No PWA, o frontend usa `apiBaseUrl=/api`.

No runtime nativo Android:

- se `nativeApiBaseUrl` estiver preenchido, o app usa esse valor
- se `apiBaseUrl` já for absoluto, ele usa esse valor
- se o app estiver nativo e ainda estiver com `apiBaseUrl=/api`, ele faz fallback automático para:

```txt
http://10.0.2.2:8787
```

Esse é o endereço correto do host visto pelo emulador Android.

## 3. Rodar no Android Studio

Sincronize os assets web:

```bash
npm run android:sync
```

Abra o projeto:

```bash
npm run android:open
```

No Android Studio:

1. espere o Gradle sincronizar
2. selecione um emulador Android 13 ou 14
3. rode o módulo `app`

## 4. Build por terminal

Debug APK:

```bash
cd android
./gradlew assembleDebug
```

Release APK:

```bash
cd android
./gradlew assembleRelease
```

Artefatos atuais:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## 5. Auth local no emulador

Para ambiente local, o Docker sobe com:

- `EXPOSE_RESET_CODE=true`
- `DEV_EMAILS=nagcode.contact@gmail.com`

Isso permite testar cadastro e reset com preview local.

O smoke automatizado disponível é:

```bash
npm run smoke:auth
```

## 6. Quando usar backend publicado

Se você quiser que o APK aponte para backend remoto em vez de `10.0.2.2`, configure:

```bash
export CROSSAPP_API_BASE_URL=https://seu-backend
export CROSSAPP_NATIVE_API_BASE_URL=https://seu-backend
npm run android:sync
```

Ou ajuste `config.js`:

```js
window.__CROSSAPP_CONFIG__ = {
  apiBaseUrl: 'https://seu-backend',
  nativeApiBaseUrl: 'https://seu-backend',
};
```

## 7. Google OAuth no app nativo

Para o fluxo de login com Google funcionar no APK:

- o backend deve estar publicamente acessível
- `BACKEND_PUBLIC_URL` deve apontar para a URL pública correta
- o callback `crossapp://auth/callback` precisa permanecer configurado no AndroidManifest
- o Google OAuth precisa aceitar o fluxo configurado no backend

Sem backend público, o login normal por email pode ser validado localmente, mas o OAuth Google tende a depender da infraestrutura externa.

## 8. Paridade esperada com o PWA

Hoje a base já cobre:

- sync dos assets web para Android
- build debug e release
- back button nativo
- callback `crossapp://auth/callback`
- fallback automático de API para emulador Android
- permissões de rede para `10.0.2.2` e `localhost`

O que ainda deve ser validado manualmente no emulador/aparelho:

- login Google
- importação de arquivos no WebView
- experiência offline
- navegação completa do coach portal no celular
