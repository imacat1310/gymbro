// "Why?" registry (ADR-016). Every decision the rules engine makes carries one or more WhyCodes; this file turns a
// code into the rule in plain words, how strong the evidence is, and where it comes from. Pattern adapted from
// gymcoach (MIT, github.com/gymcoach-app/gymcoach): decisions return structured reason codes, and the text is
// rendered separately so the app (and, later, an opt-in AI coach) read the exact same explanation.

export type Evidence = 'strong' | 'moderate' | 'convention'

export interface Source { label: string; url?: string }

export interface WhyEntry {
  title: string
  /** The rule in plain words. */
  rule: string
  evidence: Evidence
  sources: Source[]
}

// Links are only given where they were checked; the rest are full citations to look up.
const S = {
  zourdos: { label: 'Zourdos et al. 2016, RIR-based RPE scale (J Strength Cond Res 30:267)' },
  schoenfeld: { label: 'Schoenfeld, Ogborn & Krieger 2017, weekly volume dose-response (J Sports Sci 35:1073)', url: 'https://doi.org/10.1080/02640414.2016.1210197' },
  lauersen: { label: 'Lauersen et al. 2014, exercise to prevent sports injuries, meta-analysis (Br J Sports Med 48:871)', url: 'https://bjsm.bmj.com/content/48/11/871' },
  mcguine: { label: 'McGuine & Keene 2006, balance training and ankle sprains (Am J Sports Med 34:1103)' },
  haroy: { label: 'Harøy et al. 2019, Copenhagen adduction programme and groin problems (Br J Sports Med 53:150)', url: 'https://bjsm.bmj.com/content/53/3/150' },
  vanDerHorst: { label: 'van der Horst et al. 2015, Nordic hamstring exercise RCT in amateur soccer (Am J Sports Med 43:1316)', url: 'https://doi.org/10.1177/0363546515574057' },
  ellenbecker: { label: 'Ellenbecker & Cools 2010, rotator cuff and scapular rehabilitation review (Br J Sports Med 44:319)', url: 'https://bjsm.bmj.com/content/44/5/319' },
  alfredson: { label: 'Alfredson et al. 1998, heavy eccentric calf training for the Achilles (Am J Sports Med 26:360)' },
  nsca: { label: 'NSCA, Essentials of Strength Training and Conditioning (Haff & Triplett, 4th ed.): plyometric and power programming' },
  janda: { label: 'Page, Frank & Lardner 2010, Assessment and Treatment of Muscle Imbalance: The Janda Approach' },
  bunnell: { label: 'Bunnell 1984, an objective criterion for scoliosis screening (J Bone Joint Surg Am 66:1381)' },
  epley: { label: 'Epley 1985: estimated one-rep max = weight × (1 + reps ÷ 30)' },
  gymcoach: { label: 'gymcoach (MIT): stall and deload signal design', url: 'https://github.com/gymcoach-app/gymcoach' },
} satisfies Record<string, Source>

