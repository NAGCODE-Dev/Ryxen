import { OPENAI_API_KEY, OPENAI_INTERPRETER_MODEL } from './config.js';
import { shouldTryAiInterpretationFallback } from '../../src/app/importInterpreterPolicy.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export const IMPORT_INTERPRETATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Resumo curto do que foi entendido no arquivo.' },
    confidence_score: { type: 'integer', minimum: 0, maximum: 100, description: 'Confiança geral da interpretação final.' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Avisos curtos quando houver ambiguidade ou perda de informação.',
    },
    weeks: {
      type: 'array',
      description: 'Semanas de treino identificadas a partir do texto extraído.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          week_number: { type: 'integer', minimum: 1 },
          workouts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                day: { type: 'string', description: 'Dia da semana em português do Brasil, como Segunda, Terça, Quarta.' },
                blocks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      type: { type: 'string', description: 'Tipo do bloco, como DEFAULT, WOD, MANHÃ, TARDE, OPTIONAL, TIMED_WOD.' },
                      lines: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                    required: ['type', 'lines'],
                  },
                },
              },
              required: ['day', 'blocks'],
            },
          },
        },
        required: ['week_number', 'workouts'],
      },
    },
  },
  required: ['summary', 'confidence_score', 'warnings', 'weeks'],
};

export function isImportInterpreterEnabled() {
  return !!OPENAI_API_KEY;
}

export const shouldUseAiImportFallback = shouldTryAiInterpretationFallback;

export function normalizeInterpretedWorkoutPayload(payload = {}, fallbackWeekNumber = 1) {
  const safeWeeks = Array.isArray(payload?.weeks) ? payload.weeks : [];
  return safeWeeks
    .map((week, weekIndex) => {
      const weekNumber = Number(week?.week_number || fallbackWeekNumber || weekIndex + 1);
      const workouts = Array.isArray(week?.workouts)
        ? week.workouts
            .map((workout) => {
              const day = normalizeDayName(workout?.day);
              const blocks = Array.isArray(workout?.blocks)
                ? workout.blocks
                    .map((block) => ({
                      type: normalizeBlockType(block?.type),
                      lines: Array.isArray(block?.lines)
                        ? block.lines.map((line) => String(line || '').trim()).filter(Boolean)
                        : [],
                    }))
                    .filter((block) => block.lines.length > 0)
                : [];
              if (!day || !blocks.length) return null;
              return { day, blocks };
            })
            .filter(Boolean)
        : [];
      if (!workouts.length) return null;
      return { weekNumber, workouts };
    })
    .filter(Boolean);
}

export async function interpretWorkoutImportWithAI({
  rawText = '',
  source = 'text',
  fileName = '',
  activeWeekNumber = 1,
  analysis = {},
  parserReview = null,
  signal,
} = {}) {
  if (!isImportInterpreterEnabled()) {
    return { success: false, disabled: true, error: 'Interpretação assistida indisponível' };
  }

  const text = String(rawText || '').trim();
  if (!text) {
    return { success: false, error: 'Texto vazio para interpretação assistida' };
  }

  const payload = {
    model: OPENAI_INTERPRETER_MODEL,
    reasoning: { effort: 'minimal' },
    max_output_tokens: 3500,
    text: {
      format: {
        type: 'json_schema',
        strict: true,
        name: 'crossapp_import_interpretation',
        schema: IMPORT_INTERPRETATION_SCHEMA,
      },
    },
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: buildInterpretationPrompt({ text, source, fileName, activeWeekNumber, analysis, parserReview }),
          },
        ],
      },
    ],
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || `Erro OpenAI (${response.status})`);
  }

  const parsed = extractStructuredOutput(data);
  const weeks = normalizeInterpretedWorkoutPayload(parsed, activeWeekNumber);
  return {
    success: weeks.length > 0,
    provider: 'openai',
    model: data?.model || OPENAI_INTERPRETER_MODEL,
    raw: parsed,
    weeks,
    summary: String(parsed?.summary || '').trim(),
    confidenceScore: Number(parsed?.confidence_score || 0),
    warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map((item) => String(item || '').trim()).filter(Boolean) : [],
  };
}

function buildInterpretationPrompt({ text, source, fileName, activeWeekNumber, analysis, parserReview }) {
  const reviewWarnings = Array.isArray(parserReview?.warnings) ? parserReview.warnings.join(' | ') : '';
  return [
    'Você é um interpretador de treinos para CrossApp.',
    'Receba texto extraído de PDF, planilha, imagem ou vídeo e organize em semanas, dias, blocos e linhas.',
    'Não invente treino que não esteja no texto. Se algo estiver ambíguo, mantenha em warnings e preserve a linha em algum bloco apropriado.',
    'Use dias da semana em português do Brasil: Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo.',
    'Tipos de bloco aceitos: DEFAULT, WOD, WOD 2, MANHÃ, TARDE, OPTIONAL, TIMED_WOD.',
    `Arquivo: ${String(fileName || 'importado')}`,
    `Origem: ${String(source || 'text')}`,
    `Semana padrão se não houver marcador explícito: ${Number(activeWeekNumber || 1)}`,
    `Confiança da extração local: ${Number(analysis?.confidenceScore || 0)}`,
    reviewWarnings ? `Avisos do parser local: ${reviewWarnings}` : '',
    'Saída obrigatória: JSON aderente ao schema.',
    'Texto extraído:',
    text,
  ].filter(Boolean).join('\n\n');
}

function extractStructuredOutput(response) {
  const outputs = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const part of contents) {
      if (part?.type === 'output_text' && typeof part?.text === 'string') {
        const candidate = safeJsonParse(part.text);
        if (candidate && typeof candidate === 'object') return candidate;
      }
    }
  }
  return null;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}

function normalizeDayName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const map = {
    segunda: 'Segunda',
    terca: 'Terça',
    quarta: 'Quarta',
    quinta: 'Quinta',
    sexta: 'Sexta',
    sabado: 'Sábado',
    domingo: 'Domingo',
  };
  return map[normalized] || raw;
}

function normalizeBlockType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw || raw === 'DEFAULT') return 'DEFAULT';
  if (raw === 'WOD' || raw === 'WOD 2' || raw === 'MANHÃ' || raw === 'MANHA' || raw === 'TARDE' || raw === 'OPTIONAL' || raw === 'TIMED_WOD') {
    return raw === 'MANHA' ? 'MANHÃ' : raw;
  }
  return 'DEFAULT';
}
