import { buildMeasurementEntry, getMeasurementTypeMeta, normalizeMeasurementEntries } from '../profileMeasurements.js';

export async function handleProfileAction(action, el, ctx) {
  const {
    root,
    patchUiState,
    rerender,
    toast,
    syncAthleteMeasurementsIfAuthenticated,
  } = ctx;

  switch (action) {
    case 'measurement:add': {
      const type = String(root.querySelector('#measurement-type')?.value || 'weight').trim().toLowerCase();
      const label = String(root.querySelector('#measurement-label')?.value || '').trim();
      const value = Number(root.querySelector('#measurement-value')?.value);
      const recordedAt = String(root.querySelector('#measurement-date')?.value || '').trim();
      const notes = String(root.querySelector('#measurement-notes')?.value || '').trim();
      const typeMeta = getMeasurementTypeMeta(type);

      if (!Number.isFinite(value)) {
        throw new Error('Informe uma medida válida');
      }

      const entry = buildMeasurementEntry({
        type,
        label,
        value,
        unit: typeMeta.unit,
        recordedAt,
        notes,
      });

      await patchUiState((state) => ({
        ...state,
        athleteProfile: {
          ...(state?.athleteProfile || {}),
          measurements: normalizeMeasurementEntries([
            entry,
            ...((state?.athleteProfile?.measurements || [])),
          ]),
        },
      }));

      try {
        await syncAthleteMeasurementsIfAuthenticated?.();
      } catch (error) {
        toast(error?.message || 'A medida ficou salva só neste dispositivo');
      }

      const labelField = root.querySelector('#measurement-label');
      const valueField = root.querySelector('#measurement-value');
      const dateField = root.querySelector('#measurement-date');
      const notesField = root.querySelector('#measurement-notes');
      if (labelField) labelField.value = '';
      if (valueField) valueField.value = '';
      if (dateField) dateField.value = '';
      if (notesField) notesField.value = '';

      toast('Medida registrada');
      await rerender();
      return true;
    }

    case 'measurement:remove': {
      const id = String(el.dataset.measurementId || '').trim();
      if (!id) return true;

      await patchUiState((state) => ({
        ...state,
        athleteProfile: {
          ...(state?.athleteProfile || {}),
          measurements: normalizeMeasurementEntries(
            (state?.athleteProfile?.measurements || []).filter((entry) => String(entry?.id || '') !== id),
          ),
        },
      }));

      try {
        await syncAthleteMeasurementsIfAuthenticated?.();
      } catch (error) {
        toast(error?.message || 'A alteração ficou salva só neste dispositivo');
      }

      toast('Medida removida');
      await rerender();
      return true;
    }

    default:
      return false;
  }
}
