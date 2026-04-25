import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, ReactTestInstance } from "react-test-renderer";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-native", () => {
  const React = require("react");

  const createPrimitive =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(name, props, children);

  return {
    Pressable: createPrimitive("Pressable"),
    SafeAreaView: createPrimitive("SafeAreaView"),
    ScrollView: createPrimitive("ScrollView"),
    Text: createPrimitive("Text"),
    TextInput: createPrimitive("TextInput"),
    View: createPrimitive("View"),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
  };
});

function collectText(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (!node || typeof node !== "object") return [];

  const current = node as { children?: unknown[] };
  return (current.children || []).flatMap((child) => collectText(child));
}

function collectInstanceText(node: ReactTestInstance | string): string[] {
  if (typeof node === "string") return [node];

  return node.children.flatMap((child) =>
    typeof child === "string" ? [child] : collectInstanceText(child),
  );
}

function findPressableByLabel(root: ReactTestInstance, label: string) {
  return root
    .findAll((node) => String(node.type) === "Pressable")
    .find((node) => collectInstanceText(node).join(" ").includes(label));
}

describe("athlete mobile home", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    const asyncStorage = await import("@react-native-async-storage/async-storage");
    vi.mocked(asyncStorage.default.getItem).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders auth-first athlete app when there is no local session", async () => {
    const { default: AthleteHomeScreen } = await import("../app/index");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<AthleteHomeScreen />);
    });

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Athlete Rebuild");
    expect(text).toContain("Entrar");
    expect(text).toContain("Criar conta");
  });

  it("renders onboarding and today workout after restoring the athlete session", async () => {
    const asyncStorage = await import("@react-native-async-storage/async-storage");
    vi.mocked(asyncStorage.default.getItem).mockImplementation(async (key: string) => {
      if (key === "ryxen-rebuild-athlete-session") {
        return JSON.stringify({
          token: "token",
          user: {
            id: "22",
            email: "athlete@ryxen.app",
            name: "Athlete",
          },
        });
      }

      return null;
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshot: {
            primaryGym: {
              gymId: 7,
              gymName: "Ryxen Gym",
              role: "athlete",
              status: "active",
              canAthletesUseApp: true,
              warning: null,
              accessTier: "active",
            },
            canReceiveWorkout: true,
            nextStep: "O treino aparecera no Today.",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          todayWorkout: {
            id: "44",
            title: "Friday Engine",
            description: "Intervals and cooldown",
            scheduledDate: "2026-04-25",
            gymName: "Ryxen Gym",
            resultCount: 0,
            payload: { lines: ["Warm-up", "EMOM 12"] },
          },
          submittedResult: null,
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ importedPlan: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appState: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ measurements: [] }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              workoutId: "43",
              workoutTitle: "Thursday Builder",
              gymName: "Ryxen Gym",
              scheduledDate: "2026-04-24",
              summary: "Base anterior",
              score: "10 rounds",
              notes: "Ritmo constante",
              completedAt: "2026-04-24T12:00:00.000Z",
            },
          ],
        }),
      } as Response);

    const { default: AthleteHomeScreen } = await import("../app/index");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<AthleteHomeScreen />);
    });

    const reuseButton = findPressableByLabel(tree!.root, "Usar ultimo retorno como base");

    await act(async () => {
      reuseButton?.props.onPress();
      await Promise.resolve();
    });

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Ryxen Gym");
    expect(text).toContain("Status do treino");
    expect(text).toContain("Existe treino aguardando retorno");
    expect(text).toContain("Pede acao");
    expect(text).toContain("Agora falta registrar como foi a sessao.");
    expect(text).toContain("Friday Engine");
    expect(text).toContain("Registrar retorno");
    expect(text).toContain("Usar ultimo retorno como base");
    expect(text).toContain("Rascunho reaproveitado");
    expect(text).toContain("Base carregada do ultimo retorno");
    expect(text).toContain("Thursday Builder");
    expect(text).toContain("Limpar rascunho");
  });

  it("highlights the latest completed workout when the athlete is already up to date", async () => {
    const asyncStorage = await import("@react-native-async-storage/async-storage");
    vi.mocked(asyncStorage.default.getItem).mockImplementation(async (key: string) => {
      if (key === "ryxen-rebuild-athlete-session") {
        return JSON.stringify({
          token: "token",
          user: {
            id: "22",
            email: "athlete@ryxen.app",
            name: "Athlete",
          },
        });
      }

      return null;
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshot: {
            primaryGym: {
              gymId: 7,
              gymName: "Ryxen Gym",
              role: "athlete",
              status: "active",
              canAthletesUseApp: true,
              warning: null,
              accessTier: "active",
            },
            canReceiveWorkout: true,
            nextStep: "Voce esta pronto para o proximo treino.",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          todayWorkout: {
            id: "44",
            title: "Friday Engine",
            description: "Intervals and cooldown",
            scheduledDate: "2026-04-25",
            gymName: "Ryxen Gym",
            resultCount: 1,
            payload: { lines: ["Warm-up", "EMOM 12"] },
          },
          submittedResult: {
            summary: "Fechei bem o treino",
            score: "12 rounds",
            notes: "Mantive ritmo constante",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ importedPlan: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appState: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ measurements: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response);

    const { default: AthleteHomeScreen } = await import("../app/index");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<AthleteHomeScreen />);
    });

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Seu retorno ja foi enviado");
    expect(text).toContain("Em dia");
    expect(text).toContain("coach ja consegue acompanhar");
    expect(text).toContain("Ultimo treino respondido");
    expect(text).toContain("Fechei bem o treino");
    expect(text).toContain("12 rounds");
  });

  it("restores a saved local draft for the current workout", async () => {
    const asyncStorage = await import("@react-native-async-storage/async-storage");
    vi.mocked(asyncStorage.default.getItem).mockImplementation(async (key: string) => {
      if (key === "ryxen-rebuild-athlete-session") {
        return JSON.stringify({
          token: "token",
          user: {
            id: "22",
            email: "athlete@ryxen.app",
            name: "Athlete",
          },
        });
      }

      if (key === "ryxen-rebuild-athlete-result-draft:22:44") {
        return JSON.stringify({
          form: {
            summary: "Rascunho salvo",
            score: "11 rounds",
            notes: "Parei entre blocos",
          },
          draftState: {
            source: "reused",
            workoutTitle: "Thursday Builder",
          },
        });
      }

      return null;
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshot: {
            primaryGym: {
              gymId: 7,
              gymName: "Ryxen Gym",
              role: "athlete",
              status: "active",
              canAthletesUseApp: true,
              warning: null,
              accessTier: "active",
            },
            canReceiveWorkout: true,
            nextStep: "O treino aparecera no Today.",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          todayWorkout: {
            id: "44",
            title: "Friday Engine",
            description: "Intervals and cooldown",
            scheduledDate: "2026-04-25",
            gymName: "Ryxen Gym",
            resultCount: 0,
            payload: { lines: ["Warm-up", "EMOM 12"] },
          },
          submittedResult: null,
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ importedPlan: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appState: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ measurements: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response);

    const { default: AthleteHomeScreen } = await import("../app/index");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<AthleteHomeScreen />);
    });

    const textInputs = tree!.root.findAll(
      (node) => String(node.type) === "TextInput",
    );
    expect(textInputs).toHaveLength(3);
    expect(textInputs[0]!.props.value).toBe("Rascunho salvo");
    expect(textInputs[1]!.props.value).toBe("11 rounds");
    expect(textInputs[2]!.props.value).toBe("Parei entre blocos");

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Rascunho reaproveitado");
    expect(text).toContain("Thursday Builder");
    expect(text).toContain("Limpar rascunho");
  });

  it("stores a pending local result when submission fails", async () => {
    const asyncStorage = await import("@react-native-async-storage/async-storage");
    vi.mocked(asyncStorage.default.getItem).mockImplementation(async (key: string) => {
      if (key === "ryxen-rebuild-athlete-session") {
        return JSON.stringify({
          token: "token",
          user: {
            id: "22",
            email: "athlete@ryxen.app",
            name: "Athlete",
          },
        });
      }

      return null;
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshot: {
            primaryGym: {
              gymId: 7,
              gymName: "Ryxen Gym",
              role: "athlete",
              status: "active",
              canAthletesUseApp: true,
              warning: null,
              accessTier: "active",
            },
            canReceiveWorkout: true,
            nextStep: "O treino aparecera no Today.",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          todayWorkout: {
            id: "44",
            title: "Friday Engine",
            description: "Intervals and cooldown",
            scheduledDate: "2026-04-25",
            gymName: "Ryxen Gym",
            resultCount: 0,
            payload: { lines: ["Warm-up", "EMOM 12"] },
          },
          submittedResult: null,
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ importedPlan: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ appState: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ measurements: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "network down" }),
      } as Response);

    const { default: AthleteHomeScreen } = await import("../app/index");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(<AthleteHomeScreen />);
    });

    const submitButton = findPressableByLabel(tree!.root, "Registrar retorno");

    await act(async () => {
      submitButton?.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = collectText(tree!.toJSON()).join(" ");
    expect(text).toContain("Retorno pendente de envio");
    expect(text).toContain("Friday Engine");
    expect(text).toContain("Reenviar retorno");
    expect(text).toContain("Nao deu para enviar agora. O retorno ficou salvo no aparelho para reenvio.");
    expect(vi.mocked(asyncStorage.default.setItem)).toHaveBeenCalledWith(
      "ryxen-rebuild-athlete-pending-result:22:44",
      expect.stringContaining("\"workoutTitle\":\"Friday Engine\""),
    );
  });
});
