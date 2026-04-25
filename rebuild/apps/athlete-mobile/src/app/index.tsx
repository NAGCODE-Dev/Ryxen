import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAthleteErrorMessage,
  getAthleteWorkoutStatus,
  getAthleteSuccessMessage,
  getRebuildLoopNextStep,
  rebuildFeedbackTitles,
  rebuildLoopStatusLabels,
} from "@ryxen/contracts";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_RYXEN_API_URL || "http://localhost:8787";
const SESSION_STORAGE_KEY = "ryxen-rebuild-athlete-session";
const RESULT_DRAFT_STORAGE_KEY_PREFIX = "ryxen-rebuild-athlete-result-draft";
const PENDING_RESULT_STORAGE_KEY_PREFIX = "ryxen-rebuild-athlete-pending-result";

type SessionState = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type TodayWorkout = {
  id: string;
  title: string;
  description?: string | null;
  scheduledDate: string;
  gymName?: string | null;
  resultCount: number;
  payload?: {
    lines?: string[];
  };
};

type WorkoutHistoryItem = {
  workoutId: string;
  workoutTitle: string;
  gymName?: string | null;
  scheduledDate?: string;
  summary: string;
  score?: string;
  notes?: string;
  completedAt: string;
};

type AthleteOnboardingSnapshot = {
  entitlements?: {
    entitlements: string[];
    gymAccess?: Array<{
      gymId: number;
      gymName?: string | null;
      role: string;
      status: string;
      canAthletesUseApp: boolean;
      accessTier: string;
      warning?: string | null;
    }>;
  } | null;
  gyms?: Array<{
    gymId: number;
    gymName?: string | null;
    role: string;
    status: string;
    canAthletesUseApp: boolean;
    accessTier: string;
    warning?: string | null;
  }>;
  primaryGym: {
    gymId: number;
    gymName?: string | null;
    role: string;
    status: string;
    canAthletesUseApp: boolean;
    warning?: string | null;
    accessTier: string;
  } | null;
  canReceiveWorkout: boolean;
  nextStep: string;
};

type AthleteWorkoutState = {
  label: string;
  title: string;
  description: string;
  accentBorderColor: string;
};

type ResultDraftState = {
  source: "manual" | "reused";
  workoutTitle?: string;
};

type PersistedResultDraft = {
  form: {
    summary: string;
    score: string;
    notes: string;
  };
  draftState: ResultDraftState;
};

type PendingResultSubmission = {
  workoutId: string;
  workoutTitle: string;
  summary: string;
  score: string;
  notes: string;
  savedAt: string;
};

function getResultDraftStorageKey(userId: string, workoutId: string) {
  return `${RESULT_DRAFT_STORAGE_KEY_PREFIX}:${userId}:${workoutId}`;
}

function getPendingResultStorageKey(userId: string, workoutId: string) {
  return `${PENDING_RESULT_STORAGE_KEY_PREFIX}:${userId}:${workoutId}`;
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || getAthleteErrorMessage("request"));
  }

  return data as T;
}

