import express from 'express';

import { authRequired } from '../auth.js';
import { getCrossAiPreset, listCrossAiPresets } from '../ai/presets.js';
import { isCrossAiConfigured, generateCrossAiResponse } from '../ai/service.js';
import { saveCrossAiInsight } from '../ai/contextStore.js';
import { CROSSAI_MODEL, CROSSAI_SCIENCE_VECTOR_STORE_IDS } from '../config.js';

function buildMetaResponse() {
  return {
    ok: true,
    configured: isCrossAiConfigured(),
    version: 'v1',
    model: CROSSAI_MODEL,
    routes: listCrossAiPresets().map((preset) => ({
      key: preset.key,
      route: preset.route,
      intent: preset.intent,
      audience: preset.audience,
      mode: preset.contract.mode,
      layers: preset.layers,
      available: preset.key === 'research_answer'
        ? CROSSAI_SCIENCE_VECTOR_STORE_IDS.length > 0
        : true,
    })),
  };
}

function createHandler(presetKey) {
  const preset = getCrossAiPreset(presetKey);

  return async (req, res) => {
    try {
      const result = await generateCrossAiResponse({
        preset,
        body: req.body,
        user: req.user,
      });

      const persisted = await saveCrossAiInsight({
        preset,
        body: req.body,
        user: req.user,
        output: result.output,
      });

      return res.json({
        ...result.output,
        usage: result.usage,
        responseId: result.id,
        persistedInsightId: persisted?.id || null,
        preset: {
          key: preset.key,
          intent: preset.intent,
          audience: preset.audience,
        },
      });
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 500;
      return res.status(statusCode).json({
        error: statusCode === 503 ? 'CrossAI indisponível' : 'Falha ao gerar resposta da CrossAI',
        message: error?.message || 'Erro desconhecido',
      });
    }
  };
}

export function createAiRouter() {
  const router = express.Router();

  router.get('/ai/meta', authRequired, (_req, res) => {
    res.json(buildMetaResponse());
  });

  router.post('/ai/explain-workout', authRequired, createHandler('explain_workout'));
  router.post('/ai/strategy', authRequired, createHandler('strategy_wod'));
  router.post('/ai/adapt-workout', authRequired, createHandler('adapt_workout'));
  router.post('/ai/analyze-result', authRequired, createHandler('analyze_result'));
  router.post('/ai/compare-history', authRequired, createHandler('compare_history'));
  router.post('/ai/import-workout', authRequired, createHandler('import_workout'));
  router.post('/ai/competition-plan', authRequired, createHandler('competition_plan'));
  router.post('/ai/recovery-check', authRequired, createHandler('recovery_check'));
  router.post('/ai/coach-review', authRequired, createHandler('coach_review'));
  router.post('/ai/chat-coach', authRequired, createHandler('chat_coach'));
  router.post('/ai/research-answer', authRequired, createHandler('research_answer'));
  router.post('/ai/verify-study', authRequired, createHandler('verify_study'));

  return router;
}
