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

try {
  const notes = [];
  const localProperties = await readLocalProperties(localPropertiesPath);
  const sdkDir = decodePropertyValue(localProperties.get('sdk.dir') || '');

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
