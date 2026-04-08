import {
  canConsumeAthleteImport,
  getAthleteImportUsage,
  normalizeAthleteBenefits,
} from '../../../../src/core/services/athleteBenefitUsage.js';
import { getAppBridge } from '../../../../src/app/bridge.js';
import {
  createAthleteImportGuard,
  createImportBusyChecker,
} from '../import/guards.js';

export function createAthleteImportBindings({ getUiState }) {
  const guardAthleteImport = createAthleteImportGuard({
    getAppBridge,
    normalizeAthleteBenefits,
    getAthleteImportUsage,
    canConsumeAthleteImport,
  });
  const isImportBusy = createImportBusyChecker(getUiState);

  return {
    guardAthleteImport,
    isImportBusy,
  };
}
