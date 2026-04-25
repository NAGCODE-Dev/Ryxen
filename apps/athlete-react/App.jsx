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
import { validateWorkoutContract } from '../../packages/shared-web/flowContracts.js';
import TodayPage from './routes/TodayPage.jsx';
import ImportReviewSheet from './components/ImportReviewSheet.jsx';
import { createTodayViewModel } from './services/todayViewModel.js';

// ... (rest unchanged until handleConfirmReview)

  async function handleConfirmReview() {
    setImportState('saving');
    const result = await reviewAdapterRef.current.commitImportReview();
    if (!result?.success) {
      setImportState('idle');
      setError(result?.error || 'Não consegui salvar o plano.');
      return;
    }

    const workouts = result?.weeks?.flatMap(w => w.workouts || []) || [];
    for (const workout of workouts) {
      const validation = validateWorkoutContract(workout);
      if (!validation.valid) {
        setImportState('idle');
        setError(`Plano inválido: ${validation.errors.join(', ')}`);
        return;
      }
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

export default App;
