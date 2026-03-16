const SPREADSHEET_EXTENSIONS = /\.(xlsx|xls|ods)$/i;
const SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

export function isSpreadsheetFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  return SPREADSHEET_MIME_TYPES.has(type) || SPREADSHEET_EXTENSIONS.test(name);
}

export async function extractTextFromSpreadsheetFile(file) {
  const analysis = await extractTextFromSpreadsheetAnalysis(file);
  return analysis.text;
}

export async function extractTextFromSpreadsheetAnalysis(file) {
  if (!file) {
    throw new Error('Arquivo de planilha não fornecido');
  }

  if (!isSpreadsheetFile(file)) {
    throw new Error('Arquivo não é uma planilha suportada');
  }

  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: false,
    dense: true,
  });

  let rowCount = 0;
  let nonEmptyRows = 0;
  const warnings = [];

  const lines = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    rowCount += rows.length;

    return rows
      .map((row) => normalizeSpreadsheetRow(row))
      .filter((value) => {
        if (!value) return false;
        nonEmptyRows += 1;
        return true;
      });
  });

  const text = lines.join('\n').trim();
  let confidenceScore = 92;
  if (workbook.SheetNames.length > 1) confidenceScore -= 4;
  if (rowCount > 0 && nonEmptyRows / rowCount < 0.55) {
    confidenceScore -= 12;
    warnings.push('Planilha com muitas linhas vazias ou colunas soltas');
  }
  if (text.length < 60) {
    confidenceScore -= 18;
    warnings.push('Pouco conteúdo útil encontrado na planilha');
  }

  confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

  return {
    text,
    sheetCount: workbook.SheetNames.length,
    rowCount,
    nonEmptyRows,
    confidenceScore,
    confidenceLabel: confidenceScore >= 85 ? 'alta' : confidenceScore >= 65 ? 'média' : 'baixa',
    warnings,
  };
}

function normalizeSpreadsheetRow(row) {
  if (!Array.isArray(row)) return '';

  const parts = row
    .map((cell) => String(cell ?? '').trim())
    .filter(Boolean);

  return parts.join(' ');
}
