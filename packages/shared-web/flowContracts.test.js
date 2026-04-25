import { describe, it, expect } from 'vitest';

function validateWorkout(w) {
  return w && Array.isArray(w.blocks);
}

function validateOnboarding(o) {
  return o && typeof o.profile === 'object';
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
