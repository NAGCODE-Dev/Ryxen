import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { AppFrame, useNativeShell, useReducedMotion } from '../../packages/ui/index.js';
import { applyAuthRedirectFromLocation, signOut, startGoogleRedirect } from '../../packages/shared-web/auth.js';
import { createAthleteImportReviewAdapter } from '../../packages/shared-web/athlete-import-review.js';
import {
  clearTodayDayOverride,
  loadAthleteTodaySnapshot,
  persistTodaySelection,
} from '../../packages/shared-web/athlete-shell.js';
import { saveImportedPlanSnapshot } from '../../packages/shared-web/athlete-services.js';
import TodayPage from './routes/TodayPage.jsx';
import ImportReviewSheet from './components/ImportReviewSheet.jsx';
import { createTodayViewModel } from './services/todayViewModel.js';

export default function App() {
  const nativeShell = useNativeShell();
  const [snapshot, setSnapshot] = useState({
    profile: null,
    weeks: [],
    activeWeekNumber: null,
    currentDay: null,
    workout: null,
    workoutMeta: null,
    importedPlanMeta: null,
    workoutContext: { source: 'empty', availableDays: [], availableWeeks: [], recentWorkouts: [] },
    preferences: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [importState, setImportState] = useState('idle');
  const [review, setReview] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const fileInputRef = useRef(null);
  const snapshotRef = useRef(snapshot);
  const deferredReviewText = useDeferredValue(reviewText);

  snapshotRef.current = snapshot;

  const reviewAdapterRef = useRef(null);
  if (!reviewAdapterRef.current) {
    reviewAdapterRef.current = createAthleteImportReviewAdapter({
      getActiveWeekNumber: () => snapshotRef.current?.activeWeekNumber || null,
      getFallbackDay: () => snapshotRef.current?.currentDay || null,
      onProgress: (progress) => {
        setProgressMessage(String(progress?.message || '').trim());
      },
      syncImportedPlan: async (weeks, metadata) => {
        if (!snapshotRef.current?.profile?.id) return { success: false, skipped: true };
        try {
          await saveImportedPlanSnapshot({
            weeks,
            metadata,
            activeWeekNumber: weeks[0]?.weekNumber || snapshotRef.current?.activeWeekNumber || null,
          });
          return { success: true };
        } catch (syncError) {
          return { success: false, error: syncError };
        }
      },
    });
  }

  const preferredReduceMotion = snapshot?.preferences?.reduceMotion;
  const reducedMotion = useReducedMotion(typeof preferredReduceMotion === 'boolean' ? preferredReduceMotion : null);
  const viewModel = createTodayViewModel(snapshot);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const redirectResult = await applyAuthRedirectFromLocation();
      if (!alive) return;
      if (redirectResult?.handled && redirectResult?.success) {
        setMessage('Sessão sincronizada com Google.');
      } else if (redirectResult?.handled && redirectResult?.error) {
        setError(redirectResult.error);
      }
      const nextSnapshot = await loadSnapshot();
      if (!alive || !nextSnapshot) return;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function loadSnapshot() {
    setError('');
    try {
      const nextSnapshot = await loadAthleteTodaySnapshot();
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
      return nextSnapshot;
    } catch (loadError) {
      setError(loadError?.message || 'Não consegui hidratar o Today.');
      return null;
    }
  }

  async function handleWeekSelect(item) {
    await persistTodaySelection({
      activeWeekNumber: item?.key || null,
      currentDay: snapshot?.currentDay || null,
    });
    await loadSnapshot();
  }

  async function handleDaySelect(item) {
    await persistTodaySelection({
      activeWeekNumber: snapshot?.activeWeekNumber || null,
      currentDay: item?.key || null,
    });
    await loadSnapshot();
  }

  async function handleResetDay() {
    await clearTodayDayOverride();
    setMessage('Dia voltou para o modo automático.');
    await loadSnapshot();
  }

  function handleOpenImport() {
    fileInputRef.current?.click();
  }

  async function handleImportChange(event) {
    const [file] = Array.from(event.target?.files || []);
    event.target.value = '';
    if (!file) return;

    setImportState('previewing');
    setMessage('');
    setError('');
    const result = await reviewAdapterRef.current.previewImportFromFile(file);
    if (!result?.success) {
      setImportState('idle');
      setError(result?.error || 'Não consegui preparar o preview.');
      return;
    }

    setImportState('idle');
    setReview(result.review || null);
    setReviewText(String(result?.review?.reviewText || ''));
    setMessage('Preview pronto. Revise o texto antes de salvar.');
  }

  async function handleReparseReview() {
    setImportState('reparsing');
    const result = await reviewAdapterRef.current.reparseImportReview(reviewText);
    if (!result?.success) {
      setImportState('idle');
      setError(result?.error || 'Não consegui reprocessar o preview.');
      return;
    }

    setImportState('idle');
    setReview(result.review || null);
    setReviewText(String(result?.review?.reviewText || reviewText));
    setMessage('Preview atualizado com suas correções.');
  }

  async function handleConfirmReview() {
    setImportState('saving');
    const result = await reviewAdapterRef.current.commitImportReview();
    if (!result?.success) {
      setImportState('idle');
      setError(result?.error || 'Não consegui salvar o plano.');
      return;
    }

    const nextWeek = result?.review?.weekNumbers?.[0] || result?.weeks?.[0]?.weekNumber || null;
    const nextDay = result?.review?.days?.[0]?.day || null;
    await persistTodaySelection({
      activeWeekNumber: nextWeek,
      currentDay: nextDay,
    });
    setReview(null);
    setReviewText('');
    setImportState('idle');
    setMessage('Plano salvo com sucesso.');
    await loadSnapshot();
  }

  async function handleCancelReview() {
    await reviewAdapterRef.current.cancelImportReview();
    setReview(null);
    setReviewText('');
    setImportState('idle');
  }

  function handleStartAuth() {
    setError('');
    setMessage('');
    startGoogleRedirect({ returnTo: '/athlete/' });
  }

  async function handleSignOut() {
    await signOut();
    setReview(null);
    setReviewText('');
    setMessage('Sessão encerrada.');
    await loadSnapshot();
  }

  return (
    <AppFrame nativeShell={nativeShell} reducedMotion={reducedMotion}>
      <input
        ref={fileInputRef}
        className="ath-hiddenInput"
        type="file"
        accept=".pdf,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp,.mp4,.mov,.xlsx,.xls,.ods"
        onChange={handleImportChange}
      />

      <TodayPage
        snapshot={snapshot}
        viewModel={viewModel}
        loading={loading}
        error={error}
        message={message}
        progressMessage={progressMessage}
        onOpenImport={handleOpenImport}
        onSelectWeek={handleWeekSelect}
        onSelectDay={handleDaySelect}
        onResetDay={handleResetDay}
        onStartAuth={handleStartAuth}
        onSignOut={handleSignOut}
      />

      <ImportReviewSheet
        open={!!review}
        review={review}
        reviewText={reviewText}
        reviewTextDeferred={deferredReviewText}
        importState={importState}
        onClose={handleCancelReview}
        onChangeReviewText={setReviewText}
        onReparse={handleReparseReview}
        onConfirm={handleConfirmReview}
        onCancel={handleCancelReview}
      />
    </AppFrame>
  );
}
