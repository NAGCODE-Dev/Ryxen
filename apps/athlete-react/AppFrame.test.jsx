import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AppFrame } from '../../packages/ui/index.js';

describe('AppFrame', () => {
  it('marca modo nativo e reduceMotion na shell nova', () => {
    render(
      <AppFrame nativeShell reducedMotion>
        <div>shell</div>
      </AppFrame>,
    );

    const text = screen.getByText('shell');
    const shell = text.closest('.rx-shell');

    expect(shell).toHaveAttribute('data-native-shell', 'true');
    expect(shell).toHaveAttribute('data-motion', 'reduced');
  });
});
