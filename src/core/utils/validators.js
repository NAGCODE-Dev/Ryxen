/**
 * Validadores
 * Funções puras de validação (retornam boolean ou throw)
 */

/**
 * Valida PR (Personal Record)
 * @param {number} load - Carga em kg
 * @returns {boolean}
 */
export function isValidPR(load) {
  return (
    typeof load === 'number' &&
    !isNaN(load) &&
    isFinite(load) &&
    load > 0 &&
    load <= 500 // Limite máximo realista
  );
}

/**
 * Valida nome de exercício
 * @param {string} name - Nome do exercício
 * @returns {boolean}
 */
export function isValidExerciseName(name) {
  return (
    typeof name === 'string' &&
    name.trim().length >= 2 &&
    name.trim().length <= 100
  );
}

/**
 * Valida percentual (0-100)
 * @param {number} percent - Percentual
 * @returns {boolean}
 */
export function isValidPercent(percent) {
  return (
    typeof percent === 'number' &&
    !isNaN(percent) &&
    percent >= 0 &&
    percent <= 200 // Permite overload até 200%
  );
}

/**
 * Valida semana (1-52)
 * @param {number} week - Número da semana
 * @returns {boolean}
 */
export function isValidWeek(week) {
  return (
    typeof week === 'number' &&
    !isNaN(week) &&
    Number.isInteger(week) &&
    week >= 1 &&
    week <= 52
  );
}

/**
 * Valida dia da semana
 * @param {string} dayName - Nome do dia
 * @returns {boolean}
 */
export function isValidDayName(dayName) {
  const validDays = [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 
    'Quinta', 'Sexta', 'Sábado'
  ];
  return validDays.includes(dayName);
}

/**
 * Valida email (simples)
 * @param {string} email - Email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valida URL
 * @param {string} url - URL
 * @returns {boolean}
 */
export function isValidURL(url) {
  if (typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida JSON string
 * @param {string} jsonString - String JSON
 * @returns {boolean}
 */
export function isValidJSON(jsonString) {
  if (typeof jsonString !== 'string') return false;
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida objeto não vazio
 * @param {*} obj - Objeto
 * @returns {boolean}
 */
export function isNonEmptyObject(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.keys(obj).length > 0
  );
}

/**
 * Valida array não vazio
 * @param {*} arr - Array
 * @returns {boolean}
 */
export function isNonEmptyArray(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Valida tema
 * @param {string} theme - Tema
 * @returns {boolean}
 */
export function isValidTheme(theme) {
  return theme === 'dark';
}

export function isValidAccentTone(accentTone) {
  return ['blue', 'sage', 'sand', 'rose', 'teal', 'plum', 'ember'].includes(accentTone);
}

export function isValidInterfaceDensity(interfaceDensity) {
  return interfaceDensity === 'comfortable' || interfaceDensity === 'compact';
}

/**
 * Valida preferences object
 * @param {Object} prefs - Preferências
 * @returns {boolean}
 */
export function isValidPreferences(prefs) {
  if (!isNonEmptyObject(prefs)) return false;
  
  const validKeys = [
    'showLbsConversion',
    'showEmojis',
    'showGoals',
    'showNyxHints',
    'nyxGuideCompleted',
    'theme',
    'accentTone',
    'interfaceDensity',
    'reduceMotion',
    'autoConvertLbs',
    'workoutPriority',
  ];
  
  return Object.keys(prefs).every(key => validKeys.includes(key));
}
