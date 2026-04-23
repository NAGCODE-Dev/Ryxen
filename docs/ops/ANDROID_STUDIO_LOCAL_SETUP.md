# Android Studio Local Setup

Nota:
- o callback primário do app agora é `ryxen://auth/callback`; o callback `crossapp://auth/callback` continua aceito temporariamente para clientes antigos.

Guia objetivo para rodar o app Android no emulador com comportamento o mais próximo possível do PWA.

## Pré-requisitos locais

Antes de abrir o projeto Android no VS Code ou no Android Studio, instale um JDK 17:

```bash
sudo apt update
sudo apt install -y openjdk-17-jdk
```

Valide:

```bash
java -version
javac -version
```

No Ubuntu, o caminho mais comum do `JAVA_HOME` fica em:

```txt
/usr/lib/jvm/java-17-openjdk-amd64
```

Se o VS Code continuar mostrando o aviso de JDK ausente, adicione ao `settings.json`:

```json
{
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "/usr/lib/jvm/java-17-openjdk-amd64",
      "default": true
    }
  ]
}
```

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

Rode o preflight:

```bash
npm run android:doctor
```

Abra o projeto:

```bash
npm run android:open
```

No Android Studio:

1. espere o Gradle sincronizar
2. selecione um emulador Android 13 ou 14
3. rode o módulo `app`

O fluxo de `android:open` agora faz:

1. build web com assets oficiais da marca
2. `cap sync android`
3. doctor do Android local
4. abertura do projeto no Android Studio

## 4. Build por terminal

Debug APK:

```bash
npm run android:assemble:debug
```

Release APK:

```bash
npm run android:assemble:release
```

Release AAB:

```bash
npm run android:bundle:release
```

Artefatos atuais:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release-unsigned.apk
android/app/build/outputs/bundle/release/app-release.aab
```

Se o signing de release não estiver configurado, o Gradle ainda consegue gerar artefatos de release sem assinatura para validação local.

## 5. Signing de release por variáveis de ambiente

Para gerar APK/AAB de release assinados, configure:

```bash
export RYXEN_ANDROID_KEYSTORE_PATH=/caminho/para/seu-keystore.jks
export RYXEN_ANDROID_KEYSTORE_PASSWORD='sua-senha'
export RYXEN_ANDROID_KEY_ALIAS='seu-alias'
export RYXEN_ANDROID_KEY_PASSWORD='sua-senha-da-chave'
```

Depois rode:

```bash
npm run android:assemble:release
npm run android:bundle:release
```

Observações:

- `android/local.properties` é local da máquina e não deve ir para o git.
- se as 4 variáveis acima não existirem, o projeto continua buildando release sem assinatura.
- o caminho do SDK pode ficar em `android/local.properties` como:

```properties
sdk.dir=/home/nikolas/Android/Sdk
```

## 6. Doctor e troubleshooting local

O comando principal de verificação agora é:

```bash
npm run android:doctor
```

Ele valida:

- `android/local.properties`
- `sdk.dir`
- Gradle wrapper
- launcher do Android Studio
- sync base do Gradle

Se o Android Studio não abrir, o launcher tenta nesta ordem:

1. Flatpak `com.google.AndroidStudio`
2. `~/android-studio/bin/studio.sh`
3. `/opt/android-studio/bin/studio.sh`
4. `/usr/local/android-studio/bin/studio.sh`
5. `studio.sh`, `studio` ou `android-studio` no `PATH`

Se faltar launcher, uma correção típica é:

```bash
flatpak install flathub com.google.AndroidStudio
```

Ou instalar manualmente em `~/android-studio`.

## 7. Auth local no emulador

Para ambiente local, o Docker sobe com:

- `EXPOSE_RESET_CODE=true`
- `DEV_EMAILS=nagcode.contact@gmail.com`

Isso permite testar cadastro e reset com preview local.

O smoke automatizado disponível é:

```bash
npm run smoke:auth
```

## 8. Quando usar backend publicado

Se você quiser que o APK aponte para backend remoto em vez de `10.0.2.2`, configure:

```bash
export RYXEN_API_BASE_URL=https://seu-backend
export RYXEN_NATIVE_API_BASE_URL=https://seu-backend
npm run android:sync
```

Ou ajuste `config.js`:

```js
window.__RYXEN_CONFIG__ = {
  apiBaseUrl: 'https://seu-backend',
  nativeApiBaseUrl: 'https://seu-backend',
};
```

## 9. Google OAuth no app nativo

Para o fluxo de login com Google funcionar no APK:

- o backend deve estar publicamente acessível
- `BACKEND_PUBLIC_URL` deve apontar para a URL pública correta
- o callback `ryxen://auth/callback` precisa estar configurado no AndroidManifest
- o Google OAuth precisa aceitar o fluxo configurado no backend

Sem backend público, o login normal por email pode ser validado localmente, mas o OAuth Google tende a depender da infraestrutura externa.

## 10. Paridade esperada com o PWA

Hoje a base já cobre:

- sync dos assets web para Android
- launcher e splash sincronizados com o app icon oficial
- build debug e release
- back button nativo
- callback `ryxen://auth/callback`
- fallback automático de API para emulador Android
- permissões de rede para `10.0.2.2` e `localhost`

O que ainda deve ser validado manualmente no emulador/aparelho:

- login Google
- importação de arquivos no WebView
- experiência offline
- navegação completa do coach portal no celular
