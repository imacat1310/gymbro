// Session focus: sport-specific and general gym days (features/03 §8c, ADR-015). A focus day replaces the plan's
// template for that day with an ordered list of slots: power and movement first (fresh), then strength, then
// injury prevention for the joints that sport loads most. Each slot lists curated exercises in order of preference;
// the first one the gym allows (and the user's limitations permit) is used.
import type { Experience } from './targets'
import type { Target } from './targets'

export type FocusId =
  | 'basketball' | 'badminton' | 'volleyball' | 'tennis' | 'martial_arts' | 'swimming'
  | 'power' | 'speed' | 'endurance' | 'mobility'

/** How a slot is loaded: decides sets, reps, effort and rest. */
export type SlotKind = 'plyo' | 'power' | 'strength' | 'strength2' | 'prehab' | 'carry' | 'conditioning' | 'endurance' | 'mobility'

export interface FocusSlot { kind: SlotKind; ids: string[]; reason: string }

export interface FocusDef {
  label: string
  group: 'sport' | 'general'
  /** One line on what the day trains. */
  blurb: string
  slots: FocusSlot[]
}

const S = (kind: SlotKind, ids: string[], reason: string): FocusSlot => ({ kind, ids, reason })

// Shared slot lists.
// Ordered by preference; the last entries are bodyweight fallbacks so every gym gets a real session.
const LOWER_MAIN = ['trap_bar_deadlift', 'barbell_front_squat', 'goblet_squat', 'barbell_back_squat', 'leg_press', 'split_squat', 'bodyweight_squat']
const SINGLE_LEG = ['db_bulgarian_split_squat', 'db_reverse_lunge', 'split_squat', 'db_step_up']
const CUFF = ['band_external_rotation', 'face_pull', 'prone_y_raise']
const WRIST = ['wrist_curl', 'reverse_wrist_curl']
const ACHILLES = ['single_leg_calf_raise', 'db_calf_raise', 'bodyweight_calf_raise']
const HAMSTRING = ['nordic_curl', 'lying_leg_curl', 'seated_leg_curl', 'db_single_leg_rdl']
const ROTATION = ['med_ball_rotational_throw', 'cable_woodchop', 'landmine_rotation']
const PULL = ['pull_up', 'chin_up', 'lat_pulldown', 'one_arm_db_row', 'inverted_row']

