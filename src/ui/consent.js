import { hasTelemetryConsent, setTelemetryConsent, trackEvent } from '../core/services/telemetryService.js';

/**
 * LGPD consent banner for telemetry.
 */
export function mountConsentBanner() {
  if (hasTelemetryConsent()) return;
  if (document.getElementById('consent-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:9999',
    'background:#111827',
    'color:#f3f4f6',
    'padding:12px 16px',
    'display:flex',
    'gap:12px',
    'align-items:center',
    'justify-content:space-between',
    'font-family:system-ui,sans-serif',
    'font-size:14px',
  ].join(';');

  banner.innerHTML = `
    <div style="max-width: 760px;">
      Usamos telemetria para melhorar o produto (retenção, conversão e erros), conforme LGPD.
      Veja <a href="./privacy.html" style="color:#93c5fd;">Política de Privacidade</a>.
    </div>
    <div style="display:flex; gap:8px; white-space:nowrap;">
      <button id="consent-decline" style="padding:8px 12px; border:1px solid #6b7280; background:transparent; color:#f3f4f6; border-radius:8px;">Recusar</button>
      <button id="consent-accept" style="padding:8px 12px; border:0; background:#2563eb; color:white; border-radius:8px;">Aceitar</button>
    </div>
  `;

  document.body.appendChild(banner);

  const close = () => {
    try {
      document.body.removeChild(banner);
    } catch {
      // no-op
    }
  };

  banner.querySelector('#consent-accept')?.addEventListener('click', () => {
    setTelemetryConsent(true);
    trackEvent('consent_accepted', { scope: 'telemetry' });
    close();
  });

  banner.querySelector('#consent-decline')?.addEventListener('click', () => {
    setTelemetryConsent(false);
    close();
  });
}
