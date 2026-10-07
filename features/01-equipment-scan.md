# Feature 01: Equipment Scan → Performable Exercises

## Goal
The user walks around their gym taking photos (or a short video). GymBro identifies the equipment and returns every exercise they can perform there.

## User flow
1. "Scan your gym" → camera with tips ("capture each zone: free weights, racks, machines, cables").
2. The user takes 5–20 photos, or records a 30–60 s walkthrough video (keyframes are sampled at ~1 fps and deduplicated).
3. Processing screen (~5–15 s).
4. **Review screen:** detected equipment grouped by category with thumbnails and confidence.
   - ✅ high confidence: pre-checked
   - ❓ low confidence: "Is this a Smith machine?" (yes/no)
   - ➕ "Add missing equipment" (searchable taxonomy)
   - Attributes: dumbbell range (e.g. 2–40 kg), cable attachments, machine adjustability
5. Result: "You can perform **184 exercises** here" → browse by muscle or movement pattern.
6. Saved as a **Gym profile**; users can have several (Home, Office gym, Hotel).

## Recognition approach

### v1: Vision LLM with constrained output
- Send keyframes (batched, max ~10 images per request) to the vision LLM through an Edge Function.
- The prompt includes the **closed equipment taxonomy** (~120 IDs). The model must return only IDs from that list.
- Structured output:
```json
{
  "detections": [
    {"equipment_id": "power_rack", "confidence": 0.95, "image_refs": [2, 5], "attributes": {}},
    {"equipment_id": "dumbbells", "confidence": 0.9, "image_refs": [1], "attributes": {"min_kg": 2, "max_kg": 40}},
    {"equipment_id": "cable_crossover", "confidence": 0.6, "image_refs": [7], "attributes": {"attachments": ["rope", "straight_bar"]}}
  ],
  "unrecognized_notes": ["A plate-loaded machine, possibly a hack squat or leg press"]
}
```
- Merge across batches: take the max confidence per ID and union the attributes.
- Thresholds: ≥ 0.8 auto-check, 0.5–0.8 ask the user, < 0.5 drop.

### v2 (optional, for cost and offline use): on-device detector
- Fine-tune a YOLO-family model on collected, consented scan images (labels bootstrapped from v1 LLM output plus user corrections).
- Use the LLM only as a fallback for unknown items.

## Equipment taxonomy (excerpt)
| Category | IDs |
|---|---|
| Free weights | barbell, ez_bar, trap_bar, dumbbells, kettlebells, weight_plates |
| Racks/benches | power_rack, squat_stand, flat_bench, adjustable_bench, decline_bench, preacher_bench |
| Machines | smith_machine, leg_press, hack_squat, leg_extension, leg_curl_seated, leg_curl_lying, chest_press_machine, pec_deck, lat_pulldown, seated_row_machine, shoulder_press_machine, hip_thrust_machine, abductor_machine, calf_raise_machine, glute_kickback_machine |
| Cables | cable_crossover, single_cable_stack, functional_trainer |
| Bodyweight | pull_up_bar, dip_station, gymnastic_rings, roman_chair/ghd |
| Accessories | resistance_bands, trx, medicine_ball, ab_wheel, landmine, box |
| Cardio | treadmill, rower, bike, assault_bike, ski_erg, stair_climber |

## Exercise mapping (deterministic)
```
performable(gym) = { e ∈ Exercise | ∃ group g in requirements(e): g ⊆ equipment(gym) }
```
- Requirements use AND within a group and OR across groups (see [DATA_MODEL.md](../DATA_MODEL.md)).
- Attribute constraints: e.g. "heavy DB press" requires dumbbells.max_kg ≥ user's estimated need, otherwise flag "may be too light".
- Bodyweight exercises are always included.

## Edge cases
- The same equipment photographed multiple times → dedupe by ID (counts don't matter for v1).
- Multi-function machines (e.g. a functional trainer with a Smith attachment) → multiple IDs.
- Low light or blur → per-image quality check; ask for a retake.
- People in frame → blur faces before upload; instruct users to respect others' privacy.

## Acceptance criteria
- [ ] ≥ 90% precision / ≥ 85% recall on a 30-gym test set for top-level equipment
- [ ] Scan → review in < 20 s for 15 photos
- [ ] The user can fully correct the list manually
- [ ] Exercise count and list update live as equipment is toggled
