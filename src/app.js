/**
 * App Initialization
 * Dependency Injection e orquestração de módulos
 * 
 * Responsabilidades:
 * - Inicializar state
 * - Conectar adapters
 * - Carregar dados persistidos
 * - Expor APIs para UI
 */
// app.js

// ========== IMPORTS ==========

// State & Events
import { getState, getStateSnapshot, setState, subscribe, debugState } from './core/state/store.js';
import { on, emit } from './core/events/eventBus.js';

// Use-cases
import { copyWorkout } from './core/usecases/copyWorkout.js';
import { addOrUpdatePR, removePR, listAllPRs } from './core/usecases/managePRs.js';
import { hasStoredSession } from './core/services/authService.js';
import { isDeveloperProfile } from './core/utils/devAccess.js';

// Adapters
import {
  saveMultiWeekPdf,
  saveParsedWeeks,
  loadParsedWeeks,
  getPdfInfo
} from './adapters/pdf/pdfRepository.js';

import {
  getWorkoutFromWeek,
} from './adapters/pdf/customPdfParser.js';
import { clearAllStorages, createStorage } from './adapters/storage/storageFactory.js';
import { isPdfJsAvailable } from './adapters/pdf/pdfReader.js';
import { isImageFile, extractTextFromImageFile } from './adapters/media/ocrReader.js';
import { isVideoFile, extractTextFromVideoFile } from './adapters/media/videoTextReader.js';
import { isSpreadsheetFile, extractTextFromSpreadsheetFile } from './adapters/spreadsheet/spreadsheetReader.js';
import {
  parseTextIntoWeeks,
  toWorkoutBlocks,
  toWorkoutSections,
} from './app/workoutHelpers.js';
import {
  createDefensiveWorkoutSnapshot,
  prepareWorkoutEntity,
  summarizeWorkoutIssues,
} from './app/workoutTransforms.js';
import { createWorkoutDomain } from './app/workoutDomain.js';
import { createAccountSyncDomain } from './app/accountSyncDomain.js';
import { createAuthDomain } from './app/authDomain.js';
import { createImportExportDomain } from './app/importExportDomain.js';
import { createCoachFeedDomain } from './app/coachFeedDomain.js';
import { createLocalSessionDomain } from './app/localSessionDomain.js';
import { createAthleteInteractionDomain } from './app/athleteInteractionDomain.js';
import { classifyUniversalImportFile, isPdfImportFile, isTextLikeImportFile } from './app/importFileTypes.js';
import { downloadFile } from './app/fileHelpers.js';
import { captureAppError } from './core/services/errorMonitor.js';
import { trackError } from './core/services/telemetryService.js';
import {
  normalizeCoachWorkoutFeed,
  pruneCoachWorkoutFeed,
  resolveCoachWorkoutForDay,
} from './app/coachWorkoutCache.js';
import { exposeAppApi } from './app/publicApi.js';
import { createRemoteHandlers } from './app/remoteHandlers.js';
import {
  checkDependencies as checkInitDependencies,
  loadPersistedState as loadPersistedAppState,
  restoreSessionIfPossible as restorePersistedSession,
  runAppInitialization,
  setupPersistenceListeners,
  updateCurrentDay as syncCurrentDay,
} from './app/initLifecycle.js';

// Utils
import { getDayName } from './core/utils/date.js';

const DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';
const logDebug = (...args) => {
  if (DEBUG) console.log(...args);
};
const WINDOW_OBJECT = typeof window !== 'undefined'
  ? window
  : { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
const NAVIGATOR_OBJECT = typeof navigator !== 'undefined'
  ? navigator
  : { clipboard: { writeText: async () => {} } };
const VALID_DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// ========== STORAGES ==========

const prsStorage = createStorage('prs', 5000);
const prefsStorage = createStorage('preferences', 1000);
const activeWeekStorage = createStorage('active-week', 100);
const dayOverrideStorage = createStorage('day-override', 100);
const pdfStorage = createStorage('workout-pdf', 2_000_000);
const pdfMetaStorage = createStorage('workout-pdf-metadata', 1000);
const coachWorkoutStorage = createStorage('coach-workout-cache', 300_000);

const PDF_KEY = 'workout-pdf';
const METADATA_KEY = 'workout-pdf-metadata';
const COACH_FEED_KEY = 'feed';
// Preserve CrossApp-prefixed persisted keys so existing installs keep sessions, consent and cached state after the rebrand.
const RUNTIME_CONFIG_KEY = 'crossapp-runtime-config';
const TELEMETRY_CONSENT_KEY = 'crossapp-consent';
const AUTH_TOKEN_KEY = 'crossapp-auth-token';
const PROFILE_KEY = 'crossapp-user-profile';
const CHECKOUT_INTENT_KEY = 'crossapp-pending-checkout-v1';
const PR_HISTORY_KEY = 'pr_history';
const ATHLETE_USAGE_KEY = 'crossapp-athlete-usage-v1';
const TELEMETRY_QUEUE_KEY = 'crossapp-telemetry-queue';
const APP_STATE_SYNC_KEY = 'crossapp-app-state-sync-v1';
const SYNC_OUTBOX_KEY = 'crossapp-sync-outbox-v1';
const PRESERVED_LOCAL_KEYS = [RUNTIME_CONFIG_KEY, TELEMETRY_CONSENT_KEY];

const localSessionDomain = createLocalSessionDomain({
  windowObject: WINDOW_OBJECT,
  clearAllStorages,
  PRESERVED_LOCAL_KEYS,
  AUTH_TOKEN_KEY,
  PROFILE_KEY,
  CHECKOUT_INTENT_KEY,
  PR_HISTORY_KEY,
  ATHLETE_USAGE_KEY,
  TELEMETRY_QUEUE_KEY,
  APP_STATE_SYNC_KEY,
  SYNC_OUTBOX_KEY,
});

const {
  clearLocalUserData,
} = localSessionDomain;

// ========== INICIALIZAÇÃO ==========

/**
 * Inicializa aplicação
 */
export async function init() {
  try {
    return await runAppInitialization({
      logDebug,
      checkDependencies,
      loadPersistedState,
      restoreSessionIfPossible,
      updateCurrentDay,
      loadSavedWeeks,
      setupEventListeners,
      bindOnlineSyncListener,
      exposeDebugAPIs,
      emit,
      getState,
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
    return { success: false, error: error.message };
  }
}

async function restoreSessionIfPossible() {
  return restorePersistedSession({
    hasStoredSession,
    handleRefreshSession,
    remoteHandlers,
    logDebug,
  });
}

function checkDependencies() {
  return checkInitDependencies({
    isPdfJsAvailable,
    createStorage,
    logDebug,
  });
}

/**
 * Carrega estado persistido (PRs e preferências)
 */
async function loadPersistedState() {
  return loadPersistedAppState({
    prsStorage,
    prefsStorage,
    getState,
    setState,
    logDebug,
  });
}
/**
 * Atualiza dia atual no state
 */
async function updateCurrentDay() {
  return syncCurrentDay({
    dayOverrideStorage,
    getDayName,
    setState,
    logDebug,
  });
}

/**
 * Volta para dia automático (sistema)
 * @returns {Promise<Object>}
 */
export async function resetToAutoDay() {
  // Remove override
  await dayOverrideStorage.remove('custom-day');
  
  // Volta para dia do sistema
  const systemDay = getDayName();
  setState({ currentDay: systemDay });
  
  // Reprocessa
  await reprocessActiveWeek();
  
  logDebug(`📅 Voltou para dia automático: ${systemDay}`);
  
  return { success: true, day: systemDay };
}
/**
 * Carrega semanas do PDF (fluxo multi-week)
 */
async function loadSavedWeeks() {
  const result = await loadParsedWeeks();

  if (!result.success) {
    logDebug('📄 Nenhuma semana salva');
    await applyPreferredWorkout({ fallbackToWelcome: true });
    return;
  }

  const { weeks, metadata } = result.data;
  setState({ weeks });

  const savedWeek = await activeWeekStorage.get('active-week');
  const activeWeek = savedWeek || weeks[0].weekNumber;

  await selectActiveWeek(activeWeek);

  logDebug('📄 Semanas carregadas:', metadata?.weekNumbers || weeks.map(w => w.weekNumber));
}

/**
 * Setup de event listeners
 */
function setupEventListeners() {
  return setupPersistenceListeners({
    subscribe,
    savePRsToStorage,
    savePreferencesToStorage,
    syncAthletePrSnapshotWithQueue,
    scheduleAppStateSync,
    logDebug,
  });
}

/**
 * Salva PRs no storage
 */
async function savePRsToStorage(prs) {
  try {
    await prsStorage.set('prs', prs);
    logDebug('💾 PRs salvos:', Object.keys(prs).length);
  } catch (error) {
    console.warn('Erro ao salvar PRs:', error);
  }
}

/**
 * Salva preferências no storage
 */
async function savePreferencesToStorage(preferences) {
  try {
    await prefsStorage.set('preferences', preferences);
    logDebug('💾 Preferências salvas');
  } catch (error) {
    console.warn('Erro ao salvar preferências:', error);
  }
}

// ========== MULTI-WEEK CORE ==========

/**
 * Seleciona semana ativa
 * @param {number} weekNumber - Número da semana
 * @returns {Promise<Object>}
 */
export async function selectActiveWeek(weekNumber) {
  const state = getState();
  const week = state.weeks?.find(w => w.weekNumber === weekNumber);

  if (!week) {
    return { success: false, error: `Semana ${weekNumber} não encontrada` };
  }

  setState({ activeWeekNumber: weekNumber });
  await activeWeekStorage.set('active-week', weekNumber);

  logDebug(`📅 Semana ativa: ${weekNumber}`);

  await applyPreferredWorkout({ fallbackToWelcome: true });
  emit('week:changed', { weekNumber });

  return { success: true };
}
/**
 * Permite usuário escolher dia manualmente
 * @param {string} dayName - Nome do dia ('Segunda', 'Terça', etc)
 * @returns {Promise<Object>}
 */
export async function setCustomDay(dayName) {
  if (!VALID_DAY_NAMES.includes(dayName)) {
    return {
      success: false,
      error: `Dia inválido. Use: ${VALID_DAY_NAMES.join(', ')}`,
    };
  }
  
  // Atualiza state
  setState({ currentDay: dayName });
  
  // Salva preferência (para persistir após reload)
  await dayOverrideStorage.set('custom-day', dayName);
  
  // Reprocessa treino
  await reprocessActiveWeek();
  
  emit('day:changed', { dayName, manual: true });
  
  logDebug(`📅 Dia alterado manualmente para: ${dayName}`);
  
  return { success: true, day: dayName };
}
let applyPreferredWorkoutRef = async (...args) => ({ success: false, deferred: true, args });

const coachFeedDomain = createCoachFeedDomain({
  getState,
  coachWorkoutStorage,
  COACH_FEED_KEY,
  pruneCoachWorkoutFeed,
  normalizeCoachWorkoutFeed,
  resolveCoachWorkoutForDay,
  applyPreferredWorkout: (...args) => applyPreferredWorkoutRef(...args),
});

const {
  getCoachWorkoutForCurrentDay,
  syncCoachWorkoutFeed,
  clearCoachWorkoutFeed,
} = coachFeedDomain;

const workoutDomain = createWorkoutDomain({
  getState,
  setState,
  emit,
  logDebug,
  getWorkoutFromWeek,
  getCoachWorkoutForCurrentDay,
  prepareWorkoutEntity,
  summarizeWorkoutIssues,
  createDefensiveWorkoutSnapshot,
  captureAppError,
  trackError,
});

const {
  applyWorkoutToState,
  applyPreferredWorkout,
} = workoutDomain;

applyPreferredWorkoutRef = (...args) => applyPreferredWorkout(...args);

const remoteHandlers = createRemoteHandlers({
  syncCoachWorkoutFeed,
  clearCoachWorkoutFeed,
});

const {
  handleRequestSignUpVerification,
  handleRequestPasswordReset,
  handleConfirmPasswordReset,
  handleGetProfile,
  handleGetAdminOverview,
  handleGetAdminOpsHealth,
  handleActivateCoachSubscription,
  handleReprocessBillingClaim,
  handleRetryEmailJob,
  handleCreateManualPasswordReset,
  handleRequestAccountDeletion,
  handleDeleteAccountNow,
  handleOpenCheckout,
  handleGetSubscriptionStatus,
  handleGetEntitlements,
  handleActivateMockSubscription,
  handleGetRuntimeConfig,
  handleSetRuntimeConfig,
  handleCreateGym,
  handleGetMyGyms,
  handleAddGymMember,
  handleListGymMembers,
  handleListGymGroups,
  handleCreateGymGroup,
  handlePublishGymWorkout,
  handleGetWorkoutFeed,
  handleGetAccessContext,
  handleGetAthleteSummary,
  handleGetAthleteResultsSummary,
  handleGetAthleteWorkoutsRecent,
  handleGetAppStateSnapshot,
  handleGetImportedPlanSnapshot,
  handleSaveAppStateSnapshot,
  handleSaveImportedPlanSnapshot,
  handleDeleteImportedPlanSnapshot,
  handleGetGymInsights,
  handleGetMeasurementHistory,
  handleLogAthletePr,
  handleLogRunningSession,
  handleGetRunningHistory,
  handleLogStrengthSession,
  handleGetStrengthHistory,
  handleSyncAthleteMeasurementsSnapshot: remoteHandleSyncAthleteMeasurementsSnapshot,
  handleSyncAthletePrSnapshot: remoteHandleSyncAthletePrSnapshot,
  handleGetBenchmarks,
} = remoteHandlers;

const accountSyncDomain = createAccountSyncDomain({
  getState,
  setState,
  windowObject: WINDOW_OBJECT,
  navigatorObject: NAVIGATOR_OBJECT,
  prefsStorage,
  activeWeekStorage,
  pdfStorage,
  pdfMetaStorage,
  dayOverrideStorage,
  PDF_KEY,
  METADATA_KEY,
  APP_STATE_SYNC_KEY,
  SYNC_OUTBOX_KEY,
  handleGetProfile,
  handleGetAppStateSnapshot,
  handleSaveAppStateSnapshot,
  handleGetImportedPlanSnapshot,
  handleSaveImportedPlanSnapshot,
  remoteHandleSyncAthleteMeasurementsSnapshot,
  remoteHandleSyncAthletePrSnapshot,
  loadParsedWeeks,
  selectActiveWeek,
  setCustomDay,
  resetToAutoDay,
  logDebug,
});

const {
  syncImportedPlanToAccount,
  bindOnlineSyncListener,
  scheduleAppStateSync,
  saveRemoteAppStateSnapshot,
  restoreAppStateFromAccount,
  flushPendingAppStateSync,
  syncAthletePrSnapshotWithQueue,
  syncAthleteMeasurementsSnapshotWithQueue,
  flushPendingSyncOutbox,
  restoreImportedPlanFromAccount,
} = accountSyncDomain;

const authDomain = createAuthDomain({
  getState,
  setState,
  remoteHandlers,
  handleGetProfile,
  restoreAppStateFromAccount,
  restoreImportedPlanFromAccount,
  flushPendingAppStateSync,
  flushPendingSyncOutbox,
  clearLocalUserData,
  clearCoachWorkoutFeed,
  updateCurrentDay,
  applyPreferredWorkout,
});

const {
  handleSignUp,
  handleConfirmSignUp,
  handleSignIn,
  handleSignInWithGoogle,
  handleStartGoogleRedirect,
  handleRefreshSession,
  handleSignOut,
} = authDomain;

const importExportDomain = createImportExportDomain({
  getState,
  setState,
  emit,
  logDebug,
  downloadFile,
  saveMultiWeekPdf,
  saveParsedWeeks,
  isImageFile,
  extractTextFromImageFile,
  isVideoFile,
  extractTextFromVideoFile,
  isSpreadsheetFile,
  extractTextFromSpreadsheetFile,
  isPdfImportFile,
  isTextLikeImportFile,
  classifyUniversalImportFile,
  parseTextIntoWeeks,
  toWorkoutBlocks,
  toWorkoutSections,
  captureAppError,
  prsStorage,
  prefsStorage,
  activeWeekStorage,
  dayOverrideStorage,
  pdfStorage,
  pdfMetaStorage,
  PDF_KEY,
  METADATA_KEY,
  selectActiveWeek,
  syncImportedPlanToAccount,
  applyWorkoutToState,
  applyPreferredWorkout,
  reprocessActiveWeek,
});

const {
  handleImportPRsFromCSV,
  handleImportWorkout,
  handleExportPRsToCSV,
  downloadPRsTemplate,
  handleMultiWeekPdfUpload,
  handleUniversalImport,
  handleExportBackup,
  handleImportBackup,
  handleExportWorkout,
  handleExportPRs,
  handleImportPRs,
  loadDefaultPRs,
  clearAllPdfs,
} = importExportDomain;

const athleteInteractionDomain = createAthleteInteractionDomain({
  getState,
  setState,
  emit,
  logDebug,
  navigatorObject: NAVIGATOR_OBJECT,
  copyWorkout,
  addOrUpdatePR,
  removePR,
  listAllPRs,
  reprocessActiveWeek,
});

const {
  handleCopyWorkout,
  handleUpdatePreferences,
  handleAddPR,
  handleRemovePR,
  handleListPRs,
} = athleteInteractionDomain;

export {
  handleCopyWorkout,
  handleUpdatePreferences,
  handleAddPR,
  handleRemovePR,
  handleListPRs,
  handleRequestSignUpVerification,
  handleRequestPasswordReset,
  handleConfirmPasswordReset,
  handleGetProfile,
  handleGetAdminOverview,
  handleGetAdminOpsHealth,
  handleActivateCoachSubscription,
  handleReprocessBillingClaim,
  handleRetryEmailJob,
  handleCreateManualPasswordReset,
  handleRequestAccountDeletion,
  handleDeleteAccountNow,
  handleOpenCheckout,
  handleGetSubscriptionStatus,
  handleGetEntitlements,
  handleActivateMockSubscription,
  handleGetRuntimeConfig,
  handleSetRuntimeConfig,
  handleCreateGym,
  handleGetMyGyms,
  handleAddGymMember,
  handleListGymMembers,
  handleListGymGroups,
  handleCreateGymGroup,
  handlePublishGymWorkout,
  handleGetWorkoutFeed,
  handleGetAccessContext,
  handleGetAthleteSummary,
  handleGetAthleteResultsSummary,
  handleGetAthleteWorkoutsRecent,
  handleGetAppStateSnapshot,
  handleGetImportedPlanSnapshot,
  handleSaveAppStateSnapshot,
  handleSaveImportedPlanSnapshot,
  handleDeleteImportedPlanSnapshot,
  handleGetGymInsights,
  handleGetMeasurementHistory,
  handleLogAthletePr,
  handleLogRunningSession,
  handleGetRunningHistory,
  handleLogStrengthSession,
  handleGetStrengthHistory,
  remoteHandleSyncAthleteMeasurementsSnapshot,
  remoteHandleSyncAthletePrSnapshot,
  handleGetBenchmarks,
};

// ========== DEBUG APIs ==========

/**
 * Expõe APIs para debug no console
 */
function exposeDebugAPIs() {
  const profile = handleGetProfile()?.data || null;
  const api = {
    // State
    getState,
    getStateSnapshot,

    // PDF Multi-week
    uploadMultiWeekPdf: handleMultiWeekPdfUpload,
    importFromFile: handleUniversalImport,
    clearAllPdfs,
    selectWeek: selectActiveWeek,
    getWeeks: () => getState().weeks,
    getActiveWeek: () => getState().activeWeekNumber,

    // Controle de dia
    setDay: setCustomDay,
    resetDay: resetToAutoDay,
    getCurrentDay: () => getState().currentDay,
    setPreferences: handleUpdatePreferences,

    // Workout
    copyWorkout: handleCopyWorkout,
    exportWorkout: handleExportWorkout,
    importWorkout: handleImportWorkout,
    exportBackup: handleExportBackup,
    importBackup: handleImportBackup,
    signUp: handleSignUp,
    requestSignUpVerification: handleRequestSignUpVerification,
    confirmSignUp: handleConfirmSignUp,
    signIn: handleSignIn,
    signInWithGoogle: handleSignInWithGoogle,
    startGoogleSignInRedirect: handleStartGoogleRedirect,
    refreshSession: handleRefreshSession,
    requestPasswordReset: handleRequestPasswordReset,
    confirmPasswordReset: handleConfirmPasswordReset,
    signOut: handleSignOut,
    getProfile: handleGetProfile,
    getAdminOverview: handleGetAdminOverview,
    getAdminOpsHealth: handleGetAdminOpsHealth,
    activateCoachSubscription: handleActivateCoachSubscription,
    reprocessBillingClaim: handleReprocessBillingClaim,
    retryEmailJob: handleRetryEmailJob,
    createManualPasswordReset: handleCreateManualPasswordReset,
    requestAccountDeletion: handleRequestAccountDeletion,
    deleteAccountNow: handleDeleteAccountNow,
    createGym: handleCreateGym,
    getMyGyms: handleGetMyGyms,
    addGymMember: handleAddGymMember,
    listGymMembers: handleListGymMembers,
    listGymGroups: handleListGymGroups,
    createGymGroup: handleCreateGymGroup,
    publishGymWorkout: handlePublishGymWorkout,
    getWorkoutFeed: handleGetWorkoutFeed,
    getAccessContext: handleGetAccessContext,
    getAthleteSummary: handleGetAthleteSummary,
    getAthleteResultsSummary: handleGetAthleteResultsSummary,
    getAthleteWorkoutsRecent: handleGetAthleteWorkoutsRecent,
    getAppStateSnapshot: handleGetAppStateSnapshot,
    saveAppStateSnapshot: saveRemoteAppStateSnapshot,
    getImportedPlanSnapshot: handleGetImportedPlanSnapshot,
    saveImportedPlanSnapshot: handleSaveImportedPlanSnapshot,
    deleteImportedPlanSnapshot: handleDeleteImportedPlanSnapshot,
    getGymInsights: handleGetGymInsights,
    logAthletePr: handleLogAthletePr,
    getMeasurementHistory: handleGetMeasurementHistory,
    logRunningSession: handleLogRunningSession,
    getRunningHistory: handleGetRunningHistory,
    logStrengthSession: handleLogStrengthSession,
    getStrengthHistory: handleGetStrengthHistory,
    syncAthleteMeasurementsSnapshot: syncAthleteMeasurementsSnapshotWithQueue,
    syncAthletePrSnapshot: syncAthletePrSnapshotWithQueue,
    getBenchmarks: handleGetBenchmarks,
    openCheckout: handleOpenCheckout,
    getSubscriptionStatus: handleGetSubscriptionStatus,
    getEntitlements: handleGetEntitlements,
    activateMockSubscription: handleActivateMockSubscription,
    getRuntimeConfig: handleGetRuntimeConfig,
    setRuntimeConfig: handleSetRuntimeConfig,
    // PRs
    addPR: handleAddPR,
    removePR: handleRemovePR,
    listPRs: handleListPRs,
    
    // PRs - Import/Export
    exportPRs: handleExportPRs,                    // JSON
    importPRs: handleImportPRs,                    // JSON
    exportPRsCSV: handleExportPRsToCSV,            // CSV (NOVO)
    importPRsCSV: handleImportPRsFromCSV,          // CSV (NOVO)
    loadDefaultPRs: loadDefaultPRs,                // Do arquivo prs.js (NOVO)
    downloadPRsTemplate: downloadPRsTemplate,      // Template CSV (NOVO)

    // Info
    getPdfInfo,

    // Events
    on,
    emit,
  };

  if (isDeveloperProfile(profile)) {
    api.debugState = debugState;
  }

  exposeAppApi(api);

  logDebug('🐛 Debug APIs expostas no bridge interno');
}
async function reprocessActiveWeek() {
  await applyPreferredWorkout({ fallbackToWelcome: true });
}
