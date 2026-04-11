import {
  renderSettingsAboutSection,
  renderSettingsAdvancedSection,
  renderSettingsDataSection,
  renderSettingsPreferencesSection,
} from './settingsSections.js';

export function renderAthleteSettingsModal(settings = {}) {
  const platformVariant = arguments[1]?.platformVariant === 'native' ? 'native' : 'web';
  const nativeOverlayClass = platformVariant === 'native' ? 'modal-overlay-native' : '';
  const nativeContainerClass = platformVariant === 'native' ? 'modal-container-nativeSheet' : '';
  const showLbsConversion = settings.showLbsConversion !== false;
  const showEmojis = settings.showEmojis !== false;
  const showObjectivesInWods = settings.showObjectivesInWods !== false;

  return `
    <div class="modal-overlay ${nativeOverlayClass} isOpen" id="ui-settingsModalBackdrop">
      <div class="modal-container modal-container-settings ${nativeContainerClass}">
        <div class="modal-header">
          <div class="modal-titleGroup">
            <span class="modal-kicker">Ajustes</span>
            <h2 class="modal-title">Configurações do app</h2>
          </div>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-settings">
          ${renderSettingsPreferencesSection({
            showLbsConversion,
            showEmojis,
            showObjectivesInWods,
          })}
          ${renderSettingsDataSection()}
          ${renderSettingsAdvancedSection()}
          ${renderSettingsAboutSection()}
        </div>
      </div>
    </div>
  `;
}
