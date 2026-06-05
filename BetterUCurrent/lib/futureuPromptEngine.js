/**
 * Future U — prompts, constraint matching, and role-model hints.
 * Keeps Futureuai.js focused on UI + API calls.
 */

export const PROMPT_MODE = {
  SPECIFIC: "specific",
  GENERAL: "general",
};

export const RESPONSE_DEPTH = {
  QUICK: "quick",
  DETAILED: "detailed",
};

export const MODE_OPTIONS = [
  {
    id: PROMPT_MODE.SPECIFIC,
    label: "Role model",
    description: "One real person who achieved your goal",
  },
  {
    id: PROMPT_MODE.GENERAL,
    label: "General path",
    description: "Typical milestones & habits (no single hero)",
  },
];

/** Keyword → vetted guidance so the model does not swap Harvard for Princeton, etc. */
const TARGET_HINTS = [
  {
    keywords: ["harvard", "harvard university", "get into harvard", "harvard admission", "harvard college"],
    primary_target: "Harvard University (admission or attendance)",
    must_align_with: [
      "Person must have a documented Harvard tie (attended Harvard College, Harvard graduate school relevant to goal, Harvard faculty, or official Harvard admissions story).",
    ],
    do_not_substitute: [
      "Princeton-only alumni",
      "Yale-only alumni",
      "Stanford-only paths",
      "Generic Ivy League example with no Harvard connection",
    ],
    example_angles: [
      "Harvard-specific extracurricular + academic profile for the user's intended major",
      "Transfer or non-traditional Harvard admit if constraints match",
    ],
  },
  {
    keywords: ["princeton", "princeton university"],
    primary_target: "Princeton University",
    must_align_with: ["Documented Princeton attendance or Princeton-specific admissions path"],
    do_not_substitute: ["Harvard-only", "Yale-only", "Random elite school"],
    example_angles: ["Princeton-specific campus resources and applicant profile"],
  },
  {
    keywords: ["yale", "yale university"],
    primary_target: "Yale University",
    must_align_with: ["Documented Yale tie"],
    do_not_substitute: ["Harvard-only", "Princeton-only"],
    example_angles: ["Yale-specific student journey"],
  },
  {
    keywords: ["mit", "massachusetts institute"],
    primary_target: "MIT",
    must_align_with: ["Documented MIT tie (student, alum, or faculty relevant to goal)"],
    do_not_substitute: ["Caltech-only", "Stanford-only", "Generic tech founder with no MIT link"],
    example_angles: ["MIT course rigor, UROP, maker culture as applicable"],
  },
  {
    keywords: ["stanford", "stanford university"],
    primary_target: "Stanford University",
    must_align_with: ["Documented Stanford tie"],
    do_not_substitute: ["MIT-only", "Berkeley-only unless user asked for comparison"],
    example_angles: ["Stanford-specific ecosystem for user's field"],
  },
  {
    keywords: ["medical school", "pre-med", "premed", "become a doctor", "physician"],
    primary_target: "Physician / medical training path",
    must_align_with: ["Person with credible MD or DO training path relevant to user's constraints"],
    do_not_substitute: ["Random celebrity with no medical training"],
    example_angles: ["MCAT timeline, clinical hours, residency match realities"],
  },
  {
    keywords: ["registered nurse", "become a nurse", "nursing school", "rn "],
    primary_target: "Registered nurse career path",
    must_align_with: ["Licensed RN or NP path with realistic NCLEX / program steps"],
    do_not_substitute: ["Physician-only story unless user pivoted from nursing"],
    example_angles: ["ADN vs BSN, clinical rotations, first hospital role"],
  },
  {
    keywords: ["software engineer", "software engineering", "coding career", "developer job"],
    primary_target: "Software engineering career",
    must_align_with: ["Engineer with verifiable SWE career arc (portfolio, internships, promotions)"],
    do_not_substitute: ["Unrelated influencer with no engineering career"],
    example_angles: ["Projects, internships, system design prep, first job ladder"],
  },
  {
    keywords: ["founder", "startup", "start a company", "entrepreneur"],
    primary_target: "Entrepreneurship / startup path",
    must_align_with: ["Founder with documented company-building arc in a related domain"],
    do_not_substitute: ["Employee-only career with no founding story"],
    example_angles: ["Validation, MVP, fundraising or bootstrapping as appropriate"],
  },
  {
    keywords: ["navy seal", "seal team", "special forces", "military officer"],
    primary_target: "Military / special operations path (as stated)",
    must_align_with: ["Verified military or SOF career path"],
    do_not_substitute: ["Civilian athlete with no service record"],
    example_angles: ["Training pipeline, standards, recovery, leadership under stress"],
  },
  {
    keywords: ["professional athlete", "nba", "nfl", "olympic", "division 1", "d1 "],
    primary_target: "Elite athletic performance path",
    must_align_with: ["Athlete in the same sport or clearly analogous pipeline"],
    do_not_substitute: ["Different sport hero unless user asked for mindset only—then say so explicitly"],
    example_angles: ["Training periodization, recruiting, injury management"],
  },
];

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect explicit targets in the user message for constraint injection.
 * @param {string} userMessage
 * @returns {object | null}
 */
