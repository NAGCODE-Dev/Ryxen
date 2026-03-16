import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import XLSX from 'xlsx';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const fixturesDir = path.join(rootDir, '__tests__', 'fixtures', 'imports');
const manifestPath = path.join(fixturesDir, 'manifest.json');

const BASE_ROWS = [
  ['SEMANA 19'],
  ['SEGUNDA'],
  ['BACK SQUAT'],
  ['5x5 @ 80%'],
  ['TERÇA'],
  ['FRAN'],
  ['21-15-9'],
  ['Thruster'],
  ['Pull-up'],
];

const MANIFEST = [
  {
    name: 'treino-exemplo.txt',
    mime: 'text/plain',
    quality: 'clean',
    format: 'txt',
    category: 'text',
    shouldParse: true,
  },
  {
    name: 'treino-exemplo.csv',
    mime: 'text/csv',
    quality: 'clean',
    format: 'csv',
    category: 'text',
    shouldParse: true,
  },
  {
    name: 'treino-exemplo.json',
    mime: 'application/json',
    quality: 'structured',
    format: 'json',
    category: 'text',
    shouldParse: false,
  },
  {
    name: 'treino-exemplo.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    quality: 'clean',
    format: 'xlsx',
    category: 'spreadsheet',
    shouldParse: true,
  },
  {
    name: 'treino-exemplo.xls',
    mime: 'application/vnd.ms-excel',
    quality: 'clean',
    format: 'xls',
    category: 'spreadsheet',
    shouldParse: true,
  },
  {
    name: 'treino-exemplo.ods',
    mime: 'application/vnd.oasis.opendocument.spreadsheet',
    quality: 'clean',
    format: 'ods',
    category: 'spreadsheet',
    shouldParse: true,
  },
  {
    name: 'treino-sujo-multiplas-abas.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    quality: 'dirty',
    format: 'xlsx',
    category: 'spreadsheet',
    shouldParse: true,
  },
  {
    name: 'treino-sujo-cabecalho-ruim.xls',
    mime: 'application/vnd.ms-excel',
    quality: 'dirty',
    format: 'xls',
    category: 'spreadsheet',
    shouldParse: true,
  },
  {
    name: 'treino-sujo-colunas-soltas.ods',
    mime: 'application/vnd.oasis.opendocument.spreadsheet',
    quality: 'dirty',
    format: 'ods',
    category: 'spreadsheet',
    shouldParse: true,
  },
  {
    name: 'treino-texto-limpo.pdf',
    mime: 'application/pdf',
    quality: 'clean',
    format: 'pdf',
    category: 'pdf',
    shouldParse: true,
  },
  {
    name: 'treino-texto-sujo.pdf',
    mime: 'application/pdf',
    quality: 'dirty',
    format: 'pdf',
    category: 'pdf',
    shouldParse: true,
  },
  {
    name: 'treino-escaneado.pdf',
    mime: 'application/pdf',
    quality: 'scanned',
    format: 'pdf',
    category: 'pdf',
    shouldParse: true,
  },
  {
    name: 'treino-foto-limpa.png',
    mime: 'image/png',
    quality: 'clean',
    format: 'png',
    category: 'image',
    shouldParse: true,
  },
  {
    name: 'treino-foto-ruidosa.png',
    mime: 'image/png',
    quality: 'dirty',
    format: 'png',
    category: 'image',
    shouldParse: true,
  },
];

async function main() {
  await fs.mkdir(fixturesDir, { recursive: true });
  await writeTextFixtures();
  await writeSpreadsheetFixtures();
  await writeImageFixtures();
  await writePdfFixtures();
  await fs.writeFile(manifestPath, JSON.stringify(MANIFEST, null, 2));
  console.log(`Fixtures geradas em ${fixturesDir}`);
}

