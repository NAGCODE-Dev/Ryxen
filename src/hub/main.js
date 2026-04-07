import { getRuntimeConfig } from '../config/runtime.js';
import { initAuxiliaryBrowserLayer } from '../app/auxiliaryBrowser.js';
import { initNativeBackHandling } from '../app/nativeBack.js';

const STORAGE_KEY = 'ryxen-active-sport';
const LEGACY_STORAGE_KEY = 'crossapp-active-sport';
const HUB_SEEN_KEY = 'ryxen-hub-seen-v1';
const LEGACY_HUB_SEEN_KEY = 'crossapp-hub-seen-v1';
const ENTRY_TARGET_KEY = 'ryxen-entry-target';
const LEGACY_ENTRY_TARGET_KEY = 'crossapp-entry-target';

boot();

function boot() {
  setupVercelObservability();
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
  const coachUrl = '/coach/index.html';
  const shouldAutoSkipHub = shouldSkipHub(availableSports);

  if (isNativePlatform()) {
    setLastSport(selectedSport);
    window.location.replace(lastSportUrl);
    return;
  }

  if (shouldAutoSkipHub) {
    window.location.replace(resolveEntryUrl({ selectedSport, athleteUrl: lastSportUrl, coachUrl }));
    return;
  }

  root.innerHTML = renderHub({ sports, availableSports, lastSport: selectedSport, lastSportUrl, coachUrl });
  bindEvents(root, sports);
  markHubAsSeen();
}

function setupVercelObservability() {
  if (window.__RYXEN_VERCEL_OBSERVABILITY__ || window.__CROSSAPP_VERCEL_OBSERVABILITY__) return;
  window.__RYXEN_VERCEL_OBSERVABILITY__ = true;
  window.__CROSSAPP_VERCEL_OBSERVABILITY__ = true;
  injectVercelScript('/_vercel/insights/script.js');
  injectVercelScript('/_vercel/speed-insights/script.js');
}

function injectVercelScript(src) {
  if (!src) return;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  script.dataset.ryxenObservability = 'true';
  document.head.appendChild(script);
}

function bindEvents(root, sports) {
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-sport-link]');
    if (!target) return;
    const sport = target.getAttribute('data-sport-link');
    if (sport && sports[sport]) setLastSport(sport);
  });

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-nav-href]');
    if (!target) return;
    const href = String(target.getAttribute('data-nav-href') || '').trim();
    if (!href) return;
    const entryTarget = String(target.getAttribute('data-entry-target') || '').trim();
    if (entryTarget) setEntryTarget(entryTarget);
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

