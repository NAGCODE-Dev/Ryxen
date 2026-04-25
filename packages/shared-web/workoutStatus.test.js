import { describe, it, expect } from 'vitest';

function mapStatus(s) {
  if (s === 'done') return 'Concluído';
  if (s === 'pending') return 'Pendente';
  return 'Desconhecido';
}

describe('workout status', () => {
  it('mapeia status', () => {
    expect(mapStatus('done')).toBe('Concluído');
    expect(mapStatus('pending')).toBe('Pendente');
    expect(mapStatus('x')).toBe('Desconhecido');
  });
});
