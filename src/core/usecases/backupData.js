/**
 * Use-case: Backup e restauração completa dos dados do app
 */

const BACKUP_VERSION = '1.0.0';

/**
 * Gera payload de backup do app
 * @param {Object} state - Estado atual do app
 * @param {Object} metadata - Metadados adicionais
 * @returns {Object}
 */
export function exportAppBackup(state, metadata = {}) {
  if (!state || typeof state !== 'object') {
    return {
      success: false,
      error: 'Estado inválido para backup',
      data: null,
    };
  }

  const payload = {
    // Preserve backup type for backward compatibility with previously exported files.
    type: 'crossapp-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    metadata: {
      app: 'Ryxen',
      ...metadata,
    },
    data: {
      prs: state.prs || {},
      preferences: state.preferences || {},
      weeks: state.weeks || [],
      activeWeekNumber: state.activeWeekNumber || null,
      currentDay: state.currentDay || null,
    },
  };

  const json = JSON.stringify(payload, null, 2);

  return {
    success: true,
    data: payload,
    json,
    filename: `ryxen-backup-${new Date().toISOString().slice(0, 10)}.json`,
  };
}

/**
 * Valida e parseia backup do app
 * @param {string} jsonString
 * @returns {Object}
 */
export function importAppBackup(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      success: false,
      error: 'Backup vazio ou inválido',
      data: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    return {
      success: false,
      error: `JSON inválido: ${error.message}`,
      data: null,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      success: false,
      error: 'Formato de backup inválido',
      data: null,
    };
  }

  if (parsed.type !== 'crossapp-backup') {
    return {
      success: false,
      error: 'Arquivo não é um backup do Ryxen',
      data: null,
    };
  }

  const backupData = parsed.data || {};
  const weeks = Array.isArray(backupData.weeks) ? backupData.weeks : [];
  const prs = backupData.prs && typeof backupData.prs === 'object' ? backupData.prs : {};
  const preferences = backupData.preferences && typeof backupData.preferences === 'object'
    ? backupData.preferences
    : {};
  const activeWeekNumber = backupData.activeWeekNumber ?? null;
  const currentDay = typeof backupData.currentDay === 'string' ? backupData.currentDay : null;

  return {
    success: true,
    data: {
      weeks,
      prs,
      preferences,
      activeWeekNumber,
      currentDay,
    },
    version: parsed.version || 'unknown',
    exportedAt: parsed.exportedAt || null,
  };
}
