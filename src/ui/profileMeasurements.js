const DEFAULT_MEASUREMENT_TYPES = {
  weight: { label: 'Peso', unit: 'kg' },
  height: { label: 'Altura', unit: 'cm' },
  body_fat: { label: '% de gordura', unit: '%' },
  chest: { label: 'Peito', unit: 'cm' },
  waist: { label: 'Cintura', unit: 'cm' },
  hip: { label: 'Quadril', unit: 'cm' },
  arm: { label: 'Braço', unit: 'cm' },
  thigh: { label: 'Coxa', unit: 'cm' },
  calf: { label: 'Panturrilha', unit: 'cm' },
  custom: { label: 'Outra medida', unit: '' },
};

export function listMeasurementTypes() {
  return Object.entries(DEFAULT_MEASUREMENT_TYPES).map(([value, meta]) => ({
    value,
    label: meta.label,
    unit: meta.unit,
  }));
}

export function getMeasurementTypeMeta(type) {
  return DEFAULT_MEASUREMENT_TYPES[String(type || '').trim().toLowerCase()] || DEFAULT_MEASUREMENT_TYPES.custom;
}

export function buildMeasurementEntry(input = {}) {
  const type = String(input.type || 'custom').trim().toLowerCase();
  const meta = getMeasurementTypeMeta(type);
  const value = Number(input.value);
  const recordedAt = normalizeMeasurementDate(input.recordedAt);

  if (!Number.isFinite(value)) {
    throw new Error('Informe um valor válido');
  }

  const customLabel = String(input.label || '').trim();
  const label = customLabel || meta.label;
  const unit = String(input.unit || meta.unit || '').trim();

  return {
    id: String(input.id || createMeasurementId()),
    type,
    label,
    unit,
    value: Number(value.toFixed(2)),
    recordedAt,
    notes: String(input.notes || '').trim(),
  };
}

export function normalizeMeasurementEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      try {
        return buildMeasurementEntry(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
}

export function summarizeMeasurements(entries = [], limit = 6) {
  const latestByType = new Map();

  for (const entry of normalizeMeasurementEntries(entries)) {
    const key = entry.type === 'custom' ? `${entry.type}:${entry.label}` : entry.type;
    if (!latestByType.has(key)) {
      latestByType.set(key, entry);
    }
  }

  return Array.from(latestByType.values()).slice(0, limit);
}

export function formatMeasurementValue(entry = {}) {
  const numeric = Number(entry.value);
  if (!Number.isFinite(numeric)) return '—';

  const formatted = numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });

  return entry.unit ? `${formatted} ${entry.unit}` : formatted;
}

function normalizeMeasurementDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function createMeasurementId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
