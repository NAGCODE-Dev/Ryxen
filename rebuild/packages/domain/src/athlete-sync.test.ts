import { describe, expect, it } from "vitest";
import { shouldSyncSnapshot } from "./athlete-sync";

describe("athlete sync", () => {
  it("syncs when there is no previous snapshot", () => {
    expect(shouldSyncSnapshot(null, "2026-04-25T10:00:00.000Z")).toBe(true);
  });

  it("syncs when the next snapshot is newer", () => {
    expect(
      shouldSyncSnapshot("2026-04-25T10:00:00.000Z", "2026-04-25T10:00:01.000Z"),
    ).toBe(true);
  });

  it("does not sync when the next snapshot is older", () => {
    expect(
      shouldSyncSnapshot("2026-04-25T10:00:01.000Z", "2026-04-25T10:00:00.000Z"),
    ).toBe(false);
  });
});
