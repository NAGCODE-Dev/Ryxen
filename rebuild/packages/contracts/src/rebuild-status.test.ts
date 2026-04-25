import { describe, expect, it } from "vitest";
import {
  getAthleteWorkoutStatus,
  getCoachWorkoutStatus,
  getRebuildLoopNextStep,
  rebuildLoopStatusLabels,
} from "./rebuild-status";

describe("rebuild status helpers", () => {
  it("maps coach workout states to shared loop statuses", () => {
    expect(getCoachWorkoutStatus({ assignedCount: 3, resultCount: 1 })).toBe("done");
    expect(getCoachWorkoutStatus({ assignedCount: 3, resultCount: 0 })).toBe("awaiting_participant");
    expect(getCoachWorkoutStatus({ assignedCount: 0, resultCount: 0 })).toBe("awaiting_setup");
  });

  it("maps athlete workout states to shared loop statuses", () => {
    expect(
      getAthleteWorkoutStatus({
        hasTodayWorkout: true,
        hasSubmittedResult: true,
        canReceiveWorkout: true,
      }),
    ).toBe("done");
    expect(
      getAthleteWorkoutStatus({
        hasTodayWorkout: true,
        hasSubmittedResult: false,
        canReceiveWorkout: true,
      }),
    ).toBe("needs_attention");
    expect(
      getAthleteWorkoutStatus({
        hasTodayWorkout: false,
        hasSubmittedResult: false,
        canReceiveWorkout: true,
      }),
    ).toBe("awaiting_participant");
    expect(
      getAthleteWorkoutStatus({
        hasTodayWorkout: false,
        hasSubmittedResult: false,
        canReceiveWorkout: false,
      }),
    ).toBe("awaiting_setup");
  });

  it("keeps shared labels stable", () => {
    expect(rebuildLoopStatusLabels.done).toBe("Em dia");
    expect(rebuildLoopStatusLabels.needs_attention).toBe("Pede acao");
    expect(rebuildLoopStatusLabels.awaiting_participant).toBe("Aguardando retorno");
    expect(rebuildLoopStatusLabels.awaiting_setup).toBe("Aguardando setup");
  });

  it("keeps shared next-step messages stable for each surface", () => {
    expect(getRebuildLoopNextStep("coach", "awaiting_participant")).toContain("cobrar o retorno");
    expect(getRebuildLoopNextStep("coach", "awaiting_setup")).toContain("Revise memberships e audiencia");
    expect(getRebuildLoopNextStep("athlete", "done")).toContain("coach ja consegue acompanhar");
    expect(getRebuildLoopNextStep("athlete", "awaiting_setup")).toContain("concluir o setup");
  });
});
