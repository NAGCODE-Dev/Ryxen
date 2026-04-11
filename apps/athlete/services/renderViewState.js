import { buildAthleteUiForRender } from '../state/uiState.js';
import {
  safeGetAthleteAppState,
  safeGetAthleteProfile,
} from './uiControllerHelpers.js';
import { getAthletePlatformVariant } from '../platformVariant.js';

export function buildAthleteRenderState({ getUiState, getUiBusy }) {
  const state = safeGetAthleteAppState();
  const uiState = getUiState();
  const platformVariant = getAthletePlatformVariant();

  state.__ui = {
    ...buildAthleteUiForRender({
      state,
      uiState,
      uiBusy: getUiBusy(),
      profile: safeGetAthleteProfile(),
    }),
    platformVariant,
    sessionRestore: state?.ui?.sessionRestore || 'idle',
  };

  return state;
}
