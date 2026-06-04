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
- Keep the visible Markdown body brief: at most 8–12 short sentences, plus 2–3 bullets if helpful.
- At most two ## headings in the body.
- Still output valid PLAN_JSON and TASKS_JSON. Use 2–4 milestones and 3–5 checklist items.
- End with 1–3 precise follow-up questions; mention you will refine the plan after they answer.
`;
  }
  return `
Response depth: DETAILED
- Full professional structure with clear ## headings and concrete steps.
- PLAN_JSON may include up to 12 checklist items.
- End with tailored follow-up questions and implementation intentions.
`;
}

const TASKS_JSON_RULE = `
At the very end of your reply, after all sections, add exactly one final line (no text after it):
TASKS_JSON: ["task 1", "task 2", "task 3", "task 4", "task 5"]
Use 3-5 short, actionable tasks for this week. Do not put TASKS_JSON elsewhere.
`;

const PLAN_JSON_RULE = `
After your main answer (before TASKS_JSON), include exactly one line starting with PLAN_JSON: followed by one JSON object:
{
  "plan_title": "short title",
  "goal": "user goal text",
  "timeframe_days": 90,
  "persona": { "name": "...", "why_match": "must explain constraint match", "credential_check": "one line: how this person matches primary_target" },
  "milestones": [{ "id": "m1", "title": "...", "start_day": 1, "end_day": 30, "success_criteria": "..." }],
  "checklist": [{ "id": "c1", "text": "...", "due_day": 7, "priority": "high", "completed": false }],
  "risks": ["optional"],
  "final_thoughts": "short string",
  "implementation_intentions": {
    "summary": "when + where + first action",
    "questions_for_user": ["tailored logistics questions"],
    "suggested_if_then": [{ "if": "...", "then": "..." }],
    "user_commitments": []
  }
}
Rules:
- timeframe_days must equal USER_CONTEXT_JSON.timeframe_days when provided.
- persona.why_match MUST reference goal_constraints when present (e.g. Harvard tie, not a different school).
- If no suitable real person exists, say so in the body and use GENERAL-style milestones instead of inventing a mismatch.
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
Address the user by name at least once.
Tone: professional, warm, direct, and specific—like an excellent college counselor or executive coach. No emojis.
Give actionable next steps and tie recommendations to BetterU (daily tasks, tracking, workouts, mental sessions, community).
No harmful, illegal, or guaranteed outcomes. Mark uncertain facts as uncertain.
If the goal is vague, ask focused follow-ups before picking a role model.
Use Markdown (## headings, **bold**).
${CONSTRAINT_RULES}
${PLAN_JSON_RULE}
${TASKS_JSON_RULE}
`;

const FUTUREU_ROLE_MODEL_PROMPT = `
Mode: role_model
- Select ONE real person whose documented path matches USER_CONTEXT_JSON.goal and goal_constraints.
- Explain their timeline, decisions, and habits; translate into the user's timeframe_days and hours_per_week.
- If goal_constraints exists and no fitting person is known with confidence, state that openly and offer 2–3 clarifying questions OR suggest switching to a general path—never substitute a mismatched celebrity.

Output (DETAILED depth):
1) ## Role model & why they fit (include credential_check)
2) ## Their path (3–7 milestones)
3) ## What to copy (skills, habits, decisions)
4) ## Your timed plan (aligned to timeframe_days)
5) ## BetterU integration (tasks, tracking, mental sessions)
6) ## Implementation intentions
7) Brief clarifying questions if needed
`;

const FUTUREU_GENERAL_PROMPT = `
Mode: general_path
- No single hero: synthesize the typical high-performing path for this goal.
- Use evidence-based milestones (skills, credentials, portfolio, network, consistency).
- Still personalize to timeframe_days, hours_per_week, and goal_constraints (e.g. Harvard admissions criteria as a system, not one random alum).

Output (DETAILED depth):
1) ## Path overview
2) ## Milestones most people follow (3–7)
3) ## Skills & habits to build
4) ## Your timed plan
5) ## BetterU integration
6) ## Implementation intentions
7) Clarifying questions if the goal is still ambiguous
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
