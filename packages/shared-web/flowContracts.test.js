import { describe, it, expect } from 'vitest';

function validateWorkout(w) {
  return Boolean(w && Array.isArray(w.blocks));
}

function validateOnboarding(o) {
  return Boolean(o && typeof o.profile === 'object' && o.profile !== null);
}

describe('flow contracts', () => {
  it('valida workout', () => {
    expect(validateWorkout({ blocks: [] })).toBe(true);
    expect(validateWorkout({})).toBe(false);
  });

  it('valida onboarding', () => {
    expect(validateOnboarding({ profile: {} })).toBe(true);
    expect(validateOnboarding(null)).toBe(false);
  });
});
