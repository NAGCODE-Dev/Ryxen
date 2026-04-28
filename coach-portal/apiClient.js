import { getRuntimeConfig } from '../packages/shared-web/runtime.js';

export function createCoachApiRequest({ readToken }) {
  return async function apiRequest(path, options = {}) {
    const cfg = getRuntimeConfig();
    const base = String(cfg.apiBaseUrl || '').trim();
    if (!base) {
      throw new Error('API base URL não configurada');
    }

    const url = `${base.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
    const token = options.token !== undefined ? options.token : readToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    if (looksLikeHtml(text)) {
      const error = new Error('Resposta inesperada do servidor. Verifique autenticação, apiBaseUrl ou a rota do backend.');
      error.status = response.status || 500;
      error.kind = 'html_response';
      error.raw = text;
      throw error;
    }

    const data = safeParse(text);

    if (!response.ok) {
      const error = new Error(data?.error || `Erro API (${response.status})`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  };
}

export async function coachRequestOptional(apiRequest, path, fallback = null, options = {}) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    if ([403, 404, 405, 501].includes(Number(error?.status || 0))) {
      return fallback;
    }
    throw error;
  }
}

export function resolveCoachKiwifyCheckoutUrl(planId) {
  const cfg = getRuntimeConfig();
  const links = cfg?.billing?.links || {};
  const raw = String(planId || 'coach').trim().toLowerCase();
  const normalized = normalizeBillingPlanId(raw);
  return links[normalized] || links[raw] || '';
}

function normalizeBillingPlanId(planId) {
  if (planId === 'coach') return 'pro';
  if (['athlete_plus', 'starter', 'pro', 'performance'].includes(planId)) return planId;
  return '';
}

function safeParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function looksLikeHtml(text) {
  const raw = String(text || '').trim().toLowerCase();
  return raw.startsWith('<!doctype html') || raw.startsWith('<html');
}
