import { hasTelemetryConsent, setTelemetryConsent, trackEvent } from '../core/services/telemetryService.js';

/**
 * LGPD consent banner for telemetry.
 */
export function mountConsentBanner() {
  if (hasTelemetryConsent()) return;
  if (document.getElementById('consent-banner')) return;

  const isCompact = window.matchMedia?.('(max-width: 640px)')?.matches;
  const isTiny = window.matchMedia?.('(max-width: 380px)')?.matches;
  const copy = isTiny
    ? 'Telemetria opcional. Veja a Política de Privacidade.'
    : isCompact
      ? 'Usamos telemetria para melhorar erros e experiência. Veja a Política de Privacidade.'
    : 'Usamos telemetria para melhorar o produto (retenção, conversão e erros), conforme LGPD. Veja Política de Privacidade.';

  const banner = document.createElement('div');
  banner.id = 'consent-banner';
  banner.style.cssText = [
    'position:fixed',
    isCompact ? (isTiny ? 'left:8px' : 'left:12px') : 'left:0',
    isCompact ? (isTiny ? 'right:8px' : 'right:12px') : 'right:0',
    isCompact ? (isTiny ? 'bottom:8px' : 'bottom:12px') : 'bottom:0',
    'z-index:9999',
    'background:#111827',
    'color:#f3f4f6',
    isCompact ? `${isTiny ? 'padding:9px 10px' : 'padding:12px 14px'} calc(${isTiny ? '9px' : '12px'} + env(safe-area-inset-bottom, 0px))` : 'padding:12px 16px',
    'display:flex',
    isTiny ? 'gap:8px' : 'gap:12px',
    isCompact ? 'flex-direction:column' : 'flex-direction:row',
    isCompact ? 'align-items:flex-start' : 'align-items:center',
    'justify-content:space-between',
    'font-family:system-ui,sans-serif',
    isCompact ? (isTiny ? 'font-size:12px' : 'font-size:13px') : 'font-size:14px',
    isCompact ? 'border:1px solid rgba(148,163,184,.18)' : 'border-top:1px solid rgba(148,163,184,.12)',
    isCompact ? `border-radius:${isTiny ? '14px' : '18px'}` : 'border-radius:0',
    isCompact ? 'box-shadow:0 18px 44px rgba(0,0,0,.32)' : 'box-shadow:none',
    isCompact ? `max-width:${isTiny ? '320px' : '380px'}` : 'max-width:none',
    isCompact ? 'margin:0 auto' : 'margin:0',
  ].join(';');

  banner.innerHTML = `
    <div style="max-width:${isCompact ? 'none' : '760px'}; line-height:${isCompact ? (isTiny ? '1.25' : '1.35') : '1.5'};">
      ${copy.replace('Política de Privacidade.', '<a href="/privacy.html" style="color:#93c5fd;">Política de Privacidade</a>.')}
    </div>
    <div style="display:flex; gap:8px; white-space:nowrap; width:${isCompact ? '100%' : 'auto'}; justify-content:${isCompact ? 'flex-end' : 'flex-start'};">
      <button id="consent-decline" style="padding:${isCompact ? (isTiny ? '6px 9px' : '7px 11px') : '8px 12px'}; min-height:${isCompact ? (isTiny ? '32px' : '36px') : '40px'}; border:1px solid #6b7280; background:transparent; color:#f3f4f6; border-radius:${isTiny ? '10px' : '12px'};">Recusar</button>
      <button id="consent-accept" style="padding:${isCompact ? (isTiny ? '6px 9px' : '7px 11px') : '8px 12px'}; min-height:${isCompact ? (isTiny ? '32px' : '36px') : '40px'}; border:0; background:#2563eb; color:white; border-radius:${isTiny ? '10px' : '12px'};">Aceitar</button>
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
