function stringList(description) {
  return {
    type: 'array',
    description,
    items: { type: 'string' },
  };
}

function object(properties, required) {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  };
}

function buildEnvelopeSchema(mode, dataSchema) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean' },
      mode: { type: 'string', enum: [mode] },
      version: { type: 'string', enum: ['v1'] },
      data: dataSchema,
      meta: object(
        {
          model: { type: 'string' },
          generatedAt: { type: 'string' },
        },
        ['model', 'generatedAt'],
      ),
    },
    required: ['ok', 'mode', 'version', 'data', 'meta'],
  };
}

const explainWorkoutData = object(
  {
    summary: { type: 'string' },
    goal: { type: 'string' },
    stimulus: { type: 'string' },
    demands: stringList('Demandas principais do treino'),
    commonMistakes: stringList('Erros comuns'),
    notes: stringList('Notas finais'),
  },
  ['summary', 'goal', 'stimulus', 'demands', 'commonMistakes', 'notes'],
);

const strategyData = object(
  {
    summary: { type: 'string' },
    opening: { type: 'string' },
    pacing: stringList('Diretrizes de pacing'),
    breakPlan: stringList('Plano de quebras'),
    transitions: stringList('Gestão de transições'),
    riskFlags: stringList('Alertas de risco'),
    finish: { type: 'string' },
  },
  ['summary', 'opening', 'pacing', 'breakPlan', 'transitions', 'riskFlags', 'finish'],
);

const adaptWorkoutData = object(
  {
    summary: { type: 'string' },
    originalStimulus: { type: 'string' },
    adaptedWorkout: stringList('Treino adaptado'),
    whyItWorks: stringList('Justificativas'),
    scenarios: object(
      {
        noEquipment: stringList('Sem equipamento'),
        beginner: stringList('Iniciante'),
        fatigued: stringList('Cansado ou em recuperação'),
      },
      ['noEquipment', 'beginner', 'fatigued'],
    ),
    warnings: stringList('Alertas'),
  },
  ['summary', 'originalStimulus', 'adaptedWorkout', 'whyItWorks', 'scenarios', 'warnings'],
);

const analyzeResultData = object(
  {
    summary: { type: 'string' },
    strengths: stringList('Pontos fortes'),
    mainLimiter: { type: 'string' },
    pacingRead: { type: 'string' },
    movementBreakdown: stringList('Leitura por movimento'),
    nextFocus: stringList('Próximos focos'),
    coachNote: { type: 'string' },
  },
  ['summary', 'strengths', 'mainLimiter', 'pacingRead', 'movementBreakdown', 'nextFocus', 'coachNote'],
);

const importWorkoutData = object(
  {
    summary: { type: 'string' },
    structuredWorkout: object(
      {
        warmup: stringList('Aquecimento'),
        strength: stringList('Força'),
        skill: stringList('Skill'),
        wod: stringList('WOD'),
        accessories: stringList('Acessórios'),
        notes: stringList('Notas'),
      },
      ['warmup', 'strength', 'skill', 'wod', 'accessories', 'notes'],
    ),
    uncertainParts: stringList('Trechos incertos'),
    detectedGoal: { type: 'string' },
  },
  ['summary', 'structuredWorkout', 'uncertainParts', 'detectedGoal'],
);

const compareHistoryData = object(
  {
    summary: { type: 'string' },
    evolution: stringList('Evolução observada'),
    repeatedPatterns: stringList('Padrões repetidos'),
    persistentWeakness: { type: 'string' },
    currentPriority: stringList('Prioridades atuais'),
    notes: stringList('Observações'),
  },
  ['summary', 'evolution', 'repeatedPatterns', 'persistentWeakness', 'currentPriority', 'notes'],
);

const competitionPlanData = object(
  {
    summary: { type: 'string' },
    warmupPlan: stringList('Aquecimento'),
    controlPoints: stringList('Pontos de controle'),
    accelerationPoints: stringList('Pontos de aceleração'),
    breakPlan: stringList('Plano de quebra'),
    tieBreakNotes: stringList('Tie-break'),
    finalPush: { type: 'string' },
  },
  ['summary', 'warmupPlan', 'controlPoints', 'accelerationPoints', 'breakPlan', 'tieBreakNotes', 'finalPush'],
);

