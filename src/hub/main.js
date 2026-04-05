import { getRuntimeConfig } from '../config/runtime.js';
import { initAuxiliaryBrowserLayer } from '../app/auxiliaryBrowser.js';
import { initNativeBackHandling } from '../app/nativeBack.js';

const STORAGE_KEY = 'crossapp-active-sport';

boot();

function boot() {
  initAuxiliaryBrowserLayer();
  initNativeBackHandling();

  const root = document.getElementById('hub-root');
  if (!root) return;

  const cfg = getRuntimeConfig();
  const sports = cfg?.app?.sports || {};
  const availableSports = getAvailableSports(cfg);
  const fallbackSport = availableSports[0]?.value || 'cross';
  const lastSport = getLastSport();
  const selectedSport = availableSports.some((sport) => sport.value === lastSport) ? lastSport : fallbackSport;
  const lastSportUrl = sports[selectedSport] || sports.cross || '/sports/cross/index.html';

  if (isNativePlatform()) {
    setLastSport(selectedSport);
    window.location.replace(lastSportUrl);
    return;
  }

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

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-nav-href]');
    if (!target) return;
    const href = String(target.getAttribute('data-nav-href') || '').trim();
    if (!href) return;
    event.preventDefault();
    window.location.assign(href);
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name !== 'hub-sport') return;

    const sport = target.value;
    const nextUrl = sports[sport] || '/sports/cross/index.html';
    const primary = root.querySelector('[data-hub-primary]');
    if (primary) {
      primary.setAttribute('data-nav-href', nextUrl);
      primary.textContent = `Abrir ${labelForSport(sport)}`;
      primary.setAttribute('data-sport-link', sport);
    }
    setLastSport(sport);
  });
}

