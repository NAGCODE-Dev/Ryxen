export async function handlePrsSettingsAction(action, el, ctx) {
  const {
    root,
    getUiState,
    setUiState,
    patchUiState,
    rerender,
    toast,
    syncAthletePrIfAuthenticated,
    loadAthleteOverview,
    cssEscape,
  } = ctx;

  switch (action) {
    case 'prs:open': {
      await setUiState({ modal: 'prs' });
      await rerender();
      root.querySelector('#ui-prsSearch')?.focus();
      return true;
    }

    case 'prs:close': {
      await setUiState({ modal: null });
      await rerender();
      return true;
    }

    case 'settings:save': {
      const showLbsConversion = !!root.querySelector('#setting-showLbsConversion')?.checked;
      const showEmojis = !!root.querySelector('#setting-showEmojis')?.checked;
      const showObjectivesInWods = !!root.querySelector('#setting-showObjectives')?.checked;

      if (typeof window.__APP__?.setPreferences === 'function') {
        const corePrefsResult = await window.__APP__.setPreferences({
          showLbsConversion,
          showEmojis,
          showGoals: showObjectivesInWods,
          autoConvertLbs: showLbsConversion,
        });

        if (!corePrefsResult?.success) {
          throw new Error(corePrefsResult?.error || 'Falha ao salvar preferências');
        }
      }

      await setUiState({
        settings: { showLbsConversion, showEmojis, showObjectivesInWods },
        modal: null,
      });

      toast('Configurações salvas');
      await rerender();
      return true;
    }

    case 'prs:add': {
      const nameEl = root.querySelector('#ui-prsNewName');
      const valueEl = root.querySelector('#ui-prsNewValue');

      const rawName = (nameEl?.value || '').trim();
      const value = Number(valueEl?.value);

      if (!rawName) throw new Error('Informe o nome do exercício');
      if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um PR válido');

      const exercise = rawName.toUpperCase();
      const result = await window.__APP__.addPR(exercise, value);
      if (!result?.success) throw new Error(result?.error || 'Falha ao adicionar PR');
      await syncAthletePrIfAuthenticated(exercise, value);

      if (nameEl) nameEl.value = '';
      if (valueEl) valueEl.value = '';

      toast('PR salvo');
      await rerender();
      return true;
    }

    case 'prs:save': {
      const ex = el.dataset.exercise;
      if (!ex) return true;

      const input = root.querySelector(
        `input[data-action="prs:editValue"][data-exercise="${cssEscape(ex)}"]`,
      );
      const value = Number(input?.value);

      if (!Number.isFinite(value) || value <= 0) throw new Error('PR inválido');

      const result = await window.__APP__.addPR(ex, value);
      if (!result?.success) throw new Error(result?.error || 'Falha ao salvar PR');
      await syncAthletePrIfAuthenticated(ex, value);

      toast('PR atualizado');
      await rerender();
      return true;
    }

    case 'prs:remove': {
      const ex = el.dataset.exercise;
      if (!ex) return true;

      const ok = confirm(`Remover PR de "${ex}"?`);
      if (!ok) return true;

      const result = await window.__APP__.removePR(ex);
      if (!result?.success) throw new Error(result?.error || 'Falha ao remover PR');
      const currentPrs = window.__APP__?.getState?.()?.prs || {};
      if (window.__APP__?.getProfile?.()?.data) {
        await window.__APP__?.syncAthletePrSnapshot?.(currentPrs);
        const athleteOverview = await loadAthleteOverview();
        await patchUiState((s) => ({ ...s, athleteOverview }));
      }

      toast('PR removido');
      await rerender();
      return true;
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
      return true;
    }

    case 'prs:export': {
      const result = window.__APP__.exportPRs();
      if (!result?.success) throw new Error(result?.error || 'Falha ao exportar PRs');
      toast('PRs exportados');
      return true;
    }

    case 'prs:import': {
      const json = prompt('Cole aqui o JSON de PRs (ex: {"BACK SQUAT":120})');
      if (!json) return true;

      const result = window.__APP__.importPRs(json);
      if (!result?.success) throw new Error(result?.error || 'Falha ao importar PRs');

      toast('PRs importados');
      await rerender();
      return true;
    }

    default:
      return false;
  }
}

export function setupPrsSettingsBindings({ root }) {
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || t.id !== 'ui-prsSearch') return;
    filterPrs(root, t.value);
  });
}

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

  const countEl = root.querySelector('#ui-prsCount');
  if (countEl) countEl.textContent = `${visible} PRs`;
}
