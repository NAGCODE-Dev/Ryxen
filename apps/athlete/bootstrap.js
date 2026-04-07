import { applyAppContext } from './bootstrapEnvironment.js';
import { runAthleteBootstrapFlow } from './bootstrapFlow.js';

export function bootstrapAthleteApp() {
  if (window.__TREINO_BOOTSTRAPPED__) {
    console.warn('⚠️ Boot já executado. Ignorando reexecução do main.js.');
    return;
  }

  window.__TREINO_BOOTSTRAPPED__ = true;
  runBootstrap();
}

async function runBootstrap() {
  applyAppContext();
  await runAthleteBootstrapFlow();
}
