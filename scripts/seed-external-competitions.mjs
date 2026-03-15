import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const SYSTEM_EMAIL = String(process.env.CROSSAPP_EXTERNAL_EVENTS_EMAIL || 'external.events@crossapp.local').trim().toLowerCase();
const SYSTEM_NAME = String(process.env.CROSSAPP_EXTERNAL_EVENTS_NAME || 'CrossApp External Events').trim();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = process.env.CROSSAPP_EXTERNAL_EVENTS_CONFIG
  ? path.resolve(process.cwd(), process.env.CROSSAPP_EXTERNAL_EVENTS_CONFIG)
  : path.join(__dirname, 'external-competitions.config.json');

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL é obrigatório para seed-external-competitions');
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function loadExternalCompetitions() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Config inválida em ${CONFIG_PATH}: esperado array de competições`);
  }
  return parsed;
}

async function main() {
  const externalCompetitions = await loadExternalCompetitions();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = await ensureSystemUser(client);
    const results = [];

    for (const item of externalCompetitions) {
      const competitionId = await upsertCompetition(client, userId, item);
      const eventIds = [];
      for (const event of item.events) {
        const eventId = await upsertCompetitionEvent(client, competitionId, event);
        eventIds.push(eventId);
      }

      results.push({
        title: item.title,
        sourceProvider: item.sourceProvider,
        externalRef: item.externalRef,
        competitionId,
        events: eventIds.length,
      });
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, seeded: results }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[seed-external-competitions] failed', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureSystemUser(client) {
  const existing = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [SYSTEM_EMAIL]);
  if (existing.rows[0]?.id) return Number(existing.rows[0].id);

  const inserted = await client.query(
    `INSERT INTO users (email, password_hash, name, is_admin)
     VALUES ($1, $2, $3, FALSE)
     RETURNING id`,
    [SYSTEM_EMAIL, 'seed-only-no-login', SYSTEM_NAME],
  );
  return Number(inserted.rows[0].id);
}

async function upsertCompetition(client, userId, item) {
  const existing = await client.query(
    `SELECT id FROM competitions WHERE source_provider = $1 AND external_ref = $2 LIMIT 1`,
    [item.sourceProvider, item.externalRef],
  );

  if (existing.rows[0]?.id) {
    await client.query(
      `UPDATE competitions
       SET title = $3,
           description = $4,
           location = $5,
           starts_at = $6,
           ends_at = $7,
           visibility = $8,
           source_type = $9,
           official_site_url = $10,
           registration_url = $11,
           leaderboard_url = $12,
           live_embed_url = $13,
           cover_image_url = $14,
           status = $15,
           payload = $16
       WHERE id = $17`,
      [
        item.sourceProvider,
        item.externalRef,
        item.title,
        item.description,
        item.location,
        item.startsAt,
        item.endsAt,
        item.visibility,
        item.sourceType,
        item.officialSiteUrl || null,
        item.registrationUrl || null,
        item.leaderboardUrl || null,
        item.liveEmbedUrl || null,
        item.coverImageUrl || null,
        item.status,
        item.payload || {},
        Number(existing.rows[0].id),
      ],
    );
    return Number(existing.rows[0].id);
  }

  const inserted = await client.query(
    `INSERT INTO competitions (
       gym_id, created_by_user_id, title, description, location, starts_at, ends_at, visibility, sport_type,
       source_provider, source_type, external_ref, official_site_url, registration_url, leaderboard_url, live_embed_url, cover_image_url, status, payload
     )
     VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, 'cross', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id`,
    [
      userId,
      item.title,
      item.description || null,
      item.location || null,
      item.startsAt,
      item.endsAt || null,
      item.visibility || 'public',
      item.sourceProvider,
      item.sourceType,
      item.externalRef,
      item.officialSiteUrl || null,
      item.registrationUrl || null,
      item.leaderboardUrl || null,
      item.liveEmbedUrl || null,
      item.coverImageUrl || null,
      item.status || 'scheduled',
      item.payload || {},
    ],
  );

  return Number(inserted.rows[0].id);
}

async function upsertCompetitionEvent(client, competitionId, item) {
  const existing = await client.query(
    `SELECT id FROM competition_events WHERE competition_id = $1 AND external_ref = $2 LIMIT 1`,
    [competitionId, item.externalRef],
  );

  if (existing.rows[0]?.id) {
    await client.query(
      `UPDATE competition_events
       SET title = $3,
           event_date = $4,
           notes = $5,
           registration_url = $6,
           leaderboard_url = $7,
           status = $8,
           payload = $9
       WHERE id = $10`,
      [
        competitionId,
        item.externalRef,
        item.title,
        item.eventDate,
        item.notes || null,
        item.registrationUrl || null,
        item.leaderboardUrl || null,
        item.status || 'scheduled',
        item.payload || {},
        Number(existing.rows[0].id),
      ],
    );
    return Number(existing.rows[0].id);
  }

  const inserted = await client.query(
    `INSERT INTO competition_events (
       competition_id, benchmark_slug, title, event_date, score_type, notes, sport_type,
       external_ref, registration_url, leaderboard_url, status, payload
     )
     VALUES ($1, NULL, $2, $3, NULL, $4, 'cross', $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      competitionId,
      item.title,
      item.eventDate,
      item.notes || null,
      item.externalRef,
      item.registrationUrl || null,
      item.leaderboardUrl || null,
      item.status || 'scheduled',
      item.payload || {},
    ],
  );

  return Number(inserted.rows[0].id);
}

main();
