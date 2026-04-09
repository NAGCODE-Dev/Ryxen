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
    'background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025)), rgba(17,22,30,.92)',
    'color:#edf2fb',
    isCompact ? `${isTiny ? 'padding:8px 9px' : 'padding:10px 12px'} calc(${isTiny ? '8px' : '10px'} + env(safe-area-inset-bottom, 0px))` : 'padding:10px 14px',
    'display:flex',
    isTiny ? 'gap:7px' : 'gap:10px',
    isCompact ? 'flex-direction:column' : 'flex-direction:row',
    isCompact ? 'align-items:flex-start' : 'align-items:center',
    'justify-content:space-between',
    'font-family:Manrope,system-ui,sans-serif',
    isCompact ? (isTiny ? 'font-size:12px' : 'font-size:13px') : 'font-size:14px',
    isCompact ? 'border:1px solid rgba(255,255,255,.08)' : 'border-top:1px solid rgba(255,255,255,.08)',
    isCompact ? `border-radius:${isTiny ? '14px' : '18px'}` : 'border-radius:0',
    isCompact ? 'box-shadow:0 18px 44px rgba(4,9,18,.22)' : 'box-shadow:none',
    isCompact ? `max-width:${isTiny ? '320px' : '380px'}` : 'max-width:none',
    isCompact ? 'margin:0 auto' : 'margin:0',
  ].join(';');

  banner.innerHTML = `
    <div style="max-width:${isCompact ? 'none' : '760px'}; line-height:${isCompact ? (isTiny ? '1.25' : '1.35') : '1.5'};">
      ${copy.replace('Política de Privacidade.', '<a href="/privacy.html" style="color:#d7e5ff;text-decoration:underline;text-decoration-color:rgba(255,255,255,.24);text-underline-offset:2px;">Política de Privacidade</a>.')}
    </div>
    <div style="display:flex; gap:8px; white-space:nowrap; width:${isCompact ? '100%' : 'auto'}; justify-content:${isCompact ? 'flex-end' : 'flex-start'};">
      <button id="consent-decline" style="padding:${isCompact ? (isTiny ? '6px 9px' : '7px 11px') : '8px 12px'}; min-height:${isCompact ? (isTiny ? '32px' : '36px') : '40px'}; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); color:#edf2fb; border-radius:${isTiny ? '10px' : '12px'};">Recusar</button>
      <button id="consent-accept" style="padding:${isCompact ? (isTiny ? '6px 9px' : '7px 11px') : '8px 12px'}; min-height:${isCompact ? (isTiny ? '32px' : '36px') : '40px'}; border:0; background:linear-gradient(135deg,#eef4ff 0%,#dce9ff 100%); color:#0e1520; border-radius:${isTiny ? '10px' : '12px'}; font-weight:700;">Aceitar</button>
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
