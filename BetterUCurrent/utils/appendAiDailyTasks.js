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
 * Also tries ```json code fences when the model ignores PLAN_JSON: prefix.
 * @param {string} text
 * @returns {{ plan: (Record<string, unknown>|null), stripped: string }}
 */
function extractPlanObject(text) {
  const key = 'PLAN_JSON:';
  const idx = text.indexOf(key);
  if (idx !== -1) {
    let start = idx + key.length;
    while (start < text.length && /\s/.test(text[start])) start += 1;
    if (text[start] === '{') {
      const parsed = parseBalancedJsonObject(text, start);
      if (parsed) {
        const stripped = `${text.slice(0, idx)}${text.slice(parsed.end)}`.trim();
        return { plan: parsed.value, stripped };
      }
    }
  }

  // Fallback: fenced ```json { "plan_title": ... } ```
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?"plan_title"[\s\S]*?\})\s*```/i);
  if (fenceMatch) {
    try {
      const plan = JSON.parse(fenceMatch[1]);
      const stripped = text.replace(fenceMatch[0], '').trim();
      return { plan, stripped };
    } catch {
      /* continue */
    }
  }

  return { plan: null, stripped: text };
}

/** @returns {{ value: Record<string, unknown>, end: number } | null} */
function parseBalancedJsonObject(text, start) {
  if (text[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const value = JSON.parse(text.slice(start, i + 1));
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            return { value, end: i + 1 };
          }
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractTasksArray(text) {
  const tasks = [];
  const regex = /TASKS_JSON:\s*(\[[\s\S]*?\])/gi;
  let match = regex.exec(text);
  while (match) {
    try {
      const arr = JSON.parse(match[1]);
      if (Array.isArray(arr)) {
        arr.forEach((s) => {
          const t = String(s).trim();
          if (t) tasks.push(t);
        });
      }
    } catch {
      /* skip bad block */
    }
    match = regex.exec(text);
  }
  return [...new Set(tasks)].slice(0, 8);
}

/** Removes machine blocks and tidies Markdown for chat display. */
export function formatAssistantDisplayText(text) {
  let out = String(text || '').trim();
  out = out.replace(/```(?:json)?\s*\{[\s\S]*?"plan_title"[\s\S]*?\}\s*```/gi, '');
  out = out.replace(/PLAN_JSON:\s*\{[\s\S]*?\}(?=\s*(TASKS_JSON:|$))/gi, '');
  out = out.replace(/TASKS_JSON:\s*\[[\s\S]*?\]/gi, '');
  out = out.replace(/USER_CONTEXT_JSON:\s*\{[\s\S]*?\}/gi, '');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

/**
 * Short intro when the interactive plan card is shown — strips duplicate bullet/checklist sections
 * so users read the summary once and use the tappable plan card for steps.
 * @param {string} text
 */
export function formatPlanMessageIntro(text) {
  let out = formatAssistantDisplayText(text);
  const lines = out.split('\n');
  const kept = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^#{1,3}\s/.test(trimmed) && /checklist|action plan|action items|steps|this week|to-?dos?|milestones|your plan|week 1/i.test(trimmed)) {
      i += 1;
      while (i < lines.length && !/^#{1,3}\s/.test(lines[i].trim())) i += 1;
      continue;
    }

    const isBullet = /^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
    if (isBullet) {
      let j = i;
      while (
        j < lines.length &&
        (/^\s*[-*•]\s+/.test(lines[j]) ||
          /^\s*\d+\.\s+/.test(lines[j]) ||
          lines[j].trim() === '')
      ) {
        j += 1;
      }
      if (j - i >= 2) {
        i = j;
        continue;
      }
    }

    kept.push(line);
    i += 1;
  }

  out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (out.length > 900) {
    out = `${out.slice(0, 900).trim()}…`;
  }
  return out;
}

/**
 * When the model fails PLAN_JSON, build a minimal plan from tasks + goal so UI still works.
 * @param {{ goal?: string, timeframeDays?: number, tasks?: string[], displayText?: string }} params
 */
export function buildFallbackPlan({ goal, timeframeDays = 90, tasks = [], displayText = '' }) {
  const checklist = (tasks.length > 0 ? tasks : extractBulletActions(displayText))
    .slice(0, 8)
    .map((text, i) => ({
      id: `c${i + 1}`,
      text: String(text).trim(),
      due_day: Math.min(Math.max(1, i + 1), 14),
      priority: i < 2 ? 'high' : 'medium',
      completed: false,
    }))
    .filter((c) => c.text);

  if (checklist.length === 0) return null;

  return normalizePlan({
    plan_title: String(goal || 'Your path').slice(0, 72),
    goal: goal || '',
    timeframe_days: timeframeDays,
    milestones: [
      {
        id: 'm1',
        title: 'Week 1 — start',
        start_day: 1,
        end_day: 7,
        success_criteria: 'Complete first checklist items',
      },
      {
        id: 'm2',
        title: 'Build momentum',
        start_day: 8,
        end_day: Math.min(30, timeframeDays),
        success_criteria: 'Stay consistent with weekly hours',
      },
    ],
    checklist,
    final_thoughts: 'Tap checklist items as you finish. Add steps to Daily Tasks to track today.',
  });
}

function extractBulletActions(markdown) {
  const lines = String(markdown || '').split('\n');
  const bullets = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*•]\s+(.+)/);
    if (m && m[1].length > 8 && m[1].length < 140) bullets.push(m[1].trim());
  }
  return bullets.slice(0, 6);
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
  let tasks = extractTasksArray(working);
  working = working.replace(/TASKS_JSON:\s*\[[\s\S]*?\]/gi, '').trim();

  const { plan: rawPlan, stripped } = extractPlanObject(working);
  let plan = normalizePlan(rawPlan);

  let displayText = formatAssistantDisplayText(stripped);

  if (plan && tasks.length === 0 && Array.isArray(plan.checklist)) {
    tasks = plan.checklist
      .map((c) => String(c.text || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  if (!plan && tasks.length > 0) {
    plan = buildFallbackPlan({ tasks, displayText });
  }

  return { displayText, tasks, plan };
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
