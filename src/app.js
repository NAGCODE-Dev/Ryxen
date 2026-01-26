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
import * as pdfjsLib from './libs/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('./libs/pdf.worker.mjs', import.meta.url).toString();

console.log('📦 app.js carregado');

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
import { addOrUpdatePR, removePR, listAllPRs } from './core/usecases/managePRs.js';

// Adapters
import {
  saveMultiWeekPdf,
  loadParsedWeeks,
  getPdfInfo
} from './adapters/pdf/pdfRepository.js';

import { getWorkoutFromWeek } from './adapters/pdf/customPdfParser.js';
import { createStorage } from './adapters/storage/storageFactory.js';
import { isPdfJsAvailable } from './adapters/pdf/pdfReader.js';

// Utils
import { getDayName, isRestDay } from './core/utils/date.js';

console.log('📦 Imports OK');

// ========== STORAGES ==========

const prsStorage = createStorage('prs', 5000);
const prefsStorage = createStorage('preferences', 1000);
const activeWeekStorage = createStorage('active-week', 100);

// ========== INICIALIZAÇÃO ==========

/**
 * Inicializa aplicação
 */
export async function init() {
  console.log('🚀 Iniciando aplicação...');

  try {
    checkDependencies();
    await loadPersistedState();
    updateCurrentDay();
    await loadSavedWeeks();
    setupEventListeners();
    exposeDebugAPIs();

    emit('app:ready', { state: getState() });
    console.log('✅ Aplicação inicializada');

    return { success: true };

  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    return { success: false, error: error.message };
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

  console.log('✅ Dependências verificadas');
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
      console.log(`📊 ${Object.keys(savedPRs).length} PRs carregados`);
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
      console.log('⚙️ Preferências carregadas');
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
  const dayOverrideStorage = createStorage('day-override', 100);
  const customDay = await dayOverrideStorage.get('custom-day');
  
  const dayName = customDay || getDayName();
  
  setState({ currentDay: dayName });
  
  if (customDay) {
    console.log(`📅 Dia atual: ${dayName} (manual)`);
  } else {
    console.log(`📅 Dia atual: ${dayName} (automático)`);
  }
}

/**
 * Permite usuário escolher dia manualmente
 * @param {string} dayName - Nome do dia ('Segunda', 'Terça', etc)
 * @returns {Object}

/**
 * Volta para dia automático (sistema)
 * @returns {Promise<Object>}
 */
export async function resetToAutoDay() {
  // Remove override
  const prefsStorage = createStorage('day-override', 100);
  await prefsStorage.remove('custom-day');
  
  // Volta para dia do sistema
  const systemDay = getDayName();
  setState({ currentDay: systemDay });
  
  // Reprocessa
  const state = getState();
  if (state.activeWeekNumber) {
    const week = state.weeks?.find(w => w.weekNumber === state.activeWeekNumber);
    if (week) {
      await processWorkoutFromWeek(week);
    }
  }
  
  console.log(`📅 Voltou para dia automático: ${systemDay}`);
  
  return { success: true, day: systemDay };
}
/**
 * Carrega semanas do PDF (fluxo multi-week)
 */
async function loadSavedWeeks() {
  const result = await loadParsedWeeks();

  if (!result.success) {
    console.log('📄 Nenhuma semana salva');
    setState({ ui: { activeScreen: 'welcome' } });
    return;
  }

  const { weeks, metadata } = result.data;
  setState({ weeks });

  const savedWeek = await activeWeekStorage.get('active-week');
  const activeWeek = savedWeek || weeks[0].weekNumber;

  await selectActiveWeek(activeWeek);

  console.log('📄 Semanas carregadas:', metadata?.weekNumbers || weeks.map(w => w.weekNumber));
}

/**
 * Setup de event listeners
 */
/**
 * Setup de event listeners
 */
/**
 * Setup de event listeners
 */
/**
 * Setup de event listeners
 */
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
  
  console.log('🎧 Event listeners configurados');
}

/**
 * Processa treino do dia de uma semana específica
 * @param {Object} week - Semana parseada
 */
/**
 * Salva PRs no storage
 */
