import test from 'node:test';
import assert from 'node:assert/strict';

import { createRenderSignatures } from '../apps/athlete/services/renderControllerHelpers.js';

test('buildModalSignature reage à troca de passo do guia do Nyx', () => {
  const ids = new WeakMap();
  let nextId = 0;
  const getObjectIdentity = (value) => {
    if (!value || typeof value !== 'object') return String(value ?? '');
    if (!ids.has(value)) ids.set(value, `obj-${++nextId}`);
    return ids.get(value);
  };

  const { buildModalSignature } = createRenderSignatures({ getObjectIdentity });

  const step0 = {
    __ui: {
      modal: 'nyx-guide',
      guide: { step: 0 },
    },
  };
  const step1 = {
    __ui: {
      modal: 'nyx-guide',
      guide: { step: 1 },
    },
  };

  assert.notEqual(buildModalSignature(step0), buildModalSignature(step1));
});