async function writeTextFixtures() {
  const plainText = BASE_ROWS.map((row) => row.join(' ')).join('\n');
  await fs.writeFile(path.join(fixturesDir, 'treino-exemplo.txt'), plainText);
  await fs.writeFile(path.join(fixturesDir, 'treino-exemplo.csv'), BASE_ROWS.map((row) => row.join(',')).join('\n'));
  await fs.writeFile(
    path.join(fixturesDir, 'treino-exemplo.json'),
    JSON.stringify({
      weekNumber: 19,
      workouts: [{ day: 'Segunda', blocks: [{ type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%'] }] }],
    }, null, 2),
  );
}

async function writeSpreadsheetFixtures() {
  await writeWorkbook(
    {
      Treino: BASE_ROWS,
    },
    'treino-exemplo.xlsx',
    'xlsx',
  );
  await writeWorkbook(
    {
      Treino: BASE_ROWS,
    },
    'treino-exemplo.xls',
    'biff8',
  );
  await writeWorkbook(
    {
      Treino: BASE_ROWS,
    },
    'treino-exemplo.ods',
    'ods',
  );

  await writeWorkbook(
    {
      Resumo: [
        ['PLANEJAMENTO DO BOX'],
        ['Atualizado 15/03/2026'],
        [''],
        ['Treinos da semana abaixo'],
      ],
      'Semana 19': [
        ['SEMANA 19'],
        [''],
        ['SEGUNDA'],
        ['BACK SQUAT'],
        ['5x5 @ 80%'],
        [''],
        ['TERÇA'],
        ['FRAN'],
        ['21-15-9'],
        ['Thruster'],
        ['Pull-up'],
      ],
    },
    'treino-sujo-multiplas-abas.xlsx',
    'xlsx',
  );

  await writeWorkbook(
    {
      'Planilha 1': [
        ['COPIADO DO GOOGLE SHEETS'],
        ['Coach:', 'Nikolas'],
        ['Observação geral', 'manter técnica'],
        [''],
        ['SEMANA 19'],
        ['SEGUNDA'],
        ['BACK SQUAT'],
        ['5x5 @ 80%'],
        ['TERÇA'],
        ['FRAN'],
        ['21-15-9'],
        ['Thruster'],
        ['Pull-up'],
      ],
    },
    'treino-sujo-cabecalho-ruim.xls',
    'biff8',
  );

  await writeWorkbook(
    {
      Treino: [
        ['SEMANA 19', '', 'planilha exportada'],
        ['', '', ''],
        ['SEGUNDA', '', 'força'],
        ['BACK SQUAT', '', 'prioridade'],
        ['5x5 @ 80%', '', ''],
        ['TERÇA', '', 'metcon'],
        ['FRAN', '', 'benchmark'],
        ['21-15-9', '', ''],
        ['Thruster', '', ''],
        ['Pull-up', '', ''],
      ],
    },
    'treino-sujo-colunas-soltas.ods',
    'ods',
  );
}

async function writeWorkbook(sheetMap, fileName, bookType) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheetMap)) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  XLSX.writeFile(workbook, path.join(fixturesDir, fileName), { bookType });
}

async function writePdfFixtures() {
  const cleanPdf = buildTextPdf([
    'SEMANA 19',
    'SEGUNDA',
    'BACK SQUAT',
    '5x5 @ 80%',
    'TERCA',
    'FRAN',
    '21-15-9',
    'Thruster',
    'Pull-up',
  ]);
  await fs.writeFile(path.join(fixturesDir, 'treino-texto-limpo.pdf'), cleanPdf);

  const dirtyPdf = buildTextPdf([
    'PLANILHA EXPORTADA DO BOX',
    'Atualizado em 15 03 2026',
    'SEMANA 19',
    'SEGUNDA',
    'BACK SQUAT',
    '5x5 @ 80%',
    'TERCA',
    'FRAN',
    '21-15-9',
    'Thruster',
    'Pull-up',
  ]);
  await fs.writeFile(path.join(fixturesDir, 'treino-texto-sujo.pdf'), dirtyPdf);

  await runPython(`
from PIL import Image
img = Image.open(r"${escapePython(path.join(fixturesDir, 'treino-foto-limpa.png'))}").convert('RGB')
img.save(r"${escapePython(path.join(fixturesDir, 'treino-escaneado.pdf'))}", "PDF", resolution=100.0)
`);
}

async function writeImageFixtures() {
  await runPython(`
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random

def draw_fixture(path, noisy=False):
    width, height = 1400, 1000
    image = Image.new("RGB", (width, height), (250, 251, 253))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    lines = [
        "SEMANA 19",
        "SEGUNDA",
        "BACK SQUAT",
        "5x5 @ 80%",
        "TERCA",
        "FRAN",
        "21-15-9",
        "Thruster",
        "Pull-up",
    ]

    y = 70
    for line in lines:
        draw.text((90, y), line, fill=(18, 24, 33), font=font)
        y += 95

    if noisy:
        for x in range(0, width, 90):
            draw.line((x, 0, x + 60, height), fill=(220, 224, 230), width=1)
        for _ in range(1800):
            px = random.randint(0, width - 1)
            py = random.randint(0, height - 1)
            shade = random.randint(150, 235)
            image.putpixel((px, py), (shade, shade, shade))
        image = image.filter(ImageFilter.GaussianBlur(radius=0.4))

    image.save(path, "PNG")

draw_fixture(r"${escapePython(path.join(fixturesDir, 'treino-foto-limpa.png'))}", noisy=False)
draw_fixture(r"${escapePython(path.join(fixturesDir, 'treino-foto-ruidosa.png'))}", noisy=True)
`);
}

function buildTextPdf(lines) {
  const contentLines = ['BT', '/F1 18 Tf', '50 760 Td'];
  lines.forEach((line, index) => {
    if (index > 0) {
      contentLines.push('0 -26 Td');
    }
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });
  contentLines.push('ET');

  const stream = contentLines.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

function escapePdfText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function escapePython(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runPython(source) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', source], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `python3 exited with code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
