import { describe, it, expect } from 'vitest';
import { validateWorkoutContract, validateOnboardingContract } from './flowContracts.js';

describe('flow contracts', () => {
  it('valida workout', () => {
    expect(validateWorkoutContract({ blocks: [] }).valid).toBe(true);
    expect(validateWorkoutContract({}).valid).toBe(false);
  });

  it('valida onboarding', () => {
    expect(validateOnboardingContract({ profile: {} }).valid).toBe(true);
    expect(validateOnboardingContract(null).valid).toBe(false);
  });
});
