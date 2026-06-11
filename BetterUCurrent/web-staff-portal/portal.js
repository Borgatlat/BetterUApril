/**
 * BetterU School Staff Portal — standalone browser app (NOT part of Expo).
 * Copy this folder to your website; configure config.js from config.example.js.
 */
(function () {
  const cfg = window.BETTERU_PORTAL_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    document.body.innerHTML =
      '<div class="shell"><div class="card"><h2>Setup required</h2><p>Copy <code>config.example.js</code> to <code>config.js</code> and add your Supabase URL + anon key.</p></div></div>';
    return;
  }

  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const $ = (id) => document.getElementById(id);
  const state = {
    profile: null,
    orgId: null,
    activePanel: "dashboard",
    inviteToken: new URLSearchParams(window.location.search).get("invite"),
  };

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function setError(el, msg) {
    el.textContent = msg || "";
    show(el, Boolean(msg));
  }

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, account_type, org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data || !["counselor", "admin"].includes(data.account_type)) {
      throw new Error("This portal is for counselor and admin accounts only.");
    }
    if (!data.org_id) throw new Error("Your profile has no school (org_id). Ask your admin to link you.");

    state.profile = data;
    state.orgId = data.org_id;
    return data;
  }

  async function tryAcceptInvite() {
    if (!state.inviteToken) return;
    const { data, error } = await supabase.rpc("accept_school_staff_invite", {
      p_token: state.inviteToken,
    });
    if (error) throw error;
    $("invite-banner").textContent = `Invite accepted. You are now ${data.role} for ${data.org_id}.`;
    show($("invite-banner"), true);
    window.history.replaceState({}, "", window.location.pathname);
    state.inviteToken = null;
    await loadProfile();
  }

  // --- Login ---
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setError($("login-error"), "");
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError($("login-error"), error.message);
      return;
    }
    await enterApp();
  });

  $("logout-btn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    show($("login-screen"), true);
    show($("app-screen"), false);
  });

  async function enterApp() {
    try {
      await tryAcceptInvite();
      await loadProfile();
    } catch (err) {
      await supabase.auth.signOut();
      setError($("login-error"), err.message || String(err));
      show($("login-screen"), true);
      show($("app-screen"), false);
      return;
    }

    $("staff-name").textContent = state.profile.full_name || state.profile.email;
    $("staff-org").textContent = `${cfg.schoolDisplayName || state.orgId} · ${state.orgId}`;
    show($("login-screen"), false);
    show($("app-screen"), true);
    await refreshActivePanel();
  }

  // --- Nav ---
  document.querySelectorAll("[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activePanel = btn.dataset.panel;
      document.querySelectorAll("[data-panel]").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".panel").forEach((p) => show(p, p.id === `panel-${state.activePanel}`));
      refreshActivePanel();
    });
  });

  async function refreshActivePanel() {
    if (!state.orgId) return;
    const loaders = {
      dashboard: loadDashboard,
      triage: loadTriage,
      alerts: loadAlerts,
      exports: () => {},
      invites: loadInvites,
      roster: loadRoster,
      parents: () => {},
      pilot: loadPilotReport,
    };
    await loaders[state.activePanel]?.();
  }

  $("refresh-btn").addEventListener("click", refreshActivePanel);

  // --- Dashboard ---
  async function loadDashboard() {
    const { data, error } = await supabase.rpc("get_org_pulse_sentinel", { p_org_id: state.orgId });
    if (error) {
      $("dashboard-metrics").innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }
    const m = data || {};
    $("dashboard-metrics").innerHTML = `
      <div class="metrics">
        <div class="metric"><div class="muted">7-day pulse sample</div><div class="value">${m.sample_size_7d ?? "—"}</div></div>
        <div class="metric"><div class="muted">Avg mood</div><div class="value">${fmt(m.mood_avg_7d)}</div></div>
        <div class="metric"><div class="muted">Avg stress</div><div class="value">${fmt(m.stress_avg_7d)}</div></div>
        <div class="metric"><div class="muted">Avg sleep</div><div class="value">${fmt(m.sleep_avg_7d)}</div></div>
        <div class="metric"><div class="muted">Open alerts</div><div class="value">${m.open_alerts_count ?? "—"}</div></div>
        <div class="metric"><div class="muted">Stress spike</div><div class="value">${m.stress_spike_warning ? "Yes" : "No"}</div></div>
      </div>
      <p class="muted" style="margin-top:12px">Aggregated, de-identified cohort metrics. Individual student rows are not shown here.</p>
    `;
  }

  function fmt(n) {
    if (n == null) return "—";
    return Number(n).toFixed(1);
  }

  // --- Triage ---
  async function loadTriage() {
    const { data, error } = await supabase.rpc("staff_list_triage_queue", { p_org_id: state.orgId });
    if (error) {
      $("triage-body").innerHTML = `<tr><td colspan="6" class="error">${error.message}</td></tr>`;
      return;
    }
    const rows = data || [];
    if (!rows.length) {
      $("triage-body").innerHTML = `<tr><td colspan="6" class="muted">No triage tickets.</td></tr>`;
      return;
    }
    $("triage-body").innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td><span class="badge ${r.risk_tier}">${r.risk_tier}</span></td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td>${esc(r.student_full_name || "Student")}<br><span class="muted">${esc(r.student_email || "")}</span></td>
        <td>${esc(r.trigger_reason || "—")}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td>
          ${r.status === "pending" ? `<button class="secondary" data-assign="${r.id}">Assign</button>` : ""}
          ${r.status !== "resolved" ? `<button class="secondary" data-resolve="${r.id}">Resolve</button>` : ""}
        </td>
      </tr>`,
      )
      .join("");

    $("triage-body").querySelectorAll("[data-assign]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await supabase
          .from("counselor_triage_queue")
          .update({ status: "assigned", assigned_counselor_id: state.profile.id })
          .eq("id", btn.dataset.assign);
        loadTriage();
      });
    });
    $("triage-body").querySelectorAll("[data-resolve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await supabase
          .from("counselor_triage_queue")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", btn.dataset.resolve);
        loadTriage();
      });
    });
  }

  // --- Alerts ---
  async function loadAlerts() {
    const { data, error } = await supabase
      .from("counselor_alerts")
      .select("id, student_name, student_email, status, created_at")
      .eq("org_id", state.orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      $("alerts-body").innerHTML = `<tr><td colspan="4" class="error">${error.message}</td></tr>`;
      return;
    }
    const rows = data || [];
    $("alerts-body").innerHTML = rows.length
      ? rows
          .map(
            (r) => `
        <tr>
          <td>${esc(r.student_name || "Student")}</td>
          <td>${esc(r.student_email || "")}</td>
          <td>${esc(r.status)}</td>
          <td>${fmtDate(r.created_at)}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="muted">No counselor alerts.</td></tr>`;
  }

  // --- Exports ---
  $("export-json-btn").addEventListener("click", async () => {
    const [sentinel, wellness, spiritual] = await Promise.all([
      supabase.rpc("get_org_pulse_sentinel", { p_org_id: state.orgId }),
      supabase.rpc("get_anonymized_weekly_trends", { p_org_id: state.orgId, p_weeks_back: 12 }),
      supabase.rpc("get_anonymized_weekly_spiritual_trends", { p_org_id: state.orgId, p_weeks_back: 12 }),
    ]);
    const payload = {
      generated_at: new Date().toISOString(),
      org_id: state.orgId,
      school_name: cfg.schoolDisplayName || state.orgId,
      sentinel: sentinel.data,
      wellness_cohorts: wellness.data,
      spiritual_cohorts: spiritual.data,
      ferpa_notice:
        "Aggregated, de-identified cohort data only. Cohorts under k-anon floor may be suppressed.",
    };
    downloadJson(`betteru-board-export-${state.orgId}.json`, payload);
  });

  $("export-csv-btn").addEventListener("click", async () => {
    const { data } = await supabase.rpc("get_anonymized_weekly_trends", {
      p_org_id: state.orgId,
      p_weeks_back: 12,
    });
    const rows = data || [];
    const header = ["week_start", "grade_level", "avg_mood", "avg_stress", "avg_sleep", "sample_size"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push(
        [r.week_start, r.grade_level, r.avg_mood, r.avg_stress, r.avg_sleep, r.sample_size]
          .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
    });
    downloadText(`betteru-wellness-trends-${state.orgId}.csv`, lines.join("\n"));
  });

  // --- Invites ---
  $("invite-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setError($("invite-error"), "");
    const email = $("invite-email").value.trim();
    const role = $("invite-role").value;
    const { data, error } = await supabase.rpc("create_school_staff_invite", {
      p_org_id: state.orgId,
      p_email: email,
      p_role: role,
    });
    if (error) {
      setError($("invite-error"), error.message);
      return;
    }
    const link = `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
    $("invite-result").innerHTML = `<p class="success">Invite created. Share this link with <strong>${esc(email)}</strong>:</p><p><code>${esc(link)}</code></p>`;
    $("invite-email").value = "";
    loadInvites();
  });

  async function loadInvites() {
    const { data, error } = await supabase.rpc("list_school_staff_invites", { p_org_id: state.orgId });
    if (error) {
      $("invites-body").innerHTML = `<tr><td colspan="4" class="error">${error.message}</td></tr>`;
      return;
    }
    const rows = data || [];
    $("invites-body").innerHTML = rows.length
      ? rows
          .map((r) => {
            const link = `${window.location.origin}${window.location.pathname}?invite=${r.token}`;
            const status = r.accepted_at ? "Accepted" : new Date(r.expires_at) < new Date() ? "Expired" : "Pending";
            return `<tr>
              <td>${esc(r.email)}</td>
              <td>${esc(r.role)}</td>
              <td>${status}</td>
              <td><code style="font-size:11px">${esc(link)}</code></td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="4" class="muted">No invites yet.</td></tr>`;
  }

  // --- 30-day pilot report ---
  async function loadPilotReport() {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const [sentinel, triage, alerts, jsn] = await Promise.all([
      supabase.rpc("get_org_pulse_sentinel", { p_org_id: state.orgId }),
      supabase.from("counselor_triage_queue").select("id, status, risk_tier, created_at").eq("org_id", state.orgId).gte("created_at", sinceIso),
      supabase.from("counselor_alerts").select("id, status, created_at").eq("org_id", state.orgId).gte("created_at", sinceIso),
      supabase.rpc("get_jsn_accreditation_metrics", { p_org_id: state.orgId, p_academic_year_start: null }),
    ]);

    const triageRows = triage.data || [];
    const alertRows = alerts.data || [];
    const m = sentinel.data || {};
    const jsnData = (jsn.data && jsn.data[0]) || {};

    const report = `
BetterU — 30-Day School Pilot Report
School: ${cfg.schoolDisplayName || state.orgId} (${state.orgId})
Generated: ${new Date().toLocaleString()}
Reporting window: last 30 days

── Engagement (aggregated) ──
• Students submitting daily pulse (7-day sample): ${m.sample_size_7d ?? "n/a"}
• 7-day average mood: ${fmt(m.mood_avg_7d)} | stress: ${fmt(m.stress_avg_7d)} | sleep: ${fmt(m.sleep_avg_7d)}
• Systemic stress spike flagged: ${m.stress_spike_warning ? "YES — review recommended" : "No"}

── Counselor workflow ──
• Triage tickets filed (30d): ${triageRows.length}
• Pending: ${triageRows.filter((t) => t.status === "pending").length}
• Resolved: ${triageRows.filter((t) => t.status === "resolved").length}
• Counselor alerts (30d): ${alertRows.length}

── Formation / accreditation (if enabled) ──
• JSN enrolled count: ${jsnData.enrolled_students ?? "n/a"}
• Communal service hours (YTD): ${jsnData.total_communal_service_hours ?? "n/a"}
• Daily examen adoption %: ${jsnData.daily_examen_adoption_pct ?? "n/a"}

── FERPA ──
This report uses aggregated cohort metrics. No individual student journal text is included.

── Recommendation ──
${m.sample_size_7d >= 5 ? "Sufficient pulse adoption to review trends with leadership." : "Increase student onboarding — pulse sample is still low."}
`;

    $("pilot-report-print").textContent = report.trim();
  }

  $("print-pilot-btn").addEventListener("click", () => window.print());

  // --- Roster ---
  function parseRosterCsv(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, full_name, grade_level] = line.split(",").map((c) => c.trim());
        return { email, full_name, grade_level };
      })
      .filter((r) => r.email && r.email.includes("@"));
  }

  async function loadRoster() {
    const { data, error } = await supabase.rpc("list_school_roster", { p_org_id: state.orgId });
    if (error) {
      $("roster-body").innerHTML = `<tr><td colspan="4" class="error">${error.message}</td></tr>`;
      return;
    }
    const rows = data || [];
    $("roster-body").innerHTML = rows.length
      ? rows
          .map(
            (r) => `<tr>
              <td>${esc(r.email)}</td>
              <td>${esc(r.full_name || "—")}</td>
              <td>${esc(r.grade_level || "—")}</td>
              <td>${r.enrolled_at ? "Yes" : "Pending"}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="4" class="muted">No roster rows yet.</td></tr>`;
  }

  $("roster-import-btn").addEventListener("click", async () => {
    setError($("roster-error"), "");
    const rows = parseRosterCsv($("roster-csv").value);
    if (!rows.length) {
      setError($("roster-error"), "Paste at least one valid email row.");
      return;
    }
    const { data, error } = await supabase.rpc("import_school_roster_batch", {
      p_org_id: state.orgId,
      p_rows: rows,
    });
    if (error) {
      setError($("roster-error"), error.message);
      return;
    }
    $("roster-result").textContent = `Imported ${data?.processed ?? rows.length} row(s).`;
    $("roster-csv").value = "";
    loadRoster();
  });

  // --- Parent links ---
  $("parent-link-btn").addEventListener("click", async () => {
    setError($("parent-error"), "");
    const email = $("parent-email").value.trim();
    const studentId = $("parent-student-id").value.trim();
    const { data, error } = await supabase.rpc("link_parent_to_student", {
      p_org_id: state.orgId,
      p_parent_email: email,
      p_student_id: studentId,
    });
    if (error) {
      setError($("parent-error"), error.message);
      return;
    }
    $("parent-result").textContent = `Linked ${data.parent_email} to student. Parent signs in with that email in the app.`;
    $("parent-email").value = "";
    $("parent-student-id").value = "";
  });

  // --- Helpers ---
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  }

  function downloadJson(filename, obj) {
    downloadText(filename, JSON.stringify(obj, null, 2));
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // --- Boot ---
  (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) await enterApp();
    else show($("login-screen"), true);
  })();
})();
