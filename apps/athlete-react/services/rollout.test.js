import { describe, expect, it } from 'vitest';

import { isAthleteReactShellEnabled, resolveAthleteEntryUrl } from './rollout.js';

describe('athlete rollout flag', () => {
  it('liga a shell nova quando athleteReactShell está habilitada', () => {
    const config = {
      app: {
        rollout: {
          athleteReactShell: true,
        },
      },
    };

    expect(isAthleteReactShellEnabled(config)).toBe(true);
    expect(resolveAthleteEntryUrl(config)).toBe('/athlete/');
  });

  it('mantém fallback legado quando a flag está desligada', () => {
    const config = {
      app: {
        rollout: {
          athleteReactShell: false,
        },
      },
    };

    expect(isAthleteReactShellEnabled(config)).toBe(false);
    expect(resolveAthleteEntryUrl(config)).toBe('/sports/cross/index.html');
  });
});
