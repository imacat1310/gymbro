// Equipment taxonomy (features/01-equipment-scan.md). IDs are stable: they're stored in gyms and used by the scanner.
export type EquipmentCategory = 'free_weight' | 'rack_bench' | 'machine' | 'cable' | 'bodyweight' | 'accessory' | 'cardio'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
  /** What it looks like, to help recognise it during the gym tour. */
  hint?: string
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  free_weight: 'Free weights',
  rack_bench: 'Racks & benches',
  machine: 'Machines',
  cable: 'Cables',
  bodyweight: 'Bodyweight stations',
  accessory: 'Accessories',
  cardio: 'Cardio',
}

export const EQUIPMENT: Equipment[] = [
  { id: 'barbell', name: 'Barbell + plates', category: 'free_weight', hint: 'Long 2 m bar with weight plates on both ends' },
  { id: 'ez_bar', name: 'EZ curl bar', category: 'free_weight', hint: 'Short bar with a zig-zag bend in the middle' },
  { id: 'trap_bar', name: 'Trap / hex bar', category: 'free_weight', hint: 'Hexagon-shaped bar you stand inside' },
  { id: 'dumbbells', name: 'Dumbbells', category: 'free_weight', hint: 'Hand weights, usually on a rack in pairs' },
  { id: 'kettlebells', name: 'Kettlebells', category: 'free_weight', hint: 'Cannonball-shaped weights with a handle on top' },

  { id: 'power_rack', name: 'Power rack', category: 'rack_bench', hint: 'Steel cage with safety bars to squat and press in' },
  { id: 'squat_stand', name: 'Squat stands', category: 'rack_bench', hint: 'Two upright posts with hooks for a barbell, no cage' },
  { id: 'flat_bench', name: 'Flat bench', category: 'rack_bench', hint: 'Padded bench that stays flat' },
  { id: 'adjustable_bench', name: 'Adjustable bench', category: 'rack_bench', hint: 'Bench whose back tilts up to an incline' },
  { id: 'preacher_bench', name: 'Preacher bench', category: 'rack_bench', hint: 'Bench with a sloped arm pad for curls' },
  { id: 'landmine', name: 'Landmine', category: 'rack_bench', hint: 'Sleeve on the floor or rack that holds one end of a barbell' },

  { id: 'smith_machine', name: 'Smith machine', category: 'machine', hint: 'Barbell fixed on vertical rails' },
  { id: 'leg_press', name: 'Leg press', category: 'machine', hint: 'Seated sled you push away with your feet' },
  { id: 'hack_squat', name: 'Hack squat', category: 'machine', hint: 'Angled sled you squat in, shoulders under pads' },
  { id: 'leg_extension', name: 'Leg extension', category: 'machine', hint: 'Seat with a pad in front of the shins that you lift' },
  { id: 'leg_curl_seated', name: 'Seated leg curl', category: 'machine', hint: 'Seat with a pad behind the calves you press down' },
  { id: 'leg_curl_lying', name: 'Lying leg curl', category: 'machine', hint: 'Face-down bench with a pad behind the ankles' },
  { id: 'chest_press_machine', name: 'Chest press machine', category: 'machine', hint: 'Seat with two handles you push forward' },
  { id: 'pec_deck', name: 'Pec deck / rear delt', category: 'machine', hint: 'Seat with two arms that swing together in front of you' },
  { id: 'lat_pulldown', name: 'Lat pulldown', category: 'machine', hint: 'Seat under a high bar on a cable you pull down' },
  { id: 'seated_row_machine', name: 'Seated row', category: 'machine', hint: 'Seat with a chest pad and handles you pull back' },
  { id: 'shoulder_press_machine', name: 'Shoulder press machine', category: 'machine', hint: 'Seat with handles at shoulder height you push up' },
  { id: 'hip_thrust_machine', name: 'Hip thrust machine', category: 'machine', hint: 'Bench with a pad over the hips you drive up' },
  { id: 'abductor_machine', name: 'Hip abductor machine', category: 'machine', hint: 'Seat with leg pads that open and close' },
  { id: 'calf_raise_machine', name: 'Calf raise machine', category: 'machine', hint: 'Shoulder or knee pads with a step for your toes' },

  { id: 'cable_station', name: 'Single cable stack', category: 'cable', hint: 'One tower with a weight stack and an adjustable pulley' },
  { id: 'cable_crossover', name: 'Cable crossover (dual)', category: 'cable', hint: 'Two cable towers facing each other' },
  { id: 'functional_trainer', name: 'Functional trainer', category: 'cable', hint: 'One frame with two adjustable pulleys side by side' },

  { id: 'pull_up_bar', name: 'Pull-up bar', category: 'bodyweight', hint: 'Bar overhead you can hang from' },
  { id: 'dip_station', name: 'Dip station', category: 'bodyweight', hint: 'Two parallel handles at hip height' },
  { id: 'roman_chair', name: 'Back extension / GHD', category: 'bodyweight', hint: 'Pad for the hips and anchors for the heels, body tilted forward' },
  { id: 'gymnastic_rings', name: 'Gymnastic rings', category: 'bodyweight', hint: 'Two wooden or plastic rings hanging on straps' },
  { id: 'trx', name: 'Suspension trainer (TRX)', category: 'bodyweight', hint: 'Two straps with handles hanging from one anchor' },

  { id: 'resistance_bands', name: 'Resistance bands', category: 'accessory', hint: 'Rubber loops or tubes in different colours' },
  { id: 'ab_wheel', name: 'Ab wheel', category: 'accessory', hint: 'Small wheel with a handle on each side' },
  { id: 'box', name: 'Plyo box / step', category: 'accessory', hint: 'Sturdy box or step you can jump onto' },
  { id: 'foam_roller', name: 'Foam roller', category: 'accessory', hint: 'Foam cylinder for rolling out muscles' },
  { id: 'medicine_ball', name: 'Medicine ball', category: 'accessory', hint: 'Weighted ball you can throw' },

  { id: 'treadmill', name: 'Treadmill', category: 'cardio', hint: 'Running belt machine' },
  { id: 'rower', name: 'Rowing machine', category: 'cardio', hint: 'Sliding seat with a handle on a chain or strap' },
  { id: 'bike', name: 'Exercise bike', category: 'cardio', hint: 'Stationary bike' },
]

