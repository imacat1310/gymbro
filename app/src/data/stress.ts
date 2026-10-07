// Joint/area stress per exercise. A user limitation in an area hard-excludes these exercises
// from generated plans (SAFETY_PRIVACY.md: contraindication filter). Conservative on purpose;
// knee- and shoulder-friendlier alternatives (leg press, reverse lunge, landmine press…) stay available.

export type Area = 'lower_back' | 'knee' | 'shoulder' | 'wrist' | 'elbow' | 'hip'

export const AREA_LABELS: Record<Area, string> = {
  lower_back: 'Lower back', knee: 'Knee', shoulder: 'Shoulder', wrist: 'Wrist', elbow: 'Elbow', hip: 'Hip',
}

const STRESS_BY_AREA: Record<Area, string[]> = {
  lower_back: [
    'barbell_back_squat', 'barbell_front_squat', 'barbell_deadlift', 'barbell_rdl', 'db_rdl', 'db_single_leg_rdl',
    'trap_bar_deadlift', 'barbell_row', 'barbell_ohp', 'standing_db_press', 'kb_swing', 'back_extension',
  ],
  knee: [
    'barbell_back_squat', 'barbell_front_squat', 'smith_squat', 'hack_squat', 'leg_extension',
    'db_walking_lunge', 'db_bulgarian_split_squat',
  ],
  shoulder: [
    'barbell_ohp', 'seated_db_press', 'standing_db_press', 'machine_shoulder_press', 'pike_push_up',
    'dip', 'bench_dip', 'barbell_bench_press', 'incline_barbell_bench', 'db_fly',
  ],
  wrist: ['push_up', 'barbell_front_squat', 'barbell_curl', 'bench_dip', 'pike_push_up'],
  elbow: ['skull_crusher', 'overhead_cable_triceps_ext', 'close_grip_bench', 'barbell_curl', 'preacher_curl', 'dip', 'chin_up'],
  hip: ['copenhagen_plank', 'db_bulgarian_split_squat', 'couch_stretch'],
}

export function stressedAreas(exerciseId: string): Area[] {
  return (Object.keys(STRESS_BY_AREA) as Area[]).filter((a) => STRESS_BY_AREA[a].includes(exerciseId))
}

export function isContraindicated(exerciseId: string, limitations: Area[]): boolean {
  return limitations.some((a) => STRESS_BY_AREA[a].includes(exerciseId))
}

export const STRESS_EXERCISE_IDS = Object.values(STRESS_BY_AREA).flat()
