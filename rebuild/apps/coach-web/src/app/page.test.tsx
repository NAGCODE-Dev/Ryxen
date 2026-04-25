import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create } from "react-test-renderer";
import CoachHomePage from "./page";

function collectText(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (!node || typeof node !== "object") return [];

  const current = node as { children?: unknown[] };
  return (current.children || []).flatMap((child) => collectText(child));
}

describe("coach web home", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    const storage = new Map<string, string>();

    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
        removeItem: vi.fn((key: string) => storage.delete(key)),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders auth-first portal when there is no local session", async () => {
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<CoachHomePage />);
    });

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Coach-First Rebuild");
    expect(text).toContain("Entrar");
    expect(text).toContain("Criar conta");
  });

  it("renders onboarding and gym data after restoring the local session", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "active", accessTier: "active", plan: "pro" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entitlements: ["coach_portal", "athlete_app"] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshot: {
            gyms: [{ id: "7", name: "Ryxen Gym", slug: "ryxen-gym", role: "owner", status: "active" }],
            primaryGym: { id: "7", name: "Ryxen Gym", slug: "ryxen-gym" },
            latestWorkout: null,
            recentWorkouts: [
              {
                id: "44",
                title: "Friday Engine",
                description: "Intervals",
                scheduledDate: "2026-04-26",
                assignedCount: 3,
                resultCount: 0,
                payload: { lines: ["Warm-up", "AMRAP 14"] },
                athleteDeliveries: [
                  {
                    membershipId: "91",
                    athleteName: "Athlete",
                    athleteEmail: "athlete@ryxen.app",
                    status: "pending",
                  },
                ],
              },
              {
                id: "45",
                title: "Sunday Reset",
                description: "Mobility",
                scheduledDate: "2026-04-27",
                assignedCount: 0,
                resultCount: 0,
                payload: { lines: ["Breathing", "Cooldown"] },
                athleteDeliveries: [],
              },
            ],
            activityFeed: [
              {
                id: "workout-44",
                type: "workout_published",
                title: "Treino publicado: Friday Engine",
                description: "O loop foi ativado para o gym. Agora vale acompanhar convites e retornos.",
                gymName: "Ryxen Gym",
                relatedWorkoutId: "44",
                occurredAt: "2026-04-25T12:00:00.000Z",
                emphasis: "neutral",
              },
              {
                id: "response-91",
                type: "athlete_responded",
                title: "Athlete respondeu ao treino",
                description: "Fechei bem o treino",
                gymName: "Ryxen Gym",
                relatedWorkoutId: "44",
                occurredAt: "2026-04-25T12:05:00.000Z",
                emphasis: "positive",
              },
            ],
            nextStep: "Publique o primeiro treino do seu gym.",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memberships: [
            {
              id: "91",
              gymId: "7",
              email: "athlete@ryxen.app",
              label: "Athlete",
              role: "athlete",
              status: "active",
            },
          ],
        }),
      } as Response);

    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({
        token: "token",
        user: {
          id: "12",
          email: "coach@ryxen.app",
          name: "Coach",
          isAdmin: false,
        },
      }),
    );

    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<CoachHomePage />);
    });

    const openWorkoutButton = tree!.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.type === "button" &&
        node.props?.children === "Abrir treino",
    )[0];

    await act(async () => {
      openWorkoutButton.props.onClick();
    });

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Ryxen Gym");
    expect(text).toContain("Publicar primeiro treino");
    expect(text).toContain("Atletas ativos prontos para receber treino");
    expect(text).toContain("Pendentes ( 1 )");
    expect(text).toContain("Aguardando setup");
    expect(text).toContain("Friday Engine");
    expect(text).toContain("Pede Atencao");
    expect(text).toContain("Aguardando retorno");
    expect(text).toContain("Agora vale cobrar o retorno dos atletas.");
    expect(text).toContain("Loop Activity");
    expect(text).toContain("Ultimo retorno para follow-up");
    expect(text).toContain("Retornos ( 1 )");
    expect(text).toContain("Memberships ( 0 )");
    expect(text).toContain("Publishes ( 1 )");
    expect(text).toContain("Athlete respondeu ao treino");
    expect(text).toContain("Fechei bem o treino");
    expect(text).toContain("Abrir treino");
    expect(text).toContain("Follow-up pendente");
    expect(text).toContain("Atletas ainda sem retorno");
    expect(text).toContain("Copiar pendentes");
  });
});
