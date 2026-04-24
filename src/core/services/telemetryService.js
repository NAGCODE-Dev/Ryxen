import { getRuntimeConfig } from '../../config/runtime.js';
import { getAuthToken } from './apiClient.js';

const CONSENT_KEY = 'ryxen-consent';
const LEGACY_CONSENT_KEY = 'crossapp-consent';
const QUEUE_KEY = 'ryxen-telemetry-queue';
const LEGACY_QUEUE_KEY = 'crossapp-telemetry-queue';
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

export function trackPerf(name, durationMs, props = {}) {
  enqueue({
    type: 'perf',
    name: String(name || 'unknown'),
    durationMs: Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
    props,
    ts: new Date().toISOString(),
  });
  flushTelemetry().catch(() => {});
}

export async function flushTelemetry() {
  const cfg = getRuntimeConfig();
  if (!cfg.telemetryEnabled) return;
  if (!hasTelemetryConsent()) return;
  if (!cfg.apiBaseUrl) return;
  const authToken = getAuthToken();
  if (!authToken) return;

  const queue = readQueue();
  if (!queue.length) return;

  const url = `${cfg.apiBaseUrl.replace(/\/$/, '')}/telemetry/ingest`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ items: queue }),
  });

  if (response.ok) {
    writeQueue([]);
  }
}

export function setTelemetryConsent(consented) {
  try {
    const serialized = JSON.stringify({ telemetry: !!consented });
    localStorage.setItem(CONSENT_KEY, serialized);
    localStorage.setItem(LEGACY_CONSENT_KEY, serialized);
  } catch {
    // no-op
  }
}

export function hasTelemetryConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY) || localStorage.getItem(LEGACY_CONSENT_KEY);
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
    const raw = localStorage.getItem(QUEUE_KEY) || localStorage.getItem(LEGACY_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    const serialized = JSON.stringify(queue || []);
    localStorage.setItem(QUEUE_KEY, serialized);
    localStorage.setItem(LEGACY_QUEUE_KEY, serialized);
  } catch {
    // no-op
  }
}
