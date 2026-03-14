/**
 * App Initialization
 * Dependency Injection e orquestração de módulos
 * 
 * Responsabilidades:
 * - Inicializar state
 * - Conectar adapters
 * - Carregar dados persistidos
 * - Expor APIs para UI
 */
// app.js

// ========== IMPORTS ==========

// State & Events
import { getState, setState, subscribe, debugState } from './core/state/store.js';
import { on, emit } from './core/events/eventBus.js';

// Use-cases
import { calculateLoads } from './core/usecases/calculateLoads.js';
import { copyWorkout } from './core/usecases/copyWorkout.js';
import { exportWorkout, importWorkout } from './core/usecases/exportWorkout.js';
import { exportPRs } from './core/usecases/exportPRs.js';
import { importPRs } from './core/usecases/importPRs.js';
import { exportAppBackup, importAppBackup } from './core/usecases/backupData.js';
import { addOrUpdatePR, removePR, listAllPRs } from './core/usecases/managePRs.js';
import { hasStoredSession } from './core/services/authService.js';

// Adapters
import {
  saveMultiWeekPdf,
  saveParsedWeeks,
  loadParsedWeeks,
  getPdfInfo
} from './adapters/pdf/pdfRepository.js';

import {
  getWorkoutFromWeek,
} from './adapters/pdf/customPdfParser.js';
import { createStorage } from './adapters/storage/storageFactory.js';
import { isPdfJsAvailable } from './adapters/pdf/pdfReader.js';
import { isImageFile, extractTextFromImageFile } from './adapters/media/ocrReader.js';
import { isVideoFile, extractTextFromVideoFile } from './adapters/media/videoTextReader.js';
import {
  isCalculatedLine,
  normalizeWorkoutBlocks,
  parseTextIntoWeeks,
  toWorkoutBlocks,
  toWorkoutSections,
} from './app/workoutHelpers.js';
import { downloadFile } from './app/fileHelpers.js';
import { exposeAppApi } from './app/publicApi.js';
import { createRemoteHandlers } from './app/remoteHandlers.js';

// Utils
import { getDayName } from './core/utils/date.js';

const DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';
const logDebug = (...args) => {
  if (DEBUG) console.log(...args);
};

// ========== STORAGES ==========

const prsStorage = createStorage('prs', 5000);
const prefsStorage = createStorage('preferences', 1000);
const activeWeekStorage = createStorage('active-week', 100);
const dayOverrideStorage = createStorage('day-override', 100);
const pdfStorage = createStorage('workout-pdf', 2_000_000);
const pdfMetaStorage = createStorage('workout-pdf-metadata', 1000);

const PDF_KEY = 'workout-pdf';
const METADATA_KEY = 'workout-pdf-metadata';
const remoteHandlers = createRemoteHandlers({ getState, setState, selectActiveWeek });

// ========== INICIALIZAÇÃO ==========

/**
 * Inicializa aplicação
 */
export async function init() {
  logDebug('🚀 Iniciando aplicação...');

  try {
    checkDependencies();
    await loadPersistedState();
    await restoreSessionIfPossible();
    await updateCurrentDay();
    await loadSavedWeeks();
    setupEventListeners();
    exposeDebugAPIs();

    emit('app:ready', { state: getState() });
    logDebug('✅ Aplicação inicializada');

    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    return { success: false, error: error.message };
  }
}

async function restoreSessionIfPossible() {
  if (!hasStoredSession()) return;

  try {
    await remoteHandlers.handleRefreshSession();
    logDebug('🔐 Sessão restaurada');
  } catch (error) {
    await remoteHandlers.handleSignOut();
    console.warn('Falha ao restaurar sessão:', error?.message || error);
  }
}

function checkDependencies() {
  if (!isPdfJsAvailable()) {
    console.warn('⚠️ PDF.js não disponível. Upload de PDF não funcionará.');
  }

  const storage = createStorage('test', 0);
  if (!storage.isAvailable()) {
    throw new Error('Nenhum storage disponível');
  }

  logDebug('✅ Dependências verificadas');
}

/**
 * Carrega estado persistido (PRs e preferências)
 */
async function loadPersistedState() {
  try {
    // Carrega PRs
    const savedPRs = await prsStorage.get('prs');
    if (savedPRs && typeof savedPRs === 'object') {
      setState({ prs: savedPRs });
      logDebug(`📊 ${Object.keys(savedPRs).length} PRs carregados`);
    }

    // Carrega preferências
    const savedPrefs = await prefsStorage.get('preferences');
    if (savedPrefs && typeof savedPrefs === 'object') {
      setState({
        preferences: {
          ...getState().preferences,
          ...savedPrefs,
        },
      });
      logDebug('⚙️ Preferências carregadas');
    }

  } catch (error) {
    console.warn('Erro ao carregar estado persistido:', error);
  }
}
/**
 * Atualiza dia atual no state
 */
