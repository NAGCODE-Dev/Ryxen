import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';

export function createBenchmarkRouter({ resolveBenchmarkOrder }) {
  const router = express.Router();

  router.get('/', authRequired, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const officialSource = String(req.query.source || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'year_desc').trim().toLowerCase();
    const params = [];
    const where = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR LOWER(slug) LIKE $${params.length})`);
    }

    if (category) {
      params.push(category);
      where.push(`LOWER(category) = $${params.length}`);
    }

    if (officialSource) {
      params.push(officialSource);
      where.push(`LOWER(official_source) = $${params.length}`);
    }

    const orderBy = resolveBenchmarkOrder(sort);
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM benchmark_library
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `;
    const countResult = await pool.query(countSql, params);

    params.push(limit);
    params.push(offset);
    const sql = `
      SELECT *
      FROM benchmark_library
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;
    const result = await pool.query(sql, params);
    return res.json({
      benchmarks: result.rows,
      pagination: {
        total: countResult.rows[0]?.total || 0,
        page,
        limit,
        pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / limit)),
      },
    });
  });

  return router;
}
