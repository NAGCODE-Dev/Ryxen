"use client";

import React, { useEffect, useState } from "react";
import {
  getCoachErrorMessage,
  getCoachWorkoutStatus,
  getCoachSuccessMessage,
  getRebuildLoopNextStep,
  rebuildFeedbackTitles,
  rebuildLoopStatusLabels,
} from "@ryxen/contracts";

const API_URL = process.env.NEXT_PUBLIC_RYXEN_API_URL || "http://localhost:8787";
const SESSION_STORAGE_KEY = "ryxen-rebuild-coach-session";

type SessionState = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    isAdmin?: boolean;
  };
};

type CoachBootstrap = {
  billingStatus: {
    status: string;
    accessTier: string;
    plan?: string | null;
  } | null;
  entitlements: {
    entitlements: string[];
  } | null;
  snapshot: {
    gyms: Array<{ id: string; name: string; slug: string; role?: string; status?: string }>;
    primaryGym: { id: string; name: string; slug: string } | null;
    latestWorkout: {
      id: string;
      title: string;
      description?: string | null;
      scheduledDate: string;
      assignedCount: number;
      resultCount: number;
      payload?: {
        lines?: string[];
      };
      recentResponses: Array<{
        athleteName: string;
        athleteEmail: string;
        summary: string;
        score?: string;
        notes?: string;
        completedAt: string;
      }>;
      athleteDeliveries: Array<{
        membershipId: string;
        athleteName: string;
        athleteEmail: string;
        status: "pending" | "responded";
        completedAt?: string | null;
        summary?: string;
        score?: string;
      }>;
    } | null;
    recentWorkouts: Array<{
      id: string;
      title: string;
      description?: string | null;
      scheduledDate: string;
      assignedCount: number;
      resultCount: number;
      payload?: {
        lines?: string[];
      };
      athleteDeliveries?: Array<{
        membershipId: string;
        athleteName: string;
        athleteEmail: string;
        status: "pending" | "responded";
        completedAt?: string | null;
        summary?: string;
        score?: string;
      }>;
    }>;
    activityFeed: Array<{
      id: string;
      type: "workout_published" | "membership_invited" | "membership_ready" | "athlete_responded";
      title: string;
      description: string;
      gymName?: string | null;
      relatedWorkoutId?: string | null;
      occurredAt: string;
      emphasis: "positive" | "neutral" | "attention";
    }>;
    nextStep: string;
  } | null;
};

type MembershipItem = {
  id?: string;
  email: string;
  label?: string;
  role: "owner" | "coach" | "athlete";
  status: string;
};

type WorkoutHistoryFilter = "all" | "responded" | "pending" | "empty";
type ActivityFeedFilter = "all" | "responses" | "memberships" | "workouts";

const shellStyle: Record<string, string | number> = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(115,167,255,0.18), transparent 28%), linear-gradient(180deg, #0d131b 0%, #080d13 100%)",
  color: "#f5f7fb",
  padding: "24px 0 56px",
};

const wrapStyle: Record<string, string | number> = {
  width: "min(1120px, calc(100vw - 24px))",
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const cardStyle: Record<string, string | number> = {
  border: "1px solid rgba(202,215,235,0.12)",
  borderRadius: 24,
  background: "linear-gradient(180deg, rgba(17,24,34,0.92), rgba(9,13,19,0.98))",
  boxShadow: "0 22px 60px rgba(2,6,12,0.22)",
  padding: 24,
};

const inputStyle: Record<string, string | number> = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid rgba(202,215,235,0.16)",
  background: "rgba(255,255,255,0.035)",
  color: "#f5f7fb",
  padding: "0 14px",
};

const textareaStyle: Record<string, string | number> = {
  ...inputStyle,
  padding: 14,
  minHeight: 110,
};

const buttonPrimary: Record<string, string | number> = {
  minHeight: 48,
  borderRadius: 16,
  border: "1px solid rgba(115,167,255,0.42)",
  background: "linear-gradient(135deg, #1f56bd, #4b8dff)",
  color: "#fff",
  fontWeight: 800,
  padding: "0 18px",
  cursor: "pointer",
};

const buttonSecondary: Record<string, string | number> = {
  ...buttonPrimary,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(202,215,235,0.12)",
};

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
    throw new Error(data?.error || getCoachErrorMessage("request"));
  }

  return data as T;
}

