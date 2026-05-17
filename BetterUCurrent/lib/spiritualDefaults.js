/**
 * Static defaults and URL helpers for the school spiritual tab (no DB I/O).
 */

/**
 * Builds the USCCB daily Mass readings page for a given local Date.
 * Pattern: MMDDYY + .cfm (USCCB bible subsite).
 *
 * @param {Date} [d]
 * @returns {string}
 */
export function buildUsccbDailyReadingsUrl(d = new Date()) {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const year = `${d.getFullYear()}`.slice(-2);
  return `https://bible.usccb.org/bible/readings/${month}${day}${year}.cfm`;
}

/**
 * Starter Live the Fourth rows when campus ministry has not created org-specific prompts yet.
 * Shaped like DB rows `{ id, org_id, title, body, sort_order, _fallback?: true, _group?: 'challenges' | 'journal' }`.
 *
 * **`_group`**: optionally drives section headings in the UI (defaults only—DB prompts omit it).
 */
export function buildLiveFourthFallbackPromptRows() {
  const challenges = [
    {
      id: "fallback-l4-ch-volunteer",
      org_id: null,
      title: "Serve your community once this week",
      body: "Volunteer at your parish, soup kitchen, campus ministry project, tutoring, sports camp, or a neighbor who needs help. Aim for something concrete—not just intention. Afterwards, jot one line: Who did Christ look like today?",
      sort_order: 10,
      _fallback: true,
      _group: "challenges",
    },
    {
      id: "fallback-l4-ch-prayer",
      org_id: null,
      title: "Pray intentionally for five minutes a day",
      body: "Set a repeating alarm at the same calm spot (wake-up, chapel, bedtime). Silence your phone; speak plainly to God—or rest in silence. One honest sentence (“Thank you”, “Help me”, “I’m distracted”) counts as faithful prayer.",
      sort_order: 11,
      _fallback: true,
      _group: "challenges",
    },
    {
      id: "fallback-l4-ch-scripture",
      org_id: null,
      title: "Read one chapter of Scripture a day",
      body: "Start with Luke or John—or Psalms and Proverbs—or the daily readings linked in Spiritual life. Don’t hunt for mysteries—listen for one word or phrase God highlights. Carry that phrase between classes.",
      sort_order: 12,
      _fallback: true,
      _group: "challenges",
    },
    {
      id: "fallback-l4-ch-accountability",
      org_id: null,
      title: "Stay accountable with a friend each week",
      body: "Text or meet a trusted friend weekly: How’s prayer going? Any slip or win? Cheer each other’s faith under grace—not gossip. BetterU Accountability Partners or retreat friends both work.",
      sort_order: 13,
      _fallback: true,
      _group: "challenges",
    },
  ];

  const journal = [
    {
      id: "fallback-l4-jn-retreat",
      org_id: null,
      title: "Journal — after retreat, what lingered?",
      body: "What moment, talk, hymn, confession, line of scripture, or quiet hour actually stayed with you? Name it without polishing. What question is God still circling?",
      sort_order: 110,
      _fallback: true,
      _group: "journal",
    },
    {
      id: "fallback-l4-jn-implement",
      org_id: null,
      title: "Journal — bringing retreat home tomorrow",
      body: "Pick one concrete habit—not five—that you’ll try Monday through Friday (prayer alarm, Mass or chapel weekly, apology to someone, bedtime examen). Where might temptation trip you?",
      sort_order: 111,
      _fallback: true,
      _group: "journal",
    },
    {
      id: "fallback-l4-jn-gratitude",
      org_id: null,
      title: "Journal — where did God show generosity today?",
      body: "List three specifics: people, sacraments, health, forgiven sin—even small glimpses train you to notice Providence.",
      sort_order: 112,
      _fallback: true,
      _group: "journal",
    },
    {
      id: "fallback-l4-jn-consolation",
      org_id: null,
      title: "Journal — consolation and desolation (Ignatian check-in)",
      body: "When today felt fuller of faith, hope, love—even briefly? Where dryness, resentment, isolation, old habits surfaced? Invite Jesus into both without pretending everything is fixed tonight.",
      sort_order: 113,
      _fallback: true,
      _group: "journal",
    },
    {
      id: "fallback-l4-jn-relationships",
      org_id: null,
      title: "Journal — Christ in classmates and teammates",
      body: "Who needs patience or an apology from you? Who has carried you quietly? Pause and pray—even one minute—for them by name.",
      sort_order: 114,
      _fallback: true,
      _group: "journal",
    },
    {
      id: "fallback-l4-jn-purpose",
      org_id: null,
      title: "Journal — gifts and vocation right now",
      body: "Studies, sports, art, friendships, hurts—nothing is spiritually neutral right now. How might God weave these strands into holiness this semester—not “when I finally have it together”?",
      sort_order: 115,
      _fallback: true,
      _group: "journal",
    },
    {
      id: "fallback-l4-jn-distraction",
      org_id: null,
      title: "Journal — what replaced God lately?",
      body: "Screens, ego, resentment, avoidance? Name one calmly—mercy isn’t amnesia. What tiny boundary might loosen that grip this week?",
      sort_order: 116,
      _fallback: true,
      _group: "journal",
    },
  ];

  return [...challenges, ...journal];
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} dbRows From `live_the_fourth_prompts`
 * @param {string | null | undefined} orgId Current org slug
 */
