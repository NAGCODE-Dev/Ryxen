import { describe, expect, it } from "vitest";
import {
  getAthleteSuccessMessage,
  getCoachSuccessMessage,
  rebuildFeedbackTitles,
} from "./rebuild-feedback";

describe("rebuild feedback helpers", () => {
  it("keeps shared feedback titles stable", () => {
    expect(rebuildFeedbackTitles.success).toBe("Fluxo em movimento");
    expect(rebuildFeedbackTitles.error).toBe("Algo travou");
  });

  it("builds coach success messages", () => {
    expect(getCoachSuccessMessage("signin")).toContain("Sessao iniciada");
    expect(
      getCoachSuccessMessage("create_gym", {
        gymName: "Ryxen Lab",
      }),
    ).toContain('Gym "Ryxen Lab" criado');
    expect(
      getCoachSuccessMessage("publish_workout", {
        workoutTitle: "Friday Engine",
        assignedCount: 3,
      }),
    ).toContain('Treino "Friday Engine" publicado para 3 atleta(s).');
  });

  it("builds athlete success messages", () => {
    expect(getAthleteSuccessMessage("signin")).toContain("Sessao restaurada");
    expect(getAthleteSuccessMessage("submit_result")).toContain("houve retorno");
    expect(getAthleteSuccessMessage("refresh")).toContain("estado mais recente");
  });
});
