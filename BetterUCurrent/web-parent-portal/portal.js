(function () {
  const cfg = window.BETTERU_PORTAL_CONFIG;
  if (!cfg?.supabaseUrl) {
    document.body.innerHTML = "<p>Copy config.example.js to config.js</p>";
    return;
  }
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const $ = (id) => document.getElementById(id);

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: $("login-email").value.trim(),
      password: $("login-password").value,
    });
    if (error) {
      $("login-error").textContent = error.message;
      $("login-error").classList.remove("hidden");
      return;
    }
    await enter();
  });

  $("logout-btn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  async function enter() {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email, account_type")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .maybeSingle();
    if (prof?.account_type !== "parent") {
      $("login-error").textContent = "Parent account required. Ask your school to link your email.";
      $("login-error").classList.remove("hidden");
      await supabase.auth.signOut();
      return;
    }
    $("parent-name").textContent = prof.full_name || prof.email;
    $("login-screen").classList.add("hidden");
    $("app-screen").classList.remove("hidden");
    await loadStudents();
  }

  async function loadStudents() {
    const { data: students, error } = await supabase.rpc("list_parent_linked_students");
    if (error) {
      $("students-wrap").innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }
    if (!students?.length) {
      $("students-wrap").innerHTML = "<p class=\"muted\">No students linked yet.</p>";
      return;
    }
    const cards = await Promise.all(
      students.map(async (s) => {
        const { data: sum } = await supabase.rpc("get_parent_student_summary", {
          p_student_id: s.student_id,
        });
        return `<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
          <h3>${s.student_name}</h3>
          <p class="muted">${s.org_name || ""} · Grade ${s.grade_level || "—"}</p>
          <p>Service hours approved: <strong>${sum?.service_hours_approved ?? 0}</strong></p>
          <p>Pending: <strong>${sum?.service_hours_pending ?? 0}</strong></p>
          <p>Check-ins (30d): <strong>${sum?.pulse_checkins_30d ?? 0}</strong></p>
          <p>${sum?.checked_in_this_week ? "✓ Checked in this week" : "No check-in this week yet"}</p>
        </div>`;
      }),
    );
    $("students-wrap").innerHTML = cards.join("");
  }

  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await enter();
    else $("login-screen").classList.remove("hidden");
  })();
})();
