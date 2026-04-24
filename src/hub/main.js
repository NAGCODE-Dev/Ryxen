import { getRuntimeConfig } from '../config/runtime.js';
import { initAuxiliaryBrowserLayer } from '../app/auxiliaryBrowser.js';
import { initNativeBackHandling } from '../app/nativeBack.js';

const STORAGE_KEY = 'ryxen-active-sport';
const LEGACY_STORAGE_KEY = 'crossapp-active-sport';
const HUB_SEEN_KEY = 'ryxen-hub-seen-v1';
const LEGACY_HUB_SEEN_KEY = 'crossapp-hub-seen-v1';
const ENTRY_TARGET_KEY = 'ryxen-entry-target';
const LEGACY_ENTRY_TARGET_KEY = 'crossapp-entry-target';
const WORDMARK_SOURCES = [
  './branding/exports/ryxen-logo-horizontal.png',
  '/branding/exports/ryxen-logo-horizontal.png',
  './branding/exports/ryxen-logo-horizontal-alt.png',
  '/branding/exports/ryxen-logo-horizontal-alt.png',
];

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
  const athleteEntryUrl = cfg?.app?.rollout?.athleteReactShell === true ? '/athlete/' : lastSportUrl;
  const coachUrl = '/coach/index.html';
  const shouldAutoSkipHub = shouldSkipHub(availableSports);

  if (isNativePlatform()) {
    setLastSport(selectedSport);
    window.location.replace(athleteEntryUrl);
    return;
  }

  if (shouldAutoSkipHub) {
    window.location.replace(resolveEntryUrl({ selectedSport, athleteUrl: athleteEntryUrl, coachUrl }));
    return;
  }

  root.innerHTML = renderHub({
    sports,
    availableSports,
    lastSport: selectedSport,
    lastSportUrl: athleteEntryUrl,
    coachUrl,
    athleteReactShell: cfg?.app?.rollout?.athleteReactShell === true,
  });
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
  bindWordmarkFallback(root);

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
    const primary = root.querySelector('[data-hub-primary]');
    const useAthleteReactShell = primary?.getAttribute('data-athlete-react-shell') === 'true';
    const nextUrl = useAthleteReactShell ? '/athlete/' : (sports[sport] || '/sports/cross/index.html');
    if (primary) {
      primary.setAttribute('data-nav-href', nextUrl);
      primary.textContent = 'Entrar no app do atleta';
      primary.setAttribute('data-sport-link', sport);
    }
    setLastSport(sport);
  });
}

function bindWordmarkFallback(root) {
  const image = root.querySelector('[data-hub-wordmark]');
  if (!(image instanceof HTMLImageElement)) return;

  let sourceIndex = WORDMARK_SOURCES.indexOf(image.getAttribute('src') || '');
  if (sourceIndex < 0) sourceIndex = 0;

  image.addEventListener('error', () => {
    sourceIndex += 1;
    if (sourceIndex >= WORDMARK_SOURCES.length) return;
    image.src = WORDMARK_SOURCES[sourceIndex];
  });
}