export const FOCUS: Record<FocusId, FocusDef> = {
  basketball: {
    label: 'Basketball', group: 'sport',
    blurb: 'Jump higher, cut faster, land safely: ankles and knees take the load.',
    slots: [
      S('plyo', ['box_jump', 'squat_jump', 'broad_jump'], 'Basketball: vertical jump power'),
      S('plyo', ['lateral_bound', 'skater_jump'], 'Basketball: lateral power for cuts'),
      S('strength', LOWER_MAIN, 'Basketball: lower-body strength'),
      S('strength2', SINGLE_LEG, 'Basketball: single-leg strength for landing and cutting'),
      S('strength2', ['push_press', 'standing_db_press', 'landmine_press', 'push_up'], 'Basketball: upper-body strength for contact'),
      S('strength2', PULL, 'Basketball: pulling balance'),
      S('prehab', ACHILLES, 'Basketball: ankle and Achilles resilience'),
      S('prehab', HAMSTRING, 'Basketball: hamstring injury prevention'),
      S('prehab', ['copenhagen_plank', 'side_plank', 'single_leg_balance'], 'Basketball: groin and hip stability'),
    ],
  },
  badminton: {
    label: 'Badminton', group: 'sport',
    blurb: 'Explosive first step, deep lunges to the corners, strong shoulder, wrist and Achilles.',
    slots: [
      S('plyo', ['skater_jump', 'split_squat_jump', 'pogo_jump'], 'Badminton: explosive first step'),
      S('strength2', ['lateral_lunge', 'lateral_shuffle'], 'Badminton: lunging reach to the corners'),
      S('strength2', SINGLE_LEG, 'Badminton: single-leg strength for the lunge'),
      S('strength', LOWER_MAIN, 'Badminton: lower-body strength'),
      S('power', ROTATION, 'Badminton: rotational power for smashes'),
      S('prehab', ACHILLES, 'Badminton: Achilles and calf, the sport’s most common injury sites'),
      S('prehab', CUFF, 'Badminton: rotator cuff for overhead strokes'),
      S('prehab', WRIST, 'Badminton: wrist and forearm'),
    ],
  },
  volleyball: {
    label: 'Volleyball', group: 'sport',
    blurb: 'Vertical jump and landing, overhead strength and shoulder health for spiking.',
    slots: [
      S('plyo', ['box_jump', 'squat_jump'], 'Volleyball: vertical jump for spikes and blocks'),
      S('plyo', ['split_squat_jump', 'broad_jump'], 'Volleyball: approach and landing'),
      S('strength', ['barbell_back_squat', 'barbell_front_squat', 'goblet_squat', 'leg_press'], 'Volleyball: squat strength'),
      S('strength2', ['barbell_rdl', 'db_rdl', 'barbell_hip_thrust', 'glute_bridge'], 'Volleyball: posterior chain'),
      S('strength2', ['landmine_press', 'standing_db_press', 'push_press'], 'Volleyball: overhead strength'),
      S('prehab', CUFF, 'Volleyball: shoulder health for spiking'),
      S('prehab', ACHILLES, 'Volleyball: Achilles and knee resilience for landings'),
      S('prehab', ['pallof_press', 'dead_bug'], 'Volleyball: trunk control in the air'),
    ],
  },
  tennis: {
    label: 'Tennis / pickleball', group: 'sport',
    blurb: 'Rotational power, lateral movement, and a resilient shoulder and elbow.',
    slots: [
      S('power', ROTATION, 'Tennis: rotational power for groundstrokes'),
      S('plyo', ['skater_jump', 'lateral_bound'], 'Tennis: lateral push-off'),
      S('strength2', ['lateral_lunge', 'lateral_shuffle'], 'Tennis: lateral movement'),
      S('strength2', SINGLE_LEG, 'Tennis: single-leg strength'),
      S('strength2', ['one_arm_db_row', 'seated_cable_row', 'chest_supported_db_row'], 'Tennis: pulling strength'),
      S('prehab', CUFF, 'Tennis: rotator cuff for serves'),
      S('prehab', WRIST, 'Tennis: forearm and elbow'),
      S('prehab', ['pallof_press', 'side_plank'], 'Tennis: anti-rotation core'),
    ],
  },
  martial_arts: {
    label: 'Martial arts / boxing', group: 'sport',
    blurb: 'Rotational and whole-body power, grip, pulling strength and round-based conditioning.',
    slots: [
      S('power', ROTATION, 'Martial arts: rotational power for strikes'),
      S('power', ['med_ball_slam', 'kb_swing', 'broad_jump', 'squat_jump'], 'Martial arts: whole-body power'),
      S('strength', ['trap_bar_deadlift', 'barbell_deadlift', 'goblet_squat', 'barbell_front_squat', 'split_squat', 'bodyweight_squat'], 'Martial arts: base strength'),
      S('strength2', PULL, 'Martial arts: pulling strength for clinch and grappling'),
      S('strength2', ['push_up', 'db_bench_press', 'landmine_press'], 'Martial arts: pushing strength'),
      S('carry', ['farmers_carry', 'suitcase_carry', 'side_plank'], 'Martial arts: grip and trunk stiffness'),
      S('conditioning', ['shadow_boxing', 'burpee', 'rower_intervals', 'bike_intervals'], 'Martial arts: round-based conditioning'),
      S('mobility', ['hip_9090', 'worlds_greatest_stretch'], 'Martial arts: hip mobility for kicks'),
    ],
  },
  swimming: {
    label: 'Swimming', group: 'sport',
    blurb: 'Pulling strength and lat endurance, strong push-offs, and a healthy swimmer’s shoulder.',
    slots: [
      S('strength', ['pull_up', 'chin_up', 'lat_pulldown', 'single_arm_cable_pulldown'], 'Swimming: pulling strength for the stroke'),
      S('endurance', ['straight_arm_pulldown', 'seated_cable_row', 'one_arm_db_row'], 'Swimming: lat endurance'),
      S('strength2', ['goblet_squat', 'barbell_front_squat', 'leg_press'], 'Swimming: leg drive for starts and push-offs'),
      S('plyo', ['squat_jump', 'broad_jump'], 'Swimming: explosive starts and turns'),
      S('strength2', ['glute_bridge', 'db_rdl', 'back_extension'], 'Swimming: hip extension for the kick'),
      S('prehab', CUFF, 'Swimming: swimmer’s-shoulder prevention'),
      S('prehab', ['dead_bug', 'plank', 'hanging_knee_raise'], 'Swimming: body position in the water'),
      S('mobility', ['thoracic_extension', 'worlds_greatest_stretch'], 'Swimming: thoracic mobility for the reach'),
    ],
  },
  power: {
    label: 'Explosive power', group: 'general',
    blurb: 'Jumps, throws and heavy-but-fast lifts: move force quickly.',
    slots: [
      S('plyo', ['box_jump', 'squat_jump', 'broad_jump'], 'Power: jump'),
      S('power', ['med_ball_slam', 'med_ball_chest_pass', 'kb_swing', 'broad_jump'], 'Power: throw'),
      S('power', LOWER_MAIN, 'Power: heavy, fast lower-body lift'),
      S('power', ['push_press', 'landmine_press', 'standing_db_press', 'push_up', 'pike_push_up'], 'Power: fast upper-body drive'),
      S('strength2', ['pull_up', 'chin_up', 'barbell_row', 'one_arm_db_row'], 'Power: pulling balance'),
      S('prehab', ['pallof_press', 'ab_wheel_rollout', 'dead_bug'], 'Power: trunk stiffness'),
    ],
  },
  speed: {
    label: 'Speed & agility', group: 'general',
    blurb: 'Acceleration, change of direction and reactive ankles, with hamstrings protected.',
    slots: [
      S('plyo', ['pogo_jump', 'skater_jump', 'lateral_bound'], 'Speed: reactive ankles'),
      S('plyo', ['broad_jump', 'split_squat_jump'], 'Speed: acceleration'),
      S('strength2', ['lateral_shuffle', 'lateral_lunge'], 'Agility: change of direction'),
      S('strength2', SINGLE_LEG, 'Speed: single-leg force'),
      S('strength2', ['barbell_hip_thrust', 'glute_bridge', 'db_rdl'], 'Speed: hip extension for sprinting'),
      S('prehab', HAMSTRING, 'Speed: hamstring protection for sprinting'),
      S('prehab', ACHILLES, 'Speed: calves and Achilles'),
    ],
  },
  endurance: {
    label: 'Endurance', group: 'general',
    blurb: 'Higher reps, short rest and intervals: keep going for longer.',
    slots: [
      S('conditioning', ['rower_intervals', 'bike_intervals', 'burpee', 'mountain_climber'], 'Endurance: intervals'),
      S('endurance', ['goblet_squat', 'db_walking_lunge', 'bodyweight_squat'], 'Endurance: legs'),
      S('endurance', ['push_up', 'db_bench_press', 'machine_chest_press'], 'Endurance: push'),
      S('endurance', ['inverted_row', 'one_arm_db_row', 'seated_cable_row'], 'Endurance: pull'),
      S('endurance', ['kb_swing', 'glute_bridge', 'db_rdl'], 'Endurance: hips'),
      S('carry', ['farmers_carry', 'suitcase_carry'], 'Endurance: carries'),
      S('prehab', ['plank', 'mountain_climber', 'dead_bug'], 'Endurance: core'),
    ],
  },
  mobility: {
    label: 'Mobility', group: 'general',
    blurb: 'An easy day for range of motion: hips, ankles, upper back and chest.',
    slots: [
      S('mobility', ['worlds_greatest_stretch'], 'Mobility: whole-body opener'),
      S('mobility', ['hip_9090'], 'Mobility: hips'),
      S('mobility', ['couch_stretch'], 'Mobility: hip flexors'),
      S('mobility', ['ankle_dorsiflexion'], 'Mobility: ankles'),
      S('mobility', ['thoracic_extension', 'wall_slide'], 'Mobility: upper back'),
      S('mobility', ['doorway_pec_stretch'], 'Mobility: chest'),
      S('prehab', ['glute_bridge', 'bird_dog', 'dead_bug'], 'Mobility: light activation'),
    ],
  },
}

