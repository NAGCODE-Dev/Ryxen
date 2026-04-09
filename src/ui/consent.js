import { hasTelemetryConsent, setTelemetryConsent, trackEvent } from '../core/services/telemetryService.js';

/**
 * LGPD consent banner for telemetry.
 */
export function mountConsentBanner() {
  if (hasTelemetryConsent()) return;
  if (document.getElementById('consent-banner')) return;

  const isCompact = window.matchMedia?.('(max-width: 640px)')?.matches;

  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.style.cssText = [
    'position:fixed',
    isCompact ? 'left:12px' : 'left:0',
    isCompact ? 'right:12px' : 'right:0',
    isCompact ? 'bottom:12px' : 'bottom:0',
    'z-index:9999',
    'background:#111827',
    'color:#f3f4f6',
    isCompact ? 'padding:12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' : 'padding:12px 16px',
    'display:flex',
    'gap:12px',
    isCompact ? 'flex-direction:column' : 'flex-direction:row',
    isCompact ? 'align-items:flex-start' : 'align-items:center',
    'justify-content:space-between',
    'font-family:system-ui,sans-serif',
    isCompact ? 'font-size:13px' : 'font-size:14px',
    isCompact ? 'border:1px solid rgba(148,163,184,.18)' : 'border-top:1px solid rgba(148,163,184,.12)',
    isCompact ? 'border-radius:18px' : 'border-radius:0',
    isCompact ? 'box-shadow:0 18px 44px rgba(0,0,0,.32)' : 'box-shadow:none',
    isCompact ? 'max-width:460px' : 'max-width:none',
    isCompact ? 'margin:0 auto' : 'margin:0',
  ].join(';');

  banner.innerHTML = `
    <div style="max-width:${isCompact ? 'none' : '760px'}; line-height:${isCompact ? '1.45' : '1.5'};">
      Usamos telemetria para melhorar o produto (retenção, conversão e erros), conforme LGPD.
      Veja <a href="/privacy.html" style="color:#93c5fd;">Política de Privacidade</a>.
    </div>
    <div style="display:flex; gap:8px; white-space:nowrap; width:${isCompact ? '100%' : 'auto'}; justify-content:${isCompact ? 'flex-end' : 'flex-start'};">
      <button id="consent-decline" style="padding:8px 12px; min-height:40px; border:1px solid #6b7280; background:transparent; color:#f3f4f6; border-radius:12px;">Recusar</button>
      <button id="consent-accept" style="padding:8px 12px; min-height:40px; border:0; background:#2563eb; color:white; border-radius:12px;">Aceitar</button>
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
