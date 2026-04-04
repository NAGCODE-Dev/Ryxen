import { getCrossAiContract } from './contracts.js';

const SHARED_LAYERS = ['core', 'safety', 'memory', 'format', 'orchestrator'];

export const CROSSAI_PRESETS = {
  explain_workout: {
    key: 'explain_workout',
    route: '/ai/explain-workout',
    intent: 'explicação de treino',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'workout_interpreter', 'athlete'],
    contract: getCrossAiContract('explain_workout'),
  },
  strategy_wod: {
    key: 'strategy_wod',
    route: '/ai/strategy',
    intent: 'estratégia de WOD',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'strategy', 'athlete'],
    contract: getCrossAiContract('strategy_wod'),
  },
  adapt_workout: {
    key: 'adapt_workout',
    route: '/ai/adapt-workout',
    intent: 'adaptação de treino',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'adaptation', 'athlete'],
    contract: getCrossAiContract('adapt_workout'),
  },
  analyze_result: {
    key: 'analyze_result',
    route: '/ai/analyze-result',
    intent: 'análise de resultado',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'result_analysis', 'athlete'],
    contract: getCrossAiContract('analyze_result'),
  },
  compare_history: {
    key: 'compare_history',
    route: '/ai/compare-history',
    intent: 'comparação com histórico',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'history_compare', 'athlete'],
    contract: getCrossAiContract('compare_history'),
  },
  import_workout: {
    key: 'import_workout',
    route: '/ai/import-workout',
    intent: 'leitura de imagem ou documento',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'image_import'],
    contract: getCrossAiContract('import_workout'),
  },
  competition_plan: {
    key: 'competition_plan',
    route: '/ai/competition-plan',
    intent: 'planejamento de competição',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'competition', 'athlete'],
    contract: getCrossAiContract('competition_plan'),
  },
  recovery_check: {
    key: 'recovery_check',
    route: '/ai/recovery-check',
    intent: 'recuperação e risco',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'recovery', 'athlete'],
    contract: getCrossAiContract('recovery_check'),
  },
  coach_review: {
    key: 'coach_review',
    route: '/ai/coach-review',
    intent: 'suporte ao coach',
    audience: 'coach',
    layers: [...SHARED_LAYERS, 'coach', 'history_compare'],
    contract: getCrossAiContract('coach_review'),
  },
  chat_coach: {
    key: 'chat_coach',
    route: '/ai/chat-coach',
    intent: 'conversa guiada com coach',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'athlete'],
    contract: getCrossAiContract('chat_coach'),
  },
  research_answer: {
    key: 'research_answer',
    route: '/ai/research-answer',
    intent: 'resposta baseada em evidência',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'research_answer', 'athlete'],
    contract: getCrossAiContract('research_answer'),
  },
  verify_study: {
    key: 'verify_study',
    route: '/ai/verify-study',
    intent: 'verificação de estudo',
    audience: 'athlete',
    layers: [...SHARED_LAYERS, 'verify_study', 'athlete'],
    contract: getCrossAiContract('verify_study'),
  },
};

export function listCrossAiPresets() {
  return Object.values(CROSSAI_PRESETS);
}

export function getCrossAiPreset(key) {
  const preset = CROSSAI_PRESETS[key];
  if (!preset) {
    throw new Error(`Preset CrossAI inválido: ${key}`);
  }
  return preset;
}
