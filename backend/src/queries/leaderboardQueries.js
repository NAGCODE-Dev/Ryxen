import { pool } from '../db.js';

export async function searchBenchmarkLibrary({ limit, page, q, category, officialSource, orderBy }) {
  const offset = (page - 1) * limit;
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

  return {
    benchmarks: result.rows,
    pagination: {
      total: countResult.rows[0]?.total || 0,
      page,
      limit,
      pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / limit)),
    },
  };
}

export async function getBenchmarkBySlug(slug) {
  const result = await pool.query(`SELECT * FROM benchmark_library WHERE slug = $1 LIMIT 1`, [slug]);
  return result.rows[0] || null;
}

export function parseBenchmarkScoreValue(scoreDisplay, scoreType) {
  const raw = String(scoreDisplay || '').trim();
  if (!raw) return 0;

  if (scoreType === 'for_time') {
    const parts = raw.split(':').map((part) => Number(part));
    if (parts.length >= 2 && parts.every(Number.isFinite)) {
      let seconds = 0;
      for (const part of parts) {
        seconds = (seconds * 60) + part;
      }
      return seconds;
    }
  }

  if (scoreType === 'rounds_reps') {
    const match = raw.match(/^\s*(\d+)\s*\+\s*(\d+)\s*$/);
    if (match) {
      return (Number(match[1]) * 1000) + Number(match[2]);
    }
  }

  const normalized = raw.replace(',', '.');
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric;

  const fallback = normalized.match(/-?\d+(\.\d+)?/);
  return fallback ? Number(fallback[0]) : 0;
}

function buildLeaderboardOrder(scoreType) {
  if (scoreType === 'for_time') {
    return 'br.score_value ASC, COALESCE(br.tiebreak_seconds, 0) ASC, br.created_at ASC';
  }
  return 'br.score_value DESC, COALESCE(br.tiebreak_seconds, 0) ASC, br.created_at ASC';
}

export async function getBenchmarkLeaderboard({ slug, sportType, gymId, limit }) {
  const benchmark = await getBenchmarkBySlug(slug);
  if (!benchmark) return null;

  const params = [slug, sportType];
  let gymClause = '';
  if (Number.isFinite(gymId)) {
    params.push(gymId);
    gymClause = ` AND br.gym_id = $${params.length}`;
  }

  params.push(limit);
  const orderBy = buildLeaderboardOrder(benchmark.score_type);
  const result = await pool.query(
    `SELECT
       br.id,
       br.user_id,
       br.gym_id,
       br.score_display,
       br.score_value,
       br.tiebreak_seconds,
       br.notes,
       br.created_at,
       COALESCE(u.name, u.email) AS name,
       u.email,
       g.name AS gym_name
     FROM benchmark_results br
     JOIN users u ON u.id = br.user_id
     LEFT JOIN gyms g ON g.id = br.gym_id
     WHERE br.benchmark_slug = $1
       AND br.sport_type = $2
       ${gymClause}
     ORDER BY ${orderBy}
     LIMIT $${params.length}`,
    params,
  );

  return {
    benchmark,
    results: result.rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    })),
  };
}

export async function createBenchmarkResult({ slug, userId, gymId, sportType, scoreDisplay, notes }) {
  const benchmark = await getBenchmarkBySlug(slug);
  if (!benchmark) return null;

  const scoreValue = parseBenchmarkScoreValue(scoreDisplay, benchmark.score_type);
  const inserted = await pool.query(
    `INSERT INTO benchmark_results (benchmark_slug, user_id, gym_id, sport_type, score_display, score_value, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [benchmark.slug, userId, gymId || null, sportType, scoreDisplay, scoreValue, notes || null],
  );

  return {
    benchmark,
    result: inserted.rows[0] || null,
  };
}