export function extractGoalConstraints(userMessage) {
  const text = normalizeText(userMessage);
  if (!text) return null;

  for (const hint of TARGET_HINTS) {
    if (hint.keywords.some((kw) => text.includes(kw))) {
      return {
        primary_target: hint.primary_target,
        must_align_with: hint.must_align_with,
        do_not_substitute: hint.do_not_substitute,
        example_angles: hint.example_angles,
        matched_keywords: hint.keywords.filter((kw) => text.includes(kw)),
      };
    }
  }

  return null;
}

function getResponseDepthBlock(depth) {
  if (depth === RESPONSE_DEPTH.QUICK) {
    return `
Response depth: QUICK
- Visible Markdown: max 250 words. Use exactly these ## headings when relevant: "Summary", "This week", "Next step".
- Use short bullet lists (max 5 bullets total in the body). No long paragraphs.
- Still output valid PLAN_JSON (3–5 checklist items, 2 milestones) and TASKS_JSON (3–5 tasks).
`;
  }
  return `
Response depth: DETAILED
- Visible Markdown: max 450 words. Use ## headings with blank lines between sections.
- Summarize in Markdown; put the full step-by-step checklist ONLY inside PLAN_JSON (do not duplicate long lists in Markdown).
- PLAN_JSON: 6–12 checklist items with due_day spread across timeframe_days; 3–5 milestones.
`;
}

const TASKS_JSON_RULE = `
MACHINE OUTPUT (required every reply — user never sees this block if formatted correctly):
1) After your Markdown, on a new line: PLAN_JSON: then one JSON object (no code fence).
2) On the next line: TASKS_JSON: ["task for this week", ...] with 3–5 strings.
3) Nothing after TASKS_JSON. No extra commentary.
TASKS_JSON tasks must match the first week of PLAN_JSON.checklist (same wording).
`;

const PLAN_JSON_RULE = `
PLAN_JSON object shape (all fields required unless noted):
{
  "plan_title": "short title",
  "goal": "user goal text",
  "timeframe_days": 90,
  "persona": { "name": "...", "why_match": "...", "credential_check": "..." },
  "milestones": [{ "id": "m1", "title": "...", "start_day": 1, "end_day": 30, "success_criteria": "..." }],
  "checklist": [{ "id": "c1", "text": "specific action starting with a verb", "due_day": 1, "priority": "high", "completed": false }],
  "risks": ["optional"],
  "final_thoughts": "one encouraging sentence",
  "implementation_intentions": {
    "summary": "when + where + first action",
    "questions_for_user": ["1–3 logistics questions"],
    "suggested_if_then": [{ "if": "...", "then": "..." }],
    "user_commitments": []
  }
}
Checklist rules: each "text" is one concrete action (under 120 chars). due_day is 1-based from plan start. Spread items across the timeline — not all due_day 1.
timeframe_days must equal USER_CONTEXT_JSON.timeframe_days when provided.
`;

const CONSTRAINT_RULES = `
CONSTRAINT MATCHING (non-negotiable)
- Read USER_CONTEXT_JSON.goal_constraints when present. The role model MUST satisfy must_align_with and MUST NOT be primarily known for do_not_substitute.
- If the user names an institution (Harvard, MIT, a team, license, rank): the exemplar must match that target. Never answer "Harvard" with a Princeton-only biography.
- If you are unsure the person fits, ask a clarifying question OR switch to honest composite guidance—do not guess a famous name from a adjacent field.
- In persona.credential_check, state the specific link (e.g. "Harvard College Class of 2014" or "Admitted to Harvard after gap year").
- Prefer well-documented public figures; if uncertain, label uncertainty explicitly.
`;

