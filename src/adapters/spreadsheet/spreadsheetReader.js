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

  const lines = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    return rows
      .map((row) => normalizeSpreadsheetRow(row))
      .filter(Boolean);
  });

  return lines.join('\n').trim();
}

function normalizeSpreadsheetRow(row) {
  if (!Array.isArray(row)) return '';

  const parts = row
    .map((cell) => String(cell ?? '').trim())
    .filter(Boolean);

  return parts.join(' ');
}
