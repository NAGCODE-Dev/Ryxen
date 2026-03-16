const STORAGE_KEY = 'crossapp-athlete-usage-v1';

const DEFAULT_BENEFITS = {
  tier: 'base',
  label: 'Liberado',
  source: 'base',
  inherited: false,
  personal: false,
  importsPerMonth: 10,
  historyDays: null,
  competitionAccess: 'full',
  premiumFeatures: true,
};

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readUsage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeUsage(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
  } catch {}
}

export function normalizeAthleteBenefits(benefits) {
  return {
    ...DEFAULT_BENEFITS,
    ...(benefits && typeof benefits === 'object' ? benefits : {}),
  };
}

export function getAthleteImportAllowance(benefits, kind = 'pdf') {
  const normalized = normalizeAthleteBenefits(benefits);
  const limit = normalized.importsPerMonth;
  return Number.isFinite(limit) ? Number(limit) : null;
}

export function getAthleteImportUsage(benefits, kind = 'pdf') {
  const normalized = normalizeAthleteBenefits(benefits);
  const monthKey = getMonthKey();
  const store = readUsage();
  const tierStore = store?.[normalized.tier] || {};
  const monthStore = tierStore?.[monthKey] || {};
  const used = Number(monthStore?.all || 0);
  const limit = getAthleteImportAllowance(normalized, kind);
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return {
    tier: normalized.tier,
    kind,
    used,
    limit,
    remaining,
    unlimited: limit === null,
    monthKey,
  };
}

export function canConsumeAthleteImport(benefits, kind = 'pdf') {
  const usage = getAthleteImportUsage(benefits, kind);
  return usage.unlimited || usage.remaining > 0;
}

export function consumeAthleteImport(benefits, kind = 'pdf') {
  const normalized = normalizeAthleteBenefits(benefits);
  const usage = getAthleteImportUsage(normalized, kind);
  if (!usage.unlimited && usage.remaining <= 0) {
    return { success: false, usage };
  }

  const store = readUsage();
  if (!store[normalized.tier]) store[normalized.tier] = {};
  if (!store[normalized.tier][usage.monthKey]) store[normalized.tier][usage.monthKey] = {};
  store[normalized.tier][usage.monthKey].all = usage.used + 1;
  writeUsage(store);

  return {
    success: true,
    usage: getAthleteImportUsage(normalized, kind),
  };
}
