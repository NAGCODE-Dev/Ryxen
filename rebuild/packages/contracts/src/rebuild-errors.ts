export function getCoachErrorMessage(
  action:
    | "request"
    | "bootstrap"
    | "signin"
    | "signup_request"
    | "signup_confirm"
    | "password_reset_request"
    | "password_reset_confirm"
    | "create_gym"
    | "publish_workout"
    | "update_workout"
    | "invite_membership"
    | "remove_membership"
    | "remove_workout",
) {
  switch (action) {
    case "request":
      return "Nao foi possivel completar a solicitacao.";
    case "bootstrap":
      return "Nao foi possivel carregar o portal.";
    case "signin":
      return "Nao foi possivel entrar.";
    case "signup_request":
      return "Nao foi possivel iniciar o cadastro.";
    case "signup_confirm":
      return "Nao foi possivel confirmar o cadastro.";
    case "password_reset_request":
      return "Nao foi possivel iniciar a recuperacao de senha.";
    case "password_reset_confirm":
      return "Nao foi possivel redefinir a senha.";
    case "create_gym":
      return "Nao foi possivel criar o gym.";
    case "publish_workout":
      return "Nao foi possivel publicar o treino.";
    case "update_workout":
      return "Nao foi possivel atualizar o treino.";
    case "invite_membership":
      return "Nao foi possivel convidar o atleta.";
    case "remove_membership":
      return "Nao foi possivel remover a membership.";
    case "remove_workout":
      return "Nao foi possivel remover o treino.";
  }
}

export function getAthleteErrorMessage(
  action:
    | "request"
    | "bootstrap"
    | "signin"
    | "signup_request"
    | "signup_confirm"
    | "password_reset_request"
    | "password_reset_confirm"
    | "submit_result",
) {
  switch (action) {
    case "request":
      return "Nao foi possivel completar a requisicao.";
    case "bootstrap":
      return "Nao foi possivel carregar o app do atleta.";
    case "signin":
      return "Nao foi possivel entrar.";
    case "signup_request":
      return "Nao foi possivel iniciar o cadastro.";
    case "signup_confirm":
      return "Nao foi possivel confirmar o cadastro.";
    case "password_reset_request":
      return "Nao foi possivel iniciar a recuperacao de senha.";
    case "password_reset_confirm":
      return "Nao foi possivel redefinir a senha.";
    case "submit_result":
      return "Nao foi possivel registrar o resultado.";
  }
}