function renderHub({ sports, availableSports, lastSport, lastSportUrl, coachUrl, athleteReactShell = false }) {
  const selectedSport = lastSport || 'cross';
  return `
    <main class="hub-shell" data-athlete-react-shell="${athleteReactShell ? 'true' : 'false'}">
      <section class="hub-hero isolate">
        <div class="hub-heroGrid items-start xl:items-center">
          <div class="hub-heroMain max-w-3xl md:pr-6">
            <img class="hub-wordmark w-[212px] md:w-[256px]" data-hub-wordmark src="./branding/exports/ryxen-logo-horizontal.png" alt="Ryxen" width="940" height="240" fetchpriority="high">
            <div class="hub-kicker max-w-max border-white/10 bg-white/5 px-4">Atleta e coach</div>
            <h1 class="max-w-[12ch]">Escolha sua entrada</h1>
            <p class="hub-lead max-w-[42rem] text-base/8 md:text-[1.08rem]">
              ${athleteReactShell ? 'Nova shell editorial do atleta + portal do coach no mesmo sistema.' : 'App do atleta e portal do coach no mesmo sistema.'}
            </p>
            <div class="hub-actions sm:flex-row sm:items-center">
              <button class="hub-primaryAction inline-flex min-h-12 items-center justify-center px-6" type="button" data-hub-primary data-entry-target="athlete" data-athlete-react-shell="${athleteReactShell ? 'true' : 'false'}" data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
                Entrar no app do atleta
              </button>
              <button class="hub-secondaryAction inline-flex min-h-12 items-center justify-center px-6" type="button" data-entry-target="coach" data-nav-href="${escapeHtml(coachUrl)}">Entrar no portal do coach</button>
            </div>
          </div>

          <aside class="hub-heroPanel rounded-[28px] border border-white/10 bg-white/[0.025] p-5 md:p-6">
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
                          <strong>App do atleta</strong>
                          <span>Treino e evolução.</span>
                        </div>
                        <div class="hub-deviceLine hub-deviceLine-coach">
                          <strong>Portal do coach</strong>
                          <span>Publicação e gestão.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-showcaseStack">
          <div class="hub-showcase">
            <div class="hub-showcaseCopy">
              <div class="hub-sectionKicker">App do atleta</div>
              <h2>Treino, histórico e evolução.</h2>
              <p>Abra o dia, veja o treino e acompanhe benchmarks.</p>
              <div class="hub-showcaseNotes">
                <span>Hoje</span>
                <span>Histórico</span>
                <span>PRs</span>
              </div>
            </div>
            <div class="hub-showcaseMedia">
              <img
                class="hub-productShot"
                src="/branding/exports/ryxen-athlete-product-shot.png"
                alt="App do atleta do Ryxen"
                width="1440"
                height="1100"
                loading="lazy"
              >
            </div>
          </div>

          <div class="hub-showcase hub-showcase-reverse">
            <div class="hub-showcaseMedia">
              <img
                class="hub-productShot"
                src="/branding/exports/ryxen-coach-portal-shot.png"
                alt="Coach Portal do Ryxen"
                width="1440"
                height="1100"
                loading="lazy"
              >
            </div>
            <div class="hub-showcaseCopy">
              <div class="hub-sectionKicker">Portal do coach</div>
              <h2>Publicação, atletas e benchmarks.</h2>
              <p>Use uma área própria para organizar o box.</p>
              <div class="hub-showcaseNotes">
                <span>Treinos</span>
                <span>Atletas</span>
                <span>Benchmarks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Entradas</div>
            <h2>Atleta e coach</h2>
          </div>
          <p>Cada área abre no contexto certo.</p>
        </div>
        <div class="hub-grid hub-grid-roles hub-grid-roles-main hub-grid-roles-mainCompact">
          ${renderRoleCard('Atleta', 'Treino, histórico e rotina importada.', [
            'Treino do dia',
            'Importação por PDF, imagem e OCR',
            'PRs e histórico',
          ], 'Entrar como atleta', lastSportUrl, selectedSport, true, 'athlete')}
          ${renderRoleCard('Coach / Box', 'Publicação, grupos, atletas e benchmarks.', [
            'Grupos e atletas',
            'Portal separado do app do atleta',
            'Benchmarks e rotina',
          ], 'Entrar como coach', coachUrl, 'coach', false, 'coach')}
        </div>
        <p class="hub-roleNote">O treino publicado aparece no app do atleta.</p>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Fluxo</div>
            <h2>Leitura direta</h2>
          </div>
          <p>Treino, evolução e operação sem telas extras.</p>
        </div>
        <div class="hub-editorialList hub-editorialListColumns">
          ${renderBenefitRow('Hoje', 'Treino do dia', 'Sessão e contexto na abertura do app.')}
          ${renderBenefitRow('Evolução', 'Benchmarks e PRs', 'Histórico e referências no mesmo lugar.')}
          ${renderBenefitRow('Coach', 'Publicação e gestão', 'Portal separado para operar o box.')}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Modalidades</div>
            <h2>Cross ativo</h2>
          </div>
          <p>Running e Strength seguem a mesma base.</p>
        </div>
        <div class="hub-grid hub-grid-platform hub-grid-platformEditorial">
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
        <div class="hub-ctaCard grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div class="hub-ctaCopy max-w-2xl">
            <div class="hub-sectionKicker max-w-max">Escolha sua entrada</div>
            <h2 class="max-w-[13ch]">Entrar</h2>
            <p class="max-w-[36rem]">Abra o app do atleta ou o portal do coach.</p>
          </div>
          <div class="hub-ctaActions flex flex-col gap-3 sm:flex-row sm:items-center">
            <button class="hub-primaryAction hub-ctaPrimary inline-flex min-h-12 items-center justify-center px-6" type="button" data-hub-primary data-entry-target="athlete" data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
              Entrar como atleta
            </button>
            <button class="hub-secondaryAction hub-ctaSecondary inline-flex min-h-12 items-center justify-center px-6" type="button" data-entry-target="coach" data-nav-href="${escapeHtml(coachUrl)}">Entrar como coach</button>
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
      <div class="hub-platformMeta">${selected ? 'Entrada atual.' : 'Mesma base.'}</div>
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
      description: 'Treino do dia, benchmarks, histórico e coach.',
      status: 'Ativo agora',
    },
    running: {
      value: 'running',
      tier: 'beta',
      title: 'Running',
      description: 'Pace, distância, intervalos e histórico.',
      status: 'Opcional',
    },
    strength: {
      value: 'strength',
      tier: 'beta',
      title: 'Strength / Bodybuilding',
      description: 'Séries, reps, carga e progressão.',
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
