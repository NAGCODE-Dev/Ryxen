import React from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import App from './App.jsx';
import '../../packages/ui/styles.css';
import './styles.css';

inject();
injectSpeedInsights();

const rootNode = document.getElementById('athlete-react-root');
if (rootNode) {
  createRoot(rootNode).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
