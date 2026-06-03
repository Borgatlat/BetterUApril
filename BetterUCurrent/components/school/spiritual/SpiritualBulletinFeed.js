import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from "react-native";
import {
  moderateBulletinPost,
  insertSpiritualBulletinPost,
} from "../../../lib/spiritualSchoolClient";
import { SectionEmptyHint } from "./sectionEmptyHint";
import { spiritualTheme } from "./spiritualTheme";
import { formatBulletinKind } from "./formatBulletinKind";
import { SpiritualPrimaryButton } from "./SpiritualPrimaryButton";

/** Student-facing bulletin; staff sees moderation controls via `canModerate`. */
export function SpiritualBulletinFeed({ posts, readonly, onRefresh, canModerate }) {
  const [busyId, setBusyId] = useState(null);

  const moderate = async (id, decision) => {
    setBusyId(id);
    try {
      await moderateBulletinPost(id, decision === "approve" ? "approved" : "rejected");
      await onRefresh?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Bulletin board</Text>
      <Text style={styles.lead}>
        {canModerate && !readonly
          ? "Pending posts from students at your school — approve or reject."
          : "Community board for prayer asks and ministry announcements (approved posts only)."}
      </Text>
      {(!posts || posts.length === 0) ? (
        <SectionEmptyHint
          icon="megaphone-outline"
          title={canModerate && !readonly ? "No pending bulletin posts" : "No approved posts yet"}
          subtitle={
            canModerate && !readonly
              ? "Student submissions will queue here."
              : "Be the first to ask for prayers or post an event — staff reviews before it goes live."
          }
        />
      ) : (
        posts.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.kind}>{formatBulletinKind(p.kind)}</Text>
            <Text style={styles.body}>{p.body}</Text>
            {p.starts_at ? (
              <Text style={styles.date}>Starts: {new Date(p.starts_at).toLocaleString()}</Text>
            ) : null}
            {readonly ? null : (
              <>
                <Text style={styles.status}>Moderation: {p.moderation_status}</Text>
                {canModerate && p.moderation_status === "pending" ? (
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.ap} disabled={busyId === p.id} onPress={() => moderate(p.id, "approve")}>
                      {busyId === p.id ? (
                        <ActivityIndicator color={spiritualTheme.success} />
                      ) : (
                        <Text style={styles.apT}>Approve</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rx} disabled={busyId === p.id} onPress={() => moderate(p.id, "reject")}>
                      <Text style={styles.rxT}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ))
      )}
    </View>
  );
}

/** Composer for intention requests / event notices (student). */
export function SpiritualBulletinComposer({ orgId, orgReady = true, onPosted }) {
  const [kind, setKind] = useState("intention_request");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const locked = !orgReady || !orgId;

  const post = async () => {
    if (locked || !body.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await insertSpiritualBulletinPost({ orgId, kind, body });
      setBody("");
      setMsg("Submitted for review.");
      await onPosted?.();
    } catch (e) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const flip = (v) => setKind(v ? "event_notice" : "intention_request");

  return (
    <View style={[styles.wrap, { marginTop: 12 }]}>
      <Text style={styles.compTitle}>Ask for prayers or announce an event</Text>
      {locked ? (
        <Text style={styles.lock}>School link needed to post.</Text>
      ) : null}
      <View style={[styles.swRow, locked && styles.dim]}>
        <Text style={styles.swLabel}>This is an event notice (not a prayer request)</Text>
        <Switch value={kind === "event_notice"} onValueChange={flip} disabled={locked} />
      </View>
      <TextInput
        style={[styles.ta, locked && styles.taOff]}
        placeholder="Your message…"
        placeholderTextColor={spiritualTheme.placeholder}
        value={body}
        onChangeText={setBody}
        multiline
        editable={!locked}
      />
      <SpiritualPrimaryButton
        label="Submit for staff review"
        disabledLabel="Submit (needs school link)"
        onPress={post}
        disabled={locked}
        loading={busy}
      />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  h2: { color: spiritualTheme.accent, fontWeight: "800", fontSize: 17 },
  lead: { color: spiritualTheme.sub, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  kind: { color: spiritualTheme.subMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  body: { color: spiritualTheme.sub, marginTop: 6, fontSize: 14, lineHeight: 20 },
  date: { color: spiritualTheme.subMuted, fontSize: 12, marginTop: 6 },
  status: { color: "#c9a962", fontSize: 12, marginTop: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  ap: {
    flex: 1,
    padding: 10,
    backgroundColor: "rgba(0,255,150,0.15)",
    borderRadius: 8,
    alignItems: "center",
  },
  apT: { color: "#7fdfa3", fontWeight: "700" },
  rx: {
    flex: 1,
    padding: 10,
    backgroundColor: "rgba(255,80,80,0.12)",
    borderRadius: 8,
    alignItems: "center",
  },
  rxT: { color: "#f99", fontWeight: "700" },
  compTitle: { color: spiritualTheme.text, fontWeight: "700", fontSize: 15 },
  lock: { color: spiritualTheme.lockBanner, fontSize: 12, fontWeight: "600", marginBottom: 8 },
  dim: { opacity: 0.55 },
  swRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  swLabel: { flex: 1, color: spiritualTheme.sub, fontSize: 13 },
  ta: {
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  taOff: { opacity: 0.55 },
  msg: { fontSize: 13, color: spiritualTheme.sub, lineHeight: 18 },
});
