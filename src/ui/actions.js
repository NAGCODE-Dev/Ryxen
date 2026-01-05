export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');
  // Busca de PRs (filtra em tempo real)
root.addEventListener('input', (e) => {
  const t = e.target;
  if (!t || t.id !== 'ui-prsSearch') return;
  filterPrs(root, t.value);
});

function filterPrs(root, query) {
  const q = String(query || '').trim().toUpperCase();

  const table = root.querySelector('#ui-prsTable');
  if (!table) return;

  const items = Array.from(table.querySelectorAll('.pr-item'));
  let visible = 0;

  for (const item of items) {
    const ex = String(item.getAttribute('data-exercise') || '').toUpperCase();
    const show = !q || ex.includes(q);
    item.style.display = show ? '' : 'none';
    if (show) visible++;
  }

  // opcional: mostra contador em algum lugar (se existir no seu shell)
  const countEl = root.querySelector('#ui-prsCount');
  if (countEl) countEl.textContent = `${visible} PRs`;
}

  // Clicks (delegação)
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    try {
      switch (action) {
        // ----- PDF / semana / treino -----
        case 'pdf:pick': {
          const file = await pickPdfFile();
          if (!file) return;
          await window.__APP__.uploadMultiWeekPdf(file);
          await rerender();
          return;
        }

        case 'pdf:clear': {
          const ok = confirm(
            '⚠️ Limpar todos os PDFs salvos?\n\n' +
            'Isso removerá todas as semanas carregadas. Esta ação não pode ser desfeita.'
          );
          if (!ok) return;

          const result = await window.__APP__.clearAllPdfs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao limpar PDFs');

          toast('Todos os PDFs removidos');
          await rerender();
          return;
        }

        case 'week:select': {
          const week = Number(el.dataset.week);
          if (!Number.isFinite(week)) return;

          await window.__APP__.selectWeek(week);
          await rerender();
          return;
        }

        case 'day:auto': {
          // Compat: alguns cores usam resetDay()
          if (typeof window.__APP__?.resetDay === 'function') {
            const result = await window.__APP__.resetDay();
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          } else if (typeof window.__APP__?.setDay === 'function') {
            const result = await window.__APP__.setDay('');
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          }
          toast('Dia automático');
          await rerender();
          return;
        }

        case 'workout:copy': {
          const st = window.__APP__?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = await window.__APP__.copyWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao copiar');

          toast('Treino copiado');
          return;
        }

        case 'workout:export': {
          const st = window.__APP__?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = window.__APP__.exportWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar');

          toast('Exportado');
          return;
        }

        // ----- Modais -----
        case 'modal:open': {
          const modal = el.dataset.modal || null; // 'prs' | 'settings'
          await setUiState({ modal });
          await rerender();

          if (modal === 'prs') root.querySelector('#ui-prsSearch')?.focus();
          return;
        }

        case 'modal:close': {
          await setUiState({ modal: null });
          await rerender();
          return;
        }

        // Compat com HTML antigo
        case 'prs:open': {
          await setUiState({ modal: 'prs' });
          await rerender();
          root.querySelector('#ui-prsSearch')?.focus();
          return;
        }

        case 'prs:close': {
          await setUiState({ modal: null });
          await rerender();
          return;
        }

        // ----- Config -----
        case 'settings:save': {
          const showLbsConversion = !!root.querySelector('#setting-showLbsConversion')?.checked;
          const showEmojis = !!root.querySelector('#setting-showEmojis')?.checked;
          const showObjectivesInWods = !!root.querySelector('#setting-showObjectives')?.checked;

          await setUiState({
            settings: { showLbsConversion, showEmojis, showObjectivesInWods },
            modal: null,
          });

          toast('Configurações salvas');
          await rerender();
          return;
        }

        // ----- Modo treino / checklist -----
        case 'wod:mode': {
          await patchUiState((s) => ({ ...s, trainingMode: !s.trainingMode }));
          await rerender();
          await ensureActiveLine(root, patchUiState);
          return;
        }

        case 'wod:toggle': {
          const lineId = el.dataset.lineId;
          if (!lineId) return;

          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };
            wod.done = wod.done || {};
            wod.done[lineId] = !wod.done[lineId];
            wod.activeLineId = lineId;
            st.wod[key] = wod;
            return st;
          });

          await rerender();
          scrollToLine(root, lineId);
          return;
        }

        case 'wod:next': {
          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };
            wod.done = wod.done || {};

            const ids = getLineIdsFromDOM(root);
            if (!ids.length) return st;

            const current = wod.activeLineId;
            if (current && ids.includes(current)) wod.done[current] = true;

            const nextId = pickNextId(ids, wod.done, current);
            wod.activeLineId = nextId;

            st.wod[key] = wod;
            return st;
          });

          await rerender();
          const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
          if (id) scrollToLine(root, id);
          return;
        }

        case 'wod:prev': {
          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };

            const ids = getLineIdsFromDOM(root);
            if (!ids.length) return st;

            const current = wod.activeLineId;
            const prevId = pickPrevId(ids, current);
            wod.activeLineId = prevId;

            st.wod[key] = wod;
            return st;
          });

          await rerender();
          const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
          if (id) scrollToLine(root, id);
          return;
        }

        // ----- PRs -----
        case 'prs:add': {
          const nameEl = root.querySelector('#ui-prsNewName');
          const valueEl = root.querySelector('#ui-prsNewValue');

          const rawName = (nameEl?.value || '').trim();
          const value = Number(valueEl?.value);

          if (!rawName) throw new Error('Informe o nome do exercício');
          if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um PR válido');

          const exercise = rawName.toUpperCase();
          const result = window.__APP__.addPR(exercise, value);
          if (!result?.success) throw new Error(result?.error || 'Falha ao adicionar PR');

          if (nameEl) nameEl.value = '';
          if (valueEl) valueEl.value = '';

          toast('PR salvo');
          await rerender();
          return;
        }

        case 'prs:save': {
          const ex = el.dataset.exercise;
          if (!ex) return;

          const input = root.querySelector(
            `input[data-action="prs:editValue"][data-exercise="${cssEscape(ex)}"]`
          );
          const value = Number(input?.value);

          if (!Number.isFinite(value) || value <= 0) throw new Error('PR inválido');

          const result = window.__APP__.addPR(ex, value);
          if (!result?.success) throw new Error(result?.error || 'Falha ao salvar PR');

          toast('PR atualizado');
          await rerender();
          return;
        }

        case 'prs:remove': {
          const ex = el.dataset.exercise;
          if (!ex) return;

          const ok = confirm(`Remover PR de "${ex}"?`);
          if (!ok) return;

          const result = window.__APP__.removePR(ex);
          if (!result?.success) throw new Error(result?.error || 'Falha ao remover PR');

          toast('PR removido');
          await rerender();
          return;
        }

        case 'prs:import-file': {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';

          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;

            try {
              const text = await file.text();
              const result = window.__APP__.importPRs(text);
              if (!result?.success) throw new Error(result?.error || 'Falha ao importar');

              toast(`${result.imported} PRs importados de ${file.name}`);
              await rerender();
            } catch (err) {
              toast(err?.message || 'Erro ao ler arquivo');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });

          document.body.appendChild(input);
          input.click();
          return;
        }

        case 'prs:export': {
          const result = window.__APP__.exportPRs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar PRs');
          toast('PRs exportados');
          return;
        }

        case 'prs:import': {
          const json = prompt('Cole aqui o JSON de PRs (ex: {"BACK SQUAT":120})');
          if (!json) return;

          const result = window.__APP__.importPRs(json);
          if (!result?.success) throw new Error(result?.error || 'Falha ao importar PRs');

          toast('PRs importados');
          await rerender();
          return;
        }

        default:
          return;
      }
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  // Dia manual (select)
  root.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-action="day:set"]');
    if (!el) return;

    const dayName = el.value;
    if (!dayName) return;

    try {
      const result = await window.__APP__.setDay(dayName);
      if (!result?.success) throw new Error(result?.error || 'Falha ao definir dia');

      toast(`Dia manual: ${result.day || dayName}`);
      el.value = '';
      await rerender();
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  // Clique fora do modal fecha
  root.addEventListener('click', async (e) => {
    const overlay = e.target.closest('.modal-overlay');
    if (!overlay) return;

    // só fecha se clicou no overlay (fora do container)
    if (e.target === overlay) {
      await setUiState({ modal: null });
      await rerender();
    }
  });

  // Esc fecha modal
  document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Escape') return;
    const ui = getUiState?.();
    if (ui?.modal) {
      await setUiState({ modal: null });
      await rerender();
    }
  });
}