async function updateCurrentDay() {
  // Verifica se há override manual
  const customDay = await dayOverrideStorage.get('custom-day');
  
  const dayName = customDay || getDayName();
  
  setState({ currentDay: dayName });
  
  if (customDay) {
    logDebug(`📅 Dia atual: ${dayName} (manual)`);
  } else {
    logDebug(`📅 Dia atual: ${dayName} (automático)`);
  }
}

/**
 * Volta para dia automático (sistema)
 * @returns {Promise<Object>}
 */
export async function resetToAutoDay() {
  // Remove override
  await dayOverrideStorage.remove('custom-day');
  
  // Volta para dia do sistema
  const systemDay = getDayName();
  setState({ currentDay: systemDay });
  
  // Reprocessa
  await reprocessActiveWeek();
  
  logDebug(`📅 Voltou para dia automático: ${systemDay}`);
  
  return { success: true, day: systemDay };
}
/**
 * Carrega semanas do PDF (fluxo multi-week)
 */
async function loadSavedWeeks() {
  const result = await loadParsedWeeks();

  if (!result.success) {
    logDebug('📄 Nenhuma semana salva');
    setState({ ui: { activeScreen: 'welcome' } });
    return;
  }

  const { weeks, metadata } = result.data;
  setState({ weeks });

  const savedWeek = await activeWeekStorage.get('active-week');
  const activeWeek = savedWeek || weeks[0].weekNumber;

  await selectActiveWeek(activeWeek);

  logDebug('📄 Semanas carregadas:', metadata?.weekNumbers || weeks.map(w => w.weekNumber));
}

/**
 * Setup de event listeners
 */
function setupEventListeners() {
  let prsSaveTimeout = null;
  let prefsSaveTimeout = null;
  let isProcessing = false; // Flag global para evitar loops
  
  // Listener: Salvar PRs quando state mudar (com debounce)
  subscribe((newState, oldState) => {
    if (isProcessing) return;
    
    if (newState.prs !== oldState.prs) {
      clearTimeout(prsSaveTimeout);
      prsSaveTimeout = setTimeout(() => {
        savePRsToStorage(newState.prs);
      }, 500);
    }
  });
  
  // Listener: Salvar preferências quando mudarem (com debounce)
  subscribe((newState, oldState) => {
    if (isProcessing) return;
    
    if (newState.preferences !== oldState.preferences) {
      clearTimeout(prefsSaveTimeout);
      prefsSaveTimeout = setTimeout(() => {
        savePreferencesToStorage(newState.preferences);
      }, 500);
    }
  });
  
  logDebug('🎧 Event listeners configurados');
}

/**
 * Salva PRs no storage
 */
async function savePRsToStorage(prs) {
  try {
    await prsStorage.set('prs', prs);
    logDebug('💾 PRs salvos:', Object.keys(prs).length);
  } catch (error) {
    console.warn('Erro ao salvar PRs:', error);
  }
}

/**
 * Salva preferências no storage
 */
async function savePreferencesToStorage(preferences) {
  try {
    await prefsStorage.set('preferences', preferences);
    logDebug('💾 Preferências salvas');
  } catch (error) {
    console.warn('Erro ao salvar preferências:', error);
  }
}

// ========== MULTI-WEEK CORE ==========

/**
 * Seleciona semana ativa
 * @param {number} weekNumber - Número da semana
 * @returns {Promise<Object>}
 */
export async function selectActiveWeek(weekNumber) {
  const state = getState();
  const week = state.weeks?.find(w => w.weekNumber === weekNumber);

  if (!week) {
    return { success: false, error: `Semana ${weekNumber} não encontrada` };
  }

  setState({ activeWeekNumber: weekNumber });
  await activeWeekStorage.set('active-week', weekNumber);

  logDebug(`📅 Semana ativa: ${weekNumber}`);

  await processWorkoutFromWeek(week);
  emit('week:changed', { weekNumber });

  return { success: true };
}
/**
 * Permite usuário escolher dia manualmente
 * @param {string} dayName - Nome do dia ('Segunda', 'Terça', etc)
 * @returns {Promise<Object>}
 */
