import {
  OPENAI_API_KEY,
  CROSSAI_MODEL,
  CROSSAI_REASONING_EFFORT,
  CROSSAI_SCIENCE_VECTOR_STORE_IDS,
} from '../config.js';
import { composePromptLayers } from './promptCatalog.js';
import { buildCrossAiContext } from './contextStore.js';

function buildSystemInstructions(preset) {
  return composePromptLayers(preset.layers);
}

function buildUserPayload({ preset, body, user, context }) {
  const extraInstructions = [];

  if (preset.key === 'chat_coach') {
    extraInstructions.push(
      'Esta é uma conversa guiada com atleta em formato de coach técnico.',
      'Use o histórico curto da conversa quando ele existir, mas não invente memória além do payload.',
      'A resposta principal deve estar em data.reply e precisa ser curta, prática e conversacional.',
      'Sugira quickActions que façam sentido como próximos toques no app.',
    );
  }

  if (preset.key === 'research_answer') {
    extraInstructions.push(
      'Use a biblioteca científica recuperada por file_search antes de responder.',
      'Preencha citations apenas com fontes realmente recuperadas ou claramente apoiadas no material encontrado.',
      'Se a evidência estiver incompleta, reduza o evidenceLevel e explique caveats.',
    );
  }

  if (preset.key === 'verify_study') {
    extraInstructions.push(
      'Baseie a resposta no arquivo fornecido no payload.',
      'Se o arquivo não permitir concluir com segurança, explique isso em caveats.',
      'Preencha citations apenas com trechos que façam sentido a partir do material analisado.',
    );
  }

  return [
    `Intento principal: ${preset.intent}.`,
    `Público-alvo: ${preset.audience}.`,
    'Responda apenas com JSON válido seguindo o schema exigido.',
    `O campo mode deve ser exatamente "${preset.contract.mode}" e version deve ser "v1".`,
    'O campo meta.generatedAt deve ser um timestamp ISO 8601.',
    `O conteúdo principal deve ficar dentro de data seguindo o contract de "${preset.contract.mode}".`,
    'Se faltarem dados, mantenha arrays vazios quando necessário e explique a incerteza em observações ou followUp.',
    ...extraInstructions,
    '',
    'Contexto da requisição:',
    JSON.stringify({
      user: {
        id: user?.userId || null,
        email: user?.email || null,
        name: user?.name || null,
      },
      context: context || null,
      payload: body || {},
    }, null, 2),
  ].join('\n');
}

function buildInputForPreset({ preset, input, body }) {
  if (preset.key === 'verify_study') {
    const content = [{ type: 'input_text', text: input }];

    if (body?.fileId) {
      content.push({ type: 'input_file', file_id: String(body.fileId) });
    } else if (body?.fileUrl) {
      content.push({ type: 'input_file', file_url: String(body.fileUrl) });
    }

    return [{ role: 'user', content }];
  }

  return input;
}

function buildToolsForPreset(preset) {
  if (preset.key !== 'research_answer') {
    return {};
  }

  if (!CROSSAI_SCIENCE_VECTOR_STORE_IDS.length) {
    const error = new Error('CROSSAI_SCIENCE_VECTOR_STORE_IDS não configurado');
    error.statusCode = 503;
    throw error;
  }

  return {
    include: ['file_search_call.results'],
    tools: [
      {
        type: 'file_search',
        vector_store_ids: CROSSAI_SCIENCE_VECTOR_STORE_IDS,
        max_num_results: 8,
      },
    ],
  };
}

function extractOutputText(responseJson) {
  const output = Array.isArray(responseJson?.output) ? responseJson.output : [];
  const chunks = [];

  for (const item of output) {
    if (item?.type !== 'message') continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function extractRefusal(responseJson) {
  const output = Array.isArray(responseJson?.output) ? responseJson.output : [];

  for (const item of output) {
    if (item?.type !== 'message') continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === 'refusal' && typeof part.refusal === 'string') {
        return part.refusal.trim();
      }
    }
  }

  return '';
}

function parseStructuredOutput(rawText) {
  if (!rawText) {
    throw new Error('A resposta da OpenAI veio vazia');
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(rawText.slice(start, end + 1));
    }
    throw new Error('Não foi possível converter a resposta da OpenAI em JSON');
  }
}

export function isCrossAiConfigured() {
  return Boolean(OPENAI_API_KEY);
}

export async function generateCrossAiResponse({ preset, body, user }) {
  if (!OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY não configurada');
    error.statusCode = 503;
    throw error;
  }

  if (preset.key === 'verify_study' && !body?.fileId && !body?.fileUrl) {
    const error = new Error('verify-study exige fileId ou fileUrl');
    error.statusCode = 400;
    throw error;
  }

  const instructions = await buildSystemInstructions(preset);
  const context = await buildCrossAiContext({ preset, body, user });
  const input = buildUserPayload({ preset, body, user, context });
  const requestInput = buildInputForPreset({ preset, input, body });
  const toolOptions = buildToolsForPreset(preset);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: CROSSAI_MODEL,
      reasoning: {
        effort: CROSSAI_REASONING_EFFORT,
      },
      instructions,
      input: requestInput,
      ...toolOptions,
      text: {
        format: {
          type: 'json_schema',
          strict: true,
          schema: preset.contract.schema,
        },
      },
    }),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    const error = new Error(responseJson?.error?.message || 'Falha ao consultar a OpenAI');
    error.statusCode = response.status;
    error.details = responseJson;
    throw error;
  }

  const refusal = extractRefusal(responseJson);
  if (refusal) {
    const error = new Error(refusal);
    error.statusCode = 422;
    throw error;
  }

  const rawText = extractOutputText(responseJson);
  const parsed = parseStructuredOutput(rawText);

  return {
    id: responseJson.id || null,
    model: responseJson.model || CROSSAI_MODEL,
    usage: responseJson.usage || null,
    output: parsed,
  };
}
