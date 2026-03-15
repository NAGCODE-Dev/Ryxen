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
    <main class="public-main hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">CrossApp Platform</div>
        <h1>Organize treino, atletas e operação do seu box em um só lugar.</h1>
        <p class="hub-lead">
          O CrossApp reúne app do atleta, Coach Portal, benchmarks, histórico e competições em uma rotina mais clara para coaches, boxes e atletas. O núcleo já entregue está em treino e operação; a expansão futura entra por módulos, não por promessa vazia.
        </p>
        <div class="hub-actions">
          <a class="hub-primaryAction" href="/pricing.html">Ver plataforma</a>
          <a class="hub-secondaryAction" href="${escapeHtml(lastSportUrl)}" data-hub-primary data-sport-link="${escapeHtml(selectedSport)}">Abrir ${escapeHtml(labelForSport(selectedSport))}</a>
          <a class="hub-secondaryAction" href="/coach/">Abrir Coach Portal</a>
        </div>
        <div class="hub-meta">
          <span>App do atleta livre</span>
          <span>Coach Portal separado</span>
          <span>Benchmarks e competições</span>
          <span>${hasBeta ? 'Modalidades extras em beta' : 'Fluxo principal focado em Cross'}</span>
        </div>
      </section>

      <section class="hub-platformStrip">
        ${renderBenefitPill('Treino e programação')}
        ${renderBenefitPill('App do atleta')}
        ${renderBenefitPill('Coach Portal')}
        ${renderBenefitPill('Benchmarks e competições')}
        ${renderBenefitPill('Base pronta para novos módulos')}
      </section>

      <section class="hub-section">
        <div class="hub-sectionHead">
          <div class="hub-kicker">Módulos</div>
          <h2>Uma plataforma modular, com núcleo real já entregue.</h2>
          <p>O produto não tenta vender tudo agora. Ele parte do que já está sólido e deixa a expansão preparada para billing, presença digital e novas modalidades.</p>
        </div>
        <div class="hub-grid hub-grid-modules">
          ${renderModuleCard({
            kicker: 'CrossApp Train',
            title: 'Treino, histórico e benchmarks no fluxo diário do atleta.',
            body: 'Planilha enviada, treino do coach, PRs, biblioteca de benchmarks, histórico específico e rotina diária em um app só.',
            tone: 'train',
            features: ['Treino do dia', 'Histórico e PRs', 'Biblioteca de benchmarks'],
            ctaHref: sports.cross || '/sports/cross/',
            ctaLabel: 'Abrir app Cross',
          })}
          ${renderModuleCard({
            kicker: 'CrossApp Coach',
            title: 'Operação do box em portal separado, sem contaminar o app do atleta.',
            body: 'Gyms, membros, grupos, publicação de treino, assinatura e rotina operacional em um workspace próprio para coach.',
            tone: 'coach',
            features: ['Coach Portal', 'Grupos e audiência', 'Publicação por modalidade'],
            ctaHref: '/coach/',
            ctaLabel: 'Abrir Coach Portal',
          })}
          ${renderModuleCard({
            kicker: 'CrossApp Competitions',
            title: 'Eventos, inscrições e leaderboard em uma estrutura pronta para providers reais.',
            body: 'Catálogo de eventos, links oficiais, resultados internos e base pronta para CrossFit Open e Competition Corner.',
            tone: 'comp',
            features: ['Agenda de eventos', 'Leaderboard oficial', 'Estrutura por provider'],
            ctaHref: sports.cross || '/sports/cross/',
            ctaLabel: 'Ver competições',
          })}
          ${renderModuleCard({
            kicker: 'CrossApp Billing',
            title: 'Camada futura para cobrança e operação financeira, sem vender ficção hoje.',
            body: 'A plataforma já separa planos, checkout e acesso. O próximo passo entra como módulo, não como promessa genérica de ERP.',
            tone: 'future',
            features: ['Kiwify integrada', 'Webhook aplicado', 'Base pronta para evolução'],
            ctaHref: '/pricing.html',
            ctaLabel: 'Ver planos',
            isFuture: true,
          })}
        </div>
      </section>

      <section class="hub-grid hub-grid-onboarding">
        ${renderGuideCard('1. Atleta entra sem fricção', 'Use o app sozinho para treino, histórico e benchmarks. O produto não trata o atleta solo como usuário de segunda classe.')}
        ${renderGuideCard('2. Coach sobe a operação', 'Quando existe plano de coach, o portal separado passa a cuidar de grupos, atletas, publicação e rotina do box.')}
        ${renderGuideCard('3. Competições conectam performance', 'Eventos e leaderboards entram como camada de engajamento e performance, não como bloco jogado no meio do app.')}
      </section>

      <section class="hub-section">
        <div class="hub-sectionHead">
          <div class="hub-kicker">Modalidades</div>
          <h2>Cross primeiro. Estrutura pronta para crescer.</h2>
          <p>O fluxo principal e comercial continua em Cross. Running e Strength entram como base de expansão, sem diluir a entrega principal.</p>
        </div>
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

function renderBenefitPill(label) {
  return `<span class="hub-benefitPill">${escapeHtml(label)}</span>`;
}

function renderGuideCard(title, description) {
  return `
    <article class="hub-card hub-card-guide">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function renderModuleCard({ kicker, title, body, features = [], ctaHref = '#', ctaLabel = 'Abrir', tone = 'train', isFuture = false }) {
  return `
    <article class="hub-card hub-moduleCard hub-moduleCard-${escapeHtml(tone)} ${isFuture ? 'hub-moduleCard-future' : ''}">
      <div class="hub-cardTop">
        <span class="sport-badge">${escapeHtml(kicker)}</span>
        <span class="hub-status">${isFuture ? 'Futuro próximo' : 'Ativo agora'}</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      <div class="hub-moduleFeatures">
        ${features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join('')}
      </div>
      <div class="hub-cardActions">
        <a class="hub-cardLink" href="${escapeHtml(ctaHref)}">${escapeHtml(ctaLabel)}</a>
      </div>
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
