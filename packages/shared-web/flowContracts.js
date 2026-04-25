export function validateWorkoutContract(workout) {
  const errors = [];

  if (!workout || typeof workout !== 'object') {
    errors.push({ path: 'workout', message: 'Workout precisa ser um objeto' });
  }

  if (workout && !Array.isArray(workout.blocks)) {
    errors.push({ path: 'workout.blocks', message: 'Blocks precisa ser array' });
  }

  if (Array.isArray(workout?.blocks)) {
    workout.blocks.forEach((block, i) => {
      if (!block || typeof block !== 'object') {
        errors.push({ path: `blocks[${i}]`, message: 'Bloco inválido' });
        return;
      }

      if (!String(block.type || '').trim()) {
        errors.push({ path: `blocks[${i}].type`, message: 'Tipo obrigatório' });
      }

      if (!Array.isArray(block.lines)) {
        errors.push({ path: `blocks[${i}].lines`, message: 'Lines precisa ser array' });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateOnboardingContract(onboarding) {
  const errors = [];

  if (!onboarding || typeof onboarding !== 'object') {
    errors.push({ path: 'onboarding', message: 'Onboarding precisa ser objeto' });
  }

  const profile = onboarding?.profile;
  if (!profile || typeof profile !== 'object') {
    errors.push({ path: 'profile', message: 'Profile precisa ser objeto' });
  }

  if (profile && typeof profile === 'object') {
    const email = String(profile.email || '').trim();
    if (profile.email !== undefined && !email.includes('@')) {
      errors.push({ path: 'profile.email', message: 'Email inválido' });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeWorkout(workout) {
  return {
    ...workout,
    blocks: (workout?.blocks || []).map((b) => ({
      type: b?.type || 'PROGRAMMING',
      lines: Array.isArray(b?.lines) ? b.lines : [],
    })),
  };
}
