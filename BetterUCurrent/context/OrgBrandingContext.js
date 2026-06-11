import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { fetchOrgBranding, mergeBrandingIntoTheme } from "../lib/orgBranding";
import { getOrgPackagingLabels } from "../lib/orgPackagingLabels";
import { campusThemeLight } from "../components/school/campusThemeTokens";
import { schoolWellnessTheme as baseWellnessTheme } from "../components/school/schoolWellnessTheme";

const OrgBrandingContext = createContext({
  branding: null,
  labels: getOrgPackagingLabels("jesuit"),
  theme: baseWellnessTheme,
  loading: false,
});

/** Provides org logo/colors + secular/jesuit copy for school workspace users. */
export function OrgBrandingProvider({ children }) {
  const { orgId, workspace } = useAuthSession();
  const isSchoolUser = ["student", "staff", "parent"].includes(workspace) || workspace === "student";
  const shouldLoad = Boolean(orgId) && (workspace === "student" || workspace === "staff" || workspace === "parent");

  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldLoad || !orgId) {
      setBranding(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOrgBranding(orgId)
      .then((row) => {
        if (!cancelled) setBranding(row);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, shouldLoad]);

  const labels = useMemo(
    () => getOrgPackagingLabels(branding?.packaging_mode ?? "jesuit"),
    [branding?.packaging_mode],
  );

  const theme = useMemo(
    () => mergeBrandingIntoTheme({ ...baseWellnessTheme, ...campusThemeLight }, branding),
    [branding],
  );

  const value = useMemo(
    () => ({ branding, labels, theme, loading, isSchoolUser }),
    [branding, labels, theme, loading, isSchoolUser],
  );

  return <OrgBrandingContext.Provider value={value}>{children}</OrgBrandingContext.Provider>;
}

export function useOrgBranding() {
  return useContext(OrgBrandingContext);
}
