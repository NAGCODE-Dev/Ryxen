export function renderGuestBenefitsSection(renderPageFold) {
  return renderPageFold({
    title: 'O que libera',
    subtitle: 'Benefícios práticos dentro do app.',
    guideTarget: 'account-access',
    content: `
      <div class="coach-list coach-listCompact">
        <div class="coach-listItem static">
          <strong>Conta salva</strong>
          <span>Entre com a mesma conta quando precisar retomar seu uso.</span>
        </div>
        <div class="coach-listItem static">
          <strong>Treinos do coach</strong>
          <span>Receba a programação do box mantendo o app principal como sua rotina diária.</span>
        </div>
        <div class="coach-listItem static">
          <strong>Histórico e PRs</strong>
          <span>Use seu progresso para calcular cargas e enxergar evolução, sem limite artificial no app.</span>
        </div>
      </div>
    `,
  });
}

export function renderGuestCoachPortalSection(renderPageFold) {
  return renderPageFold({
    title: 'Coach Portal',
    subtitle: 'A mesma conta também abre a área separada do box.',
    guideTarget: 'account-coach',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Portal separado</strong>
        <span>Gestão do box, atletas e publicação de treino continuam fora do app principal.</span>
      </div>
    </div>
    <div class="page-actions">
      <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
      <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
    </div>
    `,
  });
}
