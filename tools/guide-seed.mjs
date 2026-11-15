// Vult een tijdelijke database met een voorbeeldgebruiker voor de handleiding-schermafbeeldingen.
// Gebruik: $env:GYMCOACH_DATA = pad; node tools/guide-seed.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const data = process.env.GYMCOACH_DATA;
if (!data) throw new Error('Zet GYMCOACH_DATA naar een tijdelijke map');

const store = await import('../lib/store.js');
const auth = await import('../lib/auth.js');
const engine = await import('../lib/engine.js');
const goal = await import('../lib/goal.js');

const NAMES = {
  squat: 'Goblet Squat', hinge: 'Romanian Deadlift', hpush: 'Bench Press', hpull: 'Seated Row',
  vpull: 'Lat Pulldown', vpush: 'Shoulder Press', lunge: 'Reverse Lunge', glute: 'Hip Thrust',
  lat: 'Lateral Raise', rear: 'Face Pull', curl: 'Biceps Curl', tri: 'Triceps Pushdown',
  core: 'Cable Crunch', calf: 'Calf Raise',
};
const MUSCLE = {
  squat: 'Quads', hinge: 'Glutes', hpush: 'Pecs', hpull: 'Lats', vpull: 'Lats', vpush: 'Front Delts',
  lunge: 'Quads', glute: 'Glutes', lat: 'Side Delts', rear: 'Rear Delts', curl: 'Biceps', tri: 'Triceps',
  core: 'Abs', calf: 'Calves',
};

const library = Object.entries(engine.PATTERNS).map(([k, p]) => ({
  id: p.ids[0], name: NAMES[k], muscle: MUSCLE[k], tab: 'Training',
}));
await store.saveLibraryCache(library, 1);

const user = await auth.createUser({ username: 'demo', name: 'Sam Demo', password: 'demo-pass-1', role: 'user' });
const dir = store.speedianceDir(user);
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'config.json'), JSON.stringify({ email: 'sam.demo@example.com', region: 'EU', deviceType: 1 }));

const day = (iso, add) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
};

await store.runAs(user, async () => {
  const settings = {
    ...store.DEFAULT_SETTINGS,
    goal: 'combinatie', daysPerWeek: 3, minutesPerSession: 45, experience: 'beginner', deloadEveryWeeks: 6,
    prefsConfirmed: true, termsVersion: 1, termsAt: '2026-10-01T08:00:00.000Z',
    sex: 'm', bandSex: 'm', birthYear: 1988, birthDate: '1988-04-12', heightCm: 182,
    lang: 'nl', stepGoal: 8000,
    activityGoals: [{ id: 'wandelen', times: 3, minutes: 40, km: 4 }],
  };

  const dates = [];
  for (let i = 0; i < 8; i++) dates.push(day('2026-09-21', i * 7), day('2026-09-23', i * 7));
  const used = ['Goblet Squat', 'Bench Press', 'Seated Row', 'Lat Pulldown', 'Romanian Deadlift', 'Shoulder Press', 'Biceps Curl', 'Cable Crunch'];
  const byName = new Map(library.map((e) => [e.name, e]));
  const workouts = [];
  const sessions = {};
  dates.forEach((date, i) => {
    const id = `g${i + 1}`;
    const picks = used.slice(i % 3, (i % 3) + 5);
    const detail = picks.map((name, j) => {
      const reps = 10;
      const weight = 12 + j * 4 + Math.floor(i / 2);
      return {
        actionLibraryName: name,
        finishedReps: [0, 1].map(() => ({
          finishedCount: reps, targetCount: reps, weight,
          capacity: reps * weight,
          trainingInfoDetail: { weights: Array(reps).fill(weight) },
        })),
      };
    });
    const volume = detail.reduce((n, ex) => n + ex.finishedReps.reduce((m, r) => m + r.capacity, 0), 0);
    workouts.push({ training_id: id, date, title: i % 2 ? 'Full Body B' : 'Full Body A', duration_secs: 42 * 60, calories: 260 + (i % 5) * 12, volume, hr_avg: 118 });
    sessions[id] = { training_id: id, date, detail };
  });
  await store.saveWorkouts(workouts);
  await store.saveSessions(sessions);

  const body = [];
  for (let i = 0; i < 10; i++) {
    const date = day('2026-09-01', i * 7);
    body.push({
      date, kg: Math.round((84.2 - i * 0.25) * 10) / 10, fat: Math.round((23.4 - i * 0.2) * 10) / 10,
      muscle: Math.round((34.2 + i * 0.05) * 10) / 10, fatFree: 64, visceral: 6, bone: 3.1,
      pwv: 7.1, vascAge: 41, metAge: 39, nerve: 54, water: 48, ecw: 19, restHr: 64 - (i % 3), source: 'withings',
    });
  }
  await store.saveBodyLog(body);

  const daily = {};
  for (let i = 0; i < 42; i++) {
    const date = day('2026-09-28', i);
    daily[date] = {
      steps: 6200 + (i % 7) * 900, activeKcal: 380 + (i % 5) * 40, walkKm: Math.round((3.2 + (i % 4) * 0.6) * 10) / 10,
      restHr: 60 + (i % 4), hrv: 42 + (i % 6), vo2max: 41,
      intakeKcal: 2100 + (i % 3) * 80, proteinG: 130, carbsG: 210, fatG: 70, fiberG: 28, intakeSource: 'apple',
    };
  }
  await store.saveHealthDaily(daily);

  const activities = [];
  for (let i = 0; i < 8; i++) {
    const date = day('2026-09-27', i * 4);
    activities.push({ id: `walk${i}`, date, start: `${date}T10:15:00`, name: 'Walking', minutes: 34 + i, km: 3.1 + i * 0.1, kcal: 160, hrAvg: 112, hrMax: 128, source: 'apple' });
  }
  await store.saveActivities(activities);

  const history = engine.buildHistory(sessions, library);
  const built = engine.buildPlan({ settings, library, history, week: 5, dayTypes: ['combinatie', 'combinatie', 'buiten'] });
  await store.savePlan({ ...built, week: '2026-11-09' });

  const applied = goal.applyOutcome({
    settings, bodyLog: body, history, today: '2026-11-15',
    composition: { weightDeltaKg: -2, weeks: 16, musclePct: null },
    strengths: [{ muscle: 'Lats', pct: 5, months: 6 }],
    accept: true,
  });
  if (!applied.outcome) throw new Error('doel niet bewaard: ' + JSON.stringify(applied));
  settings.outcome = applied.outcome;
  await store.saveSettings(settings);
  console.log('voorbeeldgebruiker demo klaar', user.id, 'trainingen', workouts.length, 'doel', !!applied.outcome);
});
