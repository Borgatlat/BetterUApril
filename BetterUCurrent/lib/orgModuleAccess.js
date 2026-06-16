/**
 * Per-org module visibility for school partnerships.
 * Public users always get nutrition; spiritual is student-only when enabled for their org.
 */

/** Fallback when enabled_modules is missing from branding RPC. */
export const DEFAULT_STUDENT_MODULES = {
  spiritual: true,
  nutrition: true,
};

const PUBLIC_MODULES = {
  spiritual: false,
  nutrition: true,
};

/**
 * @typedef {{ spiritual?: boolean, nutrition?: boolean }} OrgEnabledModules
 * @typedef {{ packaging_mode?: string, enabled_modules?: OrgEnabledModules } | null | undefined} OrgBrandingRow
 */

/**
 * Merge org DB overrides onto defaults for a campus student.
 * @param {OrgBrandingRow} branding
 * @returns {{ spiritual: boolean, nutrition: boolean }}
 */
export function resolveStudentModules(branding) {
  const overrides = branding?.enabled_modules ?? {};
  return {
    spiritual: overrides.spiritual ?? DEFAULT_STUDENT_MODULES.spiritual,
    nutrition: overrides.nutrition ?? DEFAULT_STUDENT_MODULES.nutrition,
  };
}

/**
 * @param {'anon'|'public'|'student'|'staff'|'parent'} workspace
 * @param {OrgBrandingRow} branding
 */
export function getOrgModuleAccess(workspace, branding) {
  if (workspace !== "student") {
    return PUBLIC_MODULES;
  }
  return resolveStudentModules(branding);
}

/** @param {'anon'|'public'|'student'|'staff'|'parent'} workspace @param {OrgBrandingRow} branding */
export function showNutritionTab(workspace, branding) {
  return getOrgModuleAccess(workspace, branding).nutrition;
}

/** @param {'anon'|'public'|'student'|'staff'|'parent'} workspace @param {OrgBrandingRow} branding */
export function showSpiritualTab(workspace, branding) {
  if (workspace !== "student") return false;
  return getOrgModuleAccess(workspace, branding).spiritual;
}
