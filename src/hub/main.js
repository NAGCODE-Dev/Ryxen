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
  return `
    <main class="public-main hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">CrossApp</div>
        <h1>Treino do dia, resultados e evolução no mesmo app.</h1>
        <p class="hub-lead">
          Acompanhe seus treinos, importe planilhas, registre resultados e veja sua evolução sem complicação.
        </p>
        <div class="hub-actions">
          <a class="hub-primaryAction" href="${escapeHtml(lastSportUrl)}" data-hub-primary data-sport-link="${escapeHtml(selectedSport)}">Abrir ${escapeHtml(labelForSport(selectedSport))}</a>
          <a class="hub-secondaryAction" href="/sports/cross/">Entrar</a>
        </div>
        <div class="hub-meta">
          <span>Treino de hoje</span>
          <span>Importação de planilhas</span>
          <span>Resultados e benchmarks</span>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHead">
          <div class="hub-kicker">Comece por aqui</div>
          <h2>Escolha a modalidade.</h2>
          <p>Cross já está pronto para uso diário. As outras entram quando fizer sentido.</p>
        </div>
        <div class="hub-grid hub-grid-sports">
        ${availableSports.map((sport) => renderSportCard({
          sport: sport.value,
          title: sport.title,
          description: sport.description,
          status: sport.status,
          href: sports[sport.value] || '/sports/cross/',
          selected: selectedSport === sport.value,
          tier: sport.tier,
        })).join('')}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHead">
          <div class="hub-kicker">No app do atleta</div>
          <h2>O essencial para usar todo dia.</h2>
        </div>
        <div class="hub-meta hub-meta-flow">
          <span>Ver treino de hoje</span>
          <span>Importar treino</span>
          <span>Registrar resultados</span>
          <span>Ver evolução</span>
        </div>
      </section>

      <section class="hub-section">
        <article class="hub-card hub-card-coachCta">
          <div class="hub-cardTop">
            <span class="sport-badge">Coach</span>
          </div>
          <h2>Coach Portal separado.</h2>
          <p>Gestão do box, membros e publicação de treinos ficam em uma área própria para quem administra.</p>
          <div class="hub-cardActions">
            <a class="hub-cardLink" href="/coach/">Abrir Coach Portal</a>
          </div>
        </article>
      </section>
    </main>
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
      description: 'Treino do dia, importação de planilhas, resultados e evolução em uma rotina simples.',
      status: 'Ativo agora',
    },
    running: {
      value: 'running',
      tier: 'beta',
      title: 'Running',
      description: 'Base em preparação para pace, distância, intervalados e histórico de corrida.',
      status: 'Opcional',
    },
    strength: {
      value: 'strength',
      tier: 'beta',
      title: 'Strength / Bodybuilding',
      description: 'Base em preparação para séries, carga, repetições e evolução de força.',
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