export const FOCUS_ORDER: FocusId[] = ['basketball', 'badminton', 'volleyball', 'tennis', 'martial_arts', 'swimming', 'power', 'speed', 'endurance', 'mobility']

/** Too demanding to start with: beginners get the next option in the slot instead. */
export const ADVANCED_ONLY = new Set(['nordic_curl', 'push_press', 'box_jump'])

/** Loading per slot kind. Power work is about quality: few reps, full rest, maximum intent. */
export function focusTarget(kind: SlotKind, timed: boolean, experience: Experience): Target {
  const beginner = experience === 'beginner'
  switch (kind) {
    case 'plyo': return timed ? { sets: beginner ? 2 : 3, repMin: 15, repMax: 20, targetRpe: 7, restSec: 90 } : { sets: beginner ? 2 : 3, repMin: 3, repMax: 5, targetRpe: 7, restSec: 90 }
    case 'power': return { sets: 3, repMin: 3, repMax: 5, targetRpe: beginner ? 7 : 8, restSec: 120 }
    case 'strength': return { sets: beginner ? 3 : 4, repMin: beginner ? 6 : 4, repMax: beginner ? 8 : 6, targetRpe: beginner ? 7 : 8, restSec: 150 }
    case 'strength2': return timed ? { sets: 3, repMin: 20, repMax: 30, targetRpe: 7, restSec: 60 } : { sets: 3, repMin: 6, repMax: 10, targetRpe: beginner ? 7 : 8, restSec: 90 }
    case 'prehab': return timed ? { sets: 2, repMin: 20, repMax: 40, targetRpe: 7, restSec: 45 } : { sets: 2, repMin: 10, repMax: 15, targetRpe: 7, restSec: 45 }
    case 'carry': return { sets: 3, repMin: 30, repMax: 45, targetRpe: 7, restSec: 60 }
    case 'conditioning': return timed ? { sets: beginner ? 4 : 6, repMin: 20, repMax: 30, targetRpe: 8, restSec: 40 } : { sets: beginner ? 3 : 4, repMin: 8, repMax: 12, targetRpe: 8, restSec: 45 }
    case 'endurance': return timed ? { sets: 3, repMin: 30, repMax: 45, targetRpe: 7, restSec: 45 } : { sets: 3, repMin: 12, repMax: 20, targetRpe: 7, restSec: 45 }
    case 'mobility': return { sets: 2, repMin: 30, repMax: 45, targetRpe: 5, restSec: 15 }
  }
}
