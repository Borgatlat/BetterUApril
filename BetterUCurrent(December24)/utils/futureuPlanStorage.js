import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from './scheduledWorkoutHelpers';

/** Versioned key so we can migrate stored shape later without clashes. */
export const FUTUREU_PLAN_STORAGE_KEY = 'futureu_plan_artifact_v1';

/** Saved snapshots whenever a new plan is generated in Future U (not on checklist-only updates). */
export const FUTUREU_PLANS_HISTORY_KEY = 'futureu_plans_history_v1';

const MAX_HISTORY = 40;

/**
 * Persists the full plan object (including checklist completion) for Home + Future U.
 * @param {Record<string, unknown>} plan
 * @param {{ appendHistory?: boolean }} [options] — set appendHistory true when a new plan comes from the AI (Future U).
 */
export async function saveFutureuPlanArtifact(plan, options = {}) {
  const { appendHistory = false } = options;
  if (!plan || typeof plan !== 'object') return;
  const payload = {
    ...plan,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(FUTUREU_PLAN_STORAGE_KEY, JSON.stringify(payload));
  if (appendHistory) {
    await appendFutureuPlanHistoryEntry(payload);
  }
}

async function appendFutureuPlanHistoryEntry(planSnapshot) {
  const raw = await AsyncStorage.getItem(FUTUREU_PLANS_HISTORY_KEY);
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  const id = `fp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const entry = {
    id,
    savedAt: typeof planSnapshot.savedAt === 'string' ? planSnapshot.savedAt : new Date().toISOString(),
    plan: JSON.parse(JSON.stringify(planSnapshot)),
  };
  list.unshift(entry);
  while (list.length > MAX_HISTORY) list.pop();
  await AsyncStorage.setItem(FUTUREU_PLANS_HISTORY_KEY, JSON.stringify(list));
}

/**
 * If history is empty but the user already has an active plan (older app versions), copy it once into history.
 */
export async function ensureFutureuPlansHistorySeeded() {
  const raw = await AsyncStorage.getItem(FUTUREU_PLANS_HISTORY_KEY);
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  if (list.length > 0) return;
  const active = await loadFutureuPlanArtifact();
  if (!active || typeof active !== 'object') return;
  const id = `seed_${Date.now()}`;
  list.unshift({
    id,
    savedAt: active.savedAt || new Date().toISOString(),
    plan: JSON.parse(JSON.stringify(active)),
  });
  await AsyncStorage.setItem(FUTUREU_PLANS_HISTORY_KEY, JSON.stringify(list));
}

/**
 * @returns {Promise<Array<{ id: string, savedAt: string, plan: Record<string, unknown> }>>}
 */
export async function loadFutureuPlansHistory() {
  await ensureFutureuPlansHistorySeeded();
  const raw = await AsyncStorage.getItem(FUTUREU_PLANS_HISTORY_KEY);
  try {
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e) => e && e.id && e.plan) : [];
  } catch {
    return [];
  }
}

/**
 * Replace active artifact with a plan from history (does not add a history row).
 * @param {{ plan: Record<string, unknown> }} entry
 */
export async function setActiveFutureuPlanFromHistory(entry) {
  if (!entry?.plan || typeof entry.plan !== 'object') return false;
  await saveFutureuPlanArtifact(entry.plan, { appendHistory: false });
  return true;
}

/**
 * @param {string} id
 */
export async function removeFutureuPlanHistoryEntry(id) {
  const raw = await AsyncStorage.getItem(FUTUREU_PLANS_HISTORY_KEY);
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  const next = list.filter((e) => e && e.id !== id);
  await AsyncStorage.setItem(FUTUREU_PLANS_HISTORY_KEY, JSON.stringify(next));
}

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadFutureuPlanArtifact() {
  const raw = await AsyncStorage.getItem(FUTUREU_PLAN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Toggle one checklist item by id; returns updated plan or null.
 * @param {string} itemId
 * @param {boolean} completed
 */
export async function updateFutureuPlanChecklistItem(itemId, completed) {
  const plan = await loadFutureuPlanArtifact();
  if (!plan || !Array.isArray(plan.checklist)) return null;
  const next = {
    ...plan,
    checklist: plan.checklist.map((c) =>
      String(c.id) === String(itemId) ? { ...c, completed: !!completed } : c
    ),
  };
  await saveFutureuPlanArtifact(next, { appendHistory: false });
  return next;
}

export async function clearFutureuPlanArtifact() {
  await AsyncStorage.removeItem(FUTUREU_PLAN_STORAGE_KEY);
}

/**
 * Maps Future U checklist items onto real calendar days for the weekly planner.
 *
 * `plan.savedAt` (ISO string) defines **day 1** of the plan in the user's local calendar.
 * Each checklist `due_day` is 1-based (first day = 1), matching PLAN_JSON from Future U.
 *
 * If you changed `savedAt` semantics later, this mapping would shift — keep it tied to when
 * the plan artifact was saved.
 *
 * @param {Record<string, unknown>|null|undefined} plan
 * @returns {Record<string, Array<Record<string, unknown>>>} keys = YYYY-MM-DD (local)
 */
export function getFutureuChecklistByLocalDate(plan) {
  /** @type {Record<string, Array<Record<string, unknown>>>} */
  const byDate = {};
  if (!plan || typeof plan !== 'object') return byDate;
  const checklist = Array.isArray(plan.checklist) ? plan.checklist : [];
  if (checklist.length === 0) return byDate;

  const savedAt = plan.savedAt;
  if (typeof savedAt !== 'string') return byDate;
  const parsed = new Date(savedAt);
  if (Number.isNaN(parsed.getTime())) return byDate;

  // Local calendar anchor: "plan starts on the calendar date when it was saved"
  const planStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());

  for (const raw of checklist) {
    const item = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
    const due = Number(item.due_day);
    if (!Number.isFinite(due) || due < 1) continue;
    const d = new Date(planStart);
    d.setDate(d.getDate() + (due - 1));
    const key = getLocalDateString(d);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(item);
  }
  return byDate;
}
