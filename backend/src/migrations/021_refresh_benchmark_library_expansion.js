import { BENCHMARK_SEED } from '../benchmarks.js';

export const migration = {
  id: '021_refresh_benchmark_library_expansion',
  async up(client) {
    for (const benchmark of BENCHMARK_SEED) {
      await client.query(
        `INSERT INTO benchmark_library (slug, name, category, official_source, year, score_type, description, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           official_source = EXCLUDED.official_source,
           year = EXCLUDED.year,
           score_type = EXCLUDED.score_type,
           description = EXCLUDED.description,
           payload = EXCLUDED.payload`,
        [
          benchmark.slug,
          benchmark.name,
          benchmark.category,
          benchmark.official_source,
          benchmark.year,
          benchmark.score_type,
          benchmark.description,
          benchmark.payload,
        ],
      );
    }
  },
};
