export async function pickPdfFile() {
  return pickFile({ accept: 'application/pdf' });
}

export async function pickUniversalFile() {
  return pickFile({
    accept: [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/*',
      'video/*',
      '.txt',
      '.md',
      '.csv',
      '.json',
      '.xls',
      '.xlsx',
    ].join(','),
  });
}

export async function pickJsonFile() {
  return pickFile({ accept: '.json,application/json' });
}

async function pickFile({ accept = '' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}
