import React, { Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import '../coach/styles.css';

const CoachWorkspace = React.lazy(() => import('./workspace.js'));

const STORAGE_KEYS = {
  token: 'crossapp-auth-token',
  profile: 'crossapp-user-profile',
  runtime: 'crossapp-runtime-config',
};

setupVercelObservability();

function App() {
  const [token, setToken] = useState(readToken());
  const [profile, setProfile] = useState(readProfile());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });

  useEffect(() => {
    if (!token) return;
    handleBillingReturn(setMessage, setError);
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/auth/signin', {
        method: 'POST',
        body: login,
        token: '',
      });
      if (result?.token) writeToken(result.token);
      if (result?.user) writeProfile(result.user);
      setToken(result.token || '');
      setProfile(result.user || null);
      setMessage('Sessão iniciada');
    } catch (err) {
      setError(err.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.profile);
    setToken('');
    setProfile(null);
    setMessage('Sessão encerrada');
    setError('');
  }

  if (!token) {
    return React.createElement('div', { className: 'portal-shell auth-shell' },
      React.createElement('div', { className: 'auth-layout' },
        React.createElement('section', { className: 'auth-card' },
          React.createElement('div', { className: 'eyebrow' }, 'CrossApp Coach'),
          React.createElement('h1', null, 'Coach Portal'),
          React.createElement('p', { className: 'muted' }, 'Entre para publicar treinos, organizar atletas e acompanhar o box sem depender de planilha solta.'),
          error ? React.createElement('div', { className: 'notice error' }, error) : null,
          message ? React.createElement('div', { className: 'notice success' }, message) : null,
          React.createElement('form', { className: 'stack', onSubmit: handleLogin },
            React.createElement('input', {
              className: 'field',
              type: 'email',
              placeholder: 'Email',
              value: login.email,
              onChange: (e) => setLogin((prev) => ({ ...prev, email: e.target.value })),
            }),
            React.createElement('input', {
              className: 'field',
              type: 'password',
              placeholder: 'Senha',
              value: login.password,
              onChange: (e) => setLogin((prev) => ({ ...prev, password: e.target.value })),
            }),
            React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: loading }, loading ? 'Entrando...' : 'Entrar')
          ),
          React.createElement('div', { className: 'auth-links' },
            React.createElement('a', { className: 'portal-link', href: '/' }, 'Abrir app do atleta'),
            React.createElement('a', { className: 'portal-link', href: '/pricing.html' }, 'Ver planos')
          )
        ),
        React.createElement('aside', { className: 'auth-panel' },
          React.createElement('div', { className: 'eyebrow' }, 'Operação do coach'),
          React.createElement('h2', null, 'Um portal só para operar o box com mais clareza.'),
          React.createElement('p', { className: 'muted auth-panelCopy' }, 'O Coach Portal concentra programação, grupos, atletas, benchmarks, rankings e assinatura em uma experiência separada do app do atleta.'),
          React.createElement('div', { className: 'auth-panelGrid' },
            authFeatureCard('Publique treinos', 'Envie programação para todos, grupos ou atletas específicos.'),
            authFeatureCard('Gerencie atletas', 'Centralize membros, grupos e contexto operacional do gym.'),
            authFeatureCard('Acompanhe acesso', 'Visualize plano, status e benefícios herdados pelos atletas.'),
            authFeatureCard('Use a mesma conta', 'Coach e atleta compartilham sessão, mas com experiências separadas.')
          )
        )
      )
    );
  }

  return React.createElement(
    Suspense,
    {
      fallback: React.createElement('div', { className: 'portal-shell auth-shell' },
        React.createElement('div', { className: 'auth-layout auth-layout-loading' },
          React.createElement('div', { className: 'auth-card' },
            React.createElement('div', { className: 'eyebrow' }, 'CrossApp'),
            React.createElement('h1', null, 'Coach Portal'),
            React.createElement('p', { className: 'muted' }, 'Carregando workspace...')
          )
        )
      ),
    },
    React.createElement(CoachWorkspace, { profile, onLogout: handleLogout })
  );
}

async function apiRequest(path, options = {}) {
  const cfg = readRuntimeConfig();
  const base = cfg.apiBaseUrl || '/api';
  const url = `${base.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
  const token = options.token !== undefined ? options.token : readToken();

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Erro API (${response.status})`);
  }

  return data;
}

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.token) || '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token || '');
}

function readProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile || null));
}

function authFeatureCard(title, copy) {
  return React.createElement('div', { className: 'auth-feature' },
    React.createElement('strong', null, title),
    React.createElement('span', null, copy)
  );
}

function readRuntimeConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.runtime);
    const fromStorage = raw ? JSON.parse(raw) : {};
    return {
      ...(window.__CROSSAPP_CONFIG__ || {}),
      ...fromStorage,
      billing: {
        ...((window.__CROSSAPP_CONFIG__ || {}).billing || {}),
        ...(fromStorage.billing || {}),
      },
    };
  } catch {
    return window.__CROSSAPP_CONFIG__ || { apiBaseUrl: '/api' };
  }
}

async function handleBillingReturn(setMessage, setError) {
  const params = new URLSearchParams(window.location.search);
  const billing = params.get('billing');
  if (billing === 'success') {
    setMessage('Checkout concluído. Atualize o portal para refletir o plano.');
    clearBillingParams(params);
    return;
  }

  if (billing === 'cancel') {
    setError('Checkout cancelado');
    clearBillingParams(params);
  }
}

function clearBillingParams(params) {
  params.delete('billing');
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', next);
}

function setupVercelObservability() {
  if (window.__CROSSAPP_VERCEL_OBSERVABILITY__) return;
  window.__CROSSAPP_VERCEL_OBSERVABILITY__ = true;
  inject();
  injectSpeedInsights();
}

createRoot(document.getElementById('coach-root')).render(React.createElement(App));
