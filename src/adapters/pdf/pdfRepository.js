/**
 * PDF Repository
 * Gerencia persistência de PDFs usando storage adapter
 */

import { createStorage } from '../storage/storageFactory.js';
import { extractTextFromFile, validatePdfFile } from './pdfReader.js';
import { cleanPdfText } from './pdfParser.js';
import { parseMultiWeekPdf } from './customPdfParser.js';
import { getTimestamp } from '../../core/utils/date.js';

const PDF_KEY = 'workout-pdf';
const METADATA_KEY = 'workout-pdf-metadata';
const DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';
const logDebug = (...args) => {
  if (DEBUG) console.log(...args);
};

/**
 * Salva PDF (extrai texto e persiste)
 * @param {File} file - Arquivo PDF
 * @returns {Promise<Object>} Resultado
 */
export async function savePdf(file) {
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const rawText = await extractTextFromFile(file);
    if (!rawText || rawText.length < 50) {
      return { success: false, error: 'PDF vazio ou com muito pouco texto' };
    }

    const cleanedText = cleanPdfText(rawText);
    const parsedWeeks = parseMultiWeekPdf(cleanedText);

    logDebug('📦 Semanas parseadas do PDF:', parsedWeeks.map(w => w.weekNumber));

    if (!parsedWeeks || parsedWeeks.length === 0) {
      return { success: false, error: 'Nenhuma semana detectada no PDF' };
    }

    // 🔥 CARREGA SEMANAS EXISTENTES
    const existingResult = await loadPdf();
    const existingWeeks = existingResult.success ? (existingResult.data?.weeks || []) : [];

    logDebug('📦 Semanas existentes:', existingWeeks.map(w => w.weekNumber));

    // 🔥 MESCLA (acumula sem duplicar)
    const allWeeksMap = new Map();
    
    // Adiciona existentes
    existingWeeks.forEach(w => {
      if (w.weekNumber) allWeeksMap.set(w.weekNumber, w);
    });

    // Adiciona novas (sobrescreve se já existir)
    parsedWeeks.forEach(w => {
      if (w.weekNumber) allWeeksMap.set(w.weekNumber, w);
    });

    const mergedWeeks = Array.from(allWeeksMap.values())
      .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber));

    logDebug('📦 Semanas após merge:', mergedWeeks.map(w => w.weekNumber));

    // Salva todas as semanas
    const storage = createStorage(PDF_KEY, JSON.stringify(mergedWeeks).length);
    await storage.set(PDF_KEY, mergedWeeks);

    // Atualiza metadados
    const metadata = {
      uploadedAt: getTimestamp(),
      fileName: file.name,
      fileSize: file.size,
      weeksCount: mergedWeeks.length,
      weekNumbers: mergedWeeks.map(w => w.weekNumber),
    };

    const metaStorage = createStorage(METADATA_KEY, 1000);
    await metaStorage.set(METADATA_KEY, metadata);

    logDebug('✅ PDF salvo com acúmulo:', {
      novas: parsedWeeks.length, 
      total: mergedWeeks.length 
    });

    return { 
      success: true, 
      data: { weeks: mergedWeeks, metadata } 
    };
  } catch (error) {
    return { success: false, error: `Erro ao processar PDF: ${error.message}` };
  }
}

/**
 * Carrega PDF salvo
 * @returns {Promise<Object>} Resultado
 */
export async function loadPdf() {
  try {
    const storage = createStorage(PDF_KEY, 0);
    const data = await storage.get(PDF_KEY);

    if (!data) {
      return { success: false, error: 'Nenhum PDF salvo', data: null };
    }

    const weeks = normalizeWeeksData(data);
    if (!weeks) {
      return { success: false, error: 'Formato de semanas inválido', data: null };
    }

    const metaStorage = createStorage(METADATA_KEY, 0);
    const metadata = await metaStorage.get(METADATA_KEY);

    return { success: true, data: { weeks, metadata } };
  } catch (error) {
    return { success: false, error: `Erro ao carregar PDF: ${error.message}`, data: null };
  }
}
export async function clearAllPdfs() {
  try {
    const storage = createStorage(PDF_KEY, 0);
    await storage.remove(PDF_KEY);

    const metaStorage = createStorage(METADATA_KEY, 0);
    await metaStorage.remove(METADATA_KEY);

    logDebug('🗑️ Todos os PDFs removidos');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao limpar PDFs:', error);
    return { success: false, error: error.message };
  }
}
/**
 * Verifica se há PDF salvo
 * @returns {Promise<boolean>}
 */
