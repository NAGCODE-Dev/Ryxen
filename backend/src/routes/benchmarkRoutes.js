import express from 'express';

import { authRequired } from '../auth.js';
import { getMembershipForUser } from '../access.js';
import { createBenchmarkResult, searchBenchmarkLibrary } from '../queries/leaderboardQueries.js';
import { normalizeSportType } from '../utils/sportType.js';

export function createBenchmarkRouter({ resolveBenchmarkOrder }) {
  const router = express.Router();

  router.get('/', authRequired, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const officialSource = String(req.query.source || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'year_desc').trim().toLowerCase();
    const orderBy = resolveBenchmarkOrder(sort);
    const payload = await searchBenchmarkLibrary({
      limit,
      page,
      q,
      category,
      officialSource,
      orderBy,
    });
    return res.json(payload);
  });

  router.post('/:slug/results', authRequired, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const sportType = normalizeSportType(req.body?.sportType);
    const gymId = req.body?.gymId !== undefined && req.body?.gymId !== '' ? Number(req.body.gymId) : null;
    const scoreDisplay = String(req.body?.scoreDisplay || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!slug || !scoreDisplay) {
      return res.status(400).json({ error: 'slug e scoreDisplay são obrigatórios' });
    }

    if (Number.isFinite(gymId)) {
      const membership = await getMembershipForUser(gymId, req.user.userId);
      if (!membership) {
        return res.status(404).json({ error: 'Gym não encontrado para este usuário' });
      }
    }

    const created = await createBenchmarkResult({
      slug,
      userId: req.user.userId,
      gymId,
      sportType,
      scoreDisplay,
      notes,
    });

    if (!created) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }

    return res.json(created);
  });

  return router;
}
