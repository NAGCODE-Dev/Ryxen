export const rebuildFeedbackTitles = {
  success: "Fluxo em movimento",
  error: "Algo travou",
} as const;

export function getCoachSuccessMessage(
  action:
    | "signin"
    | "signup_confirm"
    | "password_reset_confirm"
    | "refresh"
    | "create_gym"
    | "publish_workout"
    | "update_workout"
    | "remove_workout",
  payload?: Record<string, string | number | undefined>,
) {
  switch (action) {
    case "signin":
      return "Sessao iniciada. O portal ja pode publicar o primeiro treino.";
    case "signup_confirm":
      return "Conta criada. O proximo passo e criar o primeiro gym.";
    case "password_reset_confirm":
      return "Senha redefinida. Agora voce ja pode entrar no portal com a nova credencial.";
    case "refresh":
      return "Portal atualizado com os dados mais recentes do gym.";
    case "create_gym":
      return `Gym "${String(payload?.gymName || "Novo gym")}" criado. Agora publique o primeiro treino.`;
    case "publish_workout":
      return `Treino "${String(payload?.workoutTitle || "Treino")}" publicado para ${String(payload?.assignedCount || 0)} atleta(s).`;
    case "update_workout":
      return `Treino "${String(payload?.workoutTitle || "Treino")}" atualizado com sucesso.`;
    case "remove_workout":
      return `Treino "${String(payload?.workoutTitle || "Treino")}" removido do historico do gym.`;
  }
}

export function getAthleteSuccessMessage(
  action:
    | "signin"
    | "signup_confirm"
    | "password_reset_confirm"
    | "refresh"
    | "submit_result",
) {
  switch (action) {
    case "signin":
      return "Sessao restaurada. O Today ja pode carregar o treino.";
    case "signup_confirm":
      return "Conta criada. Agora o app pode consumir o treino publicado pelo coach.";
    case "password_reset_confirm":
      return "Senha redefinida. Agora voce pode entrar no app com a nova credencial.";
    case "refresh":
      return "App atualizado com o estado mais recente.";
    case "submit_result":
      return "Resultado registrado. O coach ja pode ver que houve retorno.";
  }
}