export async function hasSavedPdf() {
  try {
    const storage = createStorage(PDF_KEY, 0);
    return await storage.has(PDF_KEY);
  } catch {
    return false;
  }
}

/**
 * Remove PDF salvo
 * @returns {Promise<void>}
 */
export async function removePdf() {
  try {
    const storage = createStorage(PDF_KEY, 0);
    await storage.remove(PDF_KEY);
    
    const metaStorage = createStorage(METADATA_KEY, 0);
    await metaStorage.remove(METADATA_KEY);
    
    logDebug('✅ PDF removido');
  } catch (error) {
    console.warn('Erro ao remover PDF:', error);
  }
}

/**
 * Retorna metadados do PDF salvo
 * @returns {Promise<Object|null>}
 */
export async function getPdfMetadata() {
  try {
    const metaStorage = createStorage(METADATA_KEY, 0);
    return await metaStorage.get(METADATA_KEY);
  } catch {
    return null;
  }
}

/**
 * Retorna informações sobre PDF salvo
 * @returns {Promise<Object>}
 */
export async function getPdfInfo() {
  const hasPdf = await hasSavedPdf();
  
  if (!hasPdf) {
    return {
      exists: false,
    };
  }
  
  const metadata = await getPdfMetadata();
  
  return {
    exists: true,
    uploadedAt: metadata?.uploadedAt || null,
    fileName: metadata?.fileName || 'Desconhecido',
    fileSize: metadata?.fileSize || 0,
    textLength: metadata?.textLength || 0,
    format: metadata?.format || null,
  };
}

/**
 * Atualiza PDF (substitui existente)
 * @param {File} file - Novo arquivo PDF
 * @returns {Promise<Object>} Resultado
 */
export async function updatePdf(file) {
  // Remove PDF antigo
  await removePdf();
  
  // Salva novo
  return await savePdf(file);
}

/**
 * Salva PDF multi-semana COM ACÚMULO
 */
export async function saveMultiWeekPdf(file) {
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const rawText = await extractTextFromFile(file);
    if (!rawText || rawText.length < 50) {
      return { success: false, error: 'PDF vazio ou com muito pouco texto' };
    }

    logDebug('📝 Texto bruto extraído:', rawText.length, 'chars');
    logDebug('📝 Primeiros 200 chars:', rawText.substring(0, 200));

    const cleanedText = cleanPdfText(rawText);
    logDebug('🧹 Texto limpo:', cleanedText.length, 'chars');
    logDebug('🧹 Primeiros 200 chars:', cleanedText.substring(0, 200));

    const parsedWeeks = parseMultiWeekPdf(cleanedText);

    if (!parsedWeeks || parsedWeeks.length === 0) {
      return { success: false, error: 'Nenhuma semana detectada no PDF' };
    }

    logDebug('📦 Semanas parseadas do novo PDF:', parsedWeeks.map(w => w.weekNumber));

    // 🔥 CARREGA SEMANAS EXISTENTES
    const existingResult = await loadParsedWeeks();
    const existingWeeks = existingResult.success ? (existingResult.data?.weeks || []) : [];

    logDebug('📦 Semanas já salvas:', existingWeeks.map(w => w.weekNumber));

    // 🔥 MESCLA (acumula sem duplicar)
    const allWeeksMap = new Map();
    
    // Adiciona existentes primeiro
    existingWeeks.forEach(w => {
      if (w.weekNumber) allWeeksMap.set(w.weekNumber, w);
    });

    // Adiciona/sobrescreve com novas
    parsedWeeks.forEach(w => {
      if (w.weekNumber) allWeeksMap.set(w.weekNumber, w);
    });

    const mergedWeeks = Array.from(allWeeksMap.values())
      .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber));

    logDebug('📦 Semanas após merge:', mergedWeeks.map(w => w.weekNumber));

    // Salva todas as semanas como objeto/array (sem stringificar manualmente)
    const storage = createStorage(PDF_KEY, JSON.stringify(mergedWeeks).length);
    await storage.set(PDF_KEY, mergedWeeks);

    // Atualiza metadados
    const metadata = {
      uploadedAt: getTimestamp(),
      fileName: file.name,
      fileSize: file.size,
      weeksCount: mergedWeeks.length,
      weekNumbers: mergedWeeks.map(w => w.weekNumber),
    };

    const metaStorage = createStorage(METADATA_KEY, 1000);
    await metaStorage.set(METADATA_KEY, metadata);

    logDebug('✅ PDF multi-semana salvo:', {
      novas: parsedWeeks.length, 
      totalAgora: mergedWeeks.length 
    });

    return { 
      success: true, 
      data: { 
        parsedWeeks: mergedWeeks,
        metadata 
      } 
    };
  } catch (error) {
    return { success: false, error: `Erro ao processar PDF: ${error.message}` };
  }
}

