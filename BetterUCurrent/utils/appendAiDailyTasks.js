import AsyncStorage from '@react-native-async-storage/async-storage';

/** Must match `app/(modals)/DailyTasks.js`. */
export const DAILY_TASKS_STORAGE_KEY = 'daily_tasks';
export const DAILY_CUSTOM_TASKS_KEY = 'daily_custom_tasks';

const DEFAULT_TASKS = [
  { id: 'workout', label: 'Complete a workout', icon: 'fitness', completed: false },
  { id: 'mental', label: 'Do a mental session', icon: 'heart', completed: false },
  { id: 'friend', label: 'Talk to a friend', icon: 'people', completed: false },
  { id: 'forgive', label: 'Forgive someone', icon: 'hand-left', completed: false },
  { id: 'gratitude', label: 'Practice gratitude', icon: 'sunny', completed: false },
  { id: 'water', label: 'Drink enough water', icon: 'water', completed: false },
];

/**
 * Finds PLAN_JSON: { ... } using brace counting so nested objects parse reliably.
 * @param {string} text
 * @returns {{ plan: (Record<string, unknown>|null), stripped: string }}
 */
function extractPlanObject(text) {
  const key = 'PLAN_JSON:';
  const idx = text.indexOf(key);
  if (idx === -1) return { plan: null, stripped: text };
  let start = idx + key.length;
  while (start < text.length && /\s/.test(text[start])) start += 1;
  if (text[start] !== '{') return { plan: null, stripped: text };
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const plan = JSON.parse(text.slice(start, i + 1));
          const stripped = `${text.slice(0, idx)}${text.slice(i + 1)}`.trim();
          return { plan, stripped };
        } catch {
          return { plan: null, stripped: text };
        }
      }
    }
  }
  return { plan: null, stripped: text };
}

/**
 * @param {unknown} plan
 * @returns {Record<string, unknown>|null}
 */
function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  const copy = /** @type {Record<string, unknown>} */ ({ ...plan });
  if (Array.isArray(copy.checklist)) {
    copy.checklist = copy.checklist.map((item, i) => {
      const o = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
      const rec = /** @type {Record<string, unknown>} */ (o);
      return {
        id: rec.id != null ? String(rec.id) : `c${i}`,
        text: String(rec.text ?? '').trim(),
        due_day: typeof rec.due_day === 'number' ? rec.due_day : Number(rec.due_day) || 0,
        priority: ['low', 'medium', 'high'].includes(String(rec.priority))
          ? rec.priority
          : 'medium',
        completed: !!rec.completed,
      };
    });
  }
  const ii = copy.implementation_intentions;
  if (ii && typeof ii === 'object' && !Array.isArray(ii)) {
    const raw = /** @type {Record<string, unknown>} */ (ii);
    const qs = Array.isArray(raw.questions_for_user)
      ? raw.questions_for_user.map((q) => String(q).trim()).filter(Boolean)
      : [];
    const pairs = Array.isArray(raw.suggested_if_then)
      ? raw.suggested_if_then
          .map((p) => {
            const o = p && typeof p === 'object' && !Array.isArray(p) ? p : {};
            const rec = /** @type {Record<string, unknown>} */ (o);
            const iff = String(rec.if ?? '').trim();
            const then = String(rec.then ?? '').trim();
            if (!iff && !then) return null;
            return { if: iff, then: then };
          })
          .filter(Boolean)
      : [];
    const uc = Array.isArray(raw.user_commitments)
      ? raw.user_commitments.map((s) => String(s).trim()).filter(Boolean)
      : [];
    copy.implementation_intentions = {
      summary: String(raw.summary ?? '').trim(),
      questions_for_user: qs,
      suggested_if_then: pairs,
      user_commitments: uc,
    };
  }
  return copy;
}

/**
 * Strips TASKS_JSON (last line) and PLAN_JSON from the model reply; returns display text + tasks + plan.
 * @param {string} fullText
 * @returns {{ displayText: string, tasks: string[], plan: (Record<string, unknown>|null) }}
 */