export async function setCustomDay(dayName) {
  const validDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  
  if (!validDays.includes(dayName)) {
    return {
      success: false,
      error: `Dia inválido. Use: ${validDays.join(', ')}`,
    };
  }
  
  // Atualiza state
  setState({ currentDay: dayName });
  
  // Salva preferência (para persistir após reload)
  await dayOverrideStorage.set('custom-day', dayName);
  
  // Reprocessa treino
  await reprocessActiveWeek();
  
  emit('day:changed', { dayName, manual: true });
  
  logDebug(`📅 Dia alterado manualmente para: ${dayName}`);
  
  return { success: true, day: dayName };
}
/**
 * Importar PRs de CSV
 * @param {string} csvString - String CSV
 * @param {boolean} merge - Se true, faz merge com PRs existentes
 * @returns {Promise<Object>}
 */
export async function handleImportPRsFromCSV(csvString, merge = true) {
  const { importPRsFromCSV } = await import('./core/usecases/importPRsFromCSV.js');
  
  const parseResult = importPRsFromCSV(csvString);
  
  if (!parseResult.success) {
    return parseResult;
  }
  
  const state = getState();
  
  let finalPRs;
  if (merge) {
    finalPRs = { ...state.prs, ...parseResult.data };
  } else {
    finalPRs = parseResult.data;
  }
  
  setState({ prs: finalPRs });
  
  emit('prs:imported', {
    imported: parseResult.imported,
    total: Object.keys(finalPRs).length,
    format: 'CSV',
  });
  
  logDebug(`📥 PRs importados do CSV: ${parseResult.imported} exercícios`);
  
  if (parseResult.errors) {
    console.warn('⚠️ Avisos:', parseResult.errors);
  }
  
  return {
    success: true,
    imported: parseResult.imported,
    skipped: parseResult.skipped,
    total: Object.keys(finalPRs).length,
    errors: parseResult.errors,
  };
}
/**
 * Importar treino de JSON
 * @param {File} file - Arquivo JSON
 * @returns {Promise<Object>}
 */
