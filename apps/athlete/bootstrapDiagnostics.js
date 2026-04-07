import { getAppBridge } from '../../src/app/bridge.js';

export function renderDebugPlaceholder() {
  const root = document.getElementById('app');
  if (!root) return;

  const state = safeGetState();

  root.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui; max-width: 900px; margin: 0 auto;">
      <h1 style="margin:0 0 1rem 0;">✅ PWA Multi-Semana Pronto (Debug)</h1>

      <div style="background:#f0f0f0; padding:1.25rem; border-radius:10px; margin:1rem 0;">
        <h2 style="margin:0 0 0.75rem 0;">📊 Estado Atual</h2>
        <ul style="margin:0; padding-left: 1.1rem;">
          <li><strong>Dia:</strong> ${escapeHtml(state.currentDay || '—')}</li>
          <li><strong>Semanas carregadas:</strong> ${Number(state.weeks?.length || 0)}</li>
          <li><strong>Semana ativa:</strong> ${escapeHtml(state.activeWeekNumber ?? 'Nenhuma')}</li>
          <li><strong>PRs cadastrados:</strong> ${Object.keys(state.prs || {}).length}</li>
          <li><strong>Tela ativa:</strong> ${escapeHtml(state.ui?.activeScreen || '—')}</li>
          <li><strong>Treino:</strong> ${
            state.workout ? escapeHtml(`${state.workout.day} (${state.workout.blocks?.length || 0} blocos)`) : '⏳ Aguardando PDF'
          }</li>
        </ul>
      </div>

      <div style="background:#e3f2fd; padding:1.25rem; border-radius:10px; margin:1rem 0;">
        <h2 style="margin:0 0 0.75rem 0;">🧪 Teste Multi-Semana no Console</h2>
        <pre style="background:#fff; padding:1rem; border-radius:8px; overflow:auto; font-size:0.9rem; line-height:1.4;">
// 1. Abra a página sem ?debug=1 para usar a UI normal.
// 2. O bridge interno não fica mais exposto no window.
// 3. Para inspecionar o estado, use o painel visual acima.

// Exemplo de fluxo manual de teste:
const input = document.createElement('input');
input.type = 'file';
input.accept = 'application/pdf';
input.onchange = async () => {
  console.log('Use a UI principal para importar o arquivo selecionado.');
};
input.click();
        </pre>
        <p style="margin:0;color:#333;">
          Dica: remova <code>?debug=1</code> da URL para voltar para a UI.
        </p>
      </div>
    </div>
  `;
}

export function renderError(errorMessage) {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui; max-width: 720px; margin: 0 auto; text-align: center;">
      <h1 style="color:#d32f2f; margin:0 0 0.75rem 0;">Erro ao Inicializar</h1>
      <p style="background:#ffebee; padding:1rem; border-radius:10px; color:#b71c1c; margin:0 0 1rem 0;">
        ${escapeHtml(errorMessage)}
      </p>
      <button
        onclick="location.reload()"
        style="padding: 0.75rem 1.25rem; background:#1976d2; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:1rem;"
      >
        Recarregar
      </button>
    </div>
  `;
}

function safeGetState() {
  try {
    if (getAppBridge()?.getStateSnapshot) return getAppBridge().getStateSnapshot();
    return getAppBridge()?.getState ? getAppBridge().getState() : {};
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}
