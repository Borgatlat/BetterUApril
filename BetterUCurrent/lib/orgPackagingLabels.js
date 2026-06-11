/**
 * FERPA-safe labels by org packaging_mode (Tier 3).
 * jesuit = default Spiritual copy; secular/district = neutral school language.
 */

const PACKAGES = {
  jesuit: {
    spiritualTabTitle: "Spiritual life",
    spiritualTabSubtitle: "Scripture, Ignatian prayer, campus formation, and service — in one place.",
    formationHeroKicker: "Today's formation",
    formationHeroTitle: "Start Daily Examen",
    formationHeroSub: "Gratitude · review · mercy · tomorrow's resolution",
    liveTheFourthLabel: "Live the Fourth",
    serviceLabel: "Service hours",
    valuesSection: "Formation",
  },
  secular: {
    spiritualTabTitle: "Values & service",
    spiritualTabSubtitle: "Gratitude, reflection, service learning, and campus community.",
    formationHeroKicker: "Today's reflection",
    formationHeroTitle: "Start daily reflection",
    formationHeroSub: "Gratitude · review · kindness · tomorrow's goal",
    liveTheFourthLabel: "Weekly character challenge",
    serviceLabel: "Community service",
    valuesSection: "Character & service",
  },
  district: {
    spiritualTabTitle: "Wellness & service",
    spiritualTabSubtitle: "Daily check-in, service learning, and school community programs.",
    formationHeroKicker: "Today's wellness",
    formationHeroTitle: "Start guided reflection",
    formationHeroSub: "Pause · breathe · reflect · plan tomorrow",
    liveTheFourthLabel: "Weekly wellness task",
    serviceLabel: "Service learning hours",
    valuesSection: "Programs",
  },
};

/**
 * @param {'jesuit'|'secular'|'district'|string|null|undefined} mode
 */
export function getOrgPackagingLabels(mode) {
  return PACKAGES[mode] ?? PACKAGES.jesuit;
}
