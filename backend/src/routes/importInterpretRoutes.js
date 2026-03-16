import express from 'express';

import { interpretWorkoutImportWithAI, isImportInterpreterEnabled } from '../importInterpreter.js';

export function createImportInterpretRouter({ importRateLimit }) {
  const router = express.Router();

  router.post('/interpret', importRateLimit, async (req, res) => {
    const rawText = String(req.body?.rawText || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: 'rawText é obrigatório' });
    }

    if (!isImportInterpreterEnabled()) {
      return res.status(503).json({ error: 'Interpretação assistida indisponível' });
    }

    try {
      const result = await interpretWorkoutImportWithAI({
        rawText,
        source: req.body?.source || 'text',
        fileName: req.body?.fileName || '',
        activeWeekNumber: req.body?.activeWeekNumber || 1,
        analysis: req.body?.analysis || {},
        parserReview: req.body?.parserReview || null,
      });

      if (!result?.success) {
        return res.status(422).json({ error: 'Não foi possível organizar o treino com interpretação assistida' });
      }

      return res.json({
        success: true,
        provider: result.provider,
        model: result.model,
        summary: result.summary,
        confidenceScore: result.confidenceScore,
        warnings: result.warnings,
        weeks: result.weeks,
      });
    } catch (error) {
      console.error('[import:interpret]', error);
      return res.status(502).json({ error: error?.message || 'Falha na interpretação assistida' });
    }
  });

  return router;
}