export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]))

/** Owning one item also gives you these (e.g. an adjustable bench can be used flat). */
export const IMPLIES: Record<string, string[]> = {
  adjustable_bench: ['flat_bench'],
  power_rack: ['squat_stand'],
  functional_trainer: ['cable_station', 'cable_crossover'],
  cable_crossover: ['cable_station'],
}

export interface GymPreset {
  id: string
  name: string
  description: string
  equipment: string[]
}

const ALL_COMMON = EQUIPMENT.map((e) => e.id).filter((id) => !['gymnastic_rings', 'trx', 'medicine_ball'].includes(id))

export const GYM_PRESETS: GymPreset[] = [
  { id: 'commercial', name: 'Commercial gym', description: 'Racks, free weights, machines, cables', equipment: ALL_COMMON },
  {
    id: 'hotel', name: 'Hotel gym', description: 'Dumbbells, a bench, a cable machine, cardio',
    equipment: ['dumbbells', 'adjustable_bench', 'functional_trainer', 'treadmill', 'bike'],
  },
  {
    id: 'home_barbell', name: 'Home: barbell + rack', description: 'Garage gym with rack, barbell, bench',
    equipment: ['barbell', 'power_rack', 'adjustable_bench', 'dumbbells', 'pull_up_bar', 'resistance_bands'],
  },
  {
    id: 'home_dumbbell', name: 'Home: dumbbells', description: 'Adjustable dumbbells and a bench',
    equipment: ['dumbbells', 'adjustable_bench', 'resistance_bands'],
  },
  { id: 'bodyweight', name: 'Bodyweight only', description: 'No equipment', equipment: [] },
]

/** Expand a gym's equipment list with everything it implies. */
export function expandEquipment(owned: Iterable<string>): Set<string> {
  const out = new Set<string>()
  const visit = (id: string) => {
    if (out.has(id)) return
    out.add(id)
    IMPLIES[id]?.forEach(visit)
  }
  for (const id of owned) visit(id)
  return out
}
