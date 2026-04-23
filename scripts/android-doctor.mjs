import path from 'node:path';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = process.cwd();
const androidDir = path.join(root, 'android');
const localPropertiesPath = path.join(androidDir, 'local.properties');
const gradleWrapperPath = path.join(androidDir, 'gradlew');
const studioLauncherPath = path.join(root, 'scripts', 'open-android-studio.sh');
const requiredJavaMajor = 17;

try {
  const notes = [];
  const javaRuntime = await resolveJavaRuntime(requiredJavaMajor);
  const localProperties = await readLocalProperties(localPropertiesPath);
  const sdkDir = decodePropertyValue(localProperties.get('sdk.dir') || '');

  notes.push(`JDK: ${javaRuntime.versionLabel}`);
  if (javaRuntime.javaHome) {
    notes.push(`JAVA_HOME: ${javaRuntime.javaHome}`);
  }

  if (!sdkDir) {
    throw new Error([
      '`android/local.properties` existe, mas está sem `sdk.dir`.',
      'Exemplo esperado:',
      'sdk.dir=/home/nikolas/Android/Sdk',
    ].join('\n'));
  }

  const resolvedSdkDir = path.isAbsolute(sdkDir) ? sdkDir : path.join(androidDir, sdkDir);
  await assertPathExists(resolvedSdkDir, `Android SDK não encontrado em ${resolvedSdkDir}`);
  notes.push(`SDK: ${resolvedSdkDir}`);

  await fs.access(gradleWrapperPath, fsConstants.X_OK);
  notes.push(`Gradle wrapper: ${path.relative(root, gradleWrapperPath)}`);

  const studioLauncher = await resolveAndroidStudioLauncher();
  notes.push(`Android Studio: ${studioLauncher}`);

  await run(gradleWrapperPath, ['-p', 'android', '-q', 'help'], {
    cwd: root,
    env: process.env,
  });
  notes.push('Gradle sync base: ok');

  console.log('[android:doctor] ok');
  for (const note of notes) console.log(`- ${note}`);
} catch (error) {
  console.error('[android:doctor] falhou');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function readLocalProperties(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const entries = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) return [line, ''];
        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      });
    return new Map(entries);
  } catch {
    throw new Error([
      '`android/local.properties` não foi encontrado.',
      'Crie o arquivo com o caminho do SDK, por exemplo:',
      'sdk.dir=/home/nikolas/Android/Sdk',
    ].join('\n'));
  }
}

function decodePropertyValue(value) {
  return String(value || '')
    .replace(/\\:/g, ':')
    .replace(/\\=/g, '=')
    .replace(/\\\\/g, '\\');
}

async function assertPathExists(targetPath, message) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(message);
  }
}

async function resolveAndroidStudioLauncher() {
  try {
    const { stdout } = await run(studioLauncherPath, ['--print-path'], {
      cwd: root,
      env: process.env,
    });
    const launcher = String(stdout || '').trim();
    if (!launcher) {
      throw new Error('Launcher vazio');
    }
    return launcher;
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '').trim() : '';
    throw new Error(stderr || 'Não foi possível localizar uma instalação do Android Studio.');
  }
}

async function resolveJavaRuntime(requiredMajor) {
  const javaInfo = await readJavaCommandVersion('java', ['-version']);
  const javacInfo = await readJavaCommandVersion('javac', ['-version']);
  const javaHome = String(process.env.JAVA_HOME || '').trim();

  if (!javaInfo || !javacInfo) {
    throw new Error(buildJavaSetupMessage(requiredMajor, javaHome));
  }

  if (javaInfo.major == null || javacInfo.major == null) {
    throw new Error([
      'Não foi possível identificar a versão do JDK instalado.',
      `Saída de 'java -version': ${javaInfo.raw || '(vazia)'}`,
      `Saída de 'javac -version': ${javacInfo.raw || '(vazia)'}`,
    ].join('\n'));
  }

  if (javaInfo.major !== javacInfo.major) {
    throw new Error([
      'As versões de `java` e `javac` não batem.',
      `java: ${javaInfo.versionLabel}`,
      `javac: ${javacInfo.versionLabel}`,
      'Ajuste o PATH/JAVA_HOME para o mesmo JDK antes de abrir o projeto Android.',
    ].join('\n'));
  }

  if (javaInfo.major < requiredMajor) {
    throw new Error([
      `JDK incompatível: encontrado ${javaInfo.versionLabel}, mas o projeto Android requer Java ${requiredMajor}+.`,
      buildJavaInstallHint(requiredMajor, javaHome),
    ].join('\n'));
  }

  return {
    javaHome,
    versionLabel: javaInfo.versionLabel,
  };
}

async function readJavaCommandVersion(command, args) {
  try {
    const { stdout, stderr } = await run(command, args, {
      cwd: root,
      env: process.env,
    });
    const raw = [stdout, stderr].filter(Boolean).join('\n').trim();
    return {
      raw,
      major: parseJavaMajor(raw),
      versionLabel: describeJavaVersion(command, raw),
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout || '') : '';
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '') : '';
    const raw = [stdout, stderr].filter(Boolean).join('\n').trim();
    return {
      raw,
      major: parseJavaMajor(raw),
      versionLabel: describeJavaVersion(command, raw),
    };
  }
}

function parseJavaMajor(raw) {
  const version = extractJavaVersion(raw);
  if (!version) return null;

  const normalized = version.startsWith('1.') ? version.slice(2) : version;
  const match = normalized.match(/^(\d+)/u);
  return match ? Number.parseInt(match[1], 10) : null;
}

function describeJavaVersion(command, raw) {
  const version = extractJavaVersion(raw);
  return version ? `${command} ${version}` : `${command} (versão não identificada)`;
}

function extractJavaVersion(raw) {
  const text = String(raw || '');
  const quotedMatch = text.match(/version "([^"]+)"/u);
  if (quotedMatch) return quotedMatch[1];

  const plainMatch = text.match(/\b(?:java|javac)\s+([0-9][^\s]*)/u);
  return plainMatch ? plainMatch[1] : null;
}

function buildJavaSetupMessage(requiredMajor, javaHome) {
  return [
    `JDK ${requiredMajor}+ não encontrado no PATH.`,
    buildJavaInstallHint(requiredMajor, javaHome),
  ].join('\n');
}

function buildJavaInstallHint(requiredMajor, javaHome) {
  const javaHomeHint = javaHome || `/usr/lib/jvm/java-${requiredMajor}-openjdk-amd64`;
  return [
    `Instale no Ubuntu/Debian com: sudo apt update && sudo apt install -y openjdk-${requiredMajor}-jdk`,
    `Depois exporte JAVA_HOME, por exemplo: export JAVA_HOME=${javaHomeHint}`,
    'Reabra o VS Code ou configure `java.configuration.runtimes` apontando para esse diretório.',
  ].join('\n');
}
