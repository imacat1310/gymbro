// Hand-curated core exercise database (ADR-004 §3).
// `requires`: OR across groups, AND within a group. An empty group means no equipment needed.
import { expandEquipment } from './equipment'

export type Pattern =
  | 'squat' | 'lunge' | 'hinge' | 'knee_iso' | 'hip_iso' | 'calves'
  | 'h_push' | 'v_push' | 'h_pull' | 'v_pull' | 'shoulder_iso' | 'arms'
  | 'core' | 'carry' | 'corrective'
  // Athletic patterns for sport and focus days (features/03 §8c). Standard templates don't use them.
  | 'power' | 'agility' | 'prehab' | 'conditioning'

export type LoadType = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'bodyweight' | 'band'

export type Muscle =
  | 'chest' | 'front_delt' | 'side_delt' | 'rear_delt' | 'triceps' | 'biceps' | 'forearms'
  | 'lats' | 'upper_back' | 'lower_trap' | 'traps' | 'lower_back' | 'abs' | 'obliques'
  | 'glutes' | 'glute_med' | 'quads' | 'hamstrings' | 'adductors' | 'calves' | 'neck' | 'hip_flexors'

export interface Exercise {
  id: string
  name: string
  pattern: Pattern
  mechanics: 'compound' | 'isolation'
  load: LoadType
  measure: 'reps' | 'time'
  unilateral: boolean
  requires: string[][]
  primary: Muscle[]
  secondary: Muscle[]
  cues: string[]
}

export const PATTERN_LABELS: Record<Pattern, string> = {
  squat: 'Squat', lunge: 'Lunge / single leg', hinge: 'Hinge', knee_iso: 'Leg isolation', hip_iso: 'Glute isolation',
  calves: 'Calves', h_push: 'Horizontal push', v_push: 'Vertical push', h_pull: 'Horizontal pull',
  v_pull: 'Vertical pull', shoulder_iso: 'Shoulders', arms: 'Arms', core: 'Core', carry: 'Carry',
  corrective: 'Mobility & posture',
  power: 'Power (jumps & throws)', agility: 'Agility', prehab: 'Injury prevention', conditioning: 'Conditioning',
}

export const LOWER_BODY_PATTERNS: Pattern[] = ['squat', 'lunge', 'hinge', 'knee_iso', 'hip_iso', 'calves']

type Opts = { measure?: 'time'; unilateral?: boolean; secondary?: Muscle[] }

function ex(
  id: string, name: string, pattern: Pattern, mechanics: 'compound' | 'isolation', load: LoadType,
  requires: string[][], primary: Muscle[], cues: string[], opts: Opts = {},
): Exercise {
  return {
    id, name, pattern, mechanics, load, requires, primary, cues,
    measure: opts.measure ?? 'reps', unilateral: opts.unilateral ?? false, secondary: opts.secondary ?? [],
  }
}

const RACK = [['barbell', 'squat_stand']]
const NONE = [[]]

