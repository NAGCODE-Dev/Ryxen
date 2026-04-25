import { describe, it, expect } from 'vitest';

function getErrorMessage(err) {
  return err?.message || 'Erro desconhecido';
}

function getSuccessMessage(msg) {
  return msg || 'Sucesso';
}

describe('error & feedback helpers', () => {
  it('normaliza erro', () => {
    expect(getErrorMessage(new Error('fail'))).toBe('fail');
    expect(getErrorMessage(null)).toBe('Erro desconhecido');
  });

  it('normaliza sucesso', () => {
    expect(getSuccessMessage('ok')).toBe('ok');
    expect(getSuccessMessage()).toBe('Sucesso');
  });
});
