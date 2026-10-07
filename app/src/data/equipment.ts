// Equipment taxonomy (features/01-equipment-scan.md). IDs are stable: they're stored in gyms and used by the scanner.
export type EquipmentCategory = 'free_weight' | 'rack_bench' | 'machine' | 'cable' | 'bodyweight' | 'accessory' | 'cardio'

export interface Equipment {
  id: string
  name: string
  category: EquipmentCategory
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
  { id: 'barbell', name: 'Barbell + plates', category: 'free_weight' },
  { id: 'ez_bar', name: 'EZ curl bar', category: 'free_weight' },
  { id: 'trap_bar', name: 'Trap / hex bar', category: 'free_weight' },
  { id: 'dumbbells', name: 'Dumbbells', category: 'free_weight' },
  { id: 'kettlebells', name: 'Kettlebells', category: 'free_weight' },

  { id: 'power_rack', name: 'Power rack', category: 'rack_bench' },
  { id: 'squat_stand', name: 'Squat stands', category: 'rack_bench' },
  { id: 'flat_bench', name: 'Flat bench', category: 'rack_bench' },
  { id: 'adjustable_bench', name: 'Adjustable bench', category: 'rack_bench' },
  { id: 'preacher_bench', name: 'Preacher bench', category: 'rack_bench' },
  { id: 'landmine', name: 'Landmine', category: 'rack_bench' },

  { id: 'smith_machine', name: 'Smith machine', category: 'machine' },
  { id: 'leg_press', name: 'Leg press', category: 'machine' },
  { id: 'hack_squat', name: 'Hack squat', category: 'machine' },
  { id: 'leg_extension', name: 'Leg extension', category: 'machine' },
  { id: 'leg_curl_seated', name: 'Seated leg curl', category: 'machine' },
  { id: 'leg_curl_lying', name: 'Lying leg curl', category: 'machine' },
  { id: 'chest_press_machine', name: 'Chest press machine', category: 'machine' },
  { id: 'pec_deck', name: 'Pec deck / rear delt', category: 'machine' },
  { id: 'lat_pulldown', name: 'Lat pulldown', category: 'machine' },
  { id: 'seated_row_machine', name: 'Seated row', category: 'machine' },
  { id: 'shoulder_press_machine', name: 'Shoulder press machine', category: 'machine' },
  { id: 'hip_thrust_machine', name: 'Hip thrust machine', category: 'machine' },
  { id: 'abductor_machine', name: 'Hip abductor machine', category: 'machine' },
  { id: 'calf_raise_machine', name: 'Calf raise machine', category: 'machine' },

  { id: 'cable_station', name: 'Single cable stack', category: 'cable' },
  { id: 'cable_crossover', name: 'Cable crossover (dual)', category: 'cable' },
  { id: 'functional_trainer', name: 'Functional trainer', category: 'cable' },

  { id: 'pull_up_bar', name: 'Pull-up bar', category: 'bodyweight' },
  { id: 'dip_station', name: 'Dip station', category: 'bodyweight' },
  { id: 'roman_chair', name: 'Back extension / GHD', category: 'bodyweight' },
  { id: 'gymnastic_rings', name: 'Gymnastic rings', category: 'bodyweight' },
  { id: 'trx', name: 'Suspension trainer (TRX)', category: 'bodyweight' },

  { id: 'resistance_bands', name: 'Resistance bands', category: 'accessory' },
  { id: 'ab_wheel', name: 'Ab wheel', category: 'accessory' },
  { id: 'box', name: 'Plyo box / step', category: 'accessory' },
  { id: 'foam_roller', name: 'Foam roller', category: 'accessory' },
  { id: 'medicine_ball', name: 'Medicine ball', category: 'accessory' },

  { id: 'treadmill', name: 'Treadmill', category: 'cardio' },
  { id: 'rower', name: 'Rowing machine', category: 'cardio' },
  { id: 'bike', name: 'Exercise bike', category: 'cardio' },
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