export function extractPlanTasksAndDisplayText(fullText) {
  let working = String(fullText || '').trim();
  let tasks = [];

  const tasksMatch = working.match(/TASKS_JSON:\s*(\[[\s\S]*?\])\s*$/);
  if (tasksMatch) {
    try {
      const arr = JSON.parse(tasksMatch[1]);
      if (Array.isArray(arr)) {
        tasks = arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
      }
    } catch {
      tasks = [];
    }
    working = working.slice(0, tasksMatch.index).trim();
  }

  const { plan: rawPlan, stripped } = extractPlanObject(working);
  const plan = normalizePlan(rawPlan);
  return { displayText: stripped.trim(), tasks, plan };
}

/**
 * Backward-compatible: same as extractPlanTasksAndDisplayText but omits plan.
 * @param {string} fullText
 * @returns {{ displayText: string, tasks: string[] }}
 */
export function extractTasksAndDisplayText(fullText) {
  const { displayText, tasks } = extractPlanTasksAndDisplayText(fullText);
  return { displayText, tasks };
}

async function loadOrBuildTodaySnapshot() {
  const today = new Date().toDateString();
  const storedRaw = await AsyncStorage.getItem(DAILY_TASKS_STORAGE_KEY);
  if (storedRaw) {
    try {
      const data = JSON.parse(storedRaw);
      if (data.date === today && Array.isArray(data.tasks)) {
        return {
          date: today,
          tasks: data.tasks,
          awardedTaskIds: Array.isArray(data.awardedTaskIds) ? data.awardedTaskIds : [],
        };
      }
    } catch {
      /* rebuild */
    }
  }

  const templatesRaw = await AsyncStorage.getItem(DAILY_CUSTOM_TASKS_KEY);
  let templates = [];
  try {
    templates = templatesRaw ? JSON.parse(templatesRaw) : [];
    if (!Array.isArray(templates)) templates = [];
  } catch {
    templates = [];
  }

  const baseTasks = DEFAULT_TASKS.map((t) => ({ ...t, completed: false }));
  const customFromTemplates = templates.map((template) => ({
    ...template,
    completed: false,
    custom: true,
  }));

  return {
    date: today,
    tasks: [...baseTasks, ...customFromTemplates],
    awardedTaskIds: [],
  };
}

/**
 * @param {string[]} labels
 * @returns {{ added: number, skipped: number }}
 */
export async function appendAiDailyTasks(labels) {
  const cleaned = [...new Set((labels || []).map((s) => String(s).trim()).filter(Boolean))];
  if (cleaned.length === 0) return { added: 0, skipped: 0 };

  const snapshot = await loadOrBuildTodaySnapshot();
  const existing = new Set(
    snapshot.tasks.map((t) => String(t.label || '').trim().toLowerCase()).filter(Boolean)
  );

  const templatesRaw = await AsyncStorage.getItem(DAILY_CUSTOM_TASKS_KEY);
  let templates = [];
  try {
    templates = templatesRaw ? JSON.parse(templatesRaw) : [];
    if (!Array.isArray(templates)) templates = [];
  } catch {
    templates = [];
  }

  let added = 0;
  let skipped = 0;
  const icon = 'add-outline';

  for (let i = 0; i < cleaned.length; i += 1) {
    const label = cleaned[i];
    const key = label.toLowerCase();
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    const id = `custom_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    snapshot.tasks.push({
      id,
      label,
      icon,
      completed: false,
      custom: true,
    });
    templates.push({ id, label, icon });
    existing.add(key);
    added += 1;
  }

  await AsyncStorage.setItem(
    DAILY_TASKS_STORAGE_KEY,
    JSON.stringify({
      date: snapshot.date,
      tasks: snapshot.tasks,
      awardedTaskIds: snapshot.awardedTaskIds,
    })
  );
  await AsyncStorage.setItem(DAILY_CUSTOM_TASKS_KEY, JSON.stringify(templates));

  return { added, skipped };
}
