import { getRuntimeConfig } from '../../config/runtime.js';

const CONSENT_KEY = 'crossapp-consent';
const QUEUE_KEY = 'crossapp-telemetry-queue';
const MAX_QUEUE = 200;

export function trackEvent(name, props = {}) {
  enqueue({
    type: 'event',
    name,
    props,
    ts: new Date().toISOString(),
  });
  flushTelemetry().catch(() => {});
}

export function trackError(error, context = {}) {
  enqueue({
    type: 'error',
    message: String(error?.message || error || 'unknown'),
    stack: error?.stack || null,
    context,
    ts: new Date().toISOString(),
  });
  flushTelemetry().catch(() => {});
}

export async function flushTelemetry() {
  const cfg = getRuntimeConfig();
  if (!cfg.telemetryEnabled) return;
  if (!hasTelemetryConsent()) return;
  if (!cfg.apiBaseUrl) return;

  const queue = readQueue();
  if (!queue.length) return;

  const url = `${cfg.apiBaseUrl.replace(/\/$/, '')}/telemetry/ingest`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: queue }),
  });

  if (response.ok) {
    writeQueue([]);
  }
}

export function setTelemetryConsent(consented) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ telemetry: !!consented }));
  } catch {
    // no-op
  }
}

export function hasTelemetryConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.telemetry === true;
  } catch {
    return false;
  }
}

function enqueue(item) {
  const queue = readQueue();
  queue.push(item);
  const pruned = queue.slice(-MAX_QUEUE);
  writeQueue(pruned);
}

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue || []));
  } catch {
    // no-op
  }
}