export async function handleImportWorkout(file) {
  try {
    const text = await file.text();
    const result = importWorkout(text);
    
    if (!result.success) {
      console.error('❌ Falha ao importar:', result.error);
      return { success: false, error: result.error };
    }
    
    const workout = result.data;
    
    logDebug('📥 Treino importado:', {
      day: workout.day,
      sections: workout.sections.length,
      weekNumber: result.weekNumber
    });
    
    const state = getState();
    setState({
      workout: toWorkoutBlocks(workout),
      activeWeekNumber: result.weekNumber || state.activeWeekNumber,
      ui: {
        ...state.ui,
        activeScreen: 'workout'
      }
    });
    
    emit('workout:imported', { workout });
    
    logDebug('✅ Treino importado com sucesso');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Erro ao importar:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}



/**
 * Exportar PRs para CSV
 * @returns {Promise<Object>}
 */
export async function handleExportPRsToCSV() {
  const { exportPRsToCSV } = await import('./core/usecases/importPRsFromCSV.js');
  
  const state = getState();
  const result = exportPRsToCSV(state.prs);
  
  if (!result.success) {
    return result;
  }
  
  downloadFile(result.csv, result.filename, 'text/csv');
  
  emit('prs:exported', { count: result.count, format: 'CSV' });
  
  logDebug('💾 PRs exportados (CSV):', result.filename);
  
  return { success: true, filename: result.filename };
}

/**
 * Download de template CSV
 * @returns {Promise<Object>}
 */
export async function downloadPRsTemplate() {
  const { getCSVTemplate } = await import('./core/usecases/importPRsFromCSV.js');
  
  const template = getCSVTemplate();
  downloadFile(template, 'prs-template.csv', 'text/csv');
  
  logDebug('📥 Template CSV baixado');
  
  return { success: true };
}

/**
 * Processa treino do dia de uma semana específica
 * @param {Object} week - Semana parseada
 */
async function processWorkoutFromWeek(week) {
  const state = getState();
  const dayName = state.currentDay;

  // Verifica se é domingo (descanso)
  if (dayName === 'Domingo') {
    setState({
      workout: null,
      ui: { ...state.ui, activeScreen: 'rest' }
    });
    logDebug('💤 Dia de descanso');
    return;
  }

  const workout = getWorkoutFromWeek(week, dayName);

  if (!workout) {
    setState({
      workout: null,
      ui: { ...state.ui, activeScreen: 'welcome' }
    });
    logDebug(`⚠️ Nenhum treino para ${dayName} na semana ${week.weekNumber}`);
    return;
  }

  // 🔥 CONVERSÃO AUTOMÁTICA LBS → KG (ANTES de normalizar)
  if (state.preferences.autoConvertLbs !== false && workout.blocks) {
    const { autoConvertWorkoutLbs } = await import('./core/services/loadCalculator.js');
    
    workout.blocks.forEach(block => {
      if (block.lines && Array.isArray(block.lines)) {
        block.lines = autoConvertWorkoutLbs(block.lines);
      }
    });
    
    logDebug('🔄 Conversão lbs→kg aplicada');
  }

  // 🔥 CORREÇÃO: Normaliza MAS preserva objetos já processados
  const normalizedBlocks = normalizeWorkoutBlocks(workout.blocks);

  logDebug('📋 Blocos normalizados:', normalizedBlocks.length);
  logDebug('📋 Primeira linha:', normalizedBlocks[0]?.lines[0]);

  // 🔥 Calcula cargas APENAS para linhas que NÃO têm calculated
  let hasWarnings = false;
  let blocksWithLoads = normalizedBlocks;

  const workoutForCalc = {
    day: workout.day,
    sections: normalizedBlocks
  };

  try {
    logDebug('🔢 Calculando cargas...');
    logDebug('🔢 PRs disponíveis:', Object.keys(state.prs));
    logDebug('🔢 Total de linhas:', normalizedBlocks.reduce((sum, b) => sum + b.lines.length, 0));

    const loadResult = calculateLoads(workoutForCalc, state.prs, state.preferences);

    logDebug('✅ calculateLoads result:', {
      success: loadResult.success,
      error: loadResult.error,
      hasWarnings: loadResult.hasWarnings,
      dataLength: loadResult.data?.length,
      linesWithPercent: loadResult.linesWithPercent
    });

    if (!loadResult.success) {
      console.error('❌ Falha ao calcular cargas:', loadResult.error);
    } else if (!loadResult.data || loadResult.data.length === 0) {
      console.warn('⚠️ Nenhum resultado de cálculo');
    } else {
      hasWarnings = loadResult.hasWarnings || false;

      // 🔥 APLICA CARGAS CALCULADAS
      let globalIndex = 0;

      blocksWithLoads = normalizedBlocks.map(block => {
        const newLines = block.lines.map(line => {
          const result = loadResult.data[globalIndex++];

          // Se linha JÁ tem calculated, preserva
          if (isCalculatedLine(line)) {
            return line;
          }

          // Se resultado tem cálculo, aplica
          if (result && result.hasPercent && result.calculatedText) {
            return {
              raw: result.originalLine || line,
              calculated: result.calculatedText,
              hasWarning: result.isWarning || false,
              isMax: result.isMax || false
            };
          }

          // Marca cabeçalhos
          if (result && result.isExerciseHeader) {
            return {
              raw: result.originalLine || line,
              isHeader: true,
              exercise: result.exercise
            };
          }

          // Marca descanso
          if (result && result.isRest) {
            return {
              raw: result.originalLine || line,
              isRest: true
            };
          }

          // Mantém linha original
          return line;
        });

        return { ...block, lines: newLines };
      });

      logDebug('✅ Cargas aplicadas!');
      logDebug('✅ Linha 20:', blocksWithLoads[0]?.lines[20]);
    }
  } catch (error) {
    console.error('❌ Erro ao calcular cargas:', error);
  }

  // Salva workout com cargas calculadas
  setState({
    workout: {
      ...workout,
      blocks: blocksWithLoads
    },
    ui: {
      ...state.ui,
      activeScreen: 'workout',
      hasWarnings: hasWarnings
    }
  });

  logDebug('💪 Treino carregado:', {
    day: dayName,
    week: week.weekNumber,
    blocks: blocksWithLoads.length,
    totalLines: blocksWithLoads.reduce((sum, b) => sum + b.lines.length, 0)
  });

  emit('workout:loaded', { workout, week: week.weekNumber });
}

// ========== PUBLIC ACTIONS ==========

/**
 * Upload de PDF multi-semana
 * @param {File} file - Arquivo PDF
 * @returns {Promise<Object>}
 */
export async function handleMultiWeekPdfUpload(file) {
  logDebug('📤 Uploading multi-week PDF:', file.name);

  emit('pdf:uploading', { fileName: file.name });

  try {
    const result = await saveMultiWeekPdf(file);

    if (!result.success) {
      emit('pdf:error', { error: result.error });
      return result;
    }

    const weeks = result.data.parsedWeeks;
    setState({ weeks });

    await selectActiveWeek(weeks[0].weekNumber);

    emit('pdf:uploaded', {
      fileName: file.name,
      weeksCount: weeks.length,
      weekNumbers: weeks.map(w => w.weekNumber),
    });

    logDebug('✅ PDF multi-semana carregado:', weeks.map(w => w.weekNumber));

    return { success: true, weeks };

  } catch (error) {
    const errorMsg = error.message || 'Erro desconhecido';
    emit('pdf:error', { error: errorMsg });

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Importa arquivo genérico (PDF, texto, imagem OCR, vídeo OCR)
 * @param {File} file
 * @returns {Promise<Object>}
 */
export async function handleUniversalImport(file) {
  if (!file) {
    return { success: false, error: 'Arquivo não fornecido' };
  }

  const type = file.type || '';

  // PDF continua no fluxo dedicado
  if (type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return handleMultiWeekPdfUpload(file);
  }

  emit('media:uploading', { fileName: file.name, type });

  try {
    let rawText = '';
    let source = 'text';

    if (isImageFile(file)) {
      source = 'image';
      rawText = await extractTextFromImageFile(file);
    } else if (isVideoFile(file)) {
      source = 'video';
      rawText = await extractTextFromVideoFile(file);
    } else if (type.startsWith('text/') || file.name.match(/\.(txt|md|csv|json)$/i)) {
      source = 'text';
      rawText = await file.text();
    } else {
      throw new Error(`Formato não suportado: ${type || file.name}`);
    }

    const parsedWeeks = parseTextIntoWeeks(rawText, getState().activeWeekNumber);
    if (!parsedWeeks.length) {
      throw new Error('Não foi possível identificar treinos no conteúdo importado');
    }

    const saveResult = await saveParsedWeeks(parsedWeeks, {
      fileName: file.name,
      fileSize: file.size,
      source,
    });

    if (!saveResult.success) throw new Error(saveResult.error || 'Falha ao salvar treino importado');

    const weeks = saveResult.data.parsedWeeks;
    setState({ weeks });
    const weekResult = await selectActiveWeek(weeks[0].weekNumber);
    if (!weekResult?.success) throw new Error(weekResult?.error || 'Falha ao selecionar semana');

    emit('media:uploaded', {
      fileName: file.name,
      type: source,
      weeksCount: weeks.length,
      weekNumbers: weeks.map((w) => w.weekNumber),
    });

    return {
      success: true,
      weeks,
      source,
    };
  } catch (error) {
    const errorMsg = error.message || 'Erro ao importar mídia';
    emit('media:error', { error: errorMsg, fileName: file.name });
    return { success: false, error: errorMsg };
  }
}
/**
 * Copiar treino
 * @returns {Promise<Object>}
 */
export async function handleCopyWorkout() {
  const state = getState();

  if (!state.workout) {
    return {
      success: false,
      error: 'Nenhum treino carregado',
    };
  }

  try {
    // ✅ GARANTE QUE LINHAS SÃO STRINGS
    const sectionsForCopy = (state.workout.blocks || []).map(block => ({
      ...block,
      lines: (block.lines || []).map(line => {
        if (typeof line === 'object' && line !== null) {
          return String(line.raw || line.text || '');
        }
        return String(line);
      })
    }));

    // Adapta estrutura: workout tem blocks, copyWorkout espera sections
    const workoutForCopy = {
      day: state.workout.day,
      sections: sectionsForCopy,
    };

    const result = copyWorkout(workoutForCopy, state.prs, state.preferences);

    if (!result.success) {
      return result;
    }

    await navigator.clipboard.writeText(result.text);

    emit('workout:copied', { lineCount: result.lineCount });

    logDebug('📋 Treino copiado');

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Atualiza preferências globais do app e reprocessa treino atual
 * @param {Object} nextPreferences - Atualizações parciais de preferências
 * @returns {Promise<Object>}
 */
export async function handleUpdatePreferences(nextPreferences = {}) {
  if (!nextPreferences || typeof nextPreferences !== 'object') {
    return { success: false, error: 'Preferências inválidas' };
  }

  try {
    const state = getState();
    const merged = {
      ...state.preferences,
      ...nextPreferences,
    };

    setState({ preferences: merged });

    await reprocessActiveWeek();

    emit('preferences:changed', { preferences: merged });

    return { success: true, data: merged };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar preferências',
    };
  }
}

/**
 * Exporta backup completo da aplicação
 * @returns {Promise<Object>}
 */
export async function handleExportBackup() {
  try {
    const state = getState();
    const result = exportAppBackup(state, {
      weeksCount: state.weeks?.length || 0,
      prsCount: Object.keys(state.prs || {}).length,
    });

    if (!result.success) return result;

    downloadFile(result.json, result.filename, 'application/json');
    emit('backup:exported', {
      filename: result.filename,
      weeksCount: state.weeks?.length || 0,
      prsCount: Object.keys(state.prs || {}).length,
    });

    return { success: true, filename: result.filename };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao exportar backup',
    };
  }
}

/**
 * Importa backup completo da aplicação
 * @param {File} file - Arquivo de backup JSON
 * @returns {Promise<Object>}
 */
export async function handleImportBackup(file) {
  try {
    if (!file) {
      return { success: false, error: 'Arquivo não fornecido' };
    }

    const json = await file.text();
    const result = importAppBackup(json);

    if (!result.success) return result;

    const backup = result.data;
    const currentState = getState();

    // Persiste blocos de dados em storage
    await prsStorage.set('prs', backup.prs);
    await prefsStorage.set('preferences', {
      ...currentState.preferences,
      ...backup.preferences,
    });
    await pdfStorage.set(PDF_KEY, backup.weeks);
    await pdfMetaStorage.set(METADATA_KEY, {
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      weeksCount: backup.weeks.length,
      weekNumbers: backup.weeks.map(w => w.weekNumber),
      source: 'backup-import',
    });

    if (backup.activeWeekNumber) {
      await activeWeekStorage.set('active-week', backup.activeWeekNumber);
    } else {
      await activeWeekStorage.remove('active-week');
    }

    if (backup.currentDay) {
      await dayOverrideStorage.set('custom-day', backup.currentDay);
    } else {
      await dayOverrideStorage.remove('custom-day');
    }

    // Atualiza state em memória
    const mergedPreferences = {
      ...currentState.preferences,
      ...backup.preferences,
    };

    setState({
      weeks: backup.weeks,
      prs: backup.prs,
      preferences: mergedPreferences,
      currentDay: backup.currentDay || currentState.currentDay,
      activeWeekNumber: backup.activeWeekNumber || null,
      ui: {
        ...currentState.ui,
        activeScreen: backup.weeks.length ? 'workout' : 'welcome',
      },
    });

    if (backup.weeks.length > 0) {
      const preferredWeek = backup.activeWeekNumber || backup.weeks[0].weekNumber;
      await selectActiveWeek(preferredWeek);
    }

    emit('backup:imported', {
      weeksCount: backup.weeks.length,
      prsCount: Object.keys(backup.prs).length,
      version: result.version,
    });

    return {
      success: true,
      imported: {
        weeks: backup.weeks.length,
        prs: Object.keys(backup.prs).length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao importar backup',
    };
  }
}

/**
 * Cadastro/Login/Assinatura/Sync - integração comercial
 */
export const {
  handleSignUp,
  handleSignIn,
  handleRefreshSession,
  handleRequestPasswordReset,
  handleConfirmPasswordReset,
  handleSignOut,
  handleGetProfile,
  handleGetAdminOverview,
  handleOpenCheckout,
  handleGetSubscriptionStatus,
  handleGetEntitlements,
  handleActivateMockSubscription,
  handleSyncPush,
  handleSyncPull,
  handleListSyncSnapshots,
  handleGetRuntimeConfig,
  handleSetRuntimeConfig,
  handleCreateGym,
  handleGetMyGyms,
  handleAddGymMember,
  handleListGymMembers,
  handlePublishGymWorkout,
  handleGetWorkoutFeed,
  handleGetAccessContext,
  handleGetAthleteDashboard,
  handleGetGymInsights,
  handleLogAthletePr,
  handleSyncAthletePrSnapshot,
  handleGetBenchmarks,
  handleGetCompetitionCalendar,
  handleCreateCompetition,
  handleAddCompetitionEvent,
  handleSubmitBenchmarkResult,
  handleGetBenchmarkLeaderboard,
  handleGetCompetitionLeaderboard,
  handleGetEventLeaderboard,
} = remoteHandlers;



/**
 * Exportar treino
 * @returns {Object}
 */
export function handleExportWorkout() {
  const state = getState();
  
  // 🔥 Pega o workout do estado (JÁ com cargas calculadas)
  const workout = state.workout;
  
  logDebug('📤 [EXPORT] Estado completo:', {
    hasWorkout: !!workout,
    workoutKeys: workout ? Object.keys(workout) : [],
    day: workout?.day,
    blocksLength: workout?.blocks?.length,
    firstBlock: workout?.blocks?.[0],
    firstLine: workout?.blocks?.[0]?.lines?.[0],
    secondLine: workout?.blocks?.[0]?.lines?.[1],
    thirdLine: workout?.blocks?.[0]?.lines?.[2]
  });
  
  if (!workout || !workout.blocks) {
    return { 
      success: false, 
      error: 'Nenhum treino carregado' 
    };
  }

  // 🔥 Adapta estrutura: blocks → sections (PRESERVA objetos!)
  const workoutForExport = toWorkoutSections(workout);

  logDebug('📤 [EXPORT] Workout para exportação:', {
    day: workoutForExport.day,
    sectionsLength: workoutForExport.sections.length,
    firstSection: workoutForExport.sections[0],
    firstLine: workoutForExport.sections[0]?.lines?.[0],
    secondLine: workoutForExport.sections[0]?.lines?.[1]
  });

  const result = exportWorkout(workoutForExport, {
    exportedBy: 'Treino do Dia PWA',
    weekNumber: state.activeWeekNumber
  });

  if (!result.success) {
    console.error('❌ Falha ao exportar:', result.error);
    return result;
  }

  logDebug('✅ JSON gerado (preview):', result.json.substring(0, 500));

  downloadFile(result.json, result.filename, 'application/json');
  emit('workout:exported', { filename: result.filename });

  logDebug('✅ Treino exportado:', result.filename);
  return { success: true };
}

/**
 * Adicionar/Atualizar PR
 * @param {string} exerciseName - Nome do exercício
 * @param {number} load - Carga máxima
 * @returns {Object}
 */
export function handleAddPR(exerciseName, load) {
  const state = getState();
  const result = addOrUpdatePR(state.prs, exerciseName, load);

  if (!result.success) {
    return result;
  }

  setState({ prs: result.data });

  emit('pr:updated', {
    exercise: exerciseName,
    load: load,
    isNew: result.isNew,
  });

  logDebug(`💪 PR ${result.isNew ? 'adicionado' : 'atualizado'}:`, exerciseName, load);

  return { success: true };
}

/**
 * Remover PR
 * @param {string} exerciseName - Nome do exercício
 * @returns {Object}
 */
export function handleRemovePR(exerciseName) {
  const state = getState();
  const result = removePR(state.prs, exerciseName);

  if (!result.success) {
    return result;
  }

  setState({ prs: result.data });

  emit('pr:removed', { exercise: exerciseName });

  logDebug('🗑️ PR removido:', exerciseName);

  return { success: true };
}

/**
 * Listar PRs
 * @returns {Object}
 */
export function handleListPRs() {
  const state = getState();
  return listAllPRs(state.prs);
}

/**
 * Exportar PRs
 * @returns {Object}
 */
export function handleExportPRs() {
  const state = getState();
  const result = exportPRs(state.prs);

  if (!result.success) {
    return result;
  }

  downloadFile(result.json, result.filename, 'application/json');

  emit('prs:exported', { count: result.count });

  logDebug('💾 PRs exportados:', result.count);

  return { success: true };
}

/**
 * Importar PRs
 * @param {string} jsonString - JSON de PRs
 * @returns {Object}
 */
export function handleImportPRs(jsonString) {
  const state = getState();
  const result = importPRs(jsonString, state.prs, {
    merge: true,
    overwrite: true,
  });

  if (!result.success) {
    return result;
  }

  setState({ prs: result.data });

  emit('prs:imported', {
    imported: result.imported,
    total: result.total,
  });

  logDebug('📥 PRs importados:', result.imported);

  return { success: true };
}
/**
 * Carrega PRs padrão do arquivo
 * @param {boolean} merge - Se true, faz merge com PRs existentes
 * @returns {Promise<Object>}
 */
export async function loadDefaultPRs(merge = true) {
  try {
    const { getDefaultPRs } = await import('./data/prs.js');
    const defaultPRs = getDefaultPRs();
    
    const state = getState();
    
    let finalPRs;
    if (merge) {
      // Merge: mantém PRs existentes, adiciona apenas novos
      finalPRs = { ...defaultPRs, ...state.prs };
    } else {
      // Substitui completamente
      finalPRs = defaultPRs;
    }
    
    setState({ prs: finalPRs });
    
    const added = Object.keys(finalPRs).length - Object.keys(state.prs).length;
    
    emit('prs:loaded', { 
      total: Object.keys(finalPRs).length,
      added: added,
      merged: merge 
    });
    
    logDebug(`📥 PRs padrão carregados: ${Object.keys(finalPRs).length} exercícios${merge ? ` (+${added} novos)` : ''}`);
    
    return {
      success: true,
      total: Object.keys(finalPRs).length,
      added: added,
    };
    
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao carregar PRs padrão: ' + error.message,
    };
  }
}


// ========== DEBUG APIs ==========

/**
 * Expõe APIs para debug no console
 */
function exposeDebugAPIs() {
  exposeAppApi({
    // State
    getState,
    debugState,

    // PDF Multi-week
    uploadMultiWeekPdf: handleMultiWeekPdfUpload,
    importFromFile: handleUniversalImport,
    clearAllPdfs,
    selectWeek: selectActiveWeek,
    getWeeks: () => getState().weeks,
    getActiveWeek: () => getState().activeWeekNumber,

    // Controle de dia
    setDay: setCustomDay,
    resetDay: resetToAutoDay,
    getCurrentDay: () => getState().currentDay,
    setPreferences: handleUpdatePreferences,

    // Workout
    copyWorkout: handleCopyWorkout,
    exportWorkout: handleExportWorkout,
    importWorkout: handleImportWorkout,
    exportBackup: handleExportBackup,
    importBackup: handleImportBackup,
    signUp: handleSignUp,
    signIn: handleSignIn,
    refreshSession: handleRefreshSession,
    requestPasswordReset: handleRequestPasswordReset,
    confirmPasswordReset: handleConfirmPasswordReset,
    signOut: handleSignOut,
    getProfile: handleGetProfile,
    getAdminOverview: handleGetAdminOverview,
    createGym: handleCreateGym,
    getMyGyms: handleGetMyGyms,
    addGymMember: handleAddGymMember,
    listGymMembers: handleListGymMembers,
    publishGymWorkout: handlePublishGymWorkout,
    getWorkoutFeed: handleGetWorkoutFeed,
    getAccessContext: handleGetAccessContext,
    getAthleteDashboard: handleGetAthleteDashboard,
    getGymInsights: handleGetGymInsights,
    logAthletePr: handleLogAthletePr,
    syncAthletePrSnapshot: handleSyncAthletePrSnapshot,
    getBenchmarks: handleGetBenchmarks,
    getCompetitionCalendar: handleGetCompetitionCalendar,
    createCompetition: handleCreateCompetition,
    addCompetitionEvent: handleAddCompetitionEvent,
    submitBenchmarkResult: handleSubmitBenchmarkResult,
    getBenchmarkLeaderboard: handleGetBenchmarkLeaderboard,
    getCompetitionLeaderboard: handleGetCompetitionLeaderboard,
    getEventLeaderboard: handleGetEventLeaderboard,
    openCheckout: handleOpenCheckout,
    getSubscriptionStatus: handleGetSubscriptionStatus,
    getEntitlements: handleGetEntitlements,
    activateMockSubscription: handleActivateMockSubscription,
    syncPush: handleSyncPush,
    syncPull: handleSyncPull,
    listSyncSnapshots: handleListSyncSnapshots,
    getRuntimeConfig: handleGetRuntimeConfig,
    setRuntimeConfig: handleSetRuntimeConfig,
    // PRs
    addPR: handleAddPR,
    removePR: handleRemovePR,
    listPRs: handleListPRs,
    
    // PRs - Import/Export
    exportPRs: handleExportPRs,                    // JSON
    importPRs: handleImportPRs,                    // JSON
    exportPRsCSV: handleExportPRsToCSV,            // CSV (NOVO)
    importPRsCSV: handleImportPRsFromCSV,          // CSV (NOVO)
    loadDefaultPRs: loadDefaultPRs,                // Do arquivo prs.js (NOVO)
    downloadPRsTemplate: downloadPRsTemplate,      // Template CSV (NOVO)

    // Info
    getPdfInfo,

    // Events
    on,
    emit,
  });

  logDebug('🐛 Debug APIs expostas: window.__APP__');
}
/**
 * Limpa todos os PDFs salvos
 */
async function clearAllPdfs() {
  try {
    logDebug('🗑️ Limpando todos os PDFs...');

    const { clearAllPdfs: clearPdfs } = await import('./adapters/pdf/pdfRepository.js');
    const result = await clearPdfs();

    if (!result.success) {
      console.error(`❌ Erro ao limpar PDFs: ${result.error}`);
      return { success: false, error: result.error };
    }

    // Reseta state
    setState({ 
      weeks: [], 
      activeWeekNumber: null, 
      workout: null,
      ui: { activeScreen: 'welcome' }
    });

    // Limpa storage de semana ativa
    await activeWeekStorage.remove('active-week');

    emit('pdf:cleared');
    logDebug('✅ Todos os PDFs removidos');

    return { success: true };
  } catch (error) {
    console.error(`❌ Erro ao limpar PDFs: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function reprocessActiveWeek() {
  const week = getActiveWeekFromState();
  if (week) {
    await processWorkoutFromWeek(week);
  }
}

function getActiveWeekFromState(state = getState()) {
  if (!state.activeWeekNumber) return null;
  return state.weeks?.find((week) => week.weekNumber === state.activeWeekNumber) || null;
}