function renderHub({ sports, availableSports, lastSport, lastSportUrl, coachUrl }) {
  const selectedSport = lastSport || 'cross';
  const hasBeta = availableSports.some((sport) => sport.tier === 'beta');
  const selectedSportMeta = availableSports.find((sport) => sport.value === selectedSport) || availableSports[0] || null;
  return `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-heroGrid">
          <div class="hub-heroMain">
            <img class="hub-wordmark" src="/branding/ryxen-logo-horizontal.svg" alt="Ryxen" width="940" height="240" fetchpriority="high">
            <div class="hub-kicker">Ryxen para atleta e coach</div>
            <h1>Importe treino. Acompanhe evolução. Entre no fluxo certo.</h1>
            <p class="hub-lead">
              Performance para atleta e coach com entradas separadas, rotina clara e operação sem ruído.
            </p>
            <div class="hub-actions">
              <button class="hub-primaryAction" type="button" data-hub-primary data-entry-target="athlete" data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
                Abrir ${escapeHtml(labelForSport(selectedSport))}
              </button>
              <button class="hub-secondaryAction" type="button" data-entry-target="coach" data-nav-href="${escapeHtml(coachUrl)}">Entrar no Coach Portal</button>
            </div>
            <p class="hub-supportingCopy">${hasBeta ? 'Cross no núcleo. Running e Strength crescendo na mesma base.' : 'Cross no núcleo. Expansão modular para outras modalidades na mesma base.'}</p>
          </div>

          <aside class="hub-heroPanel">
            <div class="hub-panelEyebrow">Visão do produto</div>
            <div class="hub-heroVisual">
              <div class="hub-heroMockup" aria-hidden="true">
                <div class="hub-deviceFrame">
                  <div class="hub-deviceTopbar">
                    <span></span><span></span><span></span>
                  </div>
                  <div class="hub-deviceBody">
                    <div class="hub-deviceSidebar">
                      <div class="hub-deviceBrand">Ryxen</div>
                      <div class="hub-deviceNav"></div>
                      <div class="hub-deviceNav hub-deviceNav-active"></div>
                      <div class="hub-deviceNav"></div>
                    </div>
                    <div class="hub-deviceScreen">
                      <div class="hub-deviceMetricRow">
                        <div class="hub-deviceMetric">
                          <small>Hoje</small>
                          <strong>Back Squat</strong>
                        </div>
                        <div class="hub-deviceMetric hub-deviceMetric-accent">
                          <small>Coach</small>
                          <strong>Grupo RX</strong>
                        </div>
                      </div>
                      <div class="hub-deviceChart">
                        <span class="hub-deviceBar hub-deviceBar-a"></span>
                        <span class="hub-deviceBar hub-deviceBar-b"></span>
                        <span class="hub-deviceBar hub-deviceBar-c"></span>
                        <span class="hub-deviceBar hub-deviceBar-d"></span>
                      </div>
                      <div class="hub-deviceTimeline">
                        <div class="hub-deviceLine">
                          <strong>Athlete flow</strong>
                          <span>Treino, PRs e histórico no mesmo ritmo.</span>
                        </div>
                        <div class="hub-deviceLine hub-deviceLine-coach">
                          <strong>Coach flow</strong>
                          <span>Publicação, grupos e operação sem poluir o atleta.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="hub-heroSplit">
                <div class="hub-heroTrack hub-heroTrack-athlete">
                  <span class="hub-heroTrackLabel">Atleta</span>
                  <strong>Treino claro, histórico vivo e evolução sem fricção.</strong>
                  <p>Importação por PDF, imagem e OCR. PRs, rotina e progresso no mesmo lugar.</p>
                </div>
                <div class="hub-heroTrack hub-heroTrack-coach">
                  <span class="hub-heroTrackLabel">Coach</span>
                  <strong>Portal separado para publicar, organizar grupos e operar com contexto.</strong>
                  <p>Conta única, experiência diferente. O atleta vê o que precisa. O coach opera sem poluir o fluxo principal.</p>
                </div>
              </div>
              <div class="hub-heroSignal">
                <span class="hub-heroSignalTag">${escapeHtml(selectedSportMeta?.title || 'Cross / Conditioning')}</span>
                <strong>Uma base que cresce sem refazer a experiência.</strong>
                <p>${escapeHtml(selectedSportMeta?.description || 'Treino do dia, histórico, importação e coach no mesmo fluxo.')}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-showcase">
          <div class="hub-showcaseCopy">
            <div class="hub-sectionKicker">Produto real</div>
            <h2>O atleta entra direto no treino, sem cair num painel genérico.</h2>
            <p>Em vez de prometer “all-in-one”, o Ryxen começa com uma experiência prática: treino do dia, contexto da semana, histórico e progressão no mesmo ritmo de uso.</p>
            <div class="hub-showcaseNotes">
              <span>Treino do dia</span>
              <span>Semana ativa</span>
              <span>Histórico vivo</span>
            </div>
          </div>
          <div class="hub-showcaseMedia">
            <img
              class="hub-productShot"
              src="/branding/exports/ryxen-athlete-product-shot.png"
              alt="Tela real do app do atleta do Ryxen mostrando treino, progresso e navegação principal"
              width="1440"
              height="1100"
              loading="lazy"
            >
          </div>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Fluxos</div>
            <h2>Dois caminhos. Sem confusão.</h2>
          </div>
          <p>Primeiro fica claro quem entra para treinar e quem entra para operar. Depois o produto expande sem pedir que a pessoa entenda tudo de uma vez.</p>
        </div>
        <div class="hub-grid hub-grid-roles hub-grid-roles-main">
          ${renderRoleCard('Sou atleta', 'Abro o treino, importo rotina, acompanho PRs e sigo o dia com clareza. A experiência continua enxuta mesmo quando o coach publica treino.', [
            'Treino do dia, histórico e semana ativa',
            'Importação por PDF, imagem e OCR',
            'PRs, medidas e uso fora do fluxo coach',
          ], `Abrir ${labelForSport(selectedSport)}`, lastSportUrl, selectedSport, true, 'athlete')}
          ${renderRoleCard('Atleta conectado', 'Recebo treino publicado pelo coach, mas continuo com autonomia para consultar, adaptar e acompanhar minha própria evolução.', [
            'Treino enviado pelo coach no mesmo fluxo',
            'Alternância entre treino publicado e importado',
            'Experiência limpa sem entrar no portal operacional',
          ], 'Entrar como atleta', lastSportUrl, selectedSport, false, 'athlete')}
          ${renderRoleCard('Sou coach / box', 'Entro num portal separado para publicar programação, organizar atletas e operar o box com mais estrutura e menos improviso.', [
            'Grupos, atletas e publicação por contexto',
            'Portal separado da experiência do atleta',
            'Operação mais limpa para o dia a dia do gym',
          ], 'Abrir Coach Portal', coachUrl, 'coach', false, 'coach')}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Benefícios</div>
            <h2>Três dores. Três respostas claras.</h2>
          </div>
          <p>Sem checklist infinito de features. O produto começa resolvendo o que pesa no uso real, com uma resposta simples para cada dor.</p>
        </div>
        <div class="hub-editorialList">
          ${renderBenefitRow('Treino organizado', 'Material solto vira rotina utilizável.', 'Você entra no dia com treino legível, contexto de semana e menos improviso.')}
          ${renderBenefitRow('Evolução visível', 'PRs, histórico e semana ativa ficam acessíveis.', 'Acompanhamento deixa de depender de memória, nota perdida ou print antigo.')}
          ${renderBenefitRow('Operação limpa', 'Coach publica e organiza no portal separado.', 'O atleta mantém foco em treino enquanto o box ganha uma operação mais consistente.')}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Base do produto</div>
            <h2>Cross no núcleo. Expansão modular sem refazer a experiência.</h2>
          </div>
          <p>Hoje a entrada mais madura está em Cross. Running e Strength crescem sobre a mesma base, com o mesmo princípio de clareza entre atleta e coach.</p>
        </div>
        <div class="hub-grid hub-grid-platform">
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
          <div class="hub-ctaCopy">
            <div class="hub-sectionKicker">Comece pelo essencial</div>
            <h2>Entre pelo papel certo. O resto aparece no contexto certo.</h2>
            <p>Atleta entra para treinar. Coach entra para operar. O produto cresce sem exigir que a pessoa aprenda tudo no primeiro minuto.</p>
          </div>
          <div class="hub-ctaActions">
            <button class="hub-primaryAction hub-ctaPrimary" type="button" data-hub-primary data-entry-target="athlete" data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
              Entrar como atleta
            </button>
            <button class="hub-secondaryAction hub-ctaSecondary" type="button" data-entry-target="coach" data-nav-href="${escapeHtml(coachUrl)}">Abrir Coach Portal</button>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderGuideCard(title, description) {
  return `
    <article class="hub-card hub-card-guide">
      <div class="hub-cardMiniKicker">Ryxen</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function renderBenefitRow(title, kicker, description) {
  return `
    <article class="hub-benefitRow">
      <div class="hub-benefitIntro">
        <div class="hub-cardMiniKicker">Ryxen</div>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="hub-benefitBody">
        <strong>${escapeHtml(kicker)}</strong>
        <p>${escapeHtml(description)}</p>
      </div>
    </article>
  `;
}

function renderRoleCard(title, description, bullets, ctaLabel, href, sport, highlight, entryTarget = 'athlete') {
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
        <button class="hub-cardLink ${highlight ? 'hub-cardLink-primary' : ''}" type="button" data-entry-target="${escapeHtml(entryTarget)}" data-nav-href="${escapeHtml(href)}" data-sport-link="${escapeHtml(sport)}">${escapeHtml(ctaLabel)}</button>
      </div>
    </article>
  `;
}

function renderSportCard({ sport, title, description, status, href, selected, tier }) {
  return `
    <article class="hub-card hub-platformCard ${selected ? 'hub-card-selected' : ''}">
      <div class="hub-cardTop">
        <span class="sport-badge">${escapeHtml(labelForSport(sport))}</span>
        <span class="hub-status">${escapeHtml(status)}${tier === 'beta' ? ' · Beta' : ''}</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      <div class="hub-platformRail">
        <span class="hub-platformDot ${selected ? 'hub-platformDot-active' : ''}"></span>
        <span class="hub-platformLine"></span>
      </div>
      <div class="hub-cardActions">
        <button class="hub-cardLink" type="button" data-nav-href="${escapeHtml(href)}" data-sport-link="${escapeHtml(sport)}">Explorar ${escapeHtml(labelForSport(sport))}</button>
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
    return localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'cross';
  } catch {
    return 'cross';
  }
}

