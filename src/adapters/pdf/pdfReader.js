/**
 * PDF Reader
 * Extrai texto bruto de arquivos PDF
 * Usa PDF.js via módulo local
 */

import * as pdfjsLib from '../../libs/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../../libs/pdf.worker.mjs', import.meta.url).toString();
const DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';
const logDebug = (...args) => {
  if (DEBUG) console.log(...args);
};

/**
 * Verifica se PDF.js está disponível
 * @returns {boolean}
 */
export function isPdfJsAvailable() {
  return !!pdfjsLib?.getDocument;
}

/**
 * Extrai texto completo de um arquivo PDF
 * @param {File} file - Arquivo PDF
 * @returns {Promise<string>} Texto extraído
 */
/**
 * Extrai texto completo de um arquivo PDF
 * @param {File} file - Arquivo PDF
 * @returns {Promise<string>} Texto extraído
 */
/**
 * Extrai texto completo de um arquivo PDF
 * @param {File} file - Arquivo PDF
 * @returns {Promise<string>} Texto extraído
 */
export async function extractTextFromFile(file) {
  if (!file) {
    throw new Error('Arquivo não fornecido');
  }
  
  if (!file.type || file.type !== 'application/pdf') {
    throw new Error('Arquivo não é um PDF válido');
  }
  
  if (!isPdfJsAvailable()) {
    throw new Error('PDF.js não está carregado. Adicione o script no HTML.');
  }
  
  try {
    // Lê arquivo como ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Carrega PDF
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0,
    }).promise;
    
    const totalPages = pdf.numPages;
    let fullText = '';
    
    // Extrai texto de cada página
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Concatena items de texto
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    let trimmedText = fullText.trim();
    
    // CORREÇÃO CRÍTICA: Substitui espaços duplos por quebras de linha
    // PDFs do tipo "SEMANA 19  SEGUNDA  WOD" precisam virar linhas separadas
    trimmedText = trimmedText.replace(/\s{2,}/g, '\n');
    
    // VALIDAÇÃO: texto não pode estar vazio
    if (!trimmedText || trimmedText.length < 10) {
      throw new Error('PDF vazio ou texto não extraído');
    }
    
    logDebug('✅ Texto extraído:', trimmedText.length, 'caracteres');
    
    return trimmedText;
    
  } catch (error) {
    if (error.message.includes('Invalid PDF')) {
      throw new Error('PDF inválido ou corrompido');
    }
    
    if (error.message.includes('password')) {
      throw new Error('PDF protegido por senha não é suportado');
    }
    
    throw new Error('Erro ao ler PDF: ' + error.message);
  }
}
/**
 * Lê arquivo como ArrayBuffer
 * @param {File} file - Arquivo
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Valida arquivo PDF antes de processar
 * @param {File} file - Arquivo
 * @returns {Object} Resultado da validação
 */
export function validatePdfFile(file) {
  if (!file) {
    return {
      valid: false,
      error: 'Nenhum arquivo fornecido',
    };
  }
  
  if (!file.type || file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'Arquivo não é um PDF válido',
    };
  }
  
  // Tamanho máximo: 50MB (ajustável)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Arquivo muito grande (máximo 50MB)',
    };
  }
  
  if (file.size < 100) {
    return {
      valid: false,
      error: 'Arquivo muito pequeno para ser um PDF válido',
    };
  }
  
  return {
    valid: true,
    name: file.name,
    size: file.size,
    sizeFormatted: formatBytes(file.size),
  };
}

/**
 * Extrai metadados do PDF
 * @param {File} file - Arquivo PDF
 * @returns {Promise<Object>} Metadados
 */
export async function extractMetadata(file) {
  if (!isPdfJsAvailable()) {
    throw new Error('PDF.js não disponível');
  }
  
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0,
    }).promise;
    
    const metadata = await pdf.getMetadata();
    
    return {
      numPages: pdf.numPages,
      title: metadata.info?.Title || null,
      author: metadata.info?.Author || null,
      subject: metadata.info?.Subject || null,
      creator: metadata.info?.Creator || null,
      creationDate: metadata.info?.CreationDate || null,
      modificationDate: metadata.info?.ModDate || null,
      pdfVersion: metadata.info?.PDFFormatVersion || null,
    };
    
  } catch (error) {
    throw new Error('Erro ao extrair metadados: ' + error.message);
  }
}

/**
 * Formata bytes para leitura humana
 * @param {number} bytes - Bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Retorna informações do reader
 * @returns {Object}
 */
export function getInfo() {
  return {
    name: 'PDF Reader',
    library: 'PDF.js',
    available: isPdfJsAvailable(),
    version: isPdfJsAvailable() ? pdfjsLib.version : 'N/A',
  };
};
