import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  fetchPendingServiceHourLogsForStaff,
  reviewServiceHourLog,
  fetchPendingSharedIntentions,
  updateIntentionModeration,
  declineIntentionShare,
  fetchPendingBulletinPosts,
  fetchLiveFourthPrompts,
  insertOrgLiveFourthPrompt,
  deleteLiveFourthPrompt,
  fetchSpiritualCalendarEventsStaff,
  insertSpiritualCalendarEvent,
  deleteSpiritualCalendarEvent,
  fetchRetreatTracks,
  fetchRetreatTrackPrompts,
  insertOrgRetreatTrack,
  insertRetreatTrackPrompt,
} from "../../lib/spiritualSchoolClient";
import { SpiritualBulletinFeed } from "./spiritual/SpiritualBulletinFeed";

/**
 * FERPA: prayer intentions flagged anonymous show label "Anonymous"; staff still sees row id internally.
 */
export function PastoralMinistryPanel({ orgId }) {
  const [refreshing, setRefreshing] = useState(false);
  const [hours, setHours] = useState([]);
  const [intentions, setIntentions] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [l4All, setL4All] = useState([]);
  const [cal, setCal] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selTrackId, setSelTrackId] = useState(null);
  const [trackPrompts, setTrackPrompts] = useState([]);

  const [l4Title, setL4Title] = useState("");
  const [l4Body, setL4Body] = useState("");
  const [rtSlug, setRtSlug] = useState("");
  const [rtName, setRtName] = useState("");
  const [rpBody, setRpBody] = useState("");
  const [rpKind, setRpKind] = useState("journal");

  const [calTitle, setCalTitle] = useState("");
  const [calBody, setCalBody] = useState("");
  const [calKind, setCalKind] = useState("other");
  const [calStart, setCalStart] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setRefreshing(true);
    try {
      const [h, i, b, prompts, c, tr] = await Promise.all([
        fetchPendingServiceHourLogsForStaff(orgId),
        fetchPendingSharedIntentions(orgId),
        fetchPendingBulletinPosts(orgId),
        fetchLiveFourthPrompts(orgId),
        fetchSpiritualCalendarEventsStaff(orgId),
        fetchRetreatTracks(orgId),
      ]);
      setHours(h);
      setIntentions(i);
      setBulletins(b);
      setL4All(prompts);
      setCal(c);
      setTracks(tr?.filter((t) => t.org_id === orgId || t.org_id === null) ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!selTrackId) {
      setTrackPrompts([]);
      return;
    }
    (async () => {
      const p = await fetchRetreatTrackPrompts(selTrackId);
      setTrackPrompts(p);
    })();
  }, [selTrackId]);

  const orgL4 = l4All.filter((p) => p.org_id === orgId);

  const onHours = async (id, dec) => {
    await reviewServiceHourLog(id, dec);
    await load();
  };

  const onApproveIntention = async (id) => {
    await updateIntentionModeration(id, { feedApproved: true, visibleOnWall: true });
    await load();
  };

  const onDeclineIntention = async (id) => {
    await declineIntentionShare(id);
    await load();
  };

  const addL4 = async () => {
    if (!l4Title.trim() || !l4Body.trim()) return;
    await insertOrgLiveFourthPrompt({ orgId, title: l4Title, body: l4Body });
    setL4Title("");
    setL4Body("");
    await load();
  };

  const addCal = async () => {
    if (!calTitle.trim()) return;
    await insertSpiritualCalendarEvent({
      orgId,
      title: calTitle,
      body: calBody,
      kind: calKind,
      startsAtIso: calStart.toISOString(),
      endsAtIso: null,
    });
    setCalTitle("");
    setCalBody("");
    await load();
  };

  const addTrack = async () => {
    if (!rtSlug.trim() || !rtName.trim()) return;
    await insertOrgRetreatTrack({ orgId, slug: rtSlug, displayName: rtName });
    setRtSlug("");
    setRtName("");
    await load();
  };

  const addTrackPrompt = async () => {
    if (!selTrackId || !rpBody.trim()) return;
    await insertRetreatTrackPrompt({ trackId: selTrackId, kind: rpKind, body: rpBody });
    setRpBody("");
    const p = await fetchRetreatTrackPrompts(selTrackId);
    setTrackPrompts(p);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <View style={styles.heroCura}>
        <Text style={styles.heroCuraTitle}>Cura personalis</Text>
        <Text style={styles.heroCuraBody}>
          Care of the whole person — pair these publishing tools with the leadership wellness tab: retreats, prayer wall,
          Live the Fourth, and chapel rhythm help students metabolize stress with spiritual accompaniment, not hustle alone.
        </Text>
      </View>

      <Text style={styles.banner}>
        Moderation exposes limited identity fields only where legally appropriate; intentions marked
        anonymous display without student names on student devices.
      </Text>

      <Text style={styles.h2}>Pending service hours</Text>
      {hours.length === 0 ? (
        <Text style={styles.muted}>None.</Text>
      ) : (
        hours.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.strong}>{row.student_full_name}</Text>
            <Text style={styles.small}>{row.student_email}</Text>
            <Text style={styles.body}>{row.description}</Text>
            <Text style={styles.small}>Hours: {row.hours}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.ap} onPress={() => onHours(row.id, "approve")}>
                <Text style={styles.apT}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rx} onPress={() => onHours(row.id, "reject")}>
                <Text style={styles.rxT}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={styles.h2}>Shared prayer intentions (pending)</Text>
      {intentions.length === 0 ? (
        <Text style={styles.muted}>Queue empty.</Text>
      ) : (
        intentions.map((it) => (
          <View key={it.id} style={styles.card}>
            <Text style={styles.anonTag}>Anonymous request</Text>
            <Text style={styles.body}>{it.body}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.ap} onPress={() => onApproveIntention(it.id)}>
                <Text style={styles.apT}>Approve for wall</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rx} onPress={() => onDeclineIntention(it.id)}>
                <Text style={styles.rxT}>Do not publish</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={styles.h2}>Bulletin moderation</Text>
      <SpiritualBulletinFeed
        posts={bulletins}
        readonly={false}
        canModerate
        onRefresh={load}
      />

      <Text style={styles.h2}>Live the Fourth — your school prompts</Text>
      {orgL4.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.strong}>{p.title}</Text>
          <Text style={styles.body}>{p.body}</Text>
          <TouchableOpacity onPress={() => deleteLiveFourthPrompt(p.id).then(load)}>
            <Text style={styles.del}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TextInput style={styles.inp} placeholder="Title" placeholderTextColor="#555" value={l4Title} onChangeText={setL4Title} />
      <TextInput
        style={styles.ta}
        placeholder="Prompt body"
        placeholderTextColor="#555"
        value={l4Body}
        onChangeText={setL4Body}
        multiline
      />
      <TouchableOpacity style={styles.btn} onPress={addL4}>
        <Text style={styles.btnT}>Add org prompt</Text>
      </TouchableOpacity>

      <Text style={styles.h2}>Campus calendar editor</Text>
      {cal.map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={styles.strong}>{e.title}</Text>
          <Text style={styles.small}>{new Date(e.starts_at).toLocaleString()}</Text>
          <TouchableOpacity onPress={() => deleteSpiritualCalendarEvent(e.id).then(load)}>
            <Text style={styles.del}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TextInput style={styles.inp} placeholder="Event title" value={calTitle} onChangeText={setCalTitle} placeholderTextColor="#555" />
      <TextInput
        style={styles.ta}
        placeholder="Details"
        value={calBody}
        onChangeText={setCalBody}
        multiline
        placeholderTextColor="#555"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {["confession", "rosary", "mass", "other"].map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.kindChip, calKind === k && styles.kindChipOn]}
            onPress={() => setCalKind(k)}
          >
            <Text style={{ color: calKind === k ? "#000" : "#aaa", fontWeight: "700", textTransform: "capitalize" }}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.outline} onPress={() => setShowPicker(true)}>
        <Text style={styles.outTxt}>When: {calStart.toLocaleString()}</Text>
      </TouchableOpacity>
      {showPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={calStart}
          mode="datetime"
          display="default"
          onChange={(ev, d) => {
            setShowPicker(false);
            if (ev.type === "set" && d) setCalStart(d);
          }}
        />
      ) : null}
      {showPicker && Platform.OS === "ios" ? (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <DateTimePicker value={calStart} mode="datetime" display="inline" onChange={(_, d) => { if (d) setCalStart(d); }} />
              <TouchableOpacity style={styles.btn} onPress={() => setShowPicker(false)}>
                <Text style={styles.btnT}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
      <TouchableOpacity style={styles.btn} onPress={addCal}>
        <Text style={styles.btnT}>Add calendar row</Text>
      </TouchableOpacity>

      <Text style={styles.h2}>Org retreat tracks & prompts</Text>
      <TextInput style={styles.inp} placeholder="slug (kairos-followup)" value={rtSlug} onChangeText={setRtSlug} placeholderTextColor="#555" />
      <TextInput style={styles.inp} placeholder="Display name" value={rtName} onChangeText={setRtName} placeholderTextColor="#555" />
      <TouchableOpacity style={styles.btn} onPress={addTrack}>
        <Text style={styles.btnT}>Create org track</Text>
      </TouchableOpacity>
      <Text style={styles.small}>Tracks for this tenant</Text>
      {tracks.filter((t) => t.org_id === orgId).map((t) => (
        <TouchableOpacity key={t.id} style={[styles.card, selTrackId === t.id && styles.cardSel]} onPress={() => setSelTrackId(t.id)}>
          <Text style={styles.strong}>{t.display_name}</Text>
          <Text style={styles.small}>{t.slug}</Text>
        </TouchableOpacity>
      ))}
      <TextInput
        style={styles.ta}
        placeholder="Prompt for selected track…"
        value={rpBody}
        onChangeText={setRpBody}
        multiline
        placeholderTextColor="#555"
      />
      <ScrollView horizontal style={{ marginBottom: 8 }}>
        {(["challenge", "journal", "reminder"]).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.kindChip, rpKind === k && styles.kindChipOn]}
            onPress={() => setRpKind(k)}
          >
            <Text style={{ color: rpKind === k ? "#000" : "#aaa", fontWeight: "700" }}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.btn} onPress={addTrackPrompt}>
        <Text style={styles.btnT}>Add retreat prompt</Text>
      </TouchableOpacity>
      {trackPrompts.map((tp) => (
        <Text key={tp.id} style={styles.smallMuted}>
          — {tp.kind}: {tp.body}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050708" },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 72, gap: 8 },
  heroCura: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,229,0.22)",
    backgroundColor: "rgba(0,229,229,0.06)",
    padding: 14,
    marginBottom: 4,
    gap: 8,
  },
  heroCuraTitle: {
    color: "#00ffff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  heroCuraBody: { color: "#b9c9cc", fontSize: 13, lineHeight: 19 },
  banner: { backgroundColor: "rgba(255,200,120,0.08)", padding: 10, borderRadius: 10, color: "#c9b89a", fontSize: 12 },
  h2: { color: "#00ffff", fontWeight: "800", fontSize: 16, marginTop: 14 },
  muted: { color: "#666", fontSize: 13 },
  card: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginTop: 8,
  },
  cardSel: { borderColor: "#00ffff" },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  ap: { flex: 1, backgroundColor: "rgba(0,255,150,0.15)", padding: 10, borderRadius: 8, alignItems: "center" },
  apT: { color: "#8f8", fontWeight: "700" },
  rx: { flex: 1, backgroundColor: "rgba(255,80,80,0.12)", padding: 10, borderRadius: 8, alignItems: "center" },
  rxT: { color: "#f99", fontWeight: "700" },
  strong: { color: "#fff", fontWeight: "700", fontSize: 15 },
  body: { color: "#c5cdd1", marginTop: 6, fontSize: 14 },
  small: { color: "#7a8490", marginTop: 4, fontSize: 12 },
  smallMuted: { color: "#555", marginTop: 4, marginLeft: 8, fontSize: 12 },
  anonTag: { color: "#9cf", fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  del: { color: "#ff7a7a", marginTop: 8, fontWeight: "700" },
  inp: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  ta: {
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  btn: {
    marginTop: 10,
    backgroundColor: "#00ffff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnT: { fontWeight: "800", color: "#000" },
  outline: { borderWidth: 1, borderColor: "#555", padding: 12, borderRadius: 8 },
  outTxt: { color: "#ccc" },
  kindChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#444", marginRight: 8 },
  kindChipOn: { backgroundColor: "#00ffff", borderColor: "#00ffff" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalCard: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "#111",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
