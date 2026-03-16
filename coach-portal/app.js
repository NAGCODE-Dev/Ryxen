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

export default function App() {
  const [token, setToken] = useState(readToken());
  const [profile, setProfile] = useState(readProfile());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [passwordReset, setPasswordReset] = useState({
    open: false,
    email: '',
    code: '',
    newPassword: '',
    supportEmail: '',
    previewCode: '',
    previewUrl: '',
    statusMessage: '',
    statusTone: '',
  });

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

  async function handleRequestPasswordReset(event) {
    event.preventDefault();
    const email = String(passwordReset.email || login.email || '').trim().toLowerCase();
    if (!email) {
      setError('Informe o email da conta');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/auth/request-password-reset', {
        method: 'POST',
        body: { email },
        token: '',
      });
      setPasswordReset((prev) => ({
        ...prev,
        open: true,
        email,
        supportEmail: result?.supportEmail || '',
        previewCode: result?.previewCode || '',
        previewUrl: result?.delivery?.previewUrl || '',
        statusMessage: result?.message || 'Código de recuperação enviado para o email.',
        statusTone: 'success',
      }));
      setMessage('Código de recuperação enviado');
    } catch (err) {
      setPasswordReset((prev) => ({
        ...prev,
        open: true,
        email,
        statusMessage: err.message || 'Não foi possível enviar o email de recuperação',
        statusTone: 'error',
      }));
      setError(err.message || 'Erro ao solicitar recuperação');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPasswordReset(event) {
    event.preventDefault();
    const email = String(passwordReset.email || '').trim().toLowerCase();
    const code = String(passwordReset.code || '').trim();
    const newPassword = String(passwordReset.newPassword || '');

    if (!email || !code || !newPassword) {
      setError('Preencha email, código e nova senha');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/auth/confirm-password-reset', {
        method: 'POST',
        body: { email, code, newPassword },
        token: '',
      });
      setPasswordReset({
        open: false,
        email: '',
        code: '',
        newPassword: '',
        supportEmail: '',
        previewCode: '',
        previewUrl: '',
        statusMessage: '',
        statusTone: '',
      });
      setLogin((prev) => ({ ...prev, email }));
      setMessage('Senha atualizada. Faça login com a nova senha.');
    } catch (err) {
      setError(err.message || 'Erro ao redefinir senha');
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
          React.createElement('p', { className: 'muted' }, 'Entre para publicar treinos, organizar atletas e cuidar da rotina do box em uma área separada do app do atleta.'),
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
          React.createElement('button', {
            className: 'btn btn-link portal-inlineLink',
            type: 'button',
            onClick: () => setPasswordReset((prev) => ({ ...prev, open: !prev.open, email: prev.email || login.email || '', statusMessage: '', statusTone: '' })),
          }, passwordReset.open ? 'Fechar recuperação' : 'Recuperar senha'),
          passwordReset.open
            ? React.createElement('div', { className: 'auth-resetCard stack' },
                React.createElement('form', { className: 'stack', onSubmit: handleRequestPasswordReset },
                  React.createElement('input', {
                    className: 'field',
                    type: 'email',
                    placeholder: 'Email da conta',
                    value: passwordReset.email,
                    onChange: (e) => setPasswordReset((prev) => ({ ...prev, email: e.target.value })),
                  }),
                  React.createElement('button', { className: 'btn btn-secondary', type: 'submit', disabled: loading }, loading ? 'Enviando...' : 'Gerar código')
                ),
                passwordReset.statusMessage
                  ? React.createElement('div', { className: `notice ${passwordReset.statusTone === 'error' ? 'error' : 'success'}` }, passwordReset.statusMessage)
                  : null,
                React.createElement('form', { className: 'stack', onSubmit: handleConfirmPasswordReset },
                  React.createElement('input', {
                    className: 'field',
                    type: 'text',
                    placeholder: 'Código de 6 dígitos',
                    value: passwordReset.code,
                    onChange: (e) => setPasswordReset((prev) => ({ ...prev, code: e.target.value })),
                  }),
                  React.createElement('input', {
                    className: 'field',
                    type: 'password',
                    placeholder: 'Nova senha (mín. 8 caracteres)',
                    value: passwordReset.newPassword,
                    onChange: (e) => setPasswordReset((prev) => ({ ...prev, newPassword: e.target.value })),
                  }),
                  React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: loading }, loading ? 'Salvando...' : 'Trocar senha')
                ),
                React.createElement('p', { className: 'muted auth-resetHint' },
                  `O código é enviado por email${passwordReset.supportEmail ? ` via ${passwordReset.supportEmail}` : ''}.`
                ),
                passwordReset.previewCode
                  ? React.createElement('p', { className: 'notice success' }, `Código de desenvolvimento: ${passwordReset.previewCode}`)
                  : null,
                passwordReset.previewUrl
                  ? React.createElement('a', { className: 'portal-link', href: passwordReset.previewUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir preview do email')
                  : null
              )
            : null,
          React.createElement('a', { className: 'portal-link', href: '/' }, 'Voltar para a plataforma')
        ),
        React.createElement('aside', { className: 'auth-panel' },
          React.createElement('div', { className: 'eyebrow' }, 'Para quem organiza o box'),
          React.createElement('h2', null, 'Use a mesma conta, mas no portal certo para gerir treino e atletas.'),
          React.createElement('p', { className: 'muted auth-panelCopy' }, 'O Coach Portal reúne publicação, grupos, atletas, benchmarks e assinatura em uma área própria para gestão.'),
          React.createElement('div', { className: 'auth-panelGrid' },
            authFeatureCard('Publique treinos', 'Envie programação para todos, grupos ou atletas específicos sem sair do portal.'),
            authFeatureCard('Organize atletas', 'Centralize gyms, membros e grupos em um fluxo mais claro de gestão.'),
            authFeatureCard('Acompanhe o acesso', 'Veja assinatura, status do box e impacto no acesso do coach.'),
            authFeatureCard('Mesma conta, área separada', 'Coach e atleta usam a mesma conta, mas cada experiência fica no lugar certo.')
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
            React.createElement('div', { className: 'eyebrow' }, 'CrossApp Coach'),
            React.createElement('h1', null, 'Coach Portal'),
            React.createElement('p', { className: 'muted' }, 'Carregando portal...')
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

export function mountCoachPortal(rootId = 'coach-root') {
  const target = document.getElementById(rootId);
  if (!target) {
    throw new Error(`Coach Portal root "${rootId}" não encontrado`);
  }
  createRoot(target).render(React.createElement(App));
}
