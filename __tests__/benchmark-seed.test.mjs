import test from 'node:test';
import assert from 'node:assert/strict';

import { BENCHMARK_SEED } from '../backend/src/benchmarks.js';

test('benchmark seed possui slugs unicos e categorias esperadas', () => {
  const slugs = BENCHMARK_SEED.map((item) => item.slug);
  const uniqueSlugs = new Set(slugs);
  const girlsCount = BENCHMARK_SEED.filter((item) => item.category === 'girls').length;
  const heroCount = BENCHMARK_SEED.filter((item) => item.category === 'hero').length;
  const openCount = BENCHMARK_SEED.filter((item) => item.category === 'open').length;

  assert.equal(uniqueSlugs.size, slugs.length);
  assert.ok(BENCHMARK_SEED.length >= 35);
  assert.ok(girlsCount >= 10);
  assert.ok(heroCount >= 8);
  assert.ok(openCount >= 10);
});
