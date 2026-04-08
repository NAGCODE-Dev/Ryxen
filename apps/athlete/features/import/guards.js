export function resolveAthleteBenefitsForImport(uiState, accessContext, normalizeAthleteBenefits) {
  const overviewBenefits = uiState?.athleteOverview?.athleteBenefits || null;
  const accessBenefits = accessContext?.data?.athleteBenefits || accessContext?.athleteBenefits || null;
  return normalizeAthleteBenefits(overviewBenefits || accessBenefits || null);
}

export function createAthleteImportGuard({
  getAppBridge,
  normalizeAthleteBenefits,
  getAthleteImportUsage,
  canConsumeAthleteImport,
}) {
  return async function guardAthleteImport(kind, uiState) {
    const profile = getAppBridge()?.getProfile?.()?.data || null;
    const accessContext = profile?.email ? await getAppBridge()?.getAccessContext?.() : null;
    const benefits = resolveAthleteBenefitsForImport(uiState, accessContext, normalizeAthleteBenefits);
    const usage = getAthleteImportUsage(benefits, kind);

    if (!canConsumeAthleteImport(benefits, kind)) {
      throw new Error(
        usage.limit === null
          ? 'Seu plano atual não permite mais importações neste período'
          : `Limite mensal atingido: ${usage.used}/${usage.limit} importações entre PDF e mídia. Seu nível atual é ${benefits.label}.`,
      );
    }

    return { benefits, usage };
  };
}

export function createImportBusyChecker(getUiState) {
  return function isImportBusy() {
    return !!(getUiState?.()?.importStatus || {})?.active;
  };
}
