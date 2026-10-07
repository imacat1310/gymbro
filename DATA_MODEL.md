# Data Model

## Entity overview

```
User ─┬─ Profile (goal, intensity, experience, limitations)
      ├─ Gym ── GymEquipment ── Equipment
      ├─ PostureScan ── PostureFinding
      ├─ Plan ── PlanWeek ── PlanDay ── PlannedExercise
      ├─ Session ── SessionExercise ── SetLog ── FormAnalysis
      └─ ExerciseProgress (per exercise: e1RM, working weight)

Exercise ── ExerciseEquipmentRequirement ── Equipment
Exercise ── ExerciseMuscle ── Muscle
Exercise ── FormRuleSet
```

## Core tables

### Reference data (curated, versioned)
```sql
equipment (
  id text primary key,            -- 'barbell', 'adjustable_bench', 'cable_stack', 'smith_machine'
  name text, category text,       -- free_weight | machine | cable | cardio | accessory | bodyweight_station
  attributes_schema jsonb         -- e.g. dumbbells: {min_kg, max_kg, increment}
)

muscle (
  id text primary key,            -- 'glute_med', 'lower_trap', 'rear_delt', ...
  name text, region text          -- upper | lower | core
)

exercise (
  id text primary key,            -- 'barbell_back_squat'
  name text,
  movement_pattern text,          -- squat | hinge | h_push | v_push | h_pull | v_pull | lunge | carry | core | isolation
  mechanics text,                 -- compound | isolation
  laterality text,                -- bilateral | unilateral
  difficulty int,                 -- 1–5
  contraindications text[],       -- 'lumbar_flexion_sensitive', 'shoulder_impingement'
  demo_media_url text,
  cues text[],
  pose_trackable bool             -- supports form check
)

exercise_equipment_requirement (
  exercise_id, requirement_group int, equipment_id
  -- AND within a group, OR across groups:
  -- bench press = {group1: barbell + flat_bench + rack} OR {group2: smith_machine + flat_bench}
)

exercise_muscle (exercise_id, muscle_id, role)   -- role: primary | secondary | stabilizer
```

### User data
```sql
profile (
  user_id, birth_year, sex, height_cm, weight_kg,
  experience text,                -- beginner | intermediate | advanced
  goal text,                      -- hypertrophy | strength | fat_loss | general | athletic
  intensity text,                 -- easy | moderate | hard | max
  days_per_week int, session_minutes int,
  limitations jsonb,              -- [{area:'lower_back', type:'pain', severity:2}]
  units text                      -- kg | lb
)

gym (id, user_id, name, is_default)
gym_equipment (gym_id, equipment_id, attributes jsonb, source text, confidence real)
  -- source: scan | manual | preset

posture_scan (id, user_id, taken_at, views jsonb, landmarks jsonb, media_retained bool)
posture_finding (
  id, scan_id,
  code text,                      -- 'forward_head', 'rounded_shoulders', 'shoulder_elevation_left', 'anterior_pelvic_tilt', ...
  metric_value real, unit text,   -- e.g. craniovertebral angle 44°
  severity text,                  -- none | mild | moderate | marked
  confidence real,
  side text                       -- left | right | bilateral | null
)
```

### Plan
```sql
plan (id, user_id, gym_id, goal, intensity, split text, weeks int, status, generated_by_version, rationale text)
plan_day (id, plan_id, week int, day_index int, focus text)   -- 'Upper A', 'Lower B'
planned_exercise (
  id, plan_day_id, order int, exercise_id,
  sets int, rep_min int, rep_max int, target_rpe real, rest_sec int,
  tempo text,                     -- '3-1-1-0'
  reason_code text                -- 'goal_primary' | 'corrective:rounded_shoulders' | 'weak_point:glute_med'
)
```

### Session tracking
```sql
session (id, user_id, plan_day_id null, gym_id, started_at, ended_at, total_volume_kg, notes)
session_exercise (id, session_id, exercise_id, order)
set_log (
  id, session_exercise_id, set_index,
  set_type text,                  -- warmup | working | drop | failure | amrap
  weight_kg real, reps int, rpe real null, rir int null,
  duration_sec int, rest_before_sec int,
  rep_source text,                -- manual | pose_counted
  completed_at timestamptz
)
form_analysis (
  id, set_log_id, video_local_uri, video_remote_path null,
  form_score int,                 -- 0–100
  faults jsonb,                   -- [{code:'knee_valgus', rep:[3,4,5], severity:'moderate'}]
  rep_metrics jsonb,              -- per rep: depth, tempo, bar path deviation
  feedback_text text
)
exercise_progress (user_id, exercise_id, e1rm_kg, working_weight_kg, last_progressed_at, stall_count int)
```

## Sync strategy
- The client is the source of truth for sessions in progress (IndexedDB via Dexie).
- Each row gets a `client_uuid` and `updated_at`; last-write-wins per row; set logs are append-only.
