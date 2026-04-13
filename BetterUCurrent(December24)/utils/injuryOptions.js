/**
 * Shared injury options and avoid-terms for filtering exercises.
 * Used by workout.js (filter logic) and InjuryModal (UI options).
 */

export const INJURY_AVOID_TERMS = {
  ACL: ['quad', 'knee', 'leg', 'hamstring', 'glute', 'calf', 'lunge', 'squat', 'deadlift', 'hip thrust', 'step-up', 'bulgarian', 'leg press', 'leg curl', 'romanian deadlift', 'good morning'],
  Knee: ['quad', 'knee', 'leg', 'hamstring', 'glute', 'calf', 'lunge', 'squat', 'deadlift', 'hip thrust', 'step-up', 'bulgarian', 'leg press', 'leg curl', 'romanian deadlift', 'good morning'],
  LowerBack: ['back', 'spine', 'deadlift', 'good morning', 'hyperextension', 'romanian deadlift', 'stiff-leg', 'back extension', 'reverse hyper'],
  Shoulder: ['shoulder', 'delt', 'press', 'overhead', 'lateral raise', 'front raise', 'arnold', 'military press', 'push press', 'clean and press', 'snatch'],
  Neck: ['neck', 'trap', 'shrug', 'trapezius'],
  Wrist: ['wrist', 'wrist curl', 'wrist extension', 'grip'],
  Elbow: ['elbow', 'tricep', 'bicep', 'curl', 'tricep extension', 'skull crusher', 'close-grip', 'pushdown'],
  Hip: ['hip', 'glute', 'hip thrust', 'glute bridge', 'abduction', 'adductor', 'lateral lunge', 'crossover', 'fire hydrant'],
  Chest: ['chest', 'pec', 'bench', 'fly', 'flye', 'push-up', 'dip', 'incline', 'decline', 'chest press'],
  Hamstring: ['hamstring', 'leg curl', 'romanian deadlift', 'good morning', 'stiff-leg', 'nordic curl'],
  Groin: ['groin', 'adductor', 'inner thigh', 'sumo', 'crossover'],
  Calf: ['calf', 'calves', 'standing calf', 'seated calf'],
};

export const injuredMusclesOptions = [
  { id: 'ACL', label: 'ACL / Knee', avoidTerms: INJURY_AVOID_TERMS.ACL },
  { id: 'Knee', label: 'Knee', avoidTerms: INJURY_AVOID_TERMS.Knee },
  { id: 'LowerBack', label: 'Lower Back', avoidTerms: INJURY_AVOID_TERMS.LowerBack },
  { id: 'Shoulder', label: 'Shoulder', avoidTerms: INJURY_AVOID_TERMS.Shoulder },
  { id: 'Neck', label: 'Neck', avoidTerms: INJURY_AVOID_TERMS.Neck },
  { id: 'Wrist', label: 'Wrist', avoidTerms: INJURY_AVOID_TERMS.Wrist },
  { id: 'Elbow', label: 'Elbow', avoidTerms: INJURY_AVOID_TERMS.Elbow },
  { id: 'Hip', label: 'Hip', avoidTerms: INJURY_AVOID_TERMS.Hip },
  { id: 'Chest', label: 'Chest / Pectoral', avoidTerms: INJURY_AVOID_TERMS.Chest },
  { id: 'Hamstring', label: 'Hamstring', avoidTerms: INJURY_AVOID_TERMS.Hamstring },
  { id: 'Groin', label: 'Groin', avoidTerms: INJURY_AVOID_TERMS.Groin },
  { id: 'Calf', label: 'Calf', avoidTerms: INJURY_AVOID_TERMS.Calf },
];
