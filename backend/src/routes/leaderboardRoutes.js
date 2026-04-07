import express from 'express';

import { authRequired } from '../auth.js';
import { getMembershipForUser } from '../access.js';
import { getBenchmarkLeaderboard } from '../queries/leaderboardQueries.js';
import { normalizeSportType } from '../utils/sportType.js';

export function createLeaderboardRouter() {
  const router = express.Router();

  router.get('/leaderboards/benchmarks/:slug', authRequired, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const sportType = normalizeSportType(req.query?.sportType);
    const gymId = req.query?.gymId !== undefined && req.query?.gymId !== '' ? Number(req.query.gymId) : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    if (!slug) {
      return res.status(400).json({ error: 'slug é obrigatório' });
    }

    if (Number.isFinite(gymId)) {
      const membership = await getMembershipForUser(gymId, req.user.userId);
      if (!membership) {
        return res.status(404).json({ error: 'Gym não encontrado para este usuário' });
      }
    }

    const payload = await getBenchmarkLeaderboard({ slug, sportType, gymId, limit });
    if (!payload) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }

    return res.json(payload);
  });

  return router;
}
