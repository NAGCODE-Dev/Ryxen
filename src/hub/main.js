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
      primary.textContent = 'Entrar no app do atleta';
      primary.setAttribute('data-sport-link', sport);
    }
    setLastSport(sport);
  });
}

function renderHub({ sports, availableSports, lastSport, lastSportUrl, coachUrl }) {
  const selectedSport = lastSport || 'cross';
  return `
    <main class="hub-shell">
      <section class="hub-hero isolate">
        <div class="hub-heroGrid items-start xl:items-center">
          <div class="hub-heroMain max-w-3xl md:pr-6">
            <img class="hub-wordmark w-[212px] md:w-[256px]" src="/branding/ryxen-logo-horizontal.svg" alt="Ryxen" width="940" height="240" fetchpriority="high">
            <div class="hub-kicker max-w-max border-white/10 bg-white/5 px-4">Plataforma de performance para atleta e coach</div>
            <h1 class="max-w-[12ch]">Cada lado entra no lugar certo.</h1>
            <p class="hub-lead max-w-[42rem] text-base/8 md:text-[1.08rem]">
              Ryxen organiza treino, evolução e gestão em experiências próprias para atleta e coach, com mais clareza no uso e menos ruído na rotina.
            </p>
            <div class="hub-actions sm:flex-row sm:items-center">
              <button class="hub-primaryAction inline-flex min-h-12 items-center justify-center px-6" type="button" data-hub-primary data-entry-target="athlete" data-sport-link="${escapeHtml(selectedSport)}" data-nav-href="${escapeHtml(lastSportUrl)}">
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
                          <strong>Experiência do atleta</strong>
                          <span>Treino, evolução e rotina com leitura direta.</span>
                        </div>
                        <div class="hub-deviceLine hub-deviceLine-coach">
                          <strong>Experiência do coach</strong>
                          <span>Publicação, grupos e gestão em uma superfície própria.</span>
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
              <div class="hub-sectionKicker">Experiência do atleta</div>
              <h2>O atleta abre o app e já encontra o que importa.</h2>
              <p>Treino do dia, semana ativa, histórico e evolução aparecem com clareza desde a primeira tela, sem desvio para uma interface genérica.</p>
              <div class="hub-showcaseNotes">
                <span>Treino do dia</span>
                <span>Semana ativa</span>
                <span>Evolução contínua</span>
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

          <div class="hub-showcase hub-showcase-reverse">
            <div class="hub-showcaseMedia">
              <img
                class="hub-productShot"
                src="/branding/exports/ryxen-coach-portal-shot.png"
                alt="Tela real do Coach Portal do Ryxen mostrando login, proposta de valor e entrada operacional"
                width="1440"
                height="1100"
                loading="lazy"
              >
            </div>
            <div class="hub-showcaseCopy">
              <div class="hub-sectionKicker">Experiência do coach</div>
              <h2>O coach entra em um portal pensado para publicar, organizar e acompanhar.</h2>
              <p>Planejamento, grupos, atletas e gestão do box ficam em uma superfície própria, mais clara para operar e melhor para escalar.</p>
              <div class="hub-showcaseNotes">
                <span>Portal dedicado</span>
                <span>Publicação de treinos</span>
                <span>Gestão com clareza</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Experiências</div>
            <h2>Duas experiências. Um sistema só.</h2>
          </div>
          <p>O atleta entra para treinar com foco. O coach entra para publicar, organizar e acompanhar. Cada papel começa no ambiente certo.</p>
        </div>
        <div class="hub-grid hub-grid-roles hub-grid-roles-main hub-grid-roles-mainCompact">
          ${renderRoleCard('Atleta', 'Treino, rotina importada, histórico e evolução ficam no mesmo fluxo, com uma experiência feita para acompanhar o dia sem fricção.', [
            'Treino do dia e semana ativa',
            'Importação por PDF, imagem e OCR',
            'PRs, histórico e evolução no mesmo lugar',
          ], 'Entrar como atleta', lastSportUrl, selectedSport, true, 'athlete')}
          ${renderRoleCard('Coach / Box', 'Publicação, grupos, atletas e gestão do box ficam em um portal dedicado, com mais ordem operacional e menos improviso.', [
            'Grupos, atletas e publicação centralizados',
            'Portal separado da experiência do atleta',
            'Gestão mais clara para o dia a dia do box',
          ], 'Entrar como coach', coachUrl, 'coach', false, 'coach')}
        </div>
        <p class="hub-roleNote">Quando o coach publica, o atleta recebe tudo no próprio fluxo de treino, sem cair em uma área operacional.</p>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Benefícios</div>
            <h2>Menos atrito no dia a dia. Mais clareza no que importa.</h2>
          </div>
          <p>Ryxen foi desenhado para reduzir ruído na rotina de treino e na gestão do box, com uma experiência mais direta, legível e utilizável.</p>
        </div>
        <div class="hub-editorialList hub-editorialListColumns">
          ${renderBenefitRow('Treino com clareza', 'O dia começa organizado.', 'Treino, contexto e progressão aparecem de forma simples e utilizável, sem depender de anotações soltas ou mensagens perdidas.')}
          ${renderBenefitRow('Evolução visível', 'Seu histórico continua acessível.', 'PRs, registros e evolução ficam próximos do uso real, para acompanhar progresso sem voltar ao zero toda semana.')}
          ${renderBenefitRow('Gestão mais limpa', 'O coach opera melhor.', 'Publicação, organização e acompanhamento acontecem em um espaço próprio, com mais consistência para o box e menos ruído para o atleta.')}
        </div>
      </section>

      <section class="hub-section">
        <div class="hub-sectionHeader">
          <div>
            <div class="hub-sectionKicker">Base do produto</div>
            <h2>Cross é o núcleo atual. A base já nasce pronta para expandir.</h2>
          </div>
          <p>A experiência principal já entrega valor real em Cross, enquanto Running e Strength avançam sobre a mesma lógica de produto, clareza e separação entre atleta e coach.</p>
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
            <h2 class="max-w-[13ch]">Entre pela experiência certa.</h2>
            <p class="max-w-[36rem]">Ryxen conecta atleta e coach em um mesmo sistema, com superfícies próprias para treinar, evoluir e gerir melhor.</p>
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
      <div class="hub-platformMeta">${selected ? 'Entrada principal ativa agora.' : 'Evolução sobre a mesma linguagem de produto.'}</div>
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
      description: 'Treino do dia, benchmarks, histórico, coach e rotina ativa em uma experiência já pronta para uso real.',
      status: 'Ativo agora',
    },
    running: {
      value: 'running',
      tier: 'beta',
      title: 'Running',
      description: 'Base em evolução para pace, distância, intervalados, zonas e histórico de corrida no mesmo padrão de clareza.',
      status: 'Opcional',
    },
    strength: {
      value: 'strength',
      tier: 'beta',
      title: 'Strength / Bodybuilding',
      description: 'Base em evolução para séries, reps, carga, esforço percebido e progressão de força com leitura mais organizada.',
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