export const EXERCISES: Exercise[] = [
  // Squat
  ex('barbell_back_squat', 'Barbell back squat', 'squat', 'compound', 'barbell', RACK, ['quads', 'glutes'],
    ['Brace before you descend', 'Knees track over toes', 'Hips below knees if mobility allows'], { secondary: ['adductors', 'lower_back'] }),
  ex('barbell_front_squat', 'Barbell front squat', 'squat', 'compound', 'barbell', RACK, ['quads'],
    ['Elbows high', 'Stay upright', 'Sit straight down'], { secondary: ['glutes', 'upper_back'] }),
  ex('smith_squat', 'Smith machine squat', 'squat', 'compound', 'machine', [['smith_machine']], ['quads', 'glutes'],
    ['Feet slightly forward', 'Control the descent']),
  ex('goblet_squat', 'Goblet squat', 'squat', 'compound', 'dumbbell', [['dumbbells'], ['kettlebells']], ['quads', 'glutes'],
    ['Hold the weight at your chest', 'Elbows inside knees at the bottom']),
  ex('leg_press', 'Leg press', 'squat', 'compound', 'machine', [['leg_press']], ['quads', 'glutes'],
    ['Lower back stays on the pad', "Don't lock knees at the top"]),
  ex('hack_squat', 'Hack squat', 'squat', 'compound', 'machine', [['hack_squat']], ['quads'],
    ['Full depth', 'Push through mid-foot']),
  ex('bodyweight_squat', 'Bodyweight squat', 'squat', 'compound', 'bodyweight', NONE, ['quads', 'glutes'],
    ['Sit back and down', 'Chest up']),

  // Lunge / single leg
  ex('db_bulgarian_split_squat', 'Bulgarian split squat (DB)', 'lunge', 'compound', 'dumbbell', [['dumbbells', 'flat_bench']], ['quads', 'glutes'],
    ['Rear foot on the bench', 'Front knee over mid-foot', 'Slight forward lean for glutes'], { unilateral: true, secondary: ['adductors'] }),
  ex('split_squat', 'Split squat (bodyweight)', 'lunge', 'compound', 'bodyweight', NONE, ['quads', 'glutes'],
    ['Back knee straight down', 'Stay tall'], { unilateral: true }),
  ex('db_reverse_lunge', 'Reverse lunge (DB)', 'lunge', 'compound', 'dumbbell', [['dumbbells']], ['quads', 'glutes'],
    ['Step back softly', 'Drive through the front heel'], { unilateral: true }),
  ex('db_walking_lunge', 'Walking lunge (DB)', 'lunge', 'compound', 'dumbbell', [['dumbbells']], ['quads', 'glutes'],
    ['Long controlled steps', 'Torso upright'], { unilateral: true }),
  ex('db_step_up', 'Step-up (DB)', 'lunge', 'compound', 'dumbbell', [['dumbbells', 'box'], ['dumbbells', 'flat_bench']], ['quads', 'glutes'],
    ["Drive through the top leg, don't push off the bottom"], { unilateral: true }),

  // Hinge
  ex('barbell_deadlift', 'Deadlift', 'hinge', 'compound', 'barbell', [['barbell']], ['glutes', 'hamstrings', 'lower_back'],
    ['Bar over mid-foot', 'Brace, pull slack out of the bar', 'Push the floor away'], { secondary: ['traps', 'forearms', 'quads'] }),
  ex('barbell_rdl', 'Romanian deadlift', 'hinge', 'compound', 'barbell', [['barbell']], ['hamstrings', 'glutes'],
    ['Soft knees', 'Push hips back', 'Bar stays close to legs'], { secondary: ['lower_back'] }),
  ex('db_rdl', 'Romanian deadlift (DB)', 'hinge', 'compound', 'dumbbell', [['dumbbells']], ['hamstrings', 'glutes'],
    ['Hips back', 'Neutral spine', 'Feel the hamstring stretch']),
  ex('db_single_leg_rdl', 'Single-leg RDL (DB)', 'hinge', 'compound', 'dumbbell', [['dumbbells']], ['hamstrings', 'glutes'],
    ['Hips square to the floor', 'Reach the back leg long'], { unilateral: true, secondary: ['glute_med'] }),
  ex('trap_bar_deadlift', 'Trap bar deadlift', 'hinge', 'compound', 'barbell', [['trap_bar']], ['glutes', 'quads', 'hamstrings'],
    ['Stand in the center', 'Chest up, push the floor away']),
  ex('barbell_hip_thrust', 'Hip thrust (barbell)', 'hinge', 'compound', 'barbell', [['barbell', 'flat_bench']], ['glutes'],
    ['Chin tucked, ribs down', 'Shins vertical at the top', 'Squeeze 1 s at lockout'], { secondary: ['hamstrings'] }),
  ex('hip_thrust_machine', 'Hip thrust machine', 'hinge', 'compound', 'machine', [['hip_thrust_machine']], ['glutes'],
    ['Full lockout', 'Pause at the top']),
  ex('glute_bridge', 'Glute bridge', 'hinge', 'isolation', 'bodyweight', NONE, ['glutes'],
    ['Posterior pelvic tilt', 'Squeeze glutes at the top'], { secondary: ['hamstrings'] }),
  ex('kb_swing', 'Kettlebell swing', 'hinge', 'compound', 'kettlebell', [['kettlebells']], ['glutes', 'hamstrings'],
    ['Hike the bell back', 'Snap hips, arms are ropes']),
  ex('back_extension', 'Back extension', 'hinge', 'compound', 'bodyweight', [['roman_chair']], ['glutes', 'lower_back', 'hamstrings'],
    ["Hinge at the hips", "Don't hyperextend at the top"]),
  ex('cable_pull_through', 'Cable pull-through', 'hinge', 'compound', 'cable', [['cable_station']], ['glutes', 'hamstrings'],
    ['Face away from the stack', 'Hips back, then drive forward']),

  // Leg / glute isolation
  ex('leg_extension', 'Leg extension', 'knee_iso', 'isolation', 'machine', [['leg_extension']], ['quads'],
    ['Knee aligned with the machine pivot', 'Pause at the top']),
  ex('seated_leg_curl', 'Seated leg curl', 'knee_iso', 'isolation', 'machine', [['leg_curl_seated']], ['hamstrings'],
    ['Lean forward slightly', 'Control the return']),
  ex('lying_leg_curl', 'Lying leg curl', 'knee_iso', 'isolation', 'machine', [['leg_curl_lying']], ['hamstrings'],
    ['Hips pressed into the pad']),
  ex('hip_abduction_machine', 'Hip abduction machine', 'hip_iso', 'isolation', 'machine', [['abductor_machine']], ['glute_med'],
    ['Lean forward slightly for more glute']),
  ex('banded_lateral_walk', 'Banded lateral walk', 'hip_iso', 'isolation', 'band', [['resistance_bands']], ['glute_med'],
    ['Band above the knees', 'Stay low, toes forward'], { unilateral: true }),
  ex('side_lying_hip_abduction', 'Side-lying hip abduction', 'hip_iso', 'isolation', 'bodyweight', NONE, ['glute_med'],
    ['Leg slightly behind you', 'Toes point forward'], { unilateral: true }),
  ex('cable_kickback', 'Cable glute kickback', 'hip_iso', 'isolation', 'cable', [['cable_station']], ['glutes'],
    ['Squeeze at full hip extension', "Don't arch the lower back"], { unilateral: true }),

  // Calves
  ex('calf_raise_machine', 'Calf raise machine', 'calves', 'isolation', 'machine', [['calf_raise_machine']], ['calves'],
    ['Full stretch at the bottom', 'Pause at the top']),
  ex('db_calf_raise', 'Standing calf raise (DB)', 'calves', 'isolation', 'dumbbell', [['dumbbells']], ['calves'],
    ['Use a step for full range']),
  ex('bodyweight_calf_raise', 'Calf raise (bodyweight)', 'calves', 'isolation', 'bodyweight', NONE, ['calves'],
    ['Slow down, pause up top']),

  // Horizontal push
  ex('barbell_bench_press', 'Bench press', 'h_push', 'compound', 'barbell', [['barbell', 'flat_bench', 'squat_stand']], ['chest', 'triceps'],
    ['Shoulder blades pinched', 'Elbows ~45–60°', 'Touch the lower chest'], { secondary: ['front_delt'] }),
  ex('incline_barbell_bench', 'Incline bench press', 'h_push', 'compound', 'barbell', [['barbell', 'adjustable_bench', 'squat_stand']], ['chest', 'front_delt'],
    ['30–45° incline', 'Touch the upper chest'], { secondary: ['triceps'] }),
  ex('db_bench_press', 'Dumbbell bench press', 'h_push', 'compound', 'dumbbell', [['dumbbells', 'flat_bench']], ['chest', 'triceps'],
    ['Deep stretch at the bottom', 'Press up and slightly in'], { secondary: ['front_delt'] }),
  ex('incline_db_press', 'Incline dumbbell press', 'h_push', 'compound', 'dumbbell', [['dumbbells', 'adjustable_bench']], ['chest', 'front_delt'],
    ['30° incline', 'Elbows under wrists'], { secondary: ['triceps'] }),
  ex('smith_bench_press', 'Smith machine bench press', 'h_push', 'compound', 'machine', [['smith_machine', 'flat_bench']], ['chest', 'triceps'],
    ['Bar path to the lower chest']),
  ex('machine_chest_press', 'Chest press machine', 'h_push', 'compound', 'machine', [['chest_press_machine']], ['chest', 'triceps'],
    ['Handles at mid-chest height']),
  ex('push_up', 'Push-up', 'h_push', 'compound', 'bodyweight', NONE, ['chest', 'triceps'],
    ['Body in a straight line', 'Elbows ~45°'], { secondary: ['front_delt', 'abs'] }),
  ex('dip', 'Dip', 'h_push', 'compound', 'bodyweight', [['dip_station']], ['chest', 'triceps'],
    ['Slight forward lean', 'Shoulders down, away from ears'], { secondary: ['front_delt'] }),
  ex('cable_fly', 'Cable fly', 'h_push', 'isolation', 'cable', [['cable_crossover']], ['chest'],
    ['Soft elbows', 'Hug a tree']),
  ex('pec_deck', 'Pec deck', 'h_push', 'isolation', 'machine', [['pec_deck']], ['chest'],
    ['Chest up', 'Squeeze at the middle']),
  ex('db_fly', 'Dumbbell fly', 'h_push', 'isolation', 'dumbbell', [['dumbbells', 'flat_bench']], ['chest'],
    ['Wide arc, stop at a comfortable stretch']),

  // Vertical push
  ex('barbell_ohp', 'Overhead press', 'v_push', 'compound', 'barbell', RACK, ['front_delt', 'triceps'],
    ['Squeeze glutes, ribs down', 'Head through at the top'], { secondary: ['side_delt', 'abs'] }),
  ex('seated_db_press', 'Seated dumbbell press', 'v_push', 'compound', 'dumbbell', [['dumbbells', 'adjustable_bench']], ['front_delt', 'triceps'],
    ['Back against the pad', 'Press to just short of lockout'], { secondary: ['side_delt'] }),
  ex('standing_db_press', 'Standing dumbbell press', 'v_push', 'compound', 'dumbbell', [['dumbbells']], ['front_delt', 'triceps'],
    ['Brace, no leaning back']),
  ex('machine_shoulder_press', 'Shoulder press machine', 'v_push', 'compound', 'machine', [['shoulder_press_machine']], ['front_delt', 'triceps'],
    ['Handles start at shoulder height']),
  ex('landmine_press', 'Landmine press', 'v_push', 'compound', 'barbell', [['barbell', 'landmine']], ['front_delt', 'chest'],
    ['Shoulder-friendly press angle', 'Reach at the top'], { unilateral: true }),
  ex('pike_push_up', 'Pike push-up', 'v_push', 'compound', 'bodyweight', NONE, ['front_delt', 'triceps'],
    ['Hips high', 'Head moves forward of the hands']),

  // Shoulders isolation
  ex('db_lateral_raise', 'Lateral raise (DB)', 'shoulder_iso', 'isolation', 'dumbbell', [['dumbbells']], ['side_delt'],
    ['Lead with elbows', 'Stop at shoulder height']),
  ex('cable_lateral_raise', 'Cable lateral raise', 'shoulder_iso', 'isolation', 'cable', [['cable_station']], ['side_delt'],
    ['Cable from behind', 'Slow negative'], { unilateral: true }),
  ex('face_pull', 'Face pull', 'shoulder_iso', 'isolation', 'cable', [['cable_station'], ['resistance_bands']], ['rear_delt', 'upper_back'],
    ['Rope to forehead', 'Thumbs back, external rotation'], { secondary: ['lower_trap'] }),
  ex('db_rear_delt_fly', 'Rear delt fly (DB)', 'shoulder_iso', 'isolation', 'dumbbell', [['dumbbells']], ['rear_delt'],
    ['Hinge over', 'Lead with the pinkies']),
  ex('reverse_pec_deck', 'Reverse pec deck', 'shoulder_iso', 'isolation', 'machine', [['pec_deck']], ['rear_delt'],
    ['Arms straight', "Don't shrug"]),
  ex('band_pull_apart', 'Band pull-apart', 'shoulder_iso', 'isolation', 'band', [['resistance_bands']], ['rear_delt', 'upper_back'],
    ['Arms straight', 'Squeeze shoulder blades']),

  // Horizontal pull
  ex('barbell_row', 'Barbell row', 'h_pull', 'compound', 'barbell', [['barbell']], ['upper_back', 'lats'],
    ['Torso ~45°', 'Pull to the lower ribs'], { secondary: ['rear_delt', 'biceps', 'lower_back'] }),
  ex('chest_supported_db_row', 'Chest-supported row (DB)', 'h_pull', 'compound', 'dumbbell', [['dumbbells', 'adjustable_bench']], ['upper_back', 'lats'],
    ['Chest on the incline pad', 'Squeeze shoulder blades'], { secondary: ['rear_delt', 'biceps'] }),
  ex('one_arm_db_row', 'One-arm dumbbell row', 'h_pull', 'compound', 'dumbbell', [['dumbbells', 'flat_bench']], ['lats', 'upper_back'],
    ['Pull the elbow to the hip', 'No torso twist'], { unilateral: true, secondary: ['biceps'] }),
  ex('seated_cable_row', 'Seated cable row', 'h_pull', 'compound', 'cable', [['seated_row_machine'], ['cable_station']], ['upper_back', 'lats'],
    ['Chest up', 'Pause with the handle at the belly'], { secondary: ['biceps', 'rear_delt'] }),
  ex('inverted_row', 'Inverted row', 'h_pull', 'compound', 'bodyweight', [['smith_machine'], ['squat_stand', 'barbell'], ['gymnastic_rings'], ['trx']], ['upper_back', 'lats'],
    ['Body straight', 'Pull chest to the bar'], { secondary: ['biceps'] }),

  // Vertical pull
  ex('pull_up', 'Pull-up', 'v_pull', 'compound', 'bodyweight', [['pull_up_bar']], ['lats', 'upper_back'],
    ['Start from a dead hang', 'Chest to the bar'], { secondary: ['biceps'] }),
  ex('chin_up', 'Chin-up', 'v_pull', 'compound', 'bodyweight', [['pull_up_bar']], ['lats', 'biceps'],
    ['Palms facing you', 'Elbows down to the ribs']),
  ex('band_assisted_pull_up', 'Band-assisted pull-up', 'v_pull', 'compound', 'band', [['pull_up_bar', 'resistance_bands']], ['lats', 'upper_back'],
    ['Lighter band as you get stronger']),
  ex('lat_pulldown', 'Lat pulldown', 'v_pull', 'compound', 'machine', [['lat_pulldown']], ['lats'],
    ['Pull to the upper chest', 'Lean back slightly'], { secondary: ['biceps', 'upper_back'] }),
  ex('single_arm_cable_pulldown', 'Single-arm cable pulldown', 'v_pull', 'compound', 'cable', [['cable_station']], ['lats'],
    ['Elbow to the hip'], { unilateral: true }),
  ex('straight_arm_pulldown', 'Straight-arm pulldown', 'v_pull', 'isolation', 'cable', [['cable_station']], ['lats'],
    ['Arms straight', 'Sweep the bar to the thighs']),

  // Arms
  ex('barbell_curl', 'Barbell curl', 'arms', 'isolation', 'barbell', [['barbell'], ['ez_bar']], ['biceps'],
    ['Elbows pinned', 'No swinging']),
  ex('db_curl', 'Dumbbell curl', 'arms', 'isolation', 'dumbbell', [['dumbbells']], ['biceps'],
    ['Supinate at the top']),
  ex('hammer_curl', 'Hammer curl', 'arms', 'isolation', 'dumbbell', [['dumbbells']], ['biceps', 'forearms'],
    ['Neutral grip']),
  ex('cable_curl', 'Cable curl', 'arms', 'isolation', 'cable', [['cable_station']], ['biceps'],
    ['Constant tension']),
  ex('preacher_curl', 'Preacher curl', 'arms', 'isolation', 'barbell', [['preacher_bench', 'ez_bar'], ['preacher_bench', 'dumbbells']], ['biceps'],
    ['Full stretch, no bounce']),
  ex('triceps_pushdown', 'Triceps pushdown', 'arms', 'isolation', 'cable', [['cable_station']], ['triceps'],
    ['Elbows at your sides', 'Full lockout']),
  ex('overhead_cable_triceps_ext', 'Overhead triceps extension (cable)', 'arms', 'isolation', 'cable', [['cable_station']], ['triceps'],
    ['Elbows forward', 'Deep stretch']),
  ex('skull_crusher', 'Skull crusher', 'arms', 'isolation', 'barbell', [['ez_bar', 'flat_bench'], ['barbell', 'flat_bench'], ['dumbbells', 'flat_bench']], ['triceps'],
    ['Lower behind the head', 'Elbows stay narrow']),
  ex('close_grip_bench', 'Close-grip bench press', 'arms', 'compound', 'barbell', [['barbell', 'flat_bench', 'squat_stand']], ['triceps', 'chest'],
    ['Shoulder-width grip', 'Elbows tucked']),
  ex('bench_dip', 'Bench dip', 'arms', 'compound', 'bodyweight', [['flat_bench']], ['triceps'],
    ['Shoulders down', "Don't go too deep"]),

  // Core
  ex('plank', 'Plank', 'core', 'isolation', 'bodyweight', NONE, ['abs'],
    ['Squeeze glutes', 'Ribs down'], { measure: 'time' }),
  ex('side_plank', 'Side plank', 'core', 'isolation', 'bodyweight', NONE, ['obliques'],
    ['Hips high', 'Straight line from head to feet'], { measure: 'time', unilateral: true, secondary: ['glute_med'] }),
  ex('dead_bug', 'Dead bug', 'core', 'isolation', 'bodyweight', NONE, ['abs'],
    ['Lower back pressed to the floor', 'Exhale as you extend']),
  ex('bird_dog', 'Bird dog', 'core', 'isolation', 'bodyweight', NONE, ['abs', 'lower_back'],
    ['Reach long', 'Hips stay level'], { unilateral: true }),
  ex('hanging_knee_raise', 'Hanging knee raise', 'core', 'isolation', 'bodyweight', [['pull_up_bar']], ['abs', 'hip_flexors'],
    ['Curl the pelvis up', 'No swinging']),
  ex('cable_crunch', 'Cable crunch', 'core', 'isolation', 'cable', [['cable_station']], ['abs'],
    ['Crunch ribs to hips', "Don't pull with the arms"]),
  ex('ab_wheel_rollout', 'Ab wheel rollout', 'core', 'isolation', 'bodyweight', [['ab_wheel']], ['abs'],
    ['Posterior pelvic tilt', 'Only go as far as you can control']),
  ex('pallof_press', 'Pallof press', 'core', 'isolation', 'cable', [['cable_station'], ['resistance_bands']], ['obliques', 'abs'],
    ['Resist the rotation', 'Press straight out'], { unilateral: true }),
  ex('copenhagen_plank', 'Copenhagen plank', 'core', 'isolation', 'bodyweight', [['flat_bench']], ['adductors', 'obliques'],
    ['Top leg on the bench', 'Hips in line'], { measure: 'time', unilateral: true }),

  // Carries
  ex('farmers_carry', "Farmer's carry", 'carry', 'compound', 'dumbbell', [['dumbbells'], ['kettlebells'], ['trap_bar']], ['forearms', 'traps'],
    ['Tall posture', 'Short quick steps'], { measure: 'time', secondary: ['abs'] }),
  ex('suitcase_carry', 'Suitcase carry', 'carry', 'compound', 'dumbbell', [['dumbbells'], ['kettlebells']], ['obliques', 'forearms'],
    ["Don't lean toward the weight"], { measure: 'time', unilateral: true }),

  // Mobility & posture correctives (features/02-posture-scan.md)
  ex('chin_tuck', 'Chin tuck', 'corrective', 'isolation', 'bodyweight', NONE, ['neck'],
    ['Make a double chin', 'Hold 5 s']),
  ex('wall_slide', 'Wall slide', 'corrective', 'isolation', 'bodyweight', NONE, ['lower_trap', 'upper_back'],
    ['Back and arms against the wall', 'Slide up without arching']),
  ex('prone_y_raise', 'Prone Y raise', 'corrective', 'isolation', 'bodyweight', NONE, ['lower_trap'],
    ['Thumbs up', 'Lift from the shoulder blades']),
  ex('thoracic_extension', 'Thoracic extension (foam roller)', 'corrective', 'isolation', 'bodyweight', [['foam_roller']], ['upper_back'],
    ['Support your head', 'Extend over the roller segment by segment']),
  ex('doorway_pec_stretch', 'Doorway pec stretch', 'corrective', 'isolation', 'bodyweight', NONE, ['chest'],
    ['Elbow at shoulder height', 'Step through gently'], { measure: 'time' }),
  ex('couch_stretch', 'Couch stretch', 'corrective', 'isolation', 'bodyweight', NONE, ['hip_flexors', 'quads'],
    ['Squeeze the glute of the back leg', 'Ribs down'], { measure: 'time', unilateral: true }),
  ex('hip_9090', '90/90 hip switch', 'corrective', 'isolation', 'bodyweight', NONE, ['glutes', 'hip_flexors'],
    ['Sit tall', 'Rotate both knees side to side without using your hands'], { measure: 'time' }),
  ex('worlds_greatest_stretch', "World's greatest stretch", 'corrective', 'isolation', 'bodyweight', NONE, ['hip_flexors', 'upper_back'],
    ['Long lunge, elbow to instep', 'Rotate and reach to the ceiling'], { measure: 'time', unilateral: true }),
  ex('ankle_dorsiflexion', 'Knee-to-wall ankle mobilisation', 'corrective', 'isolation', 'bodyweight', NONE, ['calves'],
    ['Heel stays down', 'Drive the knee over the little toes'], { measure: 'time', unilateral: true }),

  // Power: jumps and throws. Quality over fatigue: few reps, full rest, maximum intent.
  ex('box_jump', 'Box jump', 'power', 'compound', 'bodyweight', [['box']], ['quads', 'glutes'],
    ['Swing the arms', 'Land softly, knees over toes', 'Step down, don\'t jump down'], { secondary: ['calves'] }),
  ex('squat_jump', 'Squat jump', 'power', 'compound', 'bodyweight', NONE, ['quads', 'glutes'],
    ['Quarter squat, then jump as high as you can', 'Stick a quiet landing'], { secondary: ['calves'] }),
  ex('broad_jump', 'Broad jump', 'power', 'compound', 'bodyweight', NONE, ['glutes', 'quads'],
    ['Swing and jump forward', 'Land in a squat and hold 2 s'], { secondary: ['hamstrings'] }),
  ex('lateral_bound', 'Lateral bound', 'power', 'compound', 'bodyweight', NONE, ['glute_med', 'quads'],
    ['Push sideways off one leg', 'Stick the landing on the other for 2 s'], { unilateral: true, secondary: ['adductors'] }),
  ex('skater_jump', 'Skater jump', 'power', 'compound', 'bodyweight', NONE, ['glute_med', 'quads'],
    ['Quick side-to-side hops', 'Land on the outside leg, hips back'], { unilateral: true, secondary: ['calves'] }),
  ex('split_squat_jump', 'Split squat jump', 'power', 'compound', 'bodyweight', NONE, ['quads', 'glutes'],
    ['Switch legs in the air', 'Land soft, front knee over the foot'], { secondary: ['calves'] }),
  ex('pogo_jump', 'Pogo hops', 'power', 'isolation', 'bodyweight', NONE, ['calves'],
    ['Stiff ankles, small fast bounces', 'Barely bend the knees'], { measure: 'time' }),
  ex('med_ball_chest_pass', 'Med ball chest pass', 'power', 'compound', 'bodyweight', [['medicine_ball']], ['chest', 'triceps'],
    ['Throw against a wall as hard as you can', 'Catch and reset'], { secondary: ['front_delt'] }),
  ex('med_ball_slam', 'Med ball slam', 'power', 'compound', 'bodyweight', [['medicine_ball']], ['lats', 'abs'],
    ['Reach high on your toes', 'Slam through the floor'], { secondary: ['triceps'] }),
  ex('med_ball_rotational_throw', 'Med ball rotational throw', 'power', 'compound', 'bodyweight', [['medicine_ball']], ['obliques'],
    ['Side-on to a wall', 'Rotate from the back hip and throw hard'], { unilateral: true, secondary: ['glutes'] }),
  ex('cable_woodchop', 'Cable woodchop', 'power', 'compound', 'cable', [['cable_station'], ['functional_trainer'], ['cable_crossover'], ['resistance_bands']], ['obliques'],
    ['Pivot the back foot', 'Turn from the hips, arms stay long'], { unilateral: true, secondary: ['abs'] }),
  ex('landmine_rotation', 'Landmine rotation', 'power', 'compound', 'barbell', [['landmine', 'barbell']], ['obliques'],
    ['Arms long', 'Rotate the bar arc to arc, hips follow'], { secondary: ['front_delt'] }),
  ex('push_press', 'Push press', 'power', 'compound', 'barbell', [['barbell', 'power_rack'], ['barbell', 'squat_stand'], ['dumbbells']], ['front_delt', 'triceps'],
    ['Short dip, drive with the legs', 'Lock out overhead'], { secondary: ['quads'] }),

  // Agility: changing direction under control.
  ex('lateral_lunge', 'Lateral lunge', 'agility', 'compound', 'bodyweight', NONE, ['quads', 'adductors'],
    ['Step wide, sit back into one hip', 'Other leg straight, push back to the middle'], { unilateral: true, secondary: ['glutes'] }),
  ex('lateral_shuffle', 'Lateral shuffle', 'agility', 'compound', 'bodyweight', NONE, ['glute_med', 'quads'],
    ['Low athletic stance', 'Quick feet, don\'t cross them'], { measure: 'time', secondary: ['calves'] }),

  // Injury prevention for the joints each sport loads most.
  ex('band_external_rotation', 'External rotation (band or cable)', 'prehab', 'isolation', 'band', [['resistance_bands'], ['cable_station'], ['functional_trainer'], ['cable_crossover']], ['rear_delt'],
    ['Elbow tucked to your side', 'Rotate out slowly, 3 s back'], { unilateral: true }),
  ex('wrist_curl', 'Wrist curl', 'prehab', 'isolation', 'dumbbell', [['dumbbells']], ['forearms'],
    ['Forearm on your thigh', 'Full range, slow lowering']),
  ex('reverse_wrist_curl', 'Reverse wrist curl', 'prehab', 'isolation', 'dumbbell', [['dumbbells']], ['forearms'],
    ['Palm down, light weight', 'Protects the elbow (tennis elbow)']),
  ex('nordic_curl', 'Nordic hamstring curl', 'prehab', 'isolation', 'bodyweight', [['roman_chair'], ['flat_bench']], ['hamstrings'],
    ['Feet anchored', 'Lower as slowly as you can, push back up with your hands']),
  ex('single_leg_calf_raise', 'Single-leg calf raise', 'prehab', 'isolation', 'bodyweight', NONE, ['calves'],
    ['On a step, full range', '3 s down: builds the Achilles'], { unilateral: true }),
  ex('single_leg_balance', 'Single-leg balance reach', 'prehab', 'isolation', 'bodyweight', NONE, ['glute_med'],
    ['Stand on one leg, reach the other foot forward, side and back', 'Knee stays over the foot'], { measure: 'time', unilateral: true, secondary: ['calves'] }),

  // Conditioning: work in rounds.
  ex('rower_intervals', 'Rower intervals', 'conditioning', 'compound', 'machine', [['rower']], ['lats', 'quads'],
    ['Legs, then back, then arms', 'Hard work, easy recovery'], { measure: 'time', secondary: ['hamstrings'] }),
  ex('bike_intervals', 'Bike intervals', 'conditioning', 'compound', 'machine', [['bike']], ['quads'],
    ['High cadence on the work intervals'], { measure: 'time', secondary: ['glutes'] }),
  ex('burpee', 'Burpee', 'conditioning', 'compound', 'bodyweight', NONE, ['quads', 'chest'],
    ['Chest to the floor, jump at the top', 'Steady pace, no sloppy reps'], { secondary: ['triceps', 'abs'] }),
  ex('mountain_climber', 'Mountain climber', 'conditioning', 'compound', 'bodyweight', NONE, ['abs'],
    ['Hands under shoulders', 'Drive the knees, hips stay low'], { measure: 'time', secondary: ['hip_flexors'] }),
  ex('shadow_boxing', 'Shadow boxing rounds', 'conditioning', 'compound', 'bodyweight', NONE, ['side_delt', 'obliques'],
    ['Stay light on your feet', 'Hands back to guard after every punch'], { measure: 'time', secondary: ['calves'] }),
]

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

/** Exercises performable with the given equipment (features/01-equipment-scan.md: deterministic mapping). */
export function performableExercises(owned: Iterable<string>, exercises: Exercise[] = EXERCISES): Exercise[] {
  const have = expandEquipment(owned)
  return exercises.filter((e) => e.requires.some((group) => group.every((id) => have.has(id))))
}

export function isLowerBody(e: Exercise): boolean {
  return LOWER_BODY_PATTERNS.includes(e.pattern)
}
