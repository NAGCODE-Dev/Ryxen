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
    if (token) return;
    const googleClientId = window.__CROSSAPP_CONFIG__?.auth?.googleClientId || '';
    const mount = document.getElementById('coach-google-signin');
    if (!googleClientId || !mount) return;

    let attempt = 0;
    const timer = window.setInterval(() => {
      if (!window.google?.accounts?.id) {
        attempt += 1;
        if (attempt > 8) window.clearInterval(timer);
        return;
      }

      window.clearInterval(timer);
      mount.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const result = await apiRequest('/auth/google', {
              method: 'POST',
              body: { credential: response.credential },
            });
            if (result?.token) writeToken(result.token);
            if (result?.user) writeProfile(result.user);
            setToken(result.token || '');
            setProfile(result.user || null);
            setMessage('Sessão iniciada com Google');
          } catch (err) {
            setError(err.message || 'Erro ao autenticar com Google');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(mount, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
      });
    }, 300);

    return () => window.clearInterval(timer);
  }, [token]);

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
      React.createElement('div', { className: 'auth-card' },
        React.createElement('div', { className: 'eyebrow' }, 'CrossApp'),
        React.createElement('h1', null, 'Coach Portal'),
        React.createElement('p', { className: 'muted' }, 'Portal separado do atleta, usando a mesma API e a mesma sessão.'),
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
        React.createElement('div', { className: 'auth-google' },
          React.createElement('div', { className: 'muted auth-dividerText' }, 'ou'),
          React.createElement('div', { id: 'coach-google-signin' })
        ),
        React.createElement('a', { className: 'portal-link', href: '/' }, 'Abrir app do atleta')
      )
    );
  }

  return React.createElement(
    Suspense,
    {
      fallback: React.createElement('div', { className: 'portal-shell auth-shell' },
        React.createElement('div', { className: 'auth-card' },
          React.createElement('div', { className: 'eyebrow' }, 'CrossApp'),
          React.createElement('h1', null, 'Coach Portal'),
          React.createElement('p', { className: 'muted' }, 'Carregando workspace...')
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
  const provider = params.get('provider');
  const paymentId = params.get('payment_id');

  if (billing === 'success' && provider === 'mercadopago' && paymentId) {
    try {
      await apiRequest('/billing/mercadopago/confirm', {
        method: 'POST',
        body: { paymentId },
      });
      setMessage('Pagamento confirmado com Mercado Pago');
      clearBillingParams(params);
    } catch (err) {
      setError(err.message || 'Erro ao confirmar pagamento Mercado Pago');
    }
    return;
  }

  if (billing === 'success' && provider === 'stripe') {
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
  params.delete('provider');
  params.delete('payment_id');
  params.delete('payment_status');
  params.delete('status');
  params.delete('merchant_order_id');
  params.delete('preference_id');
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
