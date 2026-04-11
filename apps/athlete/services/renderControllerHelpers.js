export function createRenderStateCache() {
  return {
    headerSignature: '',
    headerHtml: '',
    mainSignature: '',
    mainHtml: '',
    bottomSignature: '',
    bottomHtml: '',
    modalSignature: '',
    modalHtml: '',
  };
}

export function createObjectIdentityTracker() {
  const objectIds = new WeakMap();
  let nextObjectId = 1;

  const getObjectIdentity = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return String(value ?? '');
    }
    let id = objectIds.get(value);
    if (!id) {
      id = nextObjectId++;
      objectIds.set(value, id);
    }
    return `#${id}`;
  };

  return {
    getObjectIdentity,
  };
}

export function createRenderSignatures({ getObjectIdentity }) {
  const buildHeaderSignature = (state) => [
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    getObjectIdentity(state?.__ui?.passwordReset || null),
    getObjectIdentity(state?.__ui?.admin || null),
    state?.__ui?.sessionRestore || 'idle',
    state?.__ui?.platformVariant || 'web',
  ].join('|');
  const buildBottomSignature = (state) => [
    String(state?.__ui?.currentPage || 'today'),
    state?.__ui?.platformVariant || 'web',
  ].join('|');
  const buildModalSignature = (state) => [
    state?.__ui?.modal || '',
    state?.__ui?.authMode || '',
    state?.__ui?.platformVariant || 'web',
    getObjectIdentity(state?.prs || null),
    getObjectIdentity(state?.__ui?.guide || null),
    getObjectIdentity(state?.__ui?.passwordReset || null),
    getObjectIdentity(state?.__ui?.signupVerification || null),
    getObjectIdentity(state?.__ui?.importStatus || null),
    getObjectIdentity(state?.__ui?.admin || null),
    getObjectIdentity(state?.__ui?.athleteOverview || null),
    getObjectIdentity(state?.__ui?.coachPortal || null),
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    state?.__ui?.isBusy ? '1' : '0',
  ].join('|');
  const buildMainSignature = (state) => [
    state?.__ui?.currentPage || 'today',
    state?.__ui?.accountView || 'overview',
    state?.__ui?.platformVariant || 'web',
    state?.activeWeekNumber ?? '',
    state?.currentDay ?? '',
    getObjectIdentity(state?.weeks || null),
    getObjectIdentity(state?.workout || null),
    getObjectIdentity(state?.workoutOfDay || null),
    getObjectIdentity(state?.workoutContext || null),
    getObjectIdentity(state?.preferences || null),
    getObjectIdentity(state?.prs || null),
    getObjectIdentity(state?.__ui?.settings || null),
    getObjectIdentity(state?.__ui?.athleteOverview || null),
    getObjectIdentity(state?.__ui?.coachPortal || null),
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    state?.__ui?.isBusy ? '1' : '0',
  ].join('|');

  return {
    buildHeaderSignature,
    buildBottomSignature,
    buildModalSignature,
    buildMainSignature,
  };
}
