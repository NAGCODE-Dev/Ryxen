import { describe, it, expect } from 'vitest';

function shouldSync(local, remote) {
  return JSON.stringify(local) !== JSON.stringify(remote);
}

describe('athlete sync', () => {
  it('detecta mudança', () => {
    expect(shouldSync({a:1},{a:2})).toBe(true);
    expect(shouldSync({a:1},{a:1})).toBe(false);
  });
});
