import express from 'express';

import { authRequired } from '../auth.js';
import { canManageMembership, getMembershipForUser } from '../access.js';
import { getBenchmarkLeaderboard } from '../queries/leaderboardQueries.js';
import { normalizeSportType } from '../utils/sportType.js';

export function createLeaderboardRouter({
  authMiddleware = authRequired,
  leaderboardRateLimit = (_req, _res, next) => next(),
  getMembershipForUserFn = getMembershipForUser,
  canManageMembershipFn = canManageMembership,
  getBenchmarkLeaderboardFn = getBenchmarkLeaderboard,
} = {}) {
  const router = express.Router();

  router.get('/leaderboards/benchmarks/:slug', leaderboardRateLimit, authMiddleware, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const sportType = normalizeSportType(req.query?.sportType);
    const gymId = req.query?.gymId !== undefined && req.query?.gymId !== '' ? Number(req.query.gymId) : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    let viewerMembership = null;

    if (!slug) {
      return res.status(400).json({ error: 'slug é obrigatório' });
    }

    if (Number.isFinite(gymId)) {
      viewerMembership = await getMembershipForUserFn(gymId, req.user.userId);
      if (!viewerMembership) {
        return res.status(404).json({ error: 'Gym não encontrado para este usuário' });
      }
    }

    const payload = await getBenchmarkLeaderboardFn({
      slug,
      sportType,
      gymId,
      limit,
      showPrivateAthleteData: canManageMembershipFn(viewerMembership),
    });
    if (!payload) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }

    return res.json(payload);
  });

  return router;
}
