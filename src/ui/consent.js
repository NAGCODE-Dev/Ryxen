import { hasTelemetryConsent, setTelemetryConsent, trackEvent } from '../core/services/telemetryService.js';

/**
 * LGPD consent banner for telemetry.
 */
export function mountConsentBanner() {
  if (hasTelemetryConsent()) return;
  if (document.getElementById('consent-banner')) return;

  const isCompact = window.matchMedia?.('(max-width: 640px)')?.matches;
  const isTiny = window.matchMedia?.('(max-width: 380px)')?.matches;
  const compactBottom = isTiny ? '6px' : '10px';
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
    isCompact ? `bottom:calc(${compactBottom} + env(safe-area-inset-bottom, 0px))` : 'bottom:0',
    'z-index:9999',
    'background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.018)), rgba(15,19,26,.82)',
    'color:#edf2fb',
    isCompact ? (isTiny ? 'padding:7px 8px' : 'padding:8px 10px') : 'padding:10px 14px',
    'display:flex',
    isTiny ? 'gap:6px' : 'gap:8px',
    isCompact ? 'flex-direction:column' : 'flex-direction:row',
    isCompact ? 'align-items:flex-start' : 'align-items:center',
    'justify-content:space-between',
    'font-family:Manrope,system-ui,sans-serif',
    isCompact ? (isTiny ? 'font-size:11px' : 'font-size:12px') : 'font-size:14px',
    isCompact ? 'border:1px solid rgba(255,255,255,.08)' : 'border-top:1px solid rgba(255,255,255,.08)',
    isCompact ? `border-radius:${isTiny ? '12px' : '16px'}` : 'border-radius:0',
    isCompact ? 'box-shadow:0 14px 34px rgba(4,9,18,.18)' : 'box-shadow:none',
    isCompact ? `max-width:${isTiny ? '300px' : '344px'}` : 'max-width:none',
    isCompact ? 'margin:0 auto' : 'margin:0',
    'backdrop-filter:blur(16px)',
  ].join(';');

  banner.innerHTML = `
    <div style="max-width:${isCompact ? 'none' : '760px'}; line-height:${isCompact ? (isTiny ? '1.22' : '1.3') : '1.5'};">
      ${copy.replace('Política de Privacidade.', '<a href="/privacy.html" style="color:#d7e5ff;text-decoration:underline;text-decoration-color:rgba(255,255,255,.24);text-underline-offset:2px;">Política de Privacidade</a>.')}
    </div>
    <div style="display:flex; gap:${isTiny ? '6px' : '7px'}; white-space:nowrap; width:${isCompact ? '100%' : 'auto'}; justify-content:${isCompact ? 'flex-end' : 'flex-start'};">
      <button id="consent-decline" style="padding:${isCompact ? (isTiny ? '5px 8px' : '6px 10px') : '8px 12px'}; min-height:${isCompact ? (isTiny ? '28px' : '32px') : '40px'}; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.035); color:#edf2fb; border-radius:${isTiny ? '9px' : '11px'};">Recusar</button>
      <button id="consent-accept" style="padding:${isCompact ? (isTiny ? '5px 8px' : '6px 10px') : '8px 12px'}; min-height:${isCompact ? (isTiny ? '28px' : '32px') : '40px'}; border:0; background:linear-gradient(135deg,#eef4ff 0%,#dce9ff 100%); color:#0e1520; border-radius:${isTiny ? '9px' : '11px'}; font-weight:700;">Aceitar</button>
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
