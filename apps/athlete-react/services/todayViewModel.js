const WEEKDAY_ORDER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function createTodayViewModel(snapshot = {}) {
  const weeks = Array.isArray(snapshot?.weeks) ? snapshot.weeks : [];
  const activeWeekNumber = Number(snapshot?.activeWeekNumber) || Number(weeks[0]?.weekNumber) || null;
  const workout = snapshot?.workout || null;
  const workoutContext = snapshot?.workoutContext || {};
  const stats = workoutContext?.stats || {};
  const availableDays = Array.isArray(workoutContext?.availableDays) ? workoutContext.availableDays : [];
  const importedPlanMeta = snapshot?.importedPlanMeta || null;
  const recentWorkouts = Array.isArray(workoutContext?.recentWorkouts) ? workoutContext.recentWorkouts : [];

  return {
    hero: {
      eyebrow: snapshot?.profile?.name ? `Hoje de ${snapshot.profile.name.split(' ')[0]}` : 'Athlete Today',
      title: workout?.day || snapshot?.currentDay || 'Treino do dia',
      subtitle: workout
        ? `Semana ${activeWeekNumber || 'ativa'} pronta para leitura, ajustes e importação.`
        : 'Importe um plano local ou entre com sua conta para hidratar o Today.',
      badges: buildHeroBadges(snapshot),
    },
    metrics: [
      {
        label: 'Semanas',
        value: weeks.length ? String(weeks.length).padStart(2, '0') : '00',
        detail: importedPlanMeta?.fileName ? trimMiddle(importedPlanMeta.fileName, 28) : 'Nenhum plano local',
      },
      {
        label: 'Blocos hoje',
        value: String(Array.isArray(workout?.blocks) ? workout.blocks.length : 0).padStart(2, '0'),
        detail: workout ? `${workout.day || snapshot?.currentDay || 'Hoje'} em foco` : 'Sem bloco carregado',
      },
      {
        label: 'Gyms ativos',
        value: String(stats.activeGyms || 0).padStart(2, '0'),
        detail: stats.athleteTier ? `Tier ${stats.athleteTier}` : 'Sem tier remoto',
      },
      {
        label: 'Últimos envios',
        value: String(recentWorkouts.length || 0).padStart(2, '0'),
        detail: recentWorkouts[0]?.gym_name || 'Nenhum treino remoto recente',
      },
    ],
    weekItems: weeks.map((week) => ({
      key: week.weekNumber,
      label: `Semana ${week.weekNumber}`,
      meta: `${Array.isArray(week?.workouts) ? week.workouts.length : 0} dias`,
      active: Number(week.weekNumber) === Number(activeWeekNumber),
    })),
    dayItems: [...availableDays]
      .sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
      .map((day) => ({
        key: day,
        label: day,
        meta: day === snapshot?.currentDay ? 'Hoje ativo' : 'Selecionar',
        active: day === snapshot?.currentDay,
      })),
    importedPlanSummary: importedPlanMeta
      ? {
          source: workoutContext?.source || importedPlanMeta?.source || 'local',
          fileName: importedPlanMeta.fileName || 'Plano importado',
          updatedAt: importedPlanMeta.updatedAt || importedPlanMeta.uploadedAt || '',
          weekNumbers: importedPlanMeta.weekNumbers || [],
        }
      : null,
    workout,
    recentWorkouts,
  };
}

export function trimMiddle(value, maxLength = 24) {
  const raw = String(value || '').trim();
  if (raw.length <= maxLength) return raw;
  const slice = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${raw.slice(0, slice)}...${raw.slice(-slice)}`;
}

function buildHeroBadges(snapshot = {}) {
  const workoutContext = snapshot?.workoutContext || {};
  const badges = [];

  if (workoutContext?.source && workoutContext.source !== 'empty') {
    badges.push({
      label: workoutContext.source === 'remote' ? 'Conta sincronizada' : 'Plano local',
      tone: workoutContext.source === 'remote' ? 'ember' : 'blue',
    });
  }

  if (snapshot?.profile?.email) {
    badges.push({
      label: 'Sessão ativa',
      tone: 'blue',
    });
  }

  if (workoutContext?.athleteBenefits?.tier) {
    badges.push({
      label: `Tier ${workoutContext.athleteBenefits.tier}`,
      tone: 'ember',
    });
  }

  return badges;
}
