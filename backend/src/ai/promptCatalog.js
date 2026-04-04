import { readFile } from 'node:fs/promises';

const PROMPT_FILES = {
  core: 'core.txt',
  safety: 'safety.txt',
  memory: 'memory.txt',
  format: 'format.txt',
  orchestrator: 'orchestrator.txt',
  athlete: 'athlete.txt',
  coach: 'coach.txt',
  workout_interpreter: 'workout_interpreter.txt',
  strategy: 'strategy.txt',
  adaptation: 'adaptation.txt',
  result_analysis: 'result_analysis.txt',
  history_compare: 'history_compare.txt',
  image_import: 'image_import.txt',
  competition: 'competition.txt',
  recovery: 'recovery.txt',
  research_answer: 'research_answer.txt',
  verify_study: 'verify_study.txt',
};

const promptCache = new Map();

function resolvePromptUrl(filename) {
  return new URL(`./prompts/${filename}`, import.meta.url);
}

export async function loadPromptLayer(name) {
  const filename = PROMPT_FILES[name];
  if (!filename) {
    throw new Error(`Prompt layer inválida: ${name}`);
  }

  if (!promptCache.has(name)) {
    const content = await readFile(resolvePromptUrl(filename), 'utf8');
    promptCache.set(name, content.trim());
  }

  return promptCache.get(name);
}

export async function composePromptLayers(layers = []) {
  const chunks = await Promise.all(layers.map((layer) => loadPromptLayer(layer)));
  return chunks.join('\n\n');
}

export function listPromptLayers() {
  return Object.keys(PROMPT_FILES);
}
