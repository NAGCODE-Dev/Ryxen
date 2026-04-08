export function updateAthleteRenderCounters({ state, refs, setLayoutText }) {
  if (refs.prsCount) {
    const count = Object.keys(state?.prs || {}).length;
    setLayoutText(refs.prsCount, `${count} PRs`);
  }
}

