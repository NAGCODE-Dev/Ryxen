CREATE TABLE IF NOT EXISTS athlete_context (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_type TEXT NOT NULL DEFAULT 'cross',
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  athlete_notes TEXT NOT NULL DEFAULT '',
  coach_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, sport_type)
);

CREATE INDEX IF NOT EXISTS athlete_context_user_sport_idx
  ON athlete_context (user_id, sport_type);

CREATE TABLE IF NOT EXISTS crossai_insights (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_type TEXT NOT NULL DEFAULT 'cross',
  preset_key TEXT NOT NULL,
  mode TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  workout_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crossai_insights_user_mode_created_idx
  ON crossai_insights (user_id, mode, created_at DESC);

CREATE INDEX IF NOT EXISTS crossai_insights_user_sport_created_idx
  ON crossai_insights (user_id, sport_type, created_at DESC);

CREATE INDEX IF NOT EXISTS crossai_insights_workout_ref_gin_idx
  ON crossai_insights USING GIN (workout_ref);
