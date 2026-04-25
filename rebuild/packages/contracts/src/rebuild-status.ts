export type RebuildLoopStatus =
  | "done"
  | "needs_attention"
  | "awaiting_participant"
  | "awaiting_setup";

export type RebuildLoopSurface = "coach" | "athlete";

export const rebuildLoopStatusLabels: Record<RebuildLoopStatus, string> = {
  done: "Em dia",
  needs_attention: "Pede acao",
  awaiting_participant: "Aguardando retorno",
  awaiting_setup: "Aguardando setup",
};

const rebuildLoopNextStepMessages: Record<
  RebuildLoopSurface,
  Record<RebuildLoopStatus, string>
> = {
  coach: {
    done: "O loop ja recebeu retorno. Agora vale usar esse treino como referencia rapida de acompanhamento.",
    needs_attention: "Ja existe acao pendente no loop. Revise esse treino e destrave o proximo passo.",
    awaiting_participant: "O treino ja foi entregue. Agora vale cobrar o retorno dos atletas.",
    awaiting_setup: "Ainda falta setup para o loop andar. Revise memberships e audiencia antes do proximo publish.",
  },
  athlete: {
    done: "Seu retorno ja foi enviado e o coach ja consegue acompanhar esse treino.",
    needs_attention: "Seu treino do dia ja chegou. Agora falta registrar como foi a sessao.",
    awaiting_participant: "Voce ja esta pronto para receber treino. Agora e so esperar o proximo publish do coach.",
    awaiting_setup: "Ainda falta concluir o setup do seu acesso para o Today receber treino.",
  },
};

export function getRebuildLoopNextStep(
  surface: RebuildLoopSurface,
  status: RebuildLoopStatus,
) {
  return rebuildLoopNextStepMessages[surface][status];
}

export function getCoachWorkoutStatus(input: {
  assignedCount: number;
  resultCount: number;
}): RebuildLoopStatus {
  if (input.resultCount > 0) {
    return "done";
  }

  if (input.assignedCount > 0) {
    return "awaiting_participant";
  }

  return "awaiting_setup";
}

export function getAthleteWorkoutStatus(input: {
  hasTodayWorkout: boolean;
  hasSubmittedResult: boolean;
  canReceiveWorkout: boolean;
}): RebuildLoopStatus {
  if (input.hasTodayWorkout && input.hasSubmittedResult) {
    return "done";
  }

  if (input.hasTodayWorkout) {
    return "needs_attention";
  }

  if (input.canReceiveWorkout) {
    return "awaiting_participant";
  }

  return "awaiting_setup";
}
