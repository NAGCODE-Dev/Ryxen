export async function handleDiscoveryAction(action, el, ctx) {
  const {
    root,
    getUiState,
    patchUiState,
    rerender,
    emptyBenchmarkBrowser,
    emptyCompetitionBrowser,
    hydrateAthleteOverviewFullInBackground,
    hydrateBenchmarkBrowserInBackground,
    hydrateCompetitionBrowserInBackground,
    validateBenchmarkScoreInput,
    toast,
  } = ctx;

  switch (action) {
    case 'page:set': {
      const page = String(el.dataset.page || 'today');
      await patchUiState((s) => ({ ...s, currentPage: page }));
      await rerender();
      try {
        root.querySelector('#ui-main')?.scrollTo?.({ top: 0, behavior: 'instant' });
      } catch {
        root.querySelector('#ui-main')?.scrollTo?.(0, 0);
      }
      window.scrollTo?.({ top: 0, behavior: 'auto' });
      if (page === 'history') {
        hydrateAthleteOverviewFullInBackground();
        hydrateBenchmarkBrowserInBackground();
      }
      if (page === 'competitions') {
        hydrateCompetitionBrowserInBackground();
      }
      return true;
    }

    case 'competition:select': {
      const selectedCompetitionId = Number(el.dataset.competitionId || 0) || null;
      await patchUiState((s) => ({
        ...s,
        competitionBrowser: {
          ...(s?.competitionBrowser || emptyCompetitionBrowser()),
          selectedCompetitionId,
          selectedEventId: null,
        },
      }));
      await rerender();
      hydrateCompetitionBrowserInBackground({ selectedCompetitionId, selectedEventId: null });
      return true;
    }

    case 'competition:event': {
      const selectedCompetitionId = Number(el.dataset.competitionId || 0) || null;
      const selectedEventId = Number(el.dataset.eventId || 0) || null;
      await patchUiState((s) => ({
        ...s,
        competitionBrowser: {
          ...(s?.competitionBrowser || emptyCompetitionBrowser()),
          selectedCompetitionId,
          selectedEventId,
        },
      }));
      await rerender();
      hydrateCompetitionBrowserInBackground({ selectedCompetitionId, selectedEventId });
      return true;
    }

    case 'benchmark:category': {
      const category = String(el.dataset.category || '').trim().toLowerCase();
      await patchUiState((s) => ({
        ...s,
        benchmarkBrowser: {
          ...(s?.benchmarkBrowser || emptyBenchmarkBrowser()),
          category,
          selectedSlug: '',
          selectedBenchmark: null,
          leaderboard: [],
          pagination: { ...(s?.benchmarkBrowser?.pagination || {}), page: 1 },
        },
      }));
      await rerender();
      hydrateBenchmarkBrowserInBackground({ category, page: 1, selectedSlug: '' });
      return true;
    }

    case 'benchmark:select': {
      const slug = String(el.dataset.slug || '').trim().toLowerCase();
      if (!slug) return true;
      await patchUiState((s) => ({
        ...s,
        benchmarkBrowser: {
          ...(s?.benchmarkBrowser || emptyBenchmarkBrowser()),
          selectedSlug: slug,
          leaderboardLoading: true,
        },
      }));
      await rerender();
      hydrateBenchmarkBrowserInBackground({ selectedSlug: slug });
      return true;
    }

    case 'benchmark:page': {
      const direction = String(el.dataset.direction || 'next');
      const ui = getUiState?.() || {};
      const current = ui?.benchmarkBrowser || emptyBenchmarkBrowser();
      const currentPage = Number(current?.pagination?.page || 1);
      const totalPages = Number(current?.pagination?.pages || 1);
      const nextPage = direction === 'prev'
        ? Math.max(1, currentPage - 1)
        : Math.min(totalPages, currentPage + 1);
      if (nextPage === currentPage) return true;
      await patchUiState((s) => ({
        ...s,
        benchmarkBrowser: {
          ...(s?.benchmarkBrowser || emptyBenchmarkBrowser()),
          loading: true,
          pagination: { ...(s?.benchmarkBrowser?.pagination || {}), page: nextPage },
        },
      }));
      await rerender();
      hydrateBenchmarkBrowserInBackground({ page: nextPage });
      return true;
    }

    case 'benchmark:submit': {
      const ui = getUiState?.() || {};
      const browser = ui?.benchmarkBrowser || emptyBenchmarkBrowser();
      const slug = String(browser?.selectedSlug || '').trim().toLowerCase();
      const scoreType = String(browser?.selectedBenchmark?.score_type || '');
      if (!slug) throw new Error('Selecione um benchmark');

      const scoreInput = root.querySelector('#benchmark-score-input');
      const scoreDisplay = String(scoreInput?.value || '').trim();
      const notes = String(root.querySelector('#benchmark-notes-input')?.value || '').trim();
      const validationError = validateBenchmarkScoreInput(scoreType, scoreDisplay);
      if (validationError) throw new Error(validationError);

      await window.__APP__?.submitBenchmarkResult?.(slug, { scoreDisplay, notes });
      toast('Resultado registrado');
      await hydrateAthleteOverviewFullInBackground();
      await hydrateBenchmarkBrowserInBackground({ selectedSlug: slug });
      return true;
    }

    default:
      return false;
  }
}