/**
 * Salva semanas parseadas diretamente (texto/OCR/etc)
 * @param {Array} parsedWeeks
 * @param {Object} sourceMeta
 * @returns {Promise<Object>}
 */
export async function saveParsedWeeks(parsedWeeks, sourceMeta = {}) {
  if (!Array.isArray(parsedWeeks) || parsedWeeks.length === 0) {
    return { success: false, error: 'Nenhuma semana válida para salvar' };
  }

  try {
    const existingResult = await loadParsedWeeks();
    const existingWeeks = existingResult.success ? (existingResult.data?.weeks || []) : [];

    const allWeeksMap = new Map();
    existingWeeks.forEach((w) => {
      if (w?.weekNumber) allWeeksMap.set(w.weekNumber, w);
    });
    parsedWeeks.forEach((w) => {
      if (w?.weekNumber) allWeeksMap.set(w.weekNumber, w);
    });

    const mergedWeeks = Array.from(allWeeksMap.values())
      .sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber));

    const storage = createStorage(PDF_KEY, JSON.stringify(mergedWeeks).length);
    await storage.set(PDF_KEY, mergedWeeks);

    const metadata = {
      uploadedAt: getTimestamp(),
      fileName: sourceMeta.fileName || 'imported-text',
      fileSize: sourceMeta.fileSize || 0,
      weeksCount: mergedWeeks.length,
      weekNumbers: mergedWeeks.map((w) => w.weekNumber),
      source: sourceMeta.source || 'text',
    };

    const metaStorage = createStorage(METADATA_KEY, 1000);
    await metaStorage.set(METADATA_KEY, metadata);

    return {
      success: true,
      data: {
        parsedWeeks: mergedWeeks,
        metadata,
      },
    };
  } catch (error) {
    return { success: false, error: `Erro ao salvar semanas: ${error.message}` };
  }
}
/**
 * Carrega todas as semanas salvas
 * @returns {Promise<Object>}
 */
export async function loadParsedWeeks() {
  try {
    const storage = createStorage(PDF_KEY, 0);
    const data = await storage.get(PDF_KEY);

    if (!data) {
      return { success: false, error: 'Nenhum PDF salvo', data: null };
    }

    const weeks = normalizeWeeksData(data);
    if (!weeks) {
      console.warn('⚠️ Semanas não é array:', weeks);
      return { success: false, error: 'Formato inválido', data: null };
    }

    const metaStorage = createStorage(METADATA_KEY, 0);
    const metadata = await metaStorage.get(METADATA_KEY);

    logDebug('📦 loadParsedWeeks retornou:', weeks.map(w => w.weekNumber));

    return { success: true, data: { weeks, metadata } };
  } catch (error) {
    console.error('❌ Erro ao carregar semanas:', error);
    return { success: false, error: `Erro ao carregar: ${error.message}`, data: null };
  }
}

function normalizeWeeksData(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
