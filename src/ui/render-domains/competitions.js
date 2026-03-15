export function renderCompetitionsPage(state, helpers) {
  const {
    renderPageHero,
    renderSummaryTile,
    renderPageFold,
    renderListSkeletons,
    getCompetitionProviderVisual,
    formatCompetitionMetaLine,
    competitionStatusClass,
    formatCompetitionStatus,
    formatCompetitionProvider,
    formatDateShort,
    escapeHtml,
    escapeAttribute,
  } = helpers;

  const athleteOverview = state?.__ui?.athleteOverview || {};
  const browser = state?.__ui?.competitionBrowser || {};
  const items = Array.isArray(browser.items) && browser.items.length
    ? browser.items
    : (athleteOverview?.upcomingCompetitions || []);
  const access = athleteOverview?.gymAccess || [];
  const isBusy = !!state?.__ui?.isBusy || !!browser.loading;
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;
  const activeGyms = access.filter((item) => !item?.warning).length;
  const blockedGyms = access.filter((item) => item?.warning).length;
  const liveItems = items.filter((item) => String(item?.status || '').toLowerCase() === 'live');
  const selectedCompetitionId = Number(browser.selectedCompetitionId || items[0]?.id || 0) || null;
  const selectedCompetition = items.find((item) => Number(item.id) === selectedCompetitionId) || items[0] || null;
  const selectedEvents = Array.isArray(selectedCompetition?.events) ? selectedCompetition.events : [];
  const selectedEventId = Number(browser.selectedEventId || selectedEvents[0]?.id || 0) || null;
  const selectedEvent = selectedEvents.find((item) => Number(item.id) === selectedEventId) || selectedEvents[0] || null;
  const competitionLeaderboard = browser.competitionLeaderboard || null;
  const eventLeaderboard = browser.eventLeaderboard || null;
  const selectedVisual = selectedCompetition ? getCompetitionProviderVisual(selectedCompetition) : null;

  return `
    <div class="workout-container page-stack page-stack-competitions">
      ${renderPageHero({
        eyebrow: 'Competitions',
        title: 'Eventos, inscrições e leaderboards',
        subtitle: 'Módulo Competitions com agenda do box, links oficiais e estrutura pronta para Open e Competition Corner.',
        actions: `
          ${isAuthenticated
            ? '<button class="btn-secondary" data-action="page:set" data-page="account" type="button">Ver conta</button>'
            : '<button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>'
          }
        `,
      })}

      <div class="summary-strip summary-strip-3">
        ${renderSummaryTile('Eventos', isBusy ? '...' : String(items.length), 'competições listadas')}
        ${renderSummaryTile('Ao vivo', isBusy ? '...' : String(liveItems.length), 'com etapa ativa')}
        ${renderSummaryTile('Gyms ativos', isBusy ? '...' : String(activeGyms), 'com acesso ok')}
        ${renderSummaryTile('Alertas', isBusy ? '...' : String(blockedGyms), 'gyms com aviso')}
      </div>

      <div class="coach-grid">
        ${renderPageFold({
          title: 'Calendário de eventos',
          subtitle: 'Catálogo unificado do módulo Competitions para manual, CrossFit Open e Competition Corner.',
          content: `
          <div class="coach-list coach-listCompact">
            ${isBusy ? renderListSkeletons(4) : items.length ? items.map((item) => `
              <button class="coach-listItem ${Number(item.id) === selectedCompetitionId ? 'isActive' : ''}" data-action="competition:select" data-competition-id="${Number(item.id) || ''}" type="button">
                <strong>${escapeHtml(item.title || 'Competição')}</strong>
                <span>${escapeHtml(formatCompetitionMetaLine(item))}</span>
                <span class="coach-pillRow">
                  <span class="coach-pill ${competitionStatusClass(item.status)}">${escapeHtml(formatCompetitionStatus(item.status))}</span>
                  <span class="coach-pill">${escapeHtml(getCompetitionProviderVisual(item).icon)} ${escapeHtml(formatCompetitionProvider(item.source_provider || item.sourceProvider))}</span>
                  ${item.events?.length ? `<span class="coach-pill">${item.events.length} evento(s)</span>` : ''}
                </span>
              </button>
            `).join('') : '<p class="account-hint">Seu coach ainda não publicou eventos para os gyms ligados à sua conta.</p>'}
          </div>
          `,
        })}

        ${renderPageFold({
          title: selectedCompetition ? `Detalhe • ${escapeHtml(selectedCompetition.title || 'Competição')}` : 'Detalhe do evento',
          subtitle: selectedCompetition
            ? 'Inscrição, site oficial, leaderboard e eventos internos.'
            : 'Selecione uma competição para ver os detalhes.',
          content: `
          ${selectedCompetition ? `
            <div class="competition-providerHero ${escapeAttribute(selectedVisual?.toneClass || '')}" ${selectedVisual?.coverStyle ? `style="${escapeAttribute(selectedVisual.coverStyle)}"` : ''}>
              <div class="competition-providerHeroBackdrop"></div>
              <div class="competition-providerHeroBody">
                <div class="competition-providerHeroMark">${escapeHtml(selectedVisual?.icon || '•')}</div>
                <div class="competition-providerHeroCopy">
                  <span class="competition-providerHeroEyebrow">${escapeHtml(formatCompetitionProvider(selectedCompetition.source_provider || selectedCompetition.sourceProvider))}</span>
                  <strong>${escapeHtml(selectedCompetition.title || 'Competição')}</strong>
                  <span>${escapeHtml(formatCompetitionMetaLine(selectedCompetition))}</span>
                </div>
              </div>
            </div>
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>${escapeHtml(selectedCompetition.title || 'Competição')}</strong>
                <span>${escapeHtml(formatCompetitionMetaLine(selectedCompetition))}</span>
              </div>
              <div class="coach-listItem static">
                <strong>Provider</strong>
                <span>${escapeHtml(formatCompetitionProvider(selectedCompetition.source_provider || selectedCompetition.sourceProvider))} • ${escapeHtml(formatCompetitionStatus(selectedCompetition.status))}</span>
              </div>
              ${selectedCompetition.description ? `
                <div class="coach-listItem static">
                  <strong>Descrição</strong>
                  <span>${escapeHtml(selectedCompetition.description)}</span>
                </div>
              ` : ''}
            </div>
            <div class="page-actions">
              ${selectedCompetition.registration_url || selectedCompetition.registrationUrl ? `<a class="btn-primary" href="${escapeAttribute(selectedCompetition.registration_url || selectedCompetition.registrationUrl)}">Inscrever-se</a>` : ''}
              ${selectedCompetition.official_site_url || selectedCompetition.officialSiteUrl ? `<a class="btn-secondary" href="${escapeAttribute(selectedCompetition.official_site_url || selectedCompetition.officialSiteUrl)}">Site oficial</a>` : ''}
              ${selectedCompetition.leaderboard_url || selectedCompetition.leaderboardUrl ? `<a class="btn-secondary" href="${escapeAttribute(selectedCompetition.leaderboard_url || selectedCompetition.leaderboardUrl)}">Leaderboard oficial</a>` : ''}
            </div>
            ${selectedEvents.length ? `
              <div class="coach-list coach-listCompact competition-eventList">
                ${selectedEvents.map((event) => `
                  <button class="coach-listItem ${Number(event.id) === selectedEventId ? 'isActive' : ''}" data-action="competition:event" data-competition-id="${Number(selectedCompetition.id) || ''}" data-event-id="${Number(event.id) || ''}" type="button">
                    <strong>${escapeHtml(event.title || 'Evento')}</strong>
                    <span>${escapeHtml(formatDateShort(event.eventDate || event.event_date))}${event.benchmarkSlug ? ` • ${escapeHtml(event.benchmarkSlug)}` : ''}</span>
                  </button>
                `).join('')}
              </div>
            ` : '<p class="account-hint">Sem eventos internos cadastrados. A competição ainda pode usar leaderboard oficial externo.</p>'}
          ` : '<p class="account-hint">Selecione uma competição para ver links e leaderboard.</p>'}
          `,
        })}

        ${renderPageFold({
          title: selectedEvent ? `Leaderboard • ${escapeHtml(selectedEvent.title || 'Evento')}` : 'Leaderboard',
          subtitle: selectedEvent
            ? 'Ranking do evento selecionado, com fallback para o link oficial.'
            : 'Selecione um evento interno para ver o ranking dentro do app.',
          content: `
          ${selectedEvent && eventLeaderboard?.results?.length ? `
            <div class="coach-list coach-listCompact">
              ${eventLeaderboard.results.slice(0, 10).map((row) => `
                <div class="coach-listItem static leaderboard-item">
                  <strong>#${Number(row.rank || 0)} ${escapeHtml(row.name || row.email || 'Atleta')}</strong>
                  <span>${escapeHtml(row.score_display || '—')}${row.points ? ` • ${escapeHtml(String(row.points))} pts` : ''}</span>
                </div>
              `).join('')}
            </div>
          ` : selectedCompetition && competitionLeaderboard?.leaderboard?.length ? `
            <div class="coach-list coach-listCompact">
              ${competitionLeaderboard.leaderboard.slice(0, 10).map((row) => `
                <div class="coach-listItem static leaderboard-item">
                  <strong>#${Number(row.rank || 0)} ${escapeHtml(row.name || row.email || 'Atleta')}</strong>
                  <span>${escapeHtml(String(row.totalPoints || 0))} pts • ${escapeHtml(String(row.eventsCompleted || 0))} evento(s)</span>
                </div>
              `).join('')}
            </div>
          ` : selectedEvent?.leaderboardUrl ? `
            <div class="page-actions">
              <a class="btn-primary" href="${escapeAttribute(selectedEvent.leaderboardUrl)}">Abrir leaderboard oficial do evento</a>
            </div>
          ` : selectedCompetition?.leaderboard_url || selectedCompetition?.leaderboardUrl ? `
            <div class="page-actions">
              <a class="btn-primary" href="${escapeAttribute(selectedCompetition.leaderboard_url || selectedCompetition.leaderboardUrl)}">Abrir leaderboard oficial da competição</a>
            </div>
          ` : '<p class="account-hint">Esse evento ainda não tem ranking interno nem link oficial configurado.</p>'}
          `,
        })}

        ${renderPageFold({
          title: 'Acesso por gym',
          subtitle: 'Status atual do vínculo com cada box.',
          content: `
          <div class="coach-list coach-listCompact">
            ${isBusy ? renderListSkeletons(3) : access.length ? access.map((item) => `
              <div class="coach-listItem static">
                <strong>${escapeHtml(item.gymName || `Gym ${item.gymId}`)}</strong>
                <span>${item.warning ? escapeHtml(item.warning) : 'Acesso ativo'}</span>
              </div>
            `).join('') : '<p class="account-hint">Entre na conta correta ou peça ao coach para vincular você a um gym.</p>'}
          </div>
          `,
        })}
      </div>
    </div>
  `;
}
