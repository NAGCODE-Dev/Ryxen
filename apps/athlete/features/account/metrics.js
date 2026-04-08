export function recordUiPerfMetric(name, durationMs, meta = {}) {
  try {
    const current = window.__RYXEN_UI_METRICS__ || window.__CROSSAPP_UI_METRICS__ || { recent: [], summary: {} };
    const recent = [...(current.recent || []), { name, durationMs, at: new Date().toISOString(), ...meta }].slice(-30);
    const previous = current.summary?.[name] || { count: 0, maxMs: 0, avgMs: 0, lastMs: 0 };
    const count = previous.count + 1;
    const summary = {
      ...(current.summary || {}),
      [name]: {
        count,
        maxMs: Math.max(previous.maxMs || 0, durationMs),
        avgMs: Number((((previous.avgMs || 0) * previous.count + durationMs) / count).toFixed(1)),
        lastMs: durationMs,
        ...meta,
      },
    };
    const nextMetrics = { recent, summary };
    window.__RYXEN_UI_METRICS__ = nextMetrics;
    window.__CROSSAPP_UI_METRICS__ = nextMetrics;
    if (durationMs >= 1500) {
      console.warn('[ui:slow]', name, `${durationMs}ms`, meta);
    }
  } catch {
    // no-op
  }
}

export async function measureUiAsync(name, fn, meta = {}) {
  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    recordUiPerfMetric(name, Number((performance.now() - startedAt).toFixed(1)), meta);
  }
}
