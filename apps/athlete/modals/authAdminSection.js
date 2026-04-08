export function renderAdminSection({ overview, admin, escapeHtml, formatDateShort }) {
  return `
    <details class="account-fold account-section-admin">
      <summary class="account-foldSummary">
        <div>
          <div class="section-kicker">Admin</div>
          <strong>Painel administrativo</strong>
        </div>
        <span class="account-foldMeta">${Number(overview?.stats?.users || 0)} usuários • ${Number(overview?.stats?.activeSubscriptions || 0)} assinaturas</span>
      </summary>
      <div class="account-foldBody">
      <div class="account-sectionHead">
        <div></div>
        <button class="btn-secondary" data-action="admin:refresh" type="button">Atualizar</button>
      </div>
      <div class="admin-toolbar">
        <input class="add-input" id="admin-search" type="text" placeholder="Buscar por nome ou email" value="${escapeHtml(admin?.query || '')}" />
        <button class="btn-secondary" data-action="admin:refresh" type="button">Buscar</button>
      </div>
      ${overview ? `
        <div class="admin-stats">
          <div class="admin-statCard">
            <span class="admin-statLabel">Usuários</span>
            <span class="admin-statValue">${Number(overview?.stats?.users || 0)}</span>
          </div>
          <div class="admin-statCard">
            <span class="admin-statLabel">Assinaturas ativas</span>
            <span class="admin-statValue">${Number(overview?.stats?.activeSubscriptions || 0)}</span>
          </div>
          <div class="admin-statCard">
            <span class="admin-statLabel">Exclusões pendentes</span>
            <span class="admin-statValue">${Number(overview?.stats?.pendingAccountDeletions || 0)}</span>
          </div>
        </div>
        <div class="admin-userList">
          ${(overview?.users || []).map((user) => `
            <div class="admin-userRow">
              <div>
                <div class="admin-userName">${escapeHtml(user.name || 'Sem nome')}</div>
                <div class="admin-userEmail">${escapeHtml(user.email || '')}</div>
                <div class="account-hint">
                  Plano: ${escapeHtml(user.subscription_plan || 'free')} • ${escapeHtml(user.subscription_status || 'inactive')}
                  ${user.subscription_renew_at ? ` • renova em ${escapeHtml(formatDateShort(user.subscription_renew_at))}` : ''}
                </div>
                ${user.pendingDeletion ? `
                  <div class="account-hint" style="color:#f3c87b;">
                    Exclusão pendente • apaga em ${escapeHtml(formatDateShort(user.pendingDeletion.delete_after || user.pendingDeletion.deleteAfter || ''))}
                  </div>
                ` : ''}
              </div>
              <div class="admin-userControls">
                <div class="admin-userMeta">${user.is_admin ? 'Admin' : 'User'}</div>
                <div class="admin-userActions">
                  <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="starter" type="button">Starter</button>
                  <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="pro" type="button">Pro</button>
                  <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="performance" type="button">Performance</button>
                  <button class="btn-secondary" data-action="admin:request-delete" data-user-id="${Number(user.id)}" data-user-email="${escapeHtml(user.email || '')}" type="button">${user.pendingDeletion ? 'Reenviar deleção' : 'Pedir deleção'}</button>
                  <button class="btn-secondary" data-action="admin:delete-now" data-user-id="${Number(user.id)}" data-user-email="${escapeHtml(user.email || '')}" type="button">Excluir agora</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <p class="account-hint">Carregue os dados do painel para ver os últimos usuários.</p>
      `}
      </div>
    </details>
  `;
}
