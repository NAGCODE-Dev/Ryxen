import React, { Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { getRuntimeConfig } from '../packages/shared-web/runtime.js';
import { applyAuthRedirectFromUrl, buildGoogleRedirectUrl } from '../packages/shared-web/auth.js';
import { createCoachApiRequest } from './apiClient.js';
import '../coach/styles.css';

const CoachWorkspace = React.lazy(() => import('./workspace.js'));
const DEFAULT_COACH_RETURN_TO = '/coach/';

const STORAGE_KEYS = {
  token: 'ryxen-auth-token',
  legacyToken: 'crossapp-auth-token',
  profile: 'ryxen-user-profile',
  legacyProfile: 'crossapp-user-profile',
  runtime: 'ryxen-runtime-config',
  legacyRuntime: 'crossapp-runtime-config',
};

const apiRequest = createCoachApiRequest({ readToken });

setupVercelObservability();

function App() {
  const [token, setToken] = useState(readToken());
  const [profile, setProfile] = useState(readProfile());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });

  useEffect(() => {
    const redirect = applyAuthRedirectFromLocation();
    if (!redirect.handled) return;
    if (redirect.token) setToken(redirect.token);
    if (redirect.user) setProfile(redirect.user);
    if (redirect.success) {
      setMessage('Sessão iniciada com Google');
      setError('');
    } else {
      setError(redirect.error || 'Não foi possível entrar com Google');
    }
  }, []);

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

  function handleGoogleLogin() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const target = buildGoogleRedirectUrl();
      const returnTo = normalizeReturnTo(`${window.location.pathname}${window.location.search}`, DEFAULT_COACH_RETURN_TO);
      target.searchParams.set('returnTo', returnTo);
      window.location.assign(target.toString());
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Google Sign-In indisponível');
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.legacyToken);
    localStorage.removeItem(STORAGE_KEYS.profile);
    localStorage.removeItem(STORAGE_KEYS.legacyProfile);
    setToken('');
    setProfile(null);
    setMessage('Sessão encerrada');
    setError('');
  }

  if (!token) {
    return React.createElement('div', { className: 'portal-shell auth-shell' },
      React.createElement('div', { className: 'auth-layout' },
        React.createElement('section', { className: 'auth-card' },
          React.createElement('div', { className: 'eyebrow' }, 'Ryxen Coach'),
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
          React.createElement('div', { className: 'auth-divider', role: 'presentation' },
            React.createElement('span', { className: 'auth-dividerText' }, 'ou continue com Google')
          ),
          React.createElement('button', {
            className: 'btn btn-secondary auth-googlePortalBtn',
            type: 'button',
            disabled: loading,
            onClick: handleGoogleLogin,
          },
            React.createElement('span', { className: 'auth-googlePortalMark', 'aria-hidden': 'true' }, 'G'),
            React.createElement('span', null, 'Continuar com Google')
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
            React.createElement('div', { className: 'eyebrow' }, 'Ryxen'),
            React.createElement('h1', null, 'Coach Portal'),
            React.createElement('p', { className: 'muted' }, 'Carregando workspace...')
          )
        )
      ),
    },
    React.createElement(CoachWorkspace, { profile, onLogout: handleLogout })
  );
}

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.legacyToken) || '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token || '');
  localStorage.setItem(STORAGE_KEYS.legacyToken, token || '');
}

function readProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile) || localStorage.getItem(STORAGE_KEYS.legacyProfile);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile) {
  const serialized = JSON.stringify(profile || null);
  localStorage.setItem(STORAGE_KEYS.profile, serialized);
  localStorage.setItem(STORAGE_KEYS.legacyProfile, serialized);
}

function applyAuthRedirectFromLocation() {
  return applyAuthRedirectFromUrl(window.location.href, { cleanupCurrentLocation: true });
}

function authFeatureCard(title, copy) {
  return React.createElement('div', { className: 'auth-feature' },
    React.createElement('strong', null, title),
    React.createElement('span', null, copy)
  );
}

function readRuntimeConfig() {
  return getRuntimeConfig();
}

function normalizeReturnTo(value, fallback = DEFAULT_COACH_RETURN_TO) {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return fallback;
  }
  return raw;
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
  if (window.__RYXEN_VERCEL_OBSERVABILITY__ || window.__CROSSAPP_VERCEL_OBSERVABILITY__) return;
  window.__RYXEN_VERCEL_OBSERVABILITY__ = true;
  window.__CROSSAPP_VERCEL_OBSERVABILITY__ = true;
  inject();
  injectSpeedInsights();
}

createRoot(document.getElementById('coach-root')).render(React.createElement(App));
