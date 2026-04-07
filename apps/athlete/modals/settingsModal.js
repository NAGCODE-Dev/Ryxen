export function renderAthleteSettingsModal(settings = {}) {
  const showLbsConversion = settings.showLbsConversion !== false;
  const showEmojis = settings.showEmojis !== false;
  const showObjectivesInWods = settings.showObjectivesInWods !== false;

  return `
    <div class="modal-overlay isOpen" id="ui-settingsModalBackdrop">
      <div class="modal-container modal-container-settings">
        <div class="modal-header">
          <h2 class="modal-title">⚙️ Configurações do app</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-settings">
          <section class="settings-section">
            <div class="settings-sectionHead">
              <strong>Preferências</strong>
              <span>Salvam automaticamente quando você toca.</span>
            </div>
            <div class="settings-group">
              <label class="settings-label">
                <input
                  type="checkbox"
                  id="setting-showLbsConversion"
                  data-setting-toggle="showLbsConversion"
                  ${showLbsConversion ? 'checked' : ''}
                />
                <span>
                  <strong>Mostrar conversão lbs → kg</strong>
                  <small>Ajuda a ler cargas importadas em libras sem fazer conta mental.</small>
                </span>
              </label>

              <label class="settings-label">
                <input
                  type="checkbox"
                  id="setting-showEmojis"
                  data-setting-toggle="showEmojis"
                  ${showEmojis ? 'checked' : ''}
                />
                <span>
                  <strong>Mostrar emojis</strong>
                  <small>Mantém a leitura mais leve nas áreas que usam sinais visuais rápidos.</small>
                </span>
              </label>

              <label class="settings-label">
                <input
                  type="checkbox"
                  id="setting-showObjectives"
                  data-setting-toggle="showObjectivesInWods"
                  ${showObjectivesInWods ? 'checked' : ''}
                />
                <span>
                  <strong>Mostrar objetivos nos WODs</strong>
                  <small>Exibe a intenção do treino quando o conteúdo tiver esse contexto.</small>
                </span>
              </label>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-sectionHead">
              <strong>Dados</strong>
              <span>Ferramentas para guardar ou recuperar seu app.</span>
            </div>
            <div class="settings-actions settings-actions-grid">
              <button class="btn-secondary" data-action="backup:export" type="button">🧰 Fazer backup</button>
              <button class="btn-secondary" data-action="backup:import" type="button">♻️ Restaurar backup</button>
            </div>
          </section>

          <section class="settings-section settings-section-danger">
            <div class="settings-sectionHead">
              <strong>Avançado</strong>
              <span>Ação crítica. Use só quando quiser zerar os dados locais do app.</span>
            </div>
            <div class="settings-actions">
              <button class="btn-secondary btn-dangerSoft" data-action="pdf:clear" type="button">🗑️ Limpar dados do app</button>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-sectionHead">
              <strong>Sobre</strong>
              <span>Informações legais e privacidade.</span>
            </div>
            <div class="settings-actions settings-actions-grid">
              <a class="btn-secondary settings-linkBtn" href="/privacy.html" target="_blank" rel="noopener noreferrer">🔐 Privacidade</a>
              <a class="btn-secondary settings-linkBtn" href="/terms.html" target="_blank" rel="noopener noreferrer">📄 Termos</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