export function mergeLiveFourthPromptsWithFallback(dbRows, orgId) {
  const rows = Array.isArray(dbRows) ? [...dbRows] : [];
  const fallbacks = buildLiveFourthFallbackPromptRows();
  const sharedOrGlobal = rows.filter((r) => r.org_id == null || r.org_id === undefined);

  // Student not linked to a school yet: still show starter Live the Fourth rhythms.
  if (!orgId) {
    const merged = [...fallbacks, ...sharedOrGlobal];
    merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return merged;
  }

  const schoolBuilt = rows.filter((r) => r.org_id === orgId);
  if (schoolBuilt.length > 0) {
    rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return rows;
  }

  const merged = [...fallbacks, ...sharedOrGlobal];
  merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return merged;
}

// --- Weekly “one challenge + one journal” rotation (Spiritual · Live the Fourth modal) ---

/** @param {number} n @param {number} m positive m */
function modPositive(n, m) {
  if (m <= 0) return 0;
  return ((n % m) + m) % m;
}

/** Local-calendar Monday 00:00 (deterministic week buckets for rotation). */
export function startOfLocalWeekMonday(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + delta);
  return x;
}

/** Stable integer → changes once per local Monday. */
export function getLiveFourthWeekCode(d = new Date()) {
  return Math.floor(startOfLocalWeekMonday(d).getTime() / 86400000);
}

/**
 * Human label for the week block (e.g. "Feb 3 – 9, 2026").
 * @param {Date} weekStartDate from `startOfLocalWeekMonday`
 */
export function formatLiveFourthWeekRangeLabel(weekStartDate) {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sm = start.getMonth();
  const sy = start.getFullYear();
  const em = end.getMonth();
  const ey = end.getFullYear();
  const om = new Intl.DateTimeFormat(undefined, { month: "short" });
  const od = new Intl.DateTimeFormat(undefined, { day: "numeric" });
  if (sy === ey && sm === em) {
    return `${om.format(start)} ${od.format(start)}–${od.format(end)}, ${sy}`;
  }
  return `${om.format(start)} ${od.format(start)}, ${sy} – ${om.format(end)} ${od.format(end)}, ${ey}`;
}

/**
 * Splits prompts into weekly rotation pools:
 * Uses `_group` on defaults; plain school rows (`live_the_fourth_prompts`) are split midpoint (single row → challenge slot; journal defaults fill in).
 * @returns {{ challenges: Record<string, unknown>[], journals: Record<string, unknown>[] }}
 */
export function resolveLiveFourthWeeklyPools(rows) {
  const fb = buildLiveFourthFallbackPromptRows();
  const fbC = fb.filter((r) => r._group === "challenges");
  const fbJ = fb.filter((r) => r._group === "journal");
  const sorted = [...(rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  let challenges = sorted.filter((r) => r._group === "challenges");
  let journals = sorted.filter((r) => r._group === "journal");
  const noGroup = sorted.filter(
    (r) => r._group !== "challenges" && r._group !== "journal",
  );

  if (noGroup.length === 1) {
    challenges = [...challenges, noGroup[0]];
  } else if (noGroup.length > 1) {
    const mid = Math.ceil(noGroup.length / 2);
    challenges = challenges.concat(noGroup.slice(0, mid));
    journals = journals.concat(noGroup.slice(mid));
  }

  return {
    challenges: challenges.length ? challenges : fbC,
    journals: journals.length ? journals : fbJ,
  };
}

/**
 * Deterministic picks for **one** challenge row and **one** journal row based on calendar week.
 * @param {Array<Record<string, unknown>>} rows merged prompts (fallback + campus)
 * @param {Date} [anchorDate=new Date()]
 */
export function pickLiveFourthWeekFocus(rows, anchorDate = new Date()) {
  const pools = resolveLiveFourthWeeklyPools(rows);
  const weekCode = getLiveFourthWeekCode(anchorDate);
  /** Large primes stir indices so neighboring weeks don’t move in lock-step. */
  const ci = modPositive(Number(weekCode) * 2654435761, pools.challenges.length);
  const ji = modPositive(Number(weekCode) * 1597334677 + 7, pools.journals.length);
  const weekStarts = startOfLocalWeekMonday(anchorDate);

  return {
    weekStarts,
    weekRangeLabel: formatLiveFourthWeekRangeLabel(weekStarts),
    weekCode,
    challenge: pools.challenges[ci] ?? null,
    journal: pools.journals[ji] ?? null,
  };
}