const FUTUREU_BASE_RULES = `
You are Future U, a world-class pathfinding coach inside the BetterU app.
Address the user by name once in the Markdown summary.
Tone: professional, warm, direct. No emojis. No walls of text.
The app renders PLAN_JSON as an interactive checklist card — keep Markdown as a readable summary only.
Give actionable next steps and tie recommendations to BetterU (daily tasks, workouts, mental sessions, community).
No harmful, illegal, or guaranteed outcomes. Mark uncertain facts as uncertain.
Use Markdown: ## for section titles, blank line before each heading, - for bullets. Never use # (h1).
${CONSTRAINT_RULES}
${PLAN_JSON_RULE}
${TASKS_JSON_RULE}
`;

const FUTUREU_ROLE_MODEL_PROMPT = `
Mode: role_model
- Select ONE real person whose documented path matches USER_CONTEXT_JSON.goal and goal_constraints.
- Explain their timeline, decisions, and habits; translate into the user's timeframe_days and hours_per_week.
- If goal_constraints exists and no fitting person is known with confidence, state that openly and offer 2–3 clarifying questions OR suggest switching to a general path—never substitute a mismatched celebrity.

Output Markdown sections (keep brief):
1) ## Summary — who/what path fits and why (2–4 sentences)
2) ## This week — 3–5 bullets max (concrete actions)
3) ## Next step — single clearest action for today
4) Optional: ## Questions — up to 2 follow-ups if goal is ambiguous
Do NOT repeat the full checklist here — it lives in PLAN_JSON only.
`;

const FUTUREU_GENERAL_PROMPT = `
Mode: general_path
- No single hero: synthesize the typical high-performing path for this goal.
- Use evidence-based milestones (skills, credentials, portfolio, network, consistency).
- Still personalize to timeframe_days, hours_per_week, and goal_constraints (e.g. Harvard admissions criteria as a system, not one random alum).

Output Markdown sections (keep brief):
1) ## Path overview — 2–4 sentences
2) ## This week — 3–5 bullets max
3) ## Next step — single action for today
4) Optional: ## Questions — up to 2 follow-ups if needed
Full milestones and checklist go ONLY in PLAN_JSON.
`;

function buildConstraintsBlock(constraints) {
  if (!constraints) return "goal_constraints: null (infer carefully from user_message; do not invent mismatched schools or titles).";
  return `goal_constraints: ${JSON.stringify(constraints)}`;
}

/**
 * @param {string} displayName
 * @param {string} mode — PROMPT_MODE.SPECIFIC | GENERAL
 * @param {string} responseDepth
 * @param {object | null} goalConstraints — from extractGoalConstraints
 */
export function buildSystemPrompt(
  displayName,
  mode,
  responseDepth = RESPONSE_DEPTH.DETAILED,
  goalConstraints = null,
) {
  const userName = (displayName && String(displayName).trim()) || "friend";
  const modePrompt =
    mode === PROMPT_MODE.SPECIFIC ? FUTUREU_ROLE_MODEL_PROMPT : FUTUREU_GENERAL_PROMPT;
  const depthBlock = getResponseDepthBlock(responseDepth);
  const constraintsBlock = buildConstraintsBlock(goalConstraints);
  return `${FUTUREU_BASE_RULES}\n\n${depthBlock}\n\nThe user's preferred name is "${userName}".\n\n${constraintsBlock}\n\n${modePrompt}`;
}

/**
 * Payload appended as the final user turn for the model.
 */
export function buildUserContextPayload({
  goal,
  timeframeDays,
  hoursPerWeek,
  userMessage,
  responseDepth,
  userTurnIndex,
  promptMode,
  goalConstraints,
}) {
  return {
    goal: (goal && String(goal).trim()) || userMessage,
    timeframe_days: timeframeDays,
    hours_per_week: hoursPerWeek,
    user_message: userMessage,
    response_depth: responseDepth,
    user_turn_index: userTurnIndex,
    path_mode: promptMode === PROMPT_MODE.SPECIFIC ? "role_model" : "general_path",
    goal_constraints: goalConstraints,
  };
}
