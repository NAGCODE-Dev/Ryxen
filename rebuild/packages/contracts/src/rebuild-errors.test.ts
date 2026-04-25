import { describe, expect, it } from "vitest";
import { getAthleteErrorMessage, getCoachErrorMessage } from "./rebuild-errors";

describe("rebuild error helpers", () => {
  it("keeps coach error messages stable", () => {
    expect(getCoachErrorMessage("request")).toBe("Nao foi possivel completar a solicitacao.");
    expect(getCoachErrorMessage("bootstrap")).toBe("Nao foi possivel carregar o portal.");
    expect(getCoachErrorMessage("publish_workout")).toBe("Nao foi possivel publicar o treino.");
  });

  it("keeps athlete error messages stable", () => {
    expect(getAthleteErrorMessage("request")).toBe("Nao foi possivel completar a requisicao.");
    expect(getAthleteErrorMessage("bootstrap")).toBe("Nao foi possivel carregar o app do atleta.");
    expect(getAthleteErrorMessage("submit_result")).toBe("Nao foi possivel registrar o resultado.");
  });
});
