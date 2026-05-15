/**
 * Post-run AI training plan: OpenAI JSON → optional calendar rows in `scheduled_workouts`.
 */

import { ensureApiKeyAvailable } from './apiConfig';
import { classifyRunBucket } from './classifyRunBucket';
import { addScheduledRun, addScheduledWorkout } from './scheduledWorkoutHelpers';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_PLAN_DAYS = 7;

function buildMessages({ bucket, milesRounded, distanceMeters, durationSeconds, notes }) {
  const system = `
You are a running + strength coach inside a fitness app.
Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{
  "summary": string,
  "days": [
    {
      "dayIndex": number,
      "focus": string,
      "run": { "title": string, "details": string },
      "strength": [
        { "name": string, "sets": number, "reps": string, "notes": string }
      ]
    }
  ]
}
Rules:
- The athlete bucket is FIXED by the app: "${bucket}". You MUST train for this bucket.
- Include between 4 and ${MAX_PLAN_DAYS} items in "days". dayIndex starts at 1 and increases by 1 each day.
- Each day must include BOTH "run" and "strength" (non-empty run title/details; strength array with at least 2 exercises).
- sprint: acceleration, max velocity, short reps; strength favors power + posterior chain.
- middle: speed endurance + threshold flavor; strength balanced legs.
- long: durability + aerobic support; strength favors resilience and accessories.
- Be concise. No medical diagnosis.
`.trim();

  const userPayload = {
    bucket,
    distanceMeters,
    milesRounded,
    durationSeconds: durationSeconds != null ? Number(durationSeconds) : null,
    userNotes: notes ?? '',
  };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(userPayload) },
  ];
}

/** Strip accidental markdown fences some models still emit */
function parseModelJson(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty model response');
  }
  let s = content.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(s);
}

/**
 * @param {object} opts
 * @param {number} opts.distanceMeters
 * @param {number} [opts.durationSeconds]
 * @param {string} [opts.notes]
 * @param {string} [opts.model]
 * @returns {Promise<{ bucket: string, milesRounded: number, label: string, plan: object }>}
 */
export async function generatePostRunPlanWithAI({
  distanceMeters,
  durationSeconds,
  notes,
  model = 'gpt-4o-mini',
}) {
  const apiKey = await ensureApiKeyAvailable();
  const { bucket, milesRounded, label } = classifyRunBucket(distanceMeters);

  const messages = buildMessages({
    bucket,
    milesRounded,
    distanceMeters: Number(distanceMeters) || 0,
    durationSeconds,
    notes,
  });

  const body = {
    model,
    messages,
    temperature: 0.65,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  if (!response.ok) {
    let detail = rawText;
    try {
      const errJson = JSON.parse(rawText);
      detail = errJson?.error?.message || rawText;
    } catch {
      /* use rawText */
    }
    throw new Error(detail || `OpenAI request failed (${response.status})`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON from OpenAI');
  }

  const text = data?.choices?.[0]?.message?.content;
  const plan = parseModelJson(text);

  if (!plan || typeof plan.summary !== 'string' || !Array.isArray(plan.days)) {
    throw new Error('Plan missing summary or days array');
  }

  const days = plan.days
    .filter((d) => d && typeof d.dayIndex === 'number')
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(0, MAX_PLAN_DAYS);

  if (days.length === 0) {
    throw new Error('Plan has no valid days');
  }

  return {
    bucket,
    milesRounded,
    label,
    plan: { ...plan, days },
  };
}

/**
 * Map AI strength lines to scheduled workout exercise rows (generic shape for your app).
 */
export function strengthToWorkoutExercises(strengthArr) {
  if (!Array.isArray(strengthArr)) return [];
  return strengthArr
    .filter((s) => s && (s.name || s.exercise_name))
    .map((s) => ({
      name: String(s.name || s.exercise_name || 'Exercise'),
      sets: Math.max(0, Number(s.sets) || 0),
      reps: String(s.reps ?? ''),
      notes: String(s.notes ?? ''),
    }));
}

/**
 * Schedule run + strength workout for each plan day.
 * First dayIndex maps to `startDate` (default: tomorrow so it doesn't stack on top of today's completed run).
 */
export async function applyPostRunPlanToCalendar(userId, plan, startDate) {
  if (!userId) {
    throw new Error('User id required to schedule');
  }
  const base = startDate instanceof Date ? new Date(startDate.getTime()) : new Date();
  const results = [];

  const sorted = [...(plan?.days || [])].sort((a, b) => (a.dayIndex || 0) - (b.dayIndex || 0));

  for (const day of sorted) {
    const idx = Math.max(1, Number(day.dayIndex) || 1);
    const d = new Date(base);
    d.setDate(d.getDate() + (idx - 1));

    const runTitle = String(day.run?.title || `${day.focus || 'Training'} — run`).slice(0, 200);
    const runNotes = String(day.run?.details || '').slice(0, 4000);

    const runRes = await addScheduledRun(userId, d, runTitle, runNotes || null);
    if (runRes.error) {
      throw new Error(runRes.error.message || 'Failed to schedule run');
    }
    results.push({ type: 'run', date: d, data: runRes.data });

    const workoutName = String(day.focus || 'Strength').slice(0, 120);
    const exercises = strengthToWorkoutExercises(day.strength);
    const strengthLines = exercises
      .map((e) => `${e.name}${e.sets ? ` ${e.sets}×${e.reps}` : ''}${e.notes ? ` — ${e.notes}` : ''}`)
      .join('\n');
    const workoutNotes = [plan.summary && `Plan: ${plan.summary}`, strengthLines && `Exercises:\n${strengthLines}`]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 4000);

    const workoutRes = await addScheduledWorkout(userId, d, {
      activity_type: 'workout',
      workout_name: `Legs — ${workoutName}`,
      title: `Gym — ${workoutName}`,
      notes: workoutNotes || null,
      workout_exercises: exercises,
    });
    if (workoutRes.error) {
      throw new Error(workoutRes.error.message || 'Failed to schedule workout');
    }
    results.push({ type: 'workout', date: d, data: workoutRes.data });
  }

  return results;
}