function renderHub({ sports, availableSports, lastSport, lastSportUrl }) {
  const selectedSport = lastSport || 'cross';
  const hasBeta = availableSports.some((sport) => sport.tier === 'beta');
  const selectedSportMeta = availableSports.find((sport) => sport.value === selectedSport) || availableSports[0] || null;
  return `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-heroGrid">
          <div class="hub-heroMain">
            <div class="hub-kicker">CrossApp para atleta e coach</div>
            <h1>Importe treino, acompanhe evolução e centralize a rotina do box no mesmo ecossistema.</h1>
            <p class="hub-lead">
              O CrossApp foi feito para quem treina de verdade: atleta que precisa de clareza no dia a dia e coach que quer publicar treino, organizar grupos e manter operação sem planilha solta no WhatsApp.
            </p>
            <div class="hub-proofRow">
              <span>Importação por PDF, imagem e OCR</span>
              <span>Histórico, PRs e uso offline</span>
              <span>Coach Portal separado da experiência do atleta</span>
            </div>
            <div class="hub-actions">
              <button class="hub-primaryAction" type="button" data-hub-primary data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
                Sou atleta
              </button>
              <a class="hub-secondaryAction" href="/coach/index.html">Sou coach / box</a>
            </div>
            <div class="hub-meta">
              <span>Entrada mais rápida para o atleta</span>
              <span>${hasBeta ? 'Running e Strength em expansão' : 'Expansão modular para outras modalidades'}</span>
              <span>Conta única, experiências separadas</span>
            </div>
          </div>

          <aside class="hub-heroPanel">
            <div class="hub-panelEyebrow">Entrada principal</div>
            <h2>Dois caminhos. Sem confusão.</h2>
            <p>Quem treina entra no app do atleta. Quem organiza o box entra no portal do coach. O resto aparece depois, no contexto certo.</p>
            <div class="hub-panelStats">
              <div class="hub-stat">
                <strong>Atleta</strong>
                <span>Treino do dia, PRs, histórico e rotina clara no fluxo principal.</span>
              </div>
              <div class="hub-stat">
                <strong>Coach</strong>
                <span>Publicação, grupos, atletas e operação em uma interface separada.</span>
              </div>
              <div class="hub-stat">
                <strong>${escapeHtml(selectedSportMeta?.title || 'Cross / Conditioning')}</strong>
                <span>${escapeHtml(selectedSportMeta?.description || 'Treino do dia, histórico, importação e coach no mesmo fluxo.')}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Por que existe</div>
            <h2>O produto resolve três dores logo na entrada.</h2>
          </div>
          <p>Sem prometer “gestão completa” genérica. A proposta é direta: treino claro para o atleta, operação separada para o coach e menos improviso no dia a dia.</p>
        </div>
        <div class="hub-grid hub-grid-proof">
          ${renderGuideCard('Treino organizado', 'Importe programação por PDF, imagem ou OCR e transforme material solto em rotina utilizável.')}
          ${renderGuideCard('Evolução visível', 'Mantenha PRs, histórico e contexto da semana sem depender de memória, foto perdida ou nota no celular.')}
          ${renderGuideCard('Operação limpa', 'Coach publica treino, organiza grupos e acompanha o box no portal, enquanto o atleta continua com uma UI enxuta.')}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Escolha seu fluxo</div>
            <h2>Escolha só o seu papel agora.</h2>
          </div>
          <p>Primeiro atleta ou coach. As variações aparecem depois, sem exigir que a pessoa entenda toda a arquitetura antes de começar.</p>
        </div>
        <div class="hub-grid hub-grid-roles">
          ${renderRoleCard('Sou atleta', 'Para quem quer abrir o treino, importar rotina, acompanhar PRs e treinar com clareza sem perder tempo com operação do box.', [
            'Importa treino e mantém histórico',
            'Registra resultados, PRs e evolução',
            'Continua usando mesmo sem coach online'
          ], 'Entrar como atleta', lastSportUrl, selectedSport, true)}
          ${renderRoleCard('Sou coach / box', 'Para operação, publicação e organização do treino em escala, com portal separado da rotina do atleta.', [
            'Gerencia grupos e atletas',
            'Publica treino por contexto',
            'Centraliza rotina operacional do box'
          ], 'Entrar como coach', '/coach/index.html', 'coach', false)}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Modalidades</div>
            <h2>Hoje o núcleo está em Cross. O restante cresce em cima da mesma base.</h2>
          </div>
          <p>Você entra por uma modalidade, mas a arquitetura já considera expansão para corrida, força e experiências conectadas ao coach.</p>
        </div>
        <div class="hub-grid">
        ${availableSports.map((sport) => renderSportCard({
          sport: sport.value,
          title: sport.title,
          description: sport.description,
          status: sport.status,
          href: sports[sport.value] || '/sports/cross/index.html',
          selected: selectedSport === sport.value,
          tier: sport.tier,
        })).join('')}
        </div>
      </section>

      <section class="hub-section hub-section-cta">
        <div class="hub-ctaCard">
          <div>
            <div class="hub-sectionKicker">Comece pelo essencial</div>
            <h2>Entre pelo lado certo e o resto aparece no momento certo.</h2>
            <p>Atleta entra para ver treino, importar rotina e acompanhar evolução. Coach entra para operar o box. Menos decisão no início, mais clareza no uso.</p>
          </div>
          <div class="hub-actions">
            <button class="hub-primaryAction" type="button" data-hub-primary data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
              Sou atleta
            </button>
            <a class="hub-secondaryAction" href="/coach/index.html">Sou coach / box</a>
          </div>
        </div>
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

function renderRoleCard(title, description, bullets, ctaLabel, href, sport, highlight) {
  return `
    <article class="hub-card hub-roleCard ${highlight ? 'hub-roleCard-highlight' : ''}">
      <div class="hub-cardTop">
        <span class="sport-badge">${escapeHtml(title)}</span>
        <span class="hub-status">${highlight ? 'Recomendado' : 'Disponível'}</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      <ul class="hub-list">
        ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}
      </ul>
      <div class="hub-cardActions">
        <button class="hub-cardLink ${highlight ? 'hub-cardLink-primary' : ''}" type="button" data-nav-href="${escapeHtml(href)}" data-sport-link="${escapeHtml(sport)}">${escapeHtml(ctaLabel)}</button>
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
        <button class="hub-cardLink" type="button" data-nav-href="${escapeHtml(href)}" data-sport-link="${escapeHtml(sport)}">Entrar</button>
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
      description: 'Treino do dia, planilhas, benchmarks, coach e alternância entre planilha enviada e treino do coach.',
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

function isNativePlatform() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
  } catch {
    return false;
  }
}
