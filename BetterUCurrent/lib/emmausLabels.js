/** Human-readable labels for Emmaus enums (UI only). */

export const CATEGORY_OPTIONS = [
  { id: "academic_stress", label: "Academic stress", icon: "school-outline", hint: "Exams, workload, pressure" },
  { id: "social_isolation", label: "Feeling isolated", icon: "people-outline", hint: "Lonely or disconnected" },
  { id: "grief_loss", label: "Grief or loss", icon: "heart-outline", hint: "Missing someone or something" },
  { id: "general_wellbeing", label: "General wellbeing", icon: "leaf-outline", hint: "Hard to name — that's okay" },
];

export const SUPPORT_OPTIONS = [
  { id: "listen_only", label: "Someone to listen", icon: "ear-outline" },
  { id: "prayer_request", label: "Prayer together", icon: "hand-left-outline" },
  { id: "seeking_advice", label: "Guidance & advice", icon: "chatbubbles-outline" },
  { id: "silent_prayer_only", label: "Silent prayer only", icon: "moon-outline" },
  { id: "casual_hangout", label: "Casual hangout", icon: "cafe-outline" },
];

export const FORMAT_OPTIONS = [
  { id: "text_chat", label: "Text chat", icon: "chatbubble-outline" },
  { id: "in_person_casual", label: "In person", icon: "walk-outline" },
  { id: "sacramental_chapel", label: "Chapel", icon: "business-outline" },
];

export const URGENCY_OPTIONS = [
  { id: "routine_check_in", label: "This week", icon: "calendar-outline" },
  { id: "urgent_today", label: "Today", icon: "alert-circle-outline" },
];

export function labelCategory(id) {
  return CATEGORY_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function labelSupport(id) {
  return SUPPORT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function labelFormat(id) {
  return FORMAT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function labelUrgency(id) {
  return URGENCY_OPTIONS.find((o) => o.id === id)?.label ?? id;
}