export default function CoachHomePage() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset-request" | "reset-confirm">("signin");
  const [session, setSession] = useState<SessionState | null>(null);
  const [bootstrap, setBootstrap] = useState<CoachBootstrap | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    code: "",
  });
  const [gymForm, setGymForm] = useState({ name: "", slug: "" });
  const [workoutForm, setWorkoutForm] = useState({
    title: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    description: "",
    workoutLines: "Warm-up\nEMOM 12\nCool down",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "athlete" as "coach" | "athlete",
  });
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [publishAudienceMode, setPublishAudienceMode] = useState<"all" | "selected">("all");
  const [selectedMembershipIds, setSelectedMembershipIds] = useState<string[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [highlightedWorkoutId, setHighlightedWorkoutId] = useState<string | null>(null);
  const [followUpWorkoutId, setFollowUpWorkoutId] = useState<string | null>(null);
  const [workoutHistoryFilter, setWorkoutHistoryFilter] = useState<WorkoutHistoryFilter>("all");
  const [activityFeedFilter, setActivityFeedFilter] = useState<ActivityFeedFilter>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as SessionState;
      setSession(stored);
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    void refreshBootstrap(session.token);
  }, [session?.token]);

  useEffect(() => {
    const validMembershipIds = new Set(
      memberships
        .filter((membership) => membership.role === "athlete" && membership.status === "active" && membership.id)
        .map((membership) => String(membership.id)),
    );

    setSelectedMembershipIds((current) => current.filter((membershipId) => validMembershipIds.has(membershipId)));
  }, [memberships]);

  async function refreshBootstrap(token: string) {
    try {
      setLoading(true);
      setError("");

      const [billingStatus, entitlements, onboarding] = await Promise.all([
        apiRequest<{ status: string; accessTier: string; plan?: string | null }>(
          "/billing/status",
          { method: "GET" },
          token,
        ),
        apiRequest<{ entitlements: string[] }>("/billing/entitlements", { method: "GET" }, token),
        apiRequest<{ snapshot: CoachBootstrap["snapshot"] }>("/coach/onboarding", { method: "GET" }, token),
      ]);

      setBootstrap({
        billingStatus,
        entitlements,
        snapshot: onboarding.snapshot,
      });
      setLastSyncAt(new Date().toISOString());

      if (onboarding.snapshot?.primaryGym?.id) {
        const membershipsResponse = await apiRequest<{ memberships: MembershipItem[] }>(
          `/gyms/${onboarding.snapshot.primaryGym.id}/memberships`,
          { method: "GET" },
          token,
        );
        setMemberships(membershipsResponse.memberships || []);
      } else {
        setMemberships([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("bootstrap"));
    } finally {
      setLoading(false);
    }
  }

  function persistSession(next: SessionState | null) {
    setSession(next);
    if (typeof window === "undefined") return;
    if (next) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  async function handleSignIn() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
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
      persistSession(response);
      setMessage(getCoachSuccessMessage("signin"));
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("signin"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupRequest() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ message: string; previewCode?: string }>(
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
          ? `Codigo gerado: ${response.previewCode}. Agora confirme o cadastro abaixo.`
          : response.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("signup_request"));
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
      persistSession(response);
      setMessage(getCoachSuccessMessage("signup_confirm"));
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("signup_confirm"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordResetRequest() {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ message: string; previewCode?: string }>(
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
          ? `Codigo de recuperacao: ${response.previewCode}. Agora defina a nova senha abaixo.`
          : response.message,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("password_reset_request"));
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
        setMessage(getCoachSuccessMessage("password_reset_confirm"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("password_reset_confirm"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGym() {
    if (!session?.token) return;
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ gym: { name: string } }>(
        "/gyms",
        {
          method: "POST",
          body: JSON.stringify(gymForm),
        },
        session.token,
      );
      setMessage(getCoachSuccessMessage("create_gym", { gymName: response.gym.name }));
      await refreshBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("create_gym"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishWorkout() {
    if (!session?.token || !bootstrap?.snapshot?.primaryGym) return;
    if (publishAudienceMode === "selected" && selectedMembershipIds.length === 0) {
      setError("Selecione pelo menos um atleta antes de publicar para audiencia selecionada.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const payload = {
        lines: workoutForm.workoutLines
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };
      const response = await apiRequest<{ workout: { title: string; assignedCount: number } }>(
        `/gyms/${bootstrap.snapshot.primaryGym.id}/workouts`,
        {
          method: "POST",
          body: JSON.stringify({
            gymId: bootstrap.snapshot.primaryGym.id,
            sportType: "cross",
            title: workoutForm.title,
            description: workoutForm.description,
            scheduledDate: workoutForm.scheduledDate,
            payload,
            audienceMode: publishAudienceMode,
            targetMembershipIds: selectedMembershipIds,
            targetGroupIds: [],
          }),
        },
        session.token,
      );
      setMessage(
        getCoachSuccessMessage("publish_workout", {
          workoutTitle: response.workout.title,
          assignedCount: response.workout.assignedCount,
        }),
      );
      await refreshBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("publish_workout"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateWorkout() {
    if (!session?.token || !bootstrap?.snapshot?.primaryGym || !editingWorkoutId) return;

    try {
      setLoading(true);
      setError("");
      const payload = {
        lines: workoutForm.workoutLines
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };
      const response = await apiRequest<{ workout: { title: string } }>(
        `/gyms/${bootstrap.snapshot.primaryGym.id}/workouts/${editingWorkoutId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            gymId: bootstrap.snapshot.primaryGym.id,
            workoutId: editingWorkoutId,
            title: workoutForm.title,
            description: workoutForm.description,
            scheduledDate: workoutForm.scheduledDate,
            payload,
          }),
        },
        session.token,
      );
      setEditingWorkoutId(null);
      setWorkoutForm({
        title: "",
        scheduledDate: new Date().toISOString().slice(0, 10),
        description: "",
        workoutLines: "Warm-up\nEMOM 12\nCool down",
      });
      setMessage(getCoachSuccessMessage("update_workout", { workoutTitle: response.workout.title }));
      await refreshBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("update_workout"));
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteMembership() {
    if (!session?.token || !bootstrap?.snapshot?.primaryGym) return;

    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<{ membership: MembershipItem }>(
        `/gyms/${bootstrap.snapshot.primaryGym.id}/memberships`,
        {
          method: "POST",
          body: JSON.stringify(inviteForm),
        },
        session.token,
      );

      setInviteForm({ email: "", role: "athlete" });
      setMessage(
        response.membership.status === "invited"
          ? `Convite enviado para ${response.membership.email}. Quando essa pessoa entrar, o gym sera anexado automaticamente.`
          : `${response.membership.email} ja entrou no gym e pode receber treino agora.`,
      );
      await refreshBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("invite_membership"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMembership(membership: MembershipItem) {
    if (!session?.token || !bootstrap?.snapshot?.primaryGym || !membership.id) return;

    try {
      setLoading(true);
      setError("");
      await apiRequest<{ success: true; deletedMembershipId: string }>(
        `/gyms/${bootstrap.snapshot.primaryGym.id}/memberships/${membership.id}`,
        {
          method: "DELETE",
        },
        session.token,
      );

      setMessage(
        membership.status === "invited"
          ? `Convite removido para ${membership.email}.`
          : `${membership.email} foi removido do gym.`,
      );
      await refreshBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("remove_membership"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveWorkout(workout: NonNullable<CoachBootstrap["snapshot"]>["recentWorkouts"][number]) {
    if (!session?.token || !bootstrap?.snapshot?.primaryGym) return;

    try {
      setLoading(true);
      setError("");
      await apiRequest<{ success: true; deletedWorkoutId: string }>(
        `/gyms/${bootstrap.snapshot.primaryGym.id}/workouts/${workout.id}`,
        {
          method: "DELETE",
        },
        session.token,
      );

      if (editingWorkoutId === workout.id) {
        cancelWorkoutEditing();
      }

      setMessage(getCoachSuccessMessage("remove_workout", { workoutTitle: workout.title }));
      await refreshBootstrap(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : getCoachErrorMessage("remove_workout"));
    } finally {
      setLoading(false);
    }
  }

  const activeAthleteMemberships = memberships.filter(
    (membership) => membership.role === "athlete" && membership.status === "active" && membership.id,
  );
  const activeAthleteCount = memberships.filter(
    (membership) => membership.role === "athlete" && membership.status === "active",
  ).length;
  const invitedAthleteCount = memberships.filter(
    (membership) => membership.role === "athlete" && membership.status === "invited",
  ).length;
  const activeCoachCount = memberships.filter(
    (membership) => (membership.role === "coach" || membership.role === "owner") && membership.status === "active",
  ).length;
  const invitedCoachCount = memberships.filter(
    (membership) => membership.role === "coach" && membership.status === "invited",
  ).length;
  const activeGymCount =
    bootstrap?.snapshot?.gyms.filter((gym) => gym.status === "active" || !gym.status).length || 0;
  const recentWorkouts = bootstrap?.snapshot?.recentWorkouts || [];
  const activityFeed = bootstrap?.snapshot?.activityFeed || [];
  const respondedWorkoutCount = recentWorkouts.filter((workout) => workout.resultCount > 0).length;
  const pendingWorkoutCount = recentWorkouts.filter(
    (workout) => workout.assignedCount > 0 && workout.resultCount === 0,
  ).length;
  const emptyWorkoutCount = recentWorkouts.filter((workout) => workout.assignedCount === 0).length;
  const responseActivityCount = activityFeed.filter((item) => item.type === "athlete_responded").length;
  const membershipActivityCount = activityFeed.filter(
    (item) => item.type === "membership_invited" || item.type === "membership_ready",
  ).length;
  const workoutActivityCount = activityFeed.filter((item) => item.type === "workout_published").length;

  function toggleMembershipSelection(membershipId: string) {
    setSelectedMembershipIds((current) =>
      current.includes(membershipId)
        ? current.filter((currentMembershipId) => currentMembershipId !== membershipId)
        : [...current, membershipId],
    );
  }

  async function handleManualRefresh() {
    if (!session?.token) return;

    try {
      await refreshBootstrap(session.token);
      setMessage(getCoachSuccessMessage("refresh"));
    } catch {
      // refreshBootstrap already sets UI error state
    }
  }

  function startEditingWorkout(workout: NonNullable<CoachBootstrap["snapshot"]>["recentWorkouts"][number]) {
    if (!workout) return;

    setHighlightedWorkoutId(workout.id);
    setFollowUpWorkoutId(workout.id);
    setEditingWorkoutId(workout.id);
    setWorkoutForm({
      title: workout.title || "",
      scheduledDate: workout.scheduledDate || new Date().toISOString().slice(0, 10),
      description: workout.description || "",
      workoutLines: Array.isArray(workout.payload?.lines)
        ? workout.payload?.lines.join("\n")
        : "",
    });
  }

  function cancelWorkoutEditing() {
    setEditingWorkoutId(null);
    setWorkoutForm({
      title: "",
      scheduledDate: new Date().toISOString().slice(0, 10),
      description: "",
      workoutLines: "Warm-up\nEMOM 12\nCool down",
    });
  }

  function openRelatedWorkout(workoutId?: string | null) {
    if (!workoutId) return;

    setWorkoutHistoryFilter("all");
    setHighlightedWorkoutId(workoutId);
    setFollowUpWorkoutId(workoutId);
    const workout = recentWorkouts.find((item) => item.id === workoutId) || null;

    if (workout) {
      startEditingWorkout(workout);
      setMessage(`Treino "${workout.title}" aberto a partir do feed de atividade.`);
      return;
    }

    setMessage("O treino relacionado nao esta mais na lista recente, mas o feed continua registrado.");
  }

  async function copyPendingAthletes(workout: NonNullable<CoachBootstrap["snapshot"]>["recentWorkouts"][number]) {
    const pendingEmails =
      workout.athleteDeliveries
        ?.filter((delivery) => delivery.status === "pending")
        .map((delivery) => delivery.athleteEmail)
        .filter(Boolean) || [];

    if (!pendingEmails.length) {
      setMessage("Esse treino nao tem atletas pendentes para copiar.");
      return;
    }

    const text = pendingEmails.join(", ");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMessage(`Lista de pendentes copiada: ${pendingEmails.length} atleta(s).`);
        return;
      }
    } catch {
      // fall through to visible fallback
    }

    setMessage(`Pendentes: ${text}`);
  }

  function getWorkoutProgress(workout: NonNullable<CoachBootstrap["snapshot"]>["recentWorkouts"][number]) {
    const status = getCoachWorkoutStatus({
      assignedCount: workout.assignedCount,
      resultCount: workout.resultCount,
    });

    if (workout.resultCount > 0) {
      return {
        label: rebuildLoopStatusLabels[status],
        border: "1px solid rgba(113,211,154,0.28)",
        color: "#d7f8e1",
        background: "rgba(113,211,154,0.08)",
      };
    }

    if (workout.assignedCount > 0) {
      return {
        label: rebuildLoopStatusLabels[status],
        border: "1px solid rgba(255,204,115,0.24)",
        color: "#ffe9ba",
        background: "rgba(255,204,115,0.08)",
      };
    }

    return {
      label: rebuildLoopStatusLabels[status],
      border: "1px solid rgba(202,215,235,0.12)",
      color: "#c7d2e2c2",
      background: "rgba(255,255,255,0.03)",
    };
  }

  function getWorkoutAttentionCandidate() {
    if (!recentWorkouts.length) return null;

    const prioritized = [...recentWorkouts].sort((left, right) => {
      const leftPriority =
        left.assignedCount > 0 && left.resultCount === 0 ? 0 : left.assignedCount === 0 ? 1 : 2;
      const rightPriority =
        right.assignedCount > 0 && right.resultCount === 0 ? 0 : right.assignedCount === 0 ? 1 : 2;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return right.scheduledDate.localeCompare(left.scheduledDate);
    });

    return prioritized[0] || null;
  }

  const filteredRecentWorkouts = recentWorkouts.filter((workout) => {
    if (workoutHistoryFilter === "responded") {
      return workout.resultCount > 0;
    }

    if (workoutHistoryFilter === "pending") {
      return workout.assignedCount > 0 && workout.resultCount === 0;
    }

    if (workoutHistoryFilter === "empty") {
      return workout.assignedCount === 0;
    }

    return true;
  });
  const attentionWorkout = getWorkoutAttentionCandidate();
  const attentionWorkoutProgress = attentionWorkout ? getWorkoutProgress(attentionWorkout) : null;
  const attentionWorkoutMessage = attentionWorkout
    ? getRebuildLoopNextStep(
        "coach",
        getCoachWorkoutStatus({
          assignedCount: attentionWorkout.assignedCount,
          resultCount: attentionWorkout.resultCount,
        }),
      )
    : null;
  const latestResponseActivity =
    activityFeed.find((item) => item.type === "athlete_responded") || null;
  const filteredActivityFeed = activityFeed.filter((item) => {
    if (activityFeedFilter === "responses") {
      return item.type === "athlete_responded";
    }

    if (activityFeedFilter === "memberships") {
      return item.type === "membership_invited" || item.type === "membership_ready";
    }

    if (activityFeedFilter === "workouts") {
      return item.type === "workout_published";
    }

    return true;
  });

  return (
    <main style={shellStyle}>
      <div style={wrapStyle}>
        <section style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 680 }}>
              <div
                style={{
                  display: "inline-flex",
                  minHeight: 30,
                  padding: "0 12px",
                  alignItems: "center",
                  borderRadius: 999,
                  border: "1px solid rgba(202,215,235,0.12)",
                  color: "#bfd6ff",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Coach-First Rebuild
              </div>
              <h1
                style={{
                  margin: "18px 0 10px",
                  fontSize: "clamp(2.6rem, 7vw, 4.8rem)",
                  lineHeight: 0.92,
                  letterSpacing: "-0.06em",
                }}
              >
                Portal do coach com foco no primeiro treino publicado.
              </h1>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.65, maxWidth: 760 }}>
                Esta superficie agora guia o coach da autenticacao ate a
                publicacao do primeiro treino. O objetivo do rebuild aqui e
                simples: sair do placeholder e colocar o loop principal em
                movimento real.
              </p>
            </div>

            {session ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={buttonSecondary}
                  onClick={() => void handleManualRefresh()}
                  disabled={loading}
                >
                  {loading ? "Atualizando..." : "Atualizar portal"}
                </button>
                <button
                  type="button"
                  style={buttonSecondary}
                  onClick={() => {
                    persistSession(null);
                    setBootstrap(null);
                    setLastSyncAt(null);
                    setMessage("Sessao encerrada localmente.");
                  }}
                >
                  Sair
                </button>
              </div>
            ) : null}
          </div>
          {session && lastSyncAt ? (
            <p style={{ color: "#c7d2e2c2", lineHeight: 1.6, marginTop: 14 }}>
              Ultima atualizacao: {new Date(lastSyncAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </section>

        {!session ? (
          <section style={{ ...cardStyle, display: "grid", gap: 18 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={mode === "signin" ? buttonPrimary : buttonSecondary} onClick={() => setMode("signin")}>
                Entrar
              </button>
              <button type="button" style={mode === "signup" ? buttonPrimary : buttonSecondary} onClick={() => setMode("signup")}>
                Criar conta
              </button>
              <button
                type="button"
                style={mode === "reset-request" || mode === "reset-confirm" ? buttonPrimary : buttonSecondary}
                onClick={() => setMode("reset-request")}
              >
                Recuperar senha
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {mode === "signup" ? (
                <input
                  style={inputStyle}
                  placeholder="Seu nome"
                  value={authForm.name}
                  onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                />
              ) : null}
              <input
                style={inputStyle}
                placeholder="Email"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
              />
              {mode !== "reset-request" ? (
                <input
                  style={inputStyle}
                  placeholder={mode === "reset-confirm" ? "Nova senha" : "Senha"}
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                />
              ) : null}
              {mode === "signup" || mode === "reset-confirm" ? (
                <input
                  style={inputStyle}
                  placeholder={mode === "signup" ? "Codigo de verificacao" : "Codigo de recuperacao"}
                  value={authForm.code}
                  onChange={(event) => setAuthForm((current) => ({ ...current, code: event.target.value }))}
                />
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {mode === "signin" ? (
                <button type="button" style={buttonPrimary} onClick={() => void handleSignIn()} disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              ) : mode === "reset-request" ? (
                <button type="button" style={buttonSecondary} onClick={() => void handlePasswordResetRequest()} disabled={loading}>
                  {loading ? "Gerando codigo..." : "Enviar codigo de recuperacao"}
                </button>
              ) : mode === "reset-confirm" ? (
                <button type="button" style={buttonPrimary} onClick={() => void handlePasswordResetConfirm()} disabled={loading}>
                  {loading ? "Redefinindo..." : "Redefinir senha"}
                </button>
              ) : (
                <>
                  <button type="button" style={buttonSecondary} onClick={() => void handleSignupRequest()} disabled={loading}>
                    {loading ? "Gerando codigo..." : "Gerar codigo"}
                  </button>
                  <button type="button" style={buttonPrimary} onClick={() => void handleSignupConfirm()} disabled={loading}>
                    {loading ? "Confirmando..." : "Confirmar cadastro"}
                  </button>
                </>
              )}
            </div>
          </section>
        ) : null}

        {session ? (
          <section style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <article style={cardStyle}>
              <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Sessao
              </div>
              <h2 style={{ margin: "14px 0 8px", fontSize: 28, letterSpacing: "-0.04em" }}>
                {session.user.name || session.user.email}
              </h2>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6 }}>
                Billing: {bootstrap?.billingStatus?.status || "carregando"} · Tier:{" "}
                {bootstrap?.billingStatus?.accessTier || "carregando"}
              </p>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6, marginTop: 10 }}>
                Entitlements: {(bootstrap?.entitlements?.entitlements || []).join(", ") || "nenhum ainda"}
              </p>
            </article>

            <article style={cardStyle}>
              <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Meu Acesso
              </div>
              <h2 style={{ margin: "14px 0 8px", fontSize: 28, letterSpacing: "-0.04em" }}>
                {bootstrap?.billingStatus?.plan || "sem plano definido"}
              </h2>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6 }}>
                Gyms conectados: {bootstrap?.snapshot?.gyms.length || 0} · Gyms ativos: {activeGymCount}
              </p>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6, marginTop: 10 }}>
                Pode publicar treino: {bootstrap?.snapshot?.primaryGym ? "sim" : "ainda nao"}
              </p>
            </article>

            <article style={cardStyle}>
              <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Onboarding
              </div>
              <h2 style={{ margin: "14px 0 8px", fontSize: 28, letterSpacing: "-0.04em" }}>
                {bootstrap?.snapshot?.primaryGym ? "Publicar primeiro treino" : "Criar primeiro gym"}
              </h2>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6 }}>
                {bootstrap?.snapshot?.nextStep || "Carregando proximo passo..."}
              </p>
            </article>

            <article style={cardStyle}>
              <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Pede Atencao
              </div>
              <h2 style={{ margin: "14px 0 8px", fontSize: 28, letterSpacing: "-0.04em" }}>
                {attentionWorkout ? attentionWorkout.title : "Sem treino prioritario ainda"}
              </h2>
              {attentionWorkout && attentionWorkoutProgress ? (
                <>
                  <span
                    style={{
                      display: "inline-flex",
                      minHeight: 30,
                      padding: "0 12px",
                      alignItems: "center",
                      borderRadius: 999,
                      border: attentionWorkoutProgress.border,
                      color: attentionWorkoutProgress.color,
                      background: attentionWorkoutProgress.background,
                      fontWeight: 700,
                    }}
                  >
                    {attentionWorkoutProgress.label}
                  </span>
                  <p style={{ color: "#c7d2e2c2", lineHeight: 1.6, marginTop: 12 }}>
                    {attentionWorkout.scheduledDate} · Atletas: {attentionWorkout.assignedCount} · Retornos:{" "}
                    {attentionWorkout.resultCount}
                  </p>
                  <p style={{ color: "#c7d2e2c2", lineHeight: 1.6 }}>
                    {attentionWorkoutMessage}
                  </p>
                </>
              ) : (
                <p style={{ color: "#c7d2e2c2", lineHeight: 1.6 }}>
                  Publique o primeiro treino para o portal comecar a destacar o que precisa de acao.
                </p>
              )}
            </article>
          </section>
        ) : null}

        {session && !bootstrap?.snapshot?.primaryGym ? (
          <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.04em" }}>
              Crie o primeiro gym
            </h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <input
                style={inputStyle}
                placeholder="Nome do gym"
                value={gymForm.name}
                onChange={(event) => setGymForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Slug opcional"
                value={gymForm.slug}
                onChange={(event) => setGymForm((current) => ({ ...current, slug: event.target.value }))}
              />
            </div>
            <div>
              <button type="button" style={buttonPrimary} onClick={() => void handleCreateGym()} disabled={loading}>
                {loading ? "Criando..." : "Criar gym"}
              </button>
            </div>
          </section>
        ) : null}

        {session && bootstrap?.snapshot?.primaryGym ? (
          <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
            <div>
              <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Loop Activity
              </div>
              <h2 style={{ margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.04em" }}>
                O rebuild acontecendo no gym
              </h2>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6, marginTop: 8 }}>
                Publicacao, convite e retorno do atleta aparecem juntos aqui para o coach acompanhar o ciclo sem trocar de tela.
              </p>
            </div>

            {latestResponseActivity ? (
              <div
                style={{
                  border: "1px solid rgba(113,211,154,0.18)",
                  borderRadius: 18,
                  padding: "16px 18px",
                  background: "rgba(113,211,154,0.06)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <strong style={{ color: "#fff" }}>Ultimo retorno para follow-up</strong>
                <span style={{ color: "#eef2f8" }}>{latestResponseActivity.title}</span>
                <span style={{ color: "#c7d2e2c2" }}>{latestResponseActivity.description}</span>
                <span style={{ color: "#9fb0c6" }}>
                  {new Date(latestResponseActivity.occurredAt).toLocaleString("pt-BR")}
                </span>
              </div>
            ) : null}

            {activityFeed.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={activityFeedFilter === "all" ? buttonPrimary : buttonSecondary}
                    onClick={() => setActivityFeedFilter("all")}
                  >
                    Todos ({activityFeed.length})
                  </button>
                  <button
                    type="button"
                    style={activityFeedFilter === "responses" ? buttonPrimary : buttonSecondary}
                    onClick={() => setActivityFeedFilter("responses")}
                  >
                    Retornos ({responseActivityCount})
                  </button>
                  <button
                    type="button"
                    style={activityFeedFilter === "memberships" ? buttonPrimary : buttonSecondary}
                    onClick={() => setActivityFeedFilter("memberships")}
                  >
                    Memberships ({membershipActivityCount})
                  </button>
                  <button
                    type="button"
                    style={activityFeedFilter === "workouts" ? buttonPrimary : buttonSecondary}
                    onClick={() => setActivityFeedFilter("workouts")}
                  >
                    Publishes ({workoutActivityCount})
                  </button>
                </div>

                {filteredActivityFeed.length ? filteredActivityFeed.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      background:
                        item.emphasis === "positive"
                          ? "rgba(113,211,154,0.06)"
                          : item.emphasis === "attention"
                            ? "rgba(255,204,115,0.06)"
                            : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ display: "block", color: "#fff" }}>{item.title}</strong>
                      <span style={{ color: "#c7d2e2c2" }}>
                        {new Date(item.occurredAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <span style={{ display: "block", color: "#c7d2e2c2", marginTop: 8 }}>
                      {item.description}
                    </span>
                    {item.gymName ? (
                      <span style={{ display: "block", color: "#9fb0c6", marginTop: 6 }}>
                        Gym: {item.gymName}
                      </span>
                    ) : null}
                    {item.relatedWorkoutId ? (
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          style={buttonSecondary}
                          onClick={() => openRelatedWorkout(item.relatedWorkoutId)}
                          disabled={loading}
                        >
                          Abrir treino
                        </button>
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div
                    style={{
                      border: "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "16px 18px",
                      background: "rgba(255,255,255,0.03)",
                      color: "#c7d2e2c2",
                    }}
                  >
                    Nenhum evento encontrado para este filtro.
                  </div>
                )}
              </div>
            ) : (
              <span style={{ color: "#c7d2e2c2" }}>
                Assim que o coach publicar treino, convidar membros e receber retorno, o feed aparece aqui.
              </span>
            )}
          </section>
        ) : null}

        {session && bootstrap?.snapshot?.primaryGym ? (
          <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Workout Publish
                </div>
                <h2 style={{ margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.04em" }}>
                  {bootstrap.snapshot.primaryGym.name}
                </h2>
              </div>
              {bootstrap.snapshot.latestWorkout ? (
                <div style={{ color: "#c7d2e2c2", lineHeight: 1.6 }}>
                  Ultimo treino: <strong style={{ color: "#fff" }}>{bootstrap.snapshot.latestWorkout.title}</strong>
                  <br />
                  Atletas: {bootstrap.snapshot.latestWorkout.assignedCount} · Retornos:{" "}
                  {bootstrap.snapshot.latestWorkout.resultCount}
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <input
                style={inputStyle}
                placeholder="Titulo do treino"
                value={workoutForm.title}
                onChange={(event) => setWorkoutForm((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                style={inputStyle}
                type="date"
                value={workoutForm.scheduledDate}
                onChange={(event) => setWorkoutForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              />
            </div>
            <input
              style={inputStyle}
              placeholder="Descricao curta para o coach e para o atleta"
              value={workoutForm.description}
              onChange={(event) => setWorkoutForm((current) => ({ ...current, description: event.target.value }))}
            />
            <textarea
              style={textareaStyle}
              placeholder="Uma linha por bloco ou instrução"
              value={workoutForm.workoutLines}
              onChange={(event) => setWorkoutForm((current) => ({ ...current, workoutLines: event.target.value }))}
            />
            {!editingWorkoutId ? (
              <div style={{ display: "grid", gap: 12 }}>
                <strong style={{ display: "block" }}>Audiencia do treino</strong>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={publishAudienceMode === "all" ? buttonPrimary : buttonSecondary}
                    onClick={() => setPublishAudienceMode("all")}
                  >
                    Todos os atletas ativos
                  </button>
                  <button
                    type="button"
                    style={publishAudienceMode === "selected" ? buttonPrimary : buttonSecondary}
                    onClick={() => setPublishAudienceMode("selected")}
                    disabled={!activeAthleteMemberships.length}
                  >
                    Selecionar atletas
                  </button>
                </div>

                {publishAudienceMode === "selected" ? (
                  activeAthleteMemberships.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {activeAthleteMemberships.map((membership) => {
                        const membershipId = String(membership.id);
                        const checked = selectedMembershipIds.includes(membershipId);

                        return (
                          <label
                            key={membershipId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              border: "1px solid rgba(202,215,235,0.12)",
                              borderRadius: 18,
                              padding: "14px 16px",
                              background: checked ? "rgba(75,141,255,0.12)" : "rgba(255,255,255,0.03)",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMembershipSelection(membershipId)}
                            />
                            <span>
                              <strong style={{ display: "block", marginBottom: 4 }}>
                                {membership.label || membership.email}
                              </strong>
                              <span style={{ color: "#c7d2e2c2" }}>{membership.email}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ color: "#c7d2e2c2" }}>
                      Convide e ative pelo menos um atleta para publicar com audiencia selecionada.
                    </span>
                  )
                ) : (
                  <span style={{ color: "#c7d2e2c2" }}>
                    O treino sera entregue para todos os atletas ativos deste gym.
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: "#c7d2e2c2" }}>
                Edicao rapida ativa: titulo, descricao, data e linhas do treino podem ser ajustados sem republicar.
              </span>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                style={buttonPrimary}
                onClick={() => void (editingWorkoutId ? handleUpdateWorkout() : handlePublishWorkout())}
                disabled={loading}
              >
                {loading
                  ? editingWorkoutId
                    ? "Salvando..."
                    : "Publicando..."
                  : editingWorkoutId
                    ? "Salvar ajustes do treino"
                    : "Publicar primeiro treino"}
              </button>
              {bootstrap.snapshot.latestWorkout && !editingWorkoutId ? (
                <button
                  type="button"
                  style={buttonSecondary}
                  onClick={() => {
                    if (bootstrap?.snapshot?.latestWorkout) {
                      startEditingWorkout(bootstrap.snapshot.latestWorkout);
                    }
                  }}
                  disabled={loading}
                >
                  Editar ultimo treino
                </button>
              ) : null}
              {editingWorkoutId ? (
                <button type="button" style={buttonSecondary} onClick={() => cancelWorkoutEditing()} disabled={loading}>
                  Cancelar edicao
                </button>
              ) : null}
            </div>

            {bootstrap.snapshot.latestWorkout?.recentResponses?.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                <strong style={{ display: "block" }}>Retornos recentes do treino</strong>
                {bootstrap.snapshot.latestWorkout.recentResponses.map((response) => (
                  <div
                    key={`${response.athleteEmail}-${response.completedAt}`}
                    style={{
                      border: "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: 4 }}>
                      {response.athleteName}
                    </strong>
                    <span style={{ display: "block", color: "#c7d2e2c2", marginBottom: 8 }}>
                      {response.athleteEmail}
                    </span>
                    <span style={{ display: "block", color: "#fff", marginBottom: 6 }}>
                      {response.summary}
                    </span>
                    {response.score ? (
                      <span style={{ display: "block", color: "#c7d2e2c2", marginBottom: 4 }}>
                        Score: {response.score}
                      </span>
                    ) : null}
                    {response.notes ? (
                      <span style={{ display: "block", color: "#c7d2e2c2" }}>
                        {response.notes}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {bootstrap.snapshot.latestWorkout?.athleteDeliveries?.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                <strong style={{ display: "block" }}>Status da audiencia do treino</strong>
                {bootstrap.snapshot.latestWorkout.athleteDeliveries.map((delivery) => (
                  <div
                    key={delivery.membershipId}
                    style={{
                      border: "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", marginBottom: 4 }}>
                          {delivery.athleteName}
                        </strong>
                        <span style={{ color: "#c7d2e2c2" }}>{delivery.athleteEmail}</span>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          minHeight: 30,
                          padding: "0 12px",
                          alignItems: "center",
                          borderRadius: 999,
                          border:
                            delivery.status === "responded"
                              ? "1px solid rgba(113,211,154,0.28)"
                              : "1px solid rgba(202,215,235,0.12)",
                          color: delivery.status === "responded" ? "#d7f8e1" : "#c7d2e2c2",
                          background:
                            delivery.status === "responded"
                              ? "rgba(113,211,154,0.08)"
                              : "rgba(255,255,255,0.03)",
                          fontWeight: 700,
                        }}
                      >
                        {delivery.status === "responded"
                          ? rebuildLoopStatusLabels.done
                          : rebuildLoopStatusLabels.awaiting_participant}
                      </span>
                    </div>
                    {delivery.summary ? (
                      <span style={{ display: "block", color: "#fff", marginTop: 10, marginBottom: 4 }}>
                        {delivery.summary}
                      </span>
                    ) : null}
                    {delivery.score ? (
                      <span style={{ display: "block", color: "#c7d2e2c2" }}>
                        Score: {delivery.score}
                      </span>
                    ) : null}
                    {delivery.completedAt ? (
                      <span style={{ display: "block", color: "#c7d2e2c2", marginTop: 4 }}>
                        Ultimo retorno em {new Date(delivery.completedAt).toLocaleString("pt-BR")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {bootstrap.snapshot.recentWorkouts?.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <strong style={{ display: "block" }}>Treinos recentes</strong>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={workoutHistoryFilter === "all" ? buttonPrimary : buttonSecondary}
                      onClick={() => setWorkoutHistoryFilter("all")}
                    >
                      Todos ({recentWorkouts.length})
                    </button>
                    <button
                      type="button"
                      style={workoutHistoryFilter === "responded" ? buttonPrimary : buttonSecondary}
                      onClick={() => setWorkoutHistoryFilter("responded")}
                    >
                      {rebuildLoopStatusLabels.done} ({respondedWorkoutCount})
                    </button>
                    <button
                      type="button"
                      style={workoutHistoryFilter === "pending" ? buttonPrimary : buttonSecondary}
                      onClick={() => setWorkoutHistoryFilter("pending")}
                    >
                      Pendentes ({pendingWorkoutCount})
                    </button>
                    <button
                      type="button"
                      style={workoutHistoryFilter === "empty" ? buttonPrimary : buttonSecondary}
                      onClick={() => setWorkoutHistoryFilter("empty")}
                    >
                      {rebuildLoopStatusLabels.awaiting_setup} ({emptyWorkoutCount})
                    </button>
                  </div>
                </div>
                {filteredRecentWorkouts.length ? (
                  filteredRecentWorkouts.map((workout) => {
                    const progress = getWorkoutProgress(workout);
                    const pendingDeliveries =
                      workout.athleteDeliveries?.filter((delivery) => delivery.status === "pending") || [];
                    const isFollowUpFocused = followUpWorkoutId === workout.id;

                    return (
                  <div
                    key={workout.id}
                    style={{
                      border:
                        highlightedWorkoutId === workout.id
                          ? "1px solid rgba(115,167,255,0.42)"
                          : "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      background:
                        highlightedWorkoutId === workout.id
                          ? "rgba(75,141,255,0.08)"
                          : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", marginBottom: 4 }}>{workout.title}</strong>
                        <span style={{ color: "#c7d2e2c2" }}>
                          {workout.scheduledDate} · Atletas: {workout.assignedCount} · Retornos: {workout.resultCount}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            minHeight: 28,
                            padding: "0 10px",
                            alignItems: "center",
                            borderRadius: 999,
                            marginTop: 10,
                            border: progress.border,
                            color: progress.color,
                            background: progress.background,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {progress.label}
                        </span>
                        {isFollowUpFocused && pendingDeliveries.length ? (
                          <span
                            style={{
                              display: "inline-flex",
                              minHeight: 28,
                              padding: "0 10px",
                              alignItems: "center",
                              borderRadius: 999,
                              marginTop: 10,
                              marginLeft: 8,
                              border: "1px solid rgba(255,204,115,0.24)",
                              color: "#ffe9ba",
                              background: "rgba(255,204,115,0.08)",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            Follow-up pendente: {pendingDeliveries.length}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={buttonSecondary}
                          onClick={() => startEditingWorkout(workout)}
                          disabled={loading}
                        >
                          Editar treino
                        </button>
                        <button
                          type="button"
                          style={{
                            ...buttonSecondary,
                            border: "1px solid rgba(255,126,126,0.22)",
                            color: "#ffd7d7",
                          }}
                          onClick={() => void handleRemoveWorkout(workout)}
                          disabled={loading}
                        >
                          Remover treino
                        </button>
                      </div>
                    </div>
                    {isFollowUpFocused && pendingDeliveries.length ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: "1px solid rgba(202,215,235,0.12)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong style={{ color: "#fff" }}>Atletas ainda sem retorno</strong>
                          <button
                            type="button"
                            style={buttonSecondary}
                            onClick={() => void copyPendingAthletes(workout)}
                            disabled={loading}
                          >
                            Copiar pendentes
                          </button>
                        </div>
                        {pendingDeliveries.map((delivery) => (
                          <div
                            key={delivery.membershipId}
                            style={{
                              border: "1px solid rgba(202,215,235,0.12)",
                              borderRadius: 14,
                              padding: "12px 14px",
                              background: "rgba(255,255,255,0.03)",
                            }}
                          >
                            <strong style={{ display: "block", marginBottom: 4 }}>{delivery.athleteName}</strong>
                            <span style={{ color: "#c7d2e2c2" }}>{delivery.athleteEmail}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      border: "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "16px 18px",
                      background: "rgba(255,255,255,0.03)",
                      color: "#c7d2e2c2",
                    }}
                  >
                    Nenhum treino encontrado para este filtro.
                  </div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {session && bootstrap?.snapshot?.primaryGym ? (
          <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
            <div>
              <div style={{ color: "#bfd6ff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Memberships
              </div>
              <h2 style={{ margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.04em" }}>
                Convide atletas para receber o treino
              </h2>
              <p style={{ color: "#c7d2e2c2", lineHeight: 1.6, marginTop: 8 }}>
                Se o atleta ainda nao tiver conta, o convite fica pendente e sera anexado automaticamente no signup ou signin.
              </p>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <input
                style={inputStyle}
                placeholder="Email do atleta"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
              />
              <select
                style={inputStyle}
                value={inviteForm.role}
                onChange={(event) =>
                  setInviteForm((current) => ({ ...current, role: event.target.value as "coach" | "athlete" }))
                }
              >
                <option value="athlete">Athlete</option>
                <option value="coach">Coach</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" style={buttonSecondary} onClick={() => void handleInviteMembership()} disabled={loading}>
                {loading ? "Convidando..." : "Convidar membro"}
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div
                style={{
                  border: "1px solid rgba(202,215,235,0.12)",
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <strong style={{ display: "block", fontSize: 24, marginBottom: 4 }}>{activeAthleteCount}</strong>
                <span style={{ color: "#c7d2e2c2" }}>Atletas ativos prontos para receber treino</span>
              </div>
              <div
                style={{
                  border: "1px solid rgba(202,215,235,0.12)",
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <strong style={{ display: "block", fontSize: 24, marginBottom: 4 }}>{invitedAthleteCount}</strong>
                <span style={{ color: "#c7d2e2c2" }}>Convites pendentes para atletas</span>
              </div>
              <div
                style={{
                  border: "1px solid rgba(202,215,235,0.12)",
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <strong style={{ display: "block", fontSize: 24, marginBottom: 4 }}>{activeCoachCount}</strong>
                <span style={{ color: "#c7d2e2c2" }}>Coaches ativos neste gym</span>
              </div>
              <div
                style={{
                  border: "1px solid rgba(202,215,235,0.12)",
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <strong style={{ display: "block", fontSize: 24, marginBottom: 4 }}>{invitedCoachCount}</strong>
                <span style={{ color: "#c7d2e2c2" }}>Convites pendentes para coaches</span>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {memberships.length ? (
                memberships.map((membership) => (
                  <div
                    key={`${membership.id || membership.email}-${membership.role}`}
                    style={{
                      border: "1px solid rgba(202,215,235,0.12)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", marginBottom: 4 }}>
                          {membership.label || membership.email}
                        </strong>
                        <span style={{ color: "#c7d2e2c2" }}>
                          {membership.email} · {membership.role} · {membership.status}
                        </span>
                      </div>
                      {membership.id && membership.role !== "owner" && membership.email !== session.user.email ? (
                        <button
                          type="button"
                          style={buttonSecondary}
                          onClick={() => void handleRemoveMembership(membership)}
                          disabled={loading}
                        >
                          {loading ? "Atualizando..." : membership.status === "invited" ? "Cancelar convite" : "Remover"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <span style={{ color: "#c7d2e2c2" }}>
                  Ainda nao ha memberships ativas ou pendentes neste gym.
                </span>
              )}
            </div>
          </section>
        ) : null}

        {message ? (
          <section style={{ ...cardStyle, borderColor: "rgba(113,211,154,0.28)" }}>
            <strong style={{ display: "block", marginBottom: 8 }}>{rebuildFeedbackTitles.success}</strong>
            <span style={{ color: "#d7f8e1" }}>{message}</span>
          </section>
        ) : null}

        {error ? (
          <section style={{ ...cardStyle, borderColor: "rgba(241,142,150,0.3)" }}>
            <strong style={{ display: "block", marginBottom: 8 }}>{rebuildFeedbackTitles.error}</strong>
            <span style={{ color: "#ffd9dd" }}>{error}</span>
          </section>
        ) : null}
      </div>
    </main>
  );
}
