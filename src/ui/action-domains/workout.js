export async function handleWorkoutAction(action, el, ctx) {
  const {
    root,
    getUiState,
    setUiState,
    patchUiState,
    rerender,
    toast,
    guardAthleteImport,
    consumeAthleteImport,
    pickPdfFile,
    pickUniversalFile,
    ensureActiveLine,
    workoutKeyFromAppState,
    getLineIdsFromDOM,
    pickNextId,
    pickPrevId,
    getActiveLineIdFromUi,
    scrollToLine,
    startRestTimer,
  } = ctx;

  switch (action) {
    case 'pdf:pick': {
      const ui = getUiState?.() || {};
      const importPolicy = await guardAthleteImport('pdf', ui);
      await setUiState({ modal: null });
      const file = await pickPdfFile();
      if (!file) return true;
      await window.__APP__.uploadMultiWeekPdf(file);
      consumeAthleteImport(importPolicy.benefits, 'pdf');
      await rerender();
      return true;
    }

    case 'media:pick': {
      const ui = getUiState?.() || {};
      const importPolicy = await guardAthleteImport('media', ui);
      await setUiState({ modal: null });
      const file = await pickUniversalFile();
      if (!file) return true;

      if (typeof window.__APP__?.importFromFile !== 'function') {
        throw new Error('Importação universal não disponível');
      }

      const result = await window.__APP__.importFromFile(file);
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao importar arquivo');
      }

      consumeAthleteImport(importPolicy.benefits, 'media');
      toast('Arquivo importado');
      await rerender();
      return true;
    }

    case 'pdf:clear': {
      const ok = confirm(
        '⚠️ Limpar todos os PDFs salvos?\n\n' +
        'Isso removerá todas as semanas carregadas. Esta ação não pode ser desfeita.',
      );
      if (!ok) return true;

      const result = await window.__APP__.clearAllPdfs();
      if (!result?.success) throw new Error(result?.error || 'Falha ao limpar PDFs');

      toast('Todos os PDFs removidos');
      await rerender();
      return true;
    }

    case 'week:select': {
      const week = Number(el.dataset.week);
      if (!Number.isFinite(week)) return true;
      await window.__APP__.selectWeek(week);
      await rerender();
      return true;
    }

    case 'day:auto': {
      if (typeof window.__APP__?.resetDay === 'function') {
        const result = await window.__APP__.resetDay();
        if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
      } else if (typeof window.__APP__?.setDay === 'function') {
        const result = await window.__APP__.setDay('');
        if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
      }
      toast('Dia automático');
      await rerender();
      return true;
    }

    case 'workout:source': {
      const source = String(el.dataset.source || 'uploaded').trim().toLowerCase();
      const nextPriority = source === 'coach' ? 'coach' : 'uploaded';

      if (typeof window.__APP__?.setPreferences !== 'function') {
        throw new Error('Alternância de treino indisponível');
      }

      const result = await window.__APP__.setPreferences({ workoutPriority: nextPriority });
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao alternar fonte do treino');
      }

      toast(nextPriority === 'coach' ? 'Mostrando treino do coach' : 'Mostrando planilha enviada');
      await rerender();
      return true;
    }

    case 'workout:copy': {
      const st = window.__APP__?.getState?.() || {};
      const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
      if (!blocks.length) {
        toast('Nenhum treino carregado');
        return true;
      }

      const result = await window.__APP__.copyWorkout();
      if (!result?.success) throw new Error(result?.error || 'Falha ao copiar');

      toast('Treino copiado');
      return true;
    }

    case 'workout:export': {
      await setUiState({ modal: null });
      const st = window.__APP__?.getState?.() || {};
      const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
      if (!blocks.length) {
        toast('Nenhum treino carregado');
        return true;
      }

      const result = window.__APP__.exportWorkout();
      if (!result?.success) throw new Error(result?.error || 'Falha ao exportar');

      toast('Exportado');
      return true;
    }

    case 'workout:import': {
      await setUiState({ modal: null });
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      input.addEventListener('change', async (e2) => {
        const file = e2.target.files?.[0];
        if (!file) return;

        try {
          const result = await window.__APP__.importWorkout(file);
          if (result?.success) {
            toast('✅ Treino importado!');
            await rerender();
          } else {
            toast(result?.error || 'Erro ao importar');
          }
        } catch (err) {
          toast(err?.message || 'Erro ao importar');
          console.error(err);
        } finally {
          document.body.removeChild(input);
        }
      }, { once: true });

      document.body.appendChild(input);
      input.click();
      return true;
    }

    case 'backup:export': {
      if (typeof window.__APP__?.exportBackup !== 'function') {
        throw new Error('Backup não disponível nesta versão');
      }

      const result = await window.__APP__.exportBackup();
      if (!result?.success) throw new Error(result?.error || 'Falha ao exportar backup');

      toast('Backup exportado');
      return true;
    }

    case 'backup:import': {
      if (typeof window.__APP__?.importBackup !== 'function') {
        throw new Error('Restauração não disponível nesta versão');
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      input.addEventListener('change', async (e2) => {
        const file = e2.target.files?.[0];
        if (!file) return;

        try {
          const result = await window.__APP__.importBackup(file);
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao restaurar backup');
          }
          toast('Backup restaurado');
          await rerender();
        } catch (err) {
          toast(err?.message || 'Erro ao restaurar backup');
          console.error(err);
        } finally {
          document.body.removeChild(input);
        }
      }, { once: true });

      document.body.appendChild(input);
      input.click();
      return true;
    }

    case 'exercise:help': {
      const label = String(el.dataset.exercise || '').trim();
      const directUrl = String(el.dataset.url || '').trim();
      const fallbackUrl = label
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label} exercise tutorial`)}`
        : '';
      const url = directUrl || fallbackUrl;
      if (!url) throw new Error('Vídeo de execução indisponível para este movimento');

      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.href = url;
      }
      return true;
    }

    case 'wod:mode': {
      await patchUiState((s) => ({ ...s, trainingMode: !s.trainingMode }));
      await rerender();
      await ensureActiveLine(root, patchUiState);
      return true;
    }

    case 'wod:toggle': {
      const lineId = el.dataset.lineId;
      if (!lineId) return true;

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
      return true;
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
      return true;
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
      return true;
    }

    case 'timer:start': {
      const seconds = Number(el.dataset.seconds);
      if (!seconds || seconds <= 0) return true;
      startRestTimer(seconds, toast);
      return true;
    }

    default:
      return false;
  }
}

export function setupWorkoutBindings({ root, toast, rerender }) {
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
}