export default function AthleteHomeScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset-request" | "reset-confirm">("signin");
  const [session, setSession] = useState<SessionState | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    summary: string;
    score?: string;
    notes?: string;
  } | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryItem[]>([]);
  const [onboarding, setOnboarding] = useState<AthleteOnboardingSnapshot | null>(null);
  const [snapshotState, setSnapshotState] = useState({
    importedPlan: false,
    appState: false,
    measurements: 0,
  });
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    code: "",
  });
  const [resultForm, setResultForm] = useState({
    summary: "Treino concluido",
    score: "",
    notes: "",
  });
  const [resultDraftState, setResultDraftState] = useState<ResultDraftState>({
    source: "manual",
  });
  const [pendingResultSubmission, setPendingResultSubmission] = useState<PendingResultSubmission | null>(null);
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      try {
        setSession(JSON.parse(raw) as SessionState);
      } catch {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      }
    })();
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    void refreshAthleteBootstrap(session.token);
  }, [session?.token]);

  useEffect(() => {
    if (!session?.user.id || !todayWorkout?.id || submittedResult) {
      setHydratedDraftKey(null);
      return;
    }

    const storageKey = getResultDraftStorageKey(session.user.id, todayWorkout.id);

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) {
          setHydratedDraftKey(storageKey);
          return;
        }

        const persistedDraft = JSON.parse(raw) as PersistedResultDraft;
        setResultForm({
          summary: persistedDraft.form.summary || "Treino concluido",
          score: persistedDraft.form.score || "",
          notes: persistedDraft.form.notes || "",
        });
        setResultDraftState(
          persistedDraft.draftState?.source === "reused"
            ? persistedDraft.draftState.workoutTitle
              ? {
                  source: "reused",
                  workoutTitle: persistedDraft.draftState.workoutTitle,
                }
              : { source: "reused" }
            : { source: "manual" },
        );
      } catch {
        await AsyncStorage.removeItem(storageKey);
      } finally {
        setHydratedDraftKey(storageKey);
      }
    })();
  }, [session?.user.id, todayWorkout?.id, submittedResult]);

  useEffect(() => {
    if (!session?.user.id || !todayWorkout?.id || submittedResult) {
      setPendingResultSubmission(null);
      return;
    }

    const storageKey = getPendingResultStorageKey(session.user.id, todayWorkout.id);

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) {
          setPendingResultSubmission(null);
          return;
        }

        const pendingSubmission = JSON.parse(raw) as PendingResultSubmission;
        setPendingResultSubmission(pendingSubmission);
      } catch {
        await AsyncStorage.removeItem(storageKey);
        setPendingResultSubmission(null);
      }
    })();
  }, [session?.user.id, submittedResult, todayWorkout?.id]);

  useEffect(() => {
    if (!session?.user.id || !todayWorkout?.id || submittedResult) return;

    const storageKey = getResultDraftStorageKey(session.user.id, todayWorkout.id);
    if (hydratedDraftKey !== storageKey) return;

    const payload: PersistedResultDraft = {
      form: resultForm,
      draftState: resultDraftState,
    };

    void AsyncStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    hydratedDraftKey,
    resultDraftState,
    resultForm,
    session?.user.id,
    submittedResult,
    todayWorkout?.id,
  ]);

  async function persistSession(next: SessionState | null) {
    setSession(next);
    if (next) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  async function refreshAthleteBootstrap(token: string) {
    try {
      setLoading(true);
      setError("");
      const [onboardingSnapshot, today, importedPlan, appState, measurements, workoutResults] = await Promise.all([
        apiRequest<{ snapshot: AthleteOnboardingSnapshot }>("/athletes/me/onboarding", { method: "GET" }, token),
        apiRequest<{ todayWorkout: TodayWorkout | null; submittedResult: { summary: string; score?: string; notes?: string } | null }>(
          "/athletes/me/today-workout?sportType=cross",
          { method: "GET" },
          token,
        ),
        apiRequest<{ importedPlan: unknown | null }>("/athletes/me/imported-plan", { method: "GET" }, token),
        apiRequest<{ appState: unknown | null }>("/athletes/me/app-state?sportType=cross", { method: "GET" }, token),
        apiRequest<{ measurements: unknown[] }>("/athletes/me/measurements/history", { method: "GET" }, token),
        apiRequest<{ results: WorkoutHistoryItem[] }>("/athletes/me/workout-results", { method: "GET" }, token),
      ]);

      setOnboarding(onboardingSnapshot.snapshot);
      setTodayWorkout(today.todayWorkout);
      setSubmittedResult(today.submittedResult);
      setWorkoutHistory(workoutResults.results || []);
      setLastSyncAt(new Date().toISOString());
      setSnapshotState({
        importedPlan: !!importedPlan.importedPlan,
        appState: !!appState.appState,
        measurements: Array.isArray(measurements.measurements) ? measurements.measurements.length : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("bootstrap"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<SessionState>(
        "/auth/signin",
        {
          method: "POST",
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password,
          }),
        },
      );
      await persistSession(response);
      setMessage(getAthleteSuccessMessage("signin"));
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("signin"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupRequest() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ previewCode?: string; message: string }>(
        "/auth/signup",
        {
          method: "POST",
          body: JSON.stringify({
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
          }),
        },
      );
      setMode("signup");
      setMessage(
        response.previewCode
          ? `Codigo gerado: ${response.previewCode}. Confirme o cadastro para abrir o app.`
          : response.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("signup_request"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupConfirm() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<SessionState>(
        "/auth/signup/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            email: authForm.email,
            code: authForm.code,
          }),
        },
      );
      await persistSession(response);
      setMessage(getAthleteSuccessMessage("signup_confirm"));
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("signup_confirm"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordResetRequest() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ previewCode?: string; message: string }>(
        "/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({
            email: authForm.email,
          }),
        },
      );
      setMode("reset-confirm");
      setMessage(
        response.previewCode
          ? `Codigo de recuperacao: ${response.previewCode}. Agora defina a nova senha no app.`
          : response.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("password_reset_request"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordResetConfirm() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ success: true }>(
        "/auth/password-reset/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            email: authForm.email,
            code: authForm.code,
            password: authForm.password,
          }),
        },
      );
      if (response.success) {
        setMode("signin");
        setAuthForm((current) => ({ ...current, code: "" }));
        setMessage(getAthleteSuccessMessage("password_reset_confirm"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("password_reset_confirm"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitResult() {
    if (!session?.token || !todayWorkout) return;

    const payload = {
      workoutId: todayWorkout.id,
      summary: resultForm.summary,
      score: resultForm.score,
      notes: resultForm.notes,
    };

    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ submittedResult: { summary: string; score?: string; notes?: string } }>(
        "/athletes/me/workout-result",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        session.token,
      );
      setSubmittedResult(response.submittedResult);
      setResultDraftState({ source: "manual" });
      await AsyncStorage.removeItem(getResultDraftStorageKey(session.user.id, todayWorkout.id));
      await AsyncStorage.removeItem(getPendingResultStorageKey(session.user.id, todayWorkout.id));
      setPendingResultSubmission(null);
      setMessage(getAthleteSuccessMessage("submit_result"));
      await refreshAthleteBootstrap(session.token);
    } catch (err) {
      const pendingSubmission: PendingResultSubmission = {
        workoutId: todayWorkout.id,
        workoutTitle: todayWorkout.title,
        summary: payload.summary,
        score: payload.score || "",
        notes: payload.notes || "",
        savedAt: new Date().toISOString(),
      };
      setPendingResultSubmission(pendingSubmission);
      await AsyncStorage.setItem(
        getPendingResultStorageKey(session.user.id, todayWorkout.id),
        JSON.stringify(pendingSubmission),
      );
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("submit_result"));
      setMessage("Nao deu para enviar agora. O retorno ficou salvo no aparelho para reenvio.");
    } finally {
      setLoading(false);
    }
  }

  async function retryPendingResultSubmission() {
    if (!session?.token || !todayWorkout || !pendingResultSubmission) return;

    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ submittedResult: { summary: string; score?: string; notes?: string } }>(
        "/athletes/me/workout-result",
        {
          method: "POST",
          body: JSON.stringify({
            workoutId: pendingResultSubmission.workoutId,
            summary: pendingResultSubmission.summary,
            score: pendingResultSubmission.score,
            notes: pendingResultSubmission.notes,
          }),
        },
        session.token,
      );
      setSubmittedResult(response.submittedResult);
      setPendingResultSubmission(null);
      setResultDraftState({ source: "manual" });
      await AsyncStorage.removeItem(getPendingResultStorageKey(session.user.id, todayWorkout.id));
      await AsyncStorage.removeItem(getResultDraftStorageKey(session.user.id, todayWorkout.id));
      setMessage("Retorno pendente reenviado com sucesso.");
      await refreshAthleteBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getAthleteErrorMessage("submit_result"));
    } finally {
      setLoading(false);
    }
  }

  async function handleManualRefresh() {
    if (!session?.token) return;

    try {
      await refreshAthleteBootstrap(session.token);
      setMessage(getAthleteSuccessMessage("refresh"));
    } catch {
      // refreshAthleteBootstrap already updates UI error state
    }
  }

  function reuseLatestCompletedWorkout() {
    if (!latestCompletedWorkout) return;

    setResultForm({
      summary: latestCompletedWorkout.summary || "Treino concluido",
      score: latestCompletedWorkout.score || "",
      notes: latestCompletedWorkout.notes || "",
    });
    setResultDraftState({
      source: "reused",
      workoutTitle: latestCompletedWorkout.workoutTitle,
    });
    setMessage("Ultimo retorno carregado como base para ajuste rapido.");
  }

  function clearResultDraft() {
    setResultForm({
      summary: "Treino concluido",
      score: "",
      notes: "",
    });
    setResultDraftState({ source: "manual" });
    setMessage("Rascunho limpo para um novo retorno.");
  }

  function getWorkoutState(): AthleteWorkoutState {
    const status = getAthleteWorkoutStatus({
      hasTodayWorkout: !!todayWorkout,
      hasSubmittedResult: !!submittedResult,
      canReceiveWorkout: !!onboarding?.canReceiveWorkout,
    });

    if (todayWorkout && submittedResult) {
      return {
        label: rebuildLoopStatusLabels[status],
        title: "Seu retorno ja foi enviado",
        description: getRebuildLoopNextStep("athlete", status),
        accentBorderColor: "rgba(113,211,154,0.28)",
      };
    }

    if (todayWorkout) {
      return {
        label: rebuildLoopStatusLabels[status],
        title: "Existe treino aguardando retorno",
        description: getRebuildLoopNextStep("athlete", status),
        accentBorderColor: "rgba(255,204,115,0.24)",
      };
    }

    return {
      label: rebuildLoopStatusLabels[status],
      title: onboarding?.canReceiveWorkout
        ? "Esperando o proximo publish"
        : "Finalize o vinculo com o gym",
      description:
        status === "awaiting_setup" && onboarding?.nextStep
          ? onboarding.nextStep
          : getRebuildLoopNextStep("athlete", status),
      accentBorderColor: "rgba(202,215,235,0.12)",
    };
  }

  const workoutState = getWorkoutState();
  const latestCompletedWorkout =
    submittedResult && todayWorkout
      ? {
          workoutTitle: todayWorkout.title,
          gymName: todayWorkout.gymName,
          scheduledDate: todayWorkout.scheduledDate,
          summary: submittedResult.summary,
          score: submittedResult.score,
          notes: submittedResult.notes,
        }
      : workoutHistory[0] || null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Athlete Rebuild</Text>
          <Text style={styles.title}>Today funcional, sessao real e retorno para o coach.</Text>
          <Text style={styles.lead}>
            O app do atleta agora abre com o menor conjunto que sustenta o loop vivo:
            autenticacao, bootstrap, treino do dia e registro simples de resultado.
          </Text>
          {session ? (
            <View style={styles.row}>
              <Pressable style={styles.buttonSecondary} onPress={() => void handleManualRefresh()}>
                <Text style={styles.buttonText}>{loading ? "Atualizando..." : "Atualizar app"}</Text>
              </Pressable>
            </View>
          ) : null}
          {session && lastSyncAt ? (
            <Text style={styles.metricDescription}>
              Ultima atualizacao: {new Date(lastSyncAt).toLocaleString("pt-BR")}
            </Text>
          ) : null}
        </View>

        {!session ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Pressable style={mode === "signin" ? styles.buttonPrimary : styles.buttonSecondary} onPress={() => setMode("signin")}>
                <Text style={styles.buttonText}>Entrar</Text>
              </Pressable>
              <Pressable style={mode === "signup" ? styles.buttonPrimary : styles.buttonSecondary} onPress={() => setMode("signup")}>
                <Text style={styles.buttonText}>Criar conta</Text>
              </Pressable>
              <Pressable
                style={mode === "reset-request" || mode === "reset-confirm" ? styles.buttonPrimary : styles.buttonSecondary}
                onPress={() => setMode("reset-request")}
              >
                <Text style={styles.buttonText}>Recuperar senha</Text>
              </Pressable>
            </View>

            {mode === "signup" ? (
              <TextInput
                style={styles.input}
                placeholder="Seu nome"
                placeholderTextColor="#94a3b8"
                value={authForm.name}
                onChangeText={(value) => setAuthForm((current) => ({ ...current, name: value }))}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              value={authForm.email}
              onChangeText={(value) => setAuthForm((current) => ({ ...current, email: value }))}
            />
            {mode !== "reset-request" ? (
              <TextInput
                style={styles.input}
                placeholder={mode === "reset-confirm" ? "Nova senha" : "Senha"}
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={authForm.password}
                onChangeText={(value) => setAuthForm((current) => ({ ...current, password: value }))}
              />
            ) : null}
            {mode === "signup" || mode === "reset-confirm" ? (
              <TextInput
                style={styles.input}
                placeholder={mode === "signup" ? "Codigo de verificacao" : "Codigo de recuperacao"}
                placeholderTextColor="#94a3b8"
                value={authForm.code}
                onChangeText={(value) => setAuthForm((current) => ({ ...current, code: value }))}
              />
            ) : null}

            {mode === "signin" ? (
              <Pressable style={styles.buttonPrimary} onPress={() => void handleSignIn()}>
                <Text style={styles.buttonText}>{loading ? "Entrando..." : "Entrar no app"}</Text>
              </Pressable>
            ) : mode === "reset-request" ? (
              <Pressable style={styles.buttonSecondary} onPress={() => void handlePasswordResetRequest()}>
                <Text style={styles.buttonText}>{loading ? "Gerando..." : "Enviar codigo de recuperacao"}</Text>
              </Pressable>
            ) : mode === "reset-confirm" ? (
              <Pressable style={styles.buttonPrimary} onPress={() => void handlePasswordResetConfirm()}>
                <Text style={styles.buttonText}>{loading ? "Redefinindo..." : "Redefinir senha"}</Text>
              </Pressable>
            ) : (
              <View style={styles.row}>
                <Pressable style={styles.buttonSecondary} onPress={() => void handleSignupRequest()}>
                  <Text style={styles.buttonText}>{loading ? "Gerando..." : "Gerar codigo"}</Text>
                </Pressable>
                <Pressable style={styles.buttonPrimary} onPress={() => void handleSignupConfirm()}>
                  <Text style={styles.buttonText}>{loading ? "Confirmando..." : "Confirmar"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {session ? (
          <>
            <View style={styles.metricsGrid}>
              <View style={styles.card}>
                <Text style={styles.metricLabel}>Sessao</Text>
                <Text style={styles.metricValue}>{session.user.name || session.user.email}</Text>
                <Text style={styles.metricDescription}>Bootstrap real do atleta ja em andamento.</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.metricLabel}>Snapshots</Text>
                <Text style={styles.metricValue}>
                  {snapshotState.importedPlan ? "Plano" : "Sem plano"} · {snapshotState.appState ? "Estado" : "Sem estado"}
                </Text>
                <Text style={styles.metricDescription}>
                  Medidas sincronizadas: {snapshotState.measurements}
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.metricLabel}>Meu acesso</Text>
                <Text style={styles.metricValue}>
                  {onboarding?.primaryGym?.accessTier || "sem acesso"}
                </Text>
                <Text style={styles.metricDescription}>
                  Gyms conectados: {onboarding?.gyms?.length || 0}
                </Text>
                <Text style={styles.metricDescription}>
                  Entitlements: {(onboarding?.entitlements?.entitlements || []).join(", ") || "nenhum ainda"}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { borderColor: workoutState.accentBorderColor }]}>
              <Text style={styles.metricLabel}>Status do treino</Text>
              <Text style={styles.sectionTitle}>{workoutState.title}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{workoutState.label}</Text>
              </View>
              <Text style={styles.metricDescription}>{workoutState.description}</Text>
              {workoutState.label === "Em dia" && latestCompletedWorkout ? (
                <View style={styles.resultBox}>
                  <Text style={styles.resultTitle}>Ultimo treino respondido</Text>
                  <Text style={styles.metricDescription}>
                    {latestCompletedWorkout.workoutTitle}
                    {latestCompletedWorkout.gymName ? ` · ${latestCompletedWorkout.gymName}` : ""}
                    {latestCompletedWorkout.scheduledDate ? ` · ${latestCompletedWorkout.scheduledDate}` : ""}
                  </Text>
                  <Text style={[styles.metricDescription, { marginTop: 6, color: "#eef2f8" }]}>
                    {latestCompletedWorkout.summary}
                  </Text>
                  {latestCompletedWorkout.score ? (
                    <Text style={styles.metricDescription}>Score: {latestCompletedWorkout.score}</Text>
                  ) : null}
                  {latestCompletedWorkout.notes ? (
                    <Text style={styles.metricDescription}>{latestCompletedWorkout.notes}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.metricLabel}>Onboarding</Text>
              <Text style={styles.sectionTitle}>
                {onboarding?.primaryGym?.gymName || "Aguardando vinculo com gym"}
              </Text>
              <Text style={styles.metricDescription}>
                {onboarding?.nextStep ||
                  "Assim que seu convite estiver anexado a um gym, o app passa a receber treino no Today."}
              </Text>
              {onboarding?.primaryGym ? (
                <View style={styles.statusBox}>
                  <Text style={styles.metricDescription}>
                    Papel: {onboarding.primaryGym.role} · Status: {onboarding.primaryGym.status}
                  </Text>
                  <Text style={styles.metricDescription}>
                    Pronto para receber treino: {onboarding.canReceiveWorkout ? "sim" : "ainda nao"}
                  </Text>
                  {onboarding.primaryGym.warning ? (
                    <Text style={styles.metricDescription}>{onboarding.primaryGym.warning}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.metricLabel}>Today</Text>
              {todayWorkout ? (
                <>
                  <Text style={styles.sectionTitle}>{todayWorkout.title}</Text>
                  <Text style={styles.metricDescription}>
                    {todayWorkout.gymName || "Gym"} · {todayWorkout.scheduledDate}
                  </Text>
                  <Text style={[styles.metricDescription, { marginTop: 10 }]}>
                    {todayWorkout.description || "Treino recebido do coach."}
                  </Text>
                  <View style={{ marginTop: 14, gap: 8 }}>
                    {(todayWorkout.payload?.lines || []).map((line) => (
                      <View key={line} style={styles.linePill}>
                        <Text style={styles.linePillText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Aguardando primeiro treino</Text>
                  <Text style={styles.metricDescription}>
                    O app ja esta pronto para consumir o publish flow assim que o coach soltar o treino.
                  </Text>
                </>
              )}
            </View>

            {todayWorkout ? (
              <View style={styles.card}>
                <Text style={styles.metricLabel}>Registrar resultado</Text>
                {latestCompletedWorkout || resultDraftState.source === "reused" ? (
                  <View style={styles.row}>
                    {latestCompletedWorkout ? (
                      <Pressable style={styles.buttonSecondary} onPress={() => reuseLatestCompletedWorkout()}>
                        <Text style={styles.buttonText}>Usar ultimo retorno como base</Text>
                      </Pressable>
                    ) : null}
                    {resultDraftState.source === "reused" ? (
                      <Pressable style={styles.buttonSecondary} onPress={() => clearResultDraft()}>
                        <Text style={styles.buttonText}>Limpar rascunho</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {resultDraftState.source === "reused" ? (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>Rascunho reaproveitado</Text>
                    <Text style={styles.metricDescription}>
                      Base carregada do ultimo retorno
                      {resultDraftState.workoutTitle ? `: ${resultDraftState.workoutTitle}.` : "."}
                    </Text>
                    <Text style={styles.metricDescription}>
                      Ajuste os campos abaixo e envie quando estiver pronto.
                    </Text>
                  </View>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder="Resumo do treino"
                  placeholderTextColor="#94a3b8"
                  value={resultForm.summary}
                  onChangeText={(value) => setResultForm((current) => ({ ...current, summary: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Score opcional"
                  placeholderTextColor="#94a3b8"
                  value={resultForm.score}
                  onChangeText={(value) => setResultForm((current) => ({ ...current, score: value }))}
                />
                <TextInput
                  multiline
                  style={[styles.input, styles.textarea]}
                  placeholder="Notas curtas"
                  placeholderTextColor="#94a3b8"
                  value={resultForm.notes}
                  onChangeText={(value) => setResultForm((current) => ({ ...current, notes: value }))}
                />
                <Pressable style={styles.buttonPrimary} onPress={() => void handleSubmitResult()}>
                  <Text style={styles.buttonText}>{loading ? "Enviando..." : "Registrar retorno"}</Text>
                </Pressable>

                {pendingResultSubmission ? (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>Retorno pendente de envio</Text>
                    <Text style={styles.metricDescription}>
                      {pendingResultSubmission.workoutTitle} · salvo em{" "}
                      {new Date(pendingResultSubmission.savedAt).toLocaleString("pt-BR")}
                    </Text>
                    <Text style={[styles.metricDescription, { marginTop: 6, color: "#eef2f8" }]}>
                      {pendingResultSubmission.summary}
                    </Text>
                    {pendingResultSubmission.score ? (
                      <Text style={styles.metricDescription}>Score: {pendingResultSubmission.score}</Text>
                    ) : null}
                    {pendingResultSubmission.notes ? (
                      <Text style={styles.metricDescription}>{pendingResultSubmission.notes}</Text>
                    ) : null}
                    <Pressable style={styles.buttonSecondary} onPress={() => void retryPendingResultSubmission()}>
                      <Text style={styles.buttonText}>{loading ? "Reenviando..." : "Reenviar retorno"}</Text>
                    </Pressable>
                  </View>
                ) : null}

                {submittedResult ? (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>Ultimo retorno enviado</Text>
                    <Text style={styles.metricDescription}>{submittedResult.summary}</Text>
                    {submittedResult.score ? <Text style={styles.metricDescription}>Score: {submittedResult.score}</Text> : null}
                    {submittedResult.notes ? <Text style={styles.metricDescription}>{submittedResult.notes}</Text> : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.metricLabel}>Historico de retornos</Text>
              {workoutHistory.length ? (
                <View style={styles.historyList}>
                  {workoutHistory.map((item) => (
                    <View key={`${item.workoutId}-${item.completedAt}`} style={styles.historyItem}>
                      <Text style={styles.resultTitle}>{item.workoutTitle}</Text>
                      <Text style={styles.metricDescription}>
                        {(item.gymName || "Gym") +
                          (item.scheduledDate ? ` · ${item.scheduledDate}` : "")}
                      </Text>
                      <Text style={[styles.metricDescription, { marginTop: 8, color: "#eef2f8" }]}>
                        {item.summary}
                      </Text>
                      {item.score ? <Text style={styles.metricDescription}>Score: {item.score}</Text> : null}
                      {item.notes ? <Text style={styles.metricDescription}>{item.notes}</Text> : null}
                      <Text style={styles.historyTimestamp}>
                        Enviado em {new Date(item.completedAt).toLocaleString("pt-BR")}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.metricDescription}>
                  Seus resultados vao aparecer aqui assim que voce registrar os primeiros retornos.
                </Text>
              )}
            </View>

            <Pressable
              style={styles.buttonSecondary}
              onPress={() => {
                void persistSession(null);
                if (session?.user.id && todayWorkout?.id) {
                  void AsyncStorage.removeItem(getResultDraftStorageKey(session.user.id, todayWorkout.id));
                  void AsyncStorage.removeItem(getPendingResultStorageKey(session.user.id, todayWorkout.id));
                }
                setOnboarding(null);
                setTodayWorkout(null);
                setSubmittedResult(null);
                setWorkoutHistory([]);
                setLastSyncAt(null);
                setSnapshotState({ importedPlan: false, appState: false, measurements: 0 });
                setHydratedDraftKey(null);
                setPendingResultSubmission(null);
                setResultForm({ summary: "Treino concluido", score: "", notes: "" });
                setResultDraftState({ source: "manual" });
                setMessage("Sessao removida localmente.");
              }}
            >
              <Text style={styles.buttonText}>Sair</Text>
            </Pressable>
          </>
        ) : null}

        {message ? (
          <View style={[styles.card, styles.successCard]}>
            <Text style={styles.resultTitle}>{rebuildFeedbackTitles.success}</Text>
            <Text style={styles.metricDescription}>{message}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.resultTitle}>{rebuildFeedbackTitles.error}</Text>
            <Text style={styles.metricDescription}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#080d13",
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    gap: 10,
    paddingVertical: 8,
  },
  eyebrow: {
    color: "#bfd6ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#f5f7fb",
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 36,
    letterSpacing: -1.5,
  },
  lead: {
    color: "#c7d2e2c2",
    lineHeight: 22,
  },
  metricsGrid: {
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
    borderRadius: 22,
    backgroundColor: "#111821",
    padding: 18,
    gap: 12,
  },
  successCard: {
    borderColor: "rgba(113,211,154,0.28)",
  },
  errorCard: {
    borderColor: "rgba(241,142,150,0.28)",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.16)",
    backgroundColor: "rgba(255,255,255,0.035)",
    color: "#f5f7fb",
    paddingHorizontal: 14,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: "top",
    paddingVertical: 14,
  },
  buttonPrimary: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4b8dff",
    borderWidth: 1,
    borderColor: "rgba(115,167,255,0.42)",
  },
  buttonSecondary: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
  },
  buttonText: {
    color: "#f5f7fb",
    fontWeight: "800",
  },
  metricLabel: {
    color: "#bfd6ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#f5f7fb",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  metricDescription: {
    color: "#c7d2e2c2",
    lineHeight: 21,
  },
  sectionTitle: {
    color: "#f5f7fb",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  linePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linePillText: {
    color: "#eef2f8",
  },
  resultBox: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
    backgroundColor: "rgba(255,255,255,0.025)",
    padding: 14,
    gap: 4,
  },
  statusBox: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
    backgroundColor: "rgba(255,255,255,0.025)",
    padding: 14,
    gap: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  statusBadgeText: {
    color: "#f5f7fb",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(202,215,235,0.12)",
    backgroundColor: "rgba(255,255,255,0.025)",
    padding: 14,
    gap: 4,
  },
  historyTimestamp: {
    color: "#94a3b8",
    lineHeight: 20,
    marginTop: 4,
  },
  resultTitle: {
    color: "#f5f7fb",
    fontSize: 16,
    fontWeight: "800",
  },
});