function setLastSport(sport) {
  try {
    localStorage.setItem(STORAGE_KEY, sport);
    localStorage.setItem(LEGACY_STORAGE_KEY, sport);
  } catch {
    // no-op
  }
}

function hasSeenHub() {
  try {
    return localStorage.getItem(HUB_SEEN_KEY) === '1' || localStorage.getItem(LEGACY_HUB_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markHubAsSeen() {
  try {
    localStorage.setItem(HUB_SEEN_KEY, '1');
    localStorage.setItem(LEGACY_HUB_SEEN_KEY, '1');
  } catch {
    // no-op
  }
}

function shouldSkipHub(availableSports) {
  if (!hasSeenHub()) return false;
  return availableSports.length === 1 && availableSports[0]?.value === 'cross';
}

function getEntryTarget() {
  try {
    return localStorage.getItem(ENTRY_TARGET_KEY) || localStorage.getItem(LEGACY_ENTRY_TARGET_KEY) || 'athlete';
  } catch {
    return 'athlete';
  }
}

function setEntryTarget(entryTarget) {
  const normalized = entryTarget === 'coach' ? 'coach' : 'athlete';
  try {
    localStorage.setItem(ENTRY_TARGET_KEY, normalized);
    localStorage.setItem(LEGACY_ENTRY_TARGET_KEY, normalized);
  } catch {
    // no-op
  }
}

function resolveEntryUrl({ selectedSport, athleteUrl, coachUrl }) {
  const entryTarget = getEntryTarget();
  if (entryTarget === 'coach') return coachUrl;
  setLastSport(selectedSport || 'cross');
  return athleteUrl || '/sports/cross/index.html';
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
