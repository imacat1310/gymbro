// Exercises with a form check. Kept apart from the analysers so screens can ask without loading them.

/** Free-standing squat variations the squat rules fit (machines with a fixed path are left out). */
const SQUATS = ['barbell_back_squat', 'barbell_front_squat', 'goblet_squat', 'bodyweight_squat', 'smith_squat']

export const supportsFormCheck = (exerciseId: string) => SQUATS.includes(exerciseId)
