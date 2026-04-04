import test from 'node:test';
import assert from 'node:assert/strict';

import { listPromptLayers, composePromptLayers } from '../backend/src/ai/promptCatalog.js';
import { listCrossAiPresets } from '../backend/src/ai/presets.js';
import { getCrossAiContract } from '../backend/src/ai/contracts.js';

test('CrossAI expõe todas as camadas base de prompt', async () => {
  const layers = listPromptLayers();
  assert.ok(layers.includes('core'));
  assert.ok(layers.includes('safety'));
  assert.ok(layers.includes('orchestrator'));

  const composed = await composePromptLayers(['core', 'safety']);
  assert.match(composed, /CrossAI/);
  assert.match(composed, /segurança/i);
});

test('CrossAI expõe presets principais para atleta e coach', () => {
  const presets = listCrossAiPresets();
  const keys = presets.map((item) => item.key);

  assert.ok(keys.includes('explain_workout'));
  assert.ok(keys.includes('analyze_result'));
  assert.ok(keys.includes('coach_review'));

  const coachPreset = presets.find((item) => item.key === 'coach_review');
  assert.equal(coachPreset.audience, 'coach');
  assert.ok(Array.isArray(coachPreset.layers));
  assert.ok(coachPreset.layers.includes('coach'));
});

test('CrossAI define contract final por tela com envelope padrão', () => {
  const strategy = getCrossAiContract('strategy_wod');
  assert.equal(strategy.mode, 'strategy');
  assert.equal(strategy.schema.type, 'object');
  assert.ok(strategy.schema.properties.data);
  assert.ok(strategy.schema.properties.meta);

  const importWorkout = getCrossAiContract('import_workout');
  const structuredWorkout = importWorkout.schema.properties.data.properties.structuredWorkout;
  assert.ok(structuredWorkout.properties.warmup);
  assert.ok(structuredWorkout.properties.wod);
  assert.ok(importWorkout.schema.required.includes('meta'));
});

test('CrossAI expõe rota de conversa guiada com coach', () => {
  const chatCoach = getCrossAiContract('chat_coach');
  assert.equal(chatCoach.mode, 'chat-coach');
  assert.ok(chatCoach.schema.properties.data.properties.reply);
  assert.ok(chatCoach.schema.properties.data.properties.quickActions);
  assert.ok(chatCoach.schema.properties.data.properties.followUpPrompt);
});

test('CrossAI expõe contracts de evidência e verificação', () => {
  const research = getCrossAiContract('research_answer');
  assert.equal(research.mode, 'research-answer');
  assert.ok(research.schema.properties.data.properties.answer);
  assert.ok(research.schema.properties.data.properties.citations);

  const verify = getCrossAiContract('verify_study');
  assert.equal(verify.mode, 'verify-study');
  assert.ok(verify.schema.properties.data.properties.verdict);
  assert.ok(verify.schema.properties.data.properties.caveats);
});