async function savePRsToStorage(prs) {
  try {
    await prsStorage.set('prs', prs);
    console.log('💾 PRs salvos:', Object.keys(prs).length);
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
    console.log('💾 Preferências salvas');
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

  console.log(`📅 Semana ativa: ${weekNumber}`);

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
  const dayOverrideStorage = createStorage('day-override', 100);
  await dayOverrideStorage.set('custom-day', dayName);
  
  // Reprocessa treino
  const state = getState();
  if (state.activeWeekNumber) {
    const week = state.weeks?.find(w => w.weekNumber === state.activeWeekNumber);
    if (week) {
      await processWorkoutFromWeek(week);
    }
  }
  
  emit('day:changed', { dayName, manual: true });
  
  console.log(`📅 Dia alterado manualmente para: ${dayName}`);
  
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
  
  console.log(`📥 PRs importados do CSV: ${parseResult.imported} exercícios`);
  
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
    
    console.log('📥 Treino importado:', {
      day: workout.day,
      sections: workout.sections.length,
      weekNumber: result.weekNumber
    });
    
    // Converte sections → blocks
    const blocks = workout.sections.map(s => ({
      type: s.type || 'DEFAULT',
      lines: s.lines
    }));
    
    // Salva no estado
    const state = getState();
    setState({
      workout: {
        day: workout.day,
        blocks: blocks
      },
      activeWeekNumber: result.weekNumber || state.activeWeekNumber,
      ui: {
        ...state.ui,
        activeScreen: 'workout'
      }
    });
    
    emit('workout:imported', { workout });
    
    console.log('✅ Treino importado com sucesso');
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
  
  console.log('💾 PRs exportados (CSV):', result.filename);
  
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
  
  console.log('📥 Template CSV baixado');
  
  return { success: true };
}

/**
 * Processa treino do dia de uma semana específica
 * @param {Object} week - Semana parseada
 */
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
    console.log('💤 Dia de descanso');
    return;
  }

  const workout = getWorkoutFromWeek(week, dayName);

  if (!workout) {
    setState({
      workout: null,
      ui: { ...state.ui, activeScreen: 'welcome' }
    });
    console.log(`⚠️ Nenhum treino para ${dayName} na semana ${week.weekNumber}`);
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
    
    console.log('🔄 Conversão lbs→kg aplicada');
  }

  // 🔥 CORREÇÃO: Normaliza MAS preserva objetos já processados
  const normalizedBlocks = workout.blocks.map(block => ({
    ...block,
    lines: block.lines.map(line => {
      // Se já é objeto com calculated, mantém
      if (typeof line === 'object' && line !== null && line.calculated) {
        return line;
      }
      
      // Se é objeto sem calculated, extrai string
      if (typeof line === 'object' && line !== null) {
        return String(line.raw || line.text || '');
      }
      
      // Se já é string, mantém
      return String(line);
    })
  }));

  console.log('📋 Blocos normalizados:', normalizedBlocks.length);
  console.log('📋 Primeira linha:', normalizedBlocks[0]?.lines[0]);

  // 🔥 Calcula cargas APENAS para linhas que NÃO têm calculated
  let hasWarnings = false;
  let blocksWithLoads = normalizedBlocks;

  const workoutForCalc = {
    day: workout.day,
    sections: normalizedBlocks
  };

  try {
    console.log('🔢 Calculando cargas...');
    console.log('🔢 PRs disponíveis:', Object.keys(state.prs));
    console.log('🔢 Total de linhas:', normalizedBlocks.reduce((sum, b) => sum + b.lines.length, 0));

    const loadResult = calculateLoads(workoutForCalc, state.prs, state.preferences);

    console.log('✅ calculateLoads result:', {
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
          if (typeof line === 'object' && line.calculated) {
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

      console.log('✅ Cargas aplicadas!');
      console.log('✅ Linha 20:', blocksWithLoads[0]?.lines[20]);
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

  console.log('💪 Treino carregado:', {
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
  console.log('📤 Uploading multi-week PDF:', file.name);

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

    console.log('✅ PDF multi-semana carregado:', weeks.map(w => w.weekNumber));

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

    console.log('📋 Treino copiado');

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}



/**
 * Exportar treino
 * @returns {Object}
 */
/**
 * Exportar treino
 * @returns {Object}
 */
/**
 * Exportar treino
 * @returns {Object}
 */
/**
 * Exportar treino
 * @returns {Object}
 */
export function handleExportWorkout() {
  const state = getState();
  
  // 🔥 Pega o workout do estado (JÁ com cargas calculadas)
  const workout = state.workout;
  
  console.log('📤 [EXPORT] Estado completo:', {
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
  const workoutForExport = {
    day: workout.day,
    sections: workout.blocks.map(block => ({
      type: block.type || 'DEFAULT',
      lines: block.lines // 🔥 NÃO toca nas linhas!
    }))
  };

  console.log('📤 [EXPORT] Workout para exportação:', {
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

  console.log('✅ JSON gerado (preview):', result.json.substring(0, 500));

  downloadFile(result.json, result.filename, 'application/json');
  emit('workout:exported', { filename: result.filename });

  console.log('✅ Treino exportado:', result.filename);
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

  console.log(`💪 PR ${result.isNew ? 'adicionado' : 'atualizado'}:`, exerciseName, load);

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

  console.log('🗑️ PR removido:', exerciseName);

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

  console.log('💾 PRs exportados:', result.count);

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

  console.log('📥 PRs importados:', result.imported);

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
    
    console.log(`📥 PRs padrão carregados: ${Object.keys(finalPRs).length} exercícios${merge ? ` (+${added} novos)` : ''}`);
    
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
  window.__APP__ = {
    // State
    getState,
    debugState,

    // PDF Multi-week
    uploadMultiWeekPdf: handleMultiWeekPdfUpload,
    clearAllPdfs,
    selectWeek: selectActiveWeek,
    getWeeks: () => getState().weeks,
    getActiveWeek: () => getState().activeWeekNumber,

    // Controle de dia
    setDay: setCustomDay,
    resetDay: resetToAutoDay,
    getCurrentDay: () => getState().currentDay,

    // Workout
    copyWorkout: handleCopyWorkout,
    exportWorkout: handleExportWorkout,
    importWorkout: handleImportWorkout,
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
  };

  console.log('🐛 Debug APIs expostas: window.__APP__');
}
/**
 * Limpa todos os PDFs salvos
 */
/**
 * Limpa todos os PDFs salvos
 */
async function clearAllPdfs() {
  try {
    console.log('🗑️ Limpando todos os PDFs...');

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
    console.log('✅ Todos os PDFs removidos');

    return { success: true };
  } catch (error) {
    console.error(`❌ Erro ao limpar PDFs: ${error.message}`);
    return { success: false, error: error.message };
  }
}
// ========== HELPERS ==========

/**
 * Cria download de arquivo
 * @param {string} content - Conteúdo do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