function workoutKeyFromAppState() {
  const s = window.__APP__?.getState?.() || {};
  const week = s?.activeWeekNumber ?? '0';
  const day = s?.currentDay ?? 'Hoje';
  return `${week}:${String(day).toLowerCase()}`;
}

function getActiveLineIdFromUi(uiState, key) {
  try {
    const wod = uiState?.wod?.[key];
    return wod?.activeLineId || null;
  } catch {
    return null;
  }
}

function getLineIdsFromDOM(root) {
  return Array.from(root.querySelectorAll('[data-line-id]'))
    .map((el) => el.getAttribute('data-line-id'))
    .filter(Boolean);
}

function pickNextId(ids, doneMap, currentId) {
  const done = doneMap || {};
  const start = Math.max(0, ids.indexOf(currentId));
  for (let i = start + 1; i < ids.length; i++) if (!done[ids[i]]) return ids[i];
  for (let i = 0; i < ids.length; i++) if (!done[ids[i]]) return ids[i];
  return ids[Math.min(start + 1, ids.length - 1)] || ids[0];
}

function pickPrevId(ids, currentId) {
  const idx = ids.indexOf(currentId);
  if (idx <= 0) return ids[0];
  return ids[idx - 1];
}

function scrollToLine(root, lineId) {
  const el = root.querySelector(`[data-line-id="${cssEscape(lineId)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function ensureActiveLine(root, patchUiState) {
  const ids = getLineIdsFromDOM(root);
  if (!ids.length) return;

  const key = workoutKeyFromAppState();
  await patchUiState((s) => {
    const st = { ...s };
    st.wod = st.wod || {};
    const wod = st.wod[key] || { activeLineId: null, done: {} };
    if (!wod.activeLineId) wod.activeLineId = ids[0];
    st.wod[key] = wod;
    return st;
  });

  scrollToLine(root, ids[0]);
}

function pickPdfFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

function cssEscape(value) {
  return String(value || '').replace(/[\"\\]/g, '\\$&');
}