export const WHY = {
  // ---- Weight and rep suggestions ----
  first_time: {
    title: 'Finding your starting weight',
    rule: 'With no history yet, start a little lighter than your limit: a weight you could lift about 2 more times than the target. The next session adjusts from what you actually did.',
    evidence: 'convention', sources: [S.zourdos],
  },
  double_progression: {
    title: 'Double progression',
    rule: 'Keep the weight until every working set reaches the top of the rep range, then add the smallest step your equipment allows and start again at the bottom of the range.',
    evidence: 'convention', sources: [S.zourdos],
  },
  rpe_hold: {
    title: 'Effort check',
    rule: 'Reaching the top of the range only counts if it felt no harder than your target effort (RPE). If the last set was harder, the weight stays until the same reps feel easier.',
    evidence: 'moderate', sources: [S.zourdos],
  },
  deload_missed: {
    title: 'Step back after two misses',
    rule: 'Missing the bottom of the rep range two sessions in a row suggests fatigue rather than a bad day: drop about 10% and build back up.',
    evidence: 'convention', sources: [],
  },
  form_hold: {
    title: 'Form before load',
    rule: 'A weight increase is held back while something flags your technique or safety. The load goes up once that clears.',
    evidence: 'convention', sources: [],
  },
  bodyweight_reps: {
    title: 'More reps first',
    rule: 'For bodyweight exercises the progression is reps: add one or two per set each session until the range is easy, then make the variation harder.',
    evidence: 'convention', sources: [],
  },
  timed_progression: {
    title: 'Longer holds',
    rule: 'For timed exercises, add about 5 seconds once every set reaches the target time.',
    evidence: 'convention', sources: [],
  },

  // ---- Plan building ----
  main_lift: {
    title: 'Main lift of the day',
    rule: 'Each day starts with a big compound movement while you are fresh; it gets the most sets and the heaviest loads.',
    evidence: 'convention', sources: [S.nsca],
  },
  supporting_lift: {
    title: 'Supporting work',
    rule: 'Secondary and accessory exercises fill in movement patterns and muscles the main lift doesn\'t cover, so every muscle gets enough weekly sets.',
    evidence: 'moderate', sources: [S.schoenfeld],
  },
  weekly_volume: {
    title: 'Weekly sets per muscle',
    rule: 'Muscle growth rises with weekly hard sets; roughly 10 or more per muscle is a common target. GymBro sets floors and ceilings by experience and intensity.',
    evidence: 'moderate', sources: [S.schoenfeld],
  },
  priority: {
    title: 'Your priority muscle',
    rule: 'Muscles you choose as priorities get an extra exercise and about 30% more weekly sets, protected when a session is trimmed to fit your time.',
    evidence: 'moderate', sources: [S.schoenfeld],
  },
  push_pull: {
    title: 'Pull at least as much as you push',
    rule: 'Weekly pulling sets are kept at or above pressing sets, a common coaching convention for shoulder health.',
    evidence: 'convention', sources: [S.ellenbecker],
  },
  strengthen: {
    title: 'Strengthening from your posture scan',
    rule: 'Muscles commonly associated with your posture findings get extra work. These links follow the Janda approach and are a reasonable bet, not a proven fix.',
    evidence: 'convention', sources: [S.janda],
  },
  corrective: {
    title: 'Corrective block',
    rule: 'Two light correctives per session (about 8 minutes) for confident posture findings: stretches for tight areas, activation for weak ones. They rotate through the week.',
    evidence: 'convention', sources: [S.janda],
  },
  weak_side: {
    title: 'Weaker side first',
    rule: 'When one arm or leg has 5% or more less lean mass (InBody), one-sided exercises start with it and add a set on it, so it gets the freshest and most work.',
    evidence: 'convention', sources: [],
  },
  safety_pause: {
    title: 'Safety pause',
    rule: 'After a result that suggests seeing a professional, exercises that load the lower back are left out until you confirm it has been checked. Lifting resumes as soon as you do.',
    evidence: 'convention', sources: [S.bunnell],
  },
  limitation: {
    title: 'Working around pain',
    rule: 'Exercises that load an area you marked as injured or painful are swapped for ones that load it less.',
    evidence: 'convention', sources: [],
  },

  // ---- Sport and focus days ----
  focus_plyo: {
    title: 'Jumps: quality, not fatigue',
    rule: 'Jumps come first while you are fresh: few reps (3 to 5), full rest, maximum intent. Stop when height or landing quality drops.',
    evidence: 'moderate', sources: [S.nsca],
  },
  focus_power: {
    title: 'Power: move fast',
    rule: 'Throws and fast lifts train rate of force: 3 to 5 reps with full rest, every rep as fast as possible.',
    evidence: 'moderate', sources: [S.nsca],
  },
  focus_strength: {
    title: 'Strength for sport',
    rule: 'Heavier sets of 4 to 6 build the strength that power and change of direction are built on.',
    evidence: 'moderate', sources: [S.nsca],
  },
  focus_prehab: {
    title: 'Injury prevention',
    rule: 'Strength and balance work for the joints your sport loads most. Across trials, strength training is the most effective injury-prevention exercise.',
    evidence: 'strong', sources: [S.lauersen],
  },
  focus_ankle: {
    title: 'Ankles and Achilles',
    rule: 'Calf strength (slow lowering) and balance work protect the Achilles and ankles; balance training lowered ankle sprains in basketball and soccer players.',
    evidence: 'moderate', sources: [S.mcguine, S.alfredson],
  },
  focus_hamstring: {
    title: 'Hamstring protection',
    rule: 'Nordic hamstring curls (slow lowering) are a standard hamstring-injury-prevention exercise in running and jumping sports.',
    evidence: 'moderate', sources: [S.vanDerHorst, S.lauersen],
  },
  focus_groin: {
    title: 'Groin and hip stability',
    rule: 'The Copenhagen adduction exercise lowered groin problems by about 41% in football players.',
    evidence: 'strong', sources: [S.haroy],
  },
  focus_shoulder: {
    title: 'Shoulder health for overhead sports',
    rule: 'Rotator cuff and shoulder-blade strength is the core of preventing and treating shoulder problems in overhead athletes.',
    evidence: 'moderate', sources: [S.ellenbecker],
  },
  focus_conditioning: {
    title: 'Conditioning in rounds',
    rule: 'Work-rest intervals that mirror the sport build the right kind of fitness.',
    evidence: 'convention', sources: [S.nsca],
  },
  focus_mobility: {
    title: 'Mobility',
    rule: 'Easy range-of-motion work for the hips, ankles and upper back. Low effort, so it doubles as recovery.',
    evidence: 'convention', sources: [],
  },

  // ---- Coach signals ----
  stalled: {
    title: 'Stalled lift',
    rule: 'A lift counts as stalled when its estimated one-rep max hasn\'t beaten its previous best (by more than 0.5%) for 3 sessions.',
    evidence: 'convention', sources: [S.epley, S.gymcoach],
  },
  deload_week: {
    title: 'Deload week',
    rule: 'When 2 or more lifts stall at the same time, the plateau is more likely general fatigue than any one exercise: a lighter week (about 10% less load, fewer sets) usually lets you come back stronger.',
    evidence: 'convention', sources: [S.gymcoach],
  },
  record: {
    title: 'Personal record',
    rule: 'A new heaviest weight or a new best estimated one-rep max for an exercise.',
    evidence: 'strong', sources: [S.epley],
  },
  xp_level: {
    title: 'Level and XP',
    rule: 'XP: 100 per finished workout, 2 per working set (up to 30), 50 per personal record, and 150 for each week you hit your plan. Each level needs 100 more XP than the last (level 2 at 100, 3 at 300, 4 at 600, 5 at 1,000).',
    evidence: 'convention', sources: [],
  },
  stat_strength: {
    title: 'Strength',
    rule: 'Your best estimated one-rep max in a squat, a hinge (deadlift family) and a press, added up and divided by bodyweight (InBody weight if logged). 5× bodyweight scores 99.',
    evidence: 'convention', sources: [S.epley],
  },
  stat_endurance: {
    title: 'Endurance',
    rule: 'Working sets per week over the last 4 weeks; 50 a week scores 99. A measure of training capacity, not cardio fitness.',
    evidence: 'convention', sources: [S.schoenfeld],
  },
  stat_power: {
    title: 'Power',
    rule: 'Sessions with jumps, throws or agility work in the last 4 weeks; 8 or more scores 99. Add a sport or power focus day to train it.',
    evidence: 'convention', sources: [S.nsca],
  },
  stat_consistency: {
    title: 'Consistency',
    rule: 'Workouts done in the last 4 weeks out of what your plan asks for.',
    evidence: 'convention', sources: [],
  },
  stat_balance: {
    title: 'Balance',
    rule: 'Starts at 99 and drops for confident posture findings (12 mild, 20 moderate, 30 marked), a trunk rotation in the re-test band (15) or above it (30), and 10 for each limb with a 5%+ InBody left/right gap. A screening score, not a diagnosis.',
    evidence: 'convention', sources: [S.janda, S.bunnell],
  },
  goal_lift: {
    title: 'Lift goals',
    rule: 'A lift goal is converted to an estimated one-rep max, so any weight and rep combination counts: 95 kg × 3 (about 104.5 kg) meets "100 kg × 1". Progress runs from your best when you set the goal.',
    evidence: 'moderate', sources: [S.epley],
  },
  goal_body: {
    title: 'Body goals',
    rule: 'Body goals are tracked against your InBody results, from the value when you set the goal to the target. Body composition changes slowly; weeks, not days.',
    evidence: 'convention', sources: [],
  },
  goal_pace: {
    title: 'Pace',
    rule: 'Compares your progress with a straight line from the day you set the goal to its deadline. Within 10 percentage points of that line is on track.',
    evidence: 'convention', sources: [],
  },
  consistency: {
    title: 'Consistency',
    rule: 'Workouts done this week compared with the days your plan asks for. Showing up consistently matters more than any single session.',
    evidence: 'convention', sources: [],
  },
} as const satisfies Record<string, WhyEntry>

export type WhyCode = keyof typeof WHY

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  convention: 'Coaching convention',
}
