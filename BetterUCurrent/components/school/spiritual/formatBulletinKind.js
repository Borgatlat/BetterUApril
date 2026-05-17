/** Turn DB enum into short student-facing label. */
export function formatBulletinKind(kind) {
  if (kind === "intention_request") return "Prayer request";
  if (kind === "event_notice") return "Event";
  return kind?.replace(/_/g, " ") ?? "";
}
