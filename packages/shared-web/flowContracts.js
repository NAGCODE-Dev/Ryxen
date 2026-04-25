export function validateWorkoutContract(workout) {
  const errors = [];

  if (!workout || typeof workout !== 'object') errors.push('workout_object');
  if (workout && !Array.isArray(workout.blocks)) errors.push('workout_blocks_array');

  if (Array.isArray(workout?.blocks)) {
    workout.blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object') {
        errors.push(`block_${index}_object`);
        return;
      }
      if (!String(block.type || '').trim()) errors.push(`block_${index}_type`);
      if (!Array.isArray(block.lines)) errors.push(`block_${index}_lines_array`);
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateOnboardingContract(onboarding) {
  const errors = [];

  if (!onboarding || typeof onboarding !== 'object') errors.push('onboarding_object');
  const profile = onboarding?.profile;
  if (!profile || typeof profile !== 'object') errors.push('profile_object');

  if (profile && typeof profile === 'object') {
    const email = String(profile.email || '').trim();
    if (profile.email !== undefined && !email.includes('@')) errors.push('profile_email');
  }

  return { valid: errors.length === 0, errors };
}
