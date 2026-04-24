export function isAthleteReactShellEnabled(config = {}) {
  return config?.app?.rollout?.athleteReactShell === true;
}

export function resolveAthleteEntryUrl(config = {}, fallbackUrl = '/sports/cross/index.html') {
  return isAthleteReactShellEnabled(config) ? '/athlete/' : fallbackUrl;
}
