import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { getRuntimeConfig } from '../config/runtime.js';

const STORAGE_KEY = 'crossapp-active-sport';

boot();

function boot() {
  inject();
  injectSpeedInsights();

  const root = document.getElementById('hub-root');
  if (!root) return;

  const cfg = getRuntimeConfig();
  const sports = cfg?.app?.sports || {};
  const availableSports = getAvailableSports(cfg);
  const fallbackSport = availableSports[0]?.value || 'cross';
  const lastSport = getLastSport();
  const selectedSport = availableSports.some((sport) => sport.value === lastSport) ? lastSport : fallbackSport;
  const lastSportUrl = sports[selectedSport] || sports.cross || '/sports/cross/';

  root.innerHTML = renderHub({ sports, availableSports, lastSport: selectedSport, lastSportUrl });
  bindEvents(root, sports);
}

function bindEvents(root, sports) {
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-sport-link]');
    if (!target) return;
    const sport = target.getAttribute('data-sport-link');
    if (sport) setLastSport(sport);
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name !== 'hub-sport') return;

    const sport = target.value;
    const nextUrl = sports[sport] || '/sports/cross/';
    const primary = root.querySelector('[data-hub-primary]');
    if (primary) {
      primary.setAttribute('href', nextUrl);
      primary.textContent = `Abrir ${labelForSport(sport)}`;
      primary.setAttribute('data-sport-link', sport);
    }
    setLastSport(sport);
  });
}

function renderHub({ sports, availableSports, lastSport, lastSportUrl }) {
  const selectedSport = lastSport || 'cross';
  const hasBeta = availableSports.some((sport) => sport.tier === 'beta');
  return `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">CrossApp Hub</div>
        <h1>Use sozinho ou conectado ao seu coach, sem complicar a rotina.</h1>
        <p class="hub-lead">
          O CrossApp funciona de dois jeitos: como app diário do atleta no modo solo, ou como experiência ampliada quando você está vinculado a um coach que publica treino, organiza grupos e libera mais recursos.
        </p>
        <div class="hub-actions">
          <a class="hub-primaryAction" href="${escapeHtml(lastSportUrl)}" data-hub-primary data-sport-link="${escapeHtml(selectedSport)}">
            Abrir ${escapeHtml(labelForSport(selectedSport))}
          </a>
          <a class="hub-secondaryAction" href="/coach/">Abrir Coach Portal</a>
        </div>
        <div class="hub-meta">
          <span>Use solo com 5 imports/mês</span>
          <span>Coach ativo libera mais recursos</span>
          <span>${hasBeta ? 'Beta disponível para modalidades extras' : 'Fluxo principal focado em Cross'}</span>
        </div>
      </section>

      <section class="hub-grid hub-grid-onboarding">
        ${renderGuideCard('1. Escolha sua rotina', 'Entre direto no app da modalidade que faz sentido para o seu dia. Hoje o fluxo principal está em Cross.')}
        ${renderGuideCard('2. Use sozinho ou com coach', 'Sozinho você já importa planilha, registra treino e acompanha histórico. Com coach ativo, o app libera mais imports e treino enviado pelo box.')}
        ${renderGuideCard('3. Coach opera no portal', 'A parte operacional fica separada no Coach Portal: grupos, atletas, publicação e rotina do box.')}
      </section>

      <section class="hub-grid">
        ${availableSports.map((sport) => renderSportCard({
          sport: sport.value,
          title: sport.title,
          description: sport.description,
          status: sport.status,
          href: sports[sport.value] || '/sports/cross/',
          selected: selectedSport === sport.value,
          tier: sport.tier,
        })).join('')}
      </section>
    </main>
  `;
}

function renderGuideCard(title, description) {
  return `
    <article class="hub-card hub-card-guide">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function renderSportCard({ sport, title, description, status, href, selected, tier }) {
  return `
    <article class="hub-card ${selected ? 'hub-card-selected' : ''}">
      <label class="hub-cardChoice">
        <input type="radio" name="hub-sport" value="${escapeHtml(sport)}" ${selected ? 'checked' : ''} />
        <span class="hub-cardIndicator"></span>
        <span class="hub-cardLabel">Selecionar</span>
      </label>
      <div class="hub-cardTop">
        <span class="sport-badge">${escapeHtml(labelForSport(sport))}</span>
        <span class="hub-status">${escapeHtml(status)}${tier === 'beta' ? ' · Beta' : ''}</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      <div class="hub-cardActions">
        <a class="hub-cardLink" href="${escapeHtml(href)}" data-sport-link="${escapeHtml(sport)}">Entrar</a>
      </div>
    </article>
  `;
}

function getAvailableSports(config) {
  const rollout = config?.app?.rollout || {};
  const coreSports = Array.isArray(rollout.coreSports) && rollout.coreSports.length ? rollout.coreSports : ['cross'];
  const betaSports = rollout.showBetaSports ? (Array.isArray(rollout.betaSports) ? rollout.betaSports : []) : [];
  const catalog = {
    cross: {
      value: 'cross',
      tier: 'core',
      title: 'Cross / Conditioning',
      description: 'Treino do dia, planilhas, benchmarks, coach, competições e alternância entre planilha enviada e treino do coach.',
      status: 'Ativo agora',
    },
    running: {
      value: 'running',
      tier: 'beta',
      title: 'Running',
      description: 'Estrutura preparada para pace, distância, intervalados, zonas, longões e histórico de corrida.',
      status: 'Opcional',
    },
    strength: {
      value: 'strength',
      tier: 'beta',
      title: 'Strength / Bodybuilding',
      description: 'Estrutura preparada para séries, reps, carga, RIR, volume por grupamento e progressão de força.',
      status: 'Opcional',
    },
  };

  return [...coreSports, ...betaSports].map((key) => catalog[key]).filter(Boolean);
}

function labelForSport(sport) {
  switch (sport) {
    case 'running':
      return 'Running';
    case 'strength':
      return 'Strength';
    default:
      return 'Cross';
  }
}

function getLastSport() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'cross';
  } catch {
    return 'cross';
  }
}

function setLastSport(sport) {
  try {
    localStorage.setItem(STORAGE_KEY, sport);
  } catch {
    // no-op
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}