const recoveryCheckData = object(
  {
    summary: { type: 'string' },
    status: { type: 'string', enum: ['ok', 'attention', 'high_risk'] },
    signals: stringList('Sinais observados'),
    adjustments: stringList('Ajustes imediatos'),
    warnings: stringList('Alertas'),
    nextStep: { type: 'string' },
  },
  ['summary', 'status', 'signals', 'adjustments', 'warnings', 'nextStep'],
);

const coachReviewData = object(
  {
    summary: { type: 'string' },
    sessionIntent: { type: 'string' },
    whatWorked: stringList('O que funcionou'),
    inconsistencies: stringList('Inconsistências'),
    athletePattern: stringList('Padrões do atleta'),
    recommendedActions: stringList('Ações recomendadas'),
    coachNote: { type: 'string' },
  },
  ['summary', 'sessionIntent', 'whatWorked', 'inconsistencies', 'athletePattern', 'recommendedActions', 'coachNote'],
);

const chatCoachData = object(
  {
    reply: { type: 'string' },
    quickActions: stringList('Ações rápidas sugeridas'),
    tone: { type: 'string', enum: ['coach'] },
    focus: stringList('Pontos de foco da resposta'),
    followUpPrompt: { type: 'string' },
  },
  ['reply', 'quickActions', 'tone', 'focus', 'followUpPrompt'],
);

const citationItem = object(
  {
    title: { type: 'string' },
    excerpt: { type: 'string' },
    sourceId: { type: 'string' },
  },
  ['title', 'excerpt', 'sourceId'],
);

const researchAnswerData = object(
  {
    answer: { type: 'string' },
    bottomLine: { type: 'string' },
    evidenceLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
    citations: {
      type: 'array',
      items: citationItem,
    },
    caveats: stringList('Limitações e ressalvas'),
  },
  ['answer', 'bottomLine', 'evidenceLevel', 'citations', 'caveats'],
);

const verifyStudyData = object(
  {
    answer: { type: 'string' },
    verdict: { type: 'string' },
    evidenceLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
    citations: {
      type: 'array',
      items: citationItem,
    },
    caveats: stringList('Limitações e ressalvas'),
  },
  ['answer', 'verdict', 'evidenceLevel', 'citations', 'caveats'],
);

export const CROSSAI_CONTRACTS = {
  explain_workout: {
    mode: 'explain-workout',
    schema: buildEnvelopeSchema('explain-workout', explainWorkoutData),
  },
  strategy_wod: {
    mode: 'strategy',
    schema: buildEnvelopeSchema('strategy', strategyData),
  },
  adapt_workout: {
    mode: 'adapt-workout',
    schema: buildEnvelopeSchema('adapt-workout', adaptWorkoutData),
  },
  analyze_result: {
    mode: 'analyze-result',
    schema: buildEnvelopeSchema('analyze-result', analyzeResultData),
  },
  import_workout: {
    mode: 'import-workout',
    schema: buildEnvelopeSchema('import-workout', importWorkoutData),
  },
  compare_history: {
    mode: 'compare-history',
    schema: buildEnvelopeSchema('compare-history', compareHistoryData),
  },
  competition_plan: {
    mode: 'competition-plan',
    schema: buildEnvelopeSchema('competition-plan', competitionPlanData),
  },
  recovery_check: {
    mode: 'recovery-check',
    schema: buildEnvelopeSchema('recovery-check', recoveryCheckData),
  },
  coach_review: {
    mode: 'coach-review',
    schema: buildEnvelopeSchema('coach-review', coachReviewData),
  },
  chat_coach: {
    mode: 'chat-coach',
    schema: buildEnvelopeSchema('chat-coach', chatCoachData),
  },
  research_answer: {
    mode: 'research-answer',
    schema: buildEnvelopeSchema('research-answer', researchAnswerData),
  },
  verify_study: {
    mode: 'verify-study',
    schema: buildEnvelopeSchema('verify-study', verifyStudyData),
  },
};

export function getCrossAiContract(key) {
  const contract = CROSSAI_CONTRACTS[key];
  if (!contract) {
    throw new Error(`Contract CrossAI inválido: ${key}`);
  }
  return contract;
}
