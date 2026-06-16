import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { fetchOrgBranding, mergeBrandingIntoTheme } from "../lib/orgBranding";
import { getOrgPackagingLabels } from "../lib/orgPackagingLabels";
import { getOrgModuleAccess } from "../lib/orgModuleAccess";
import { campusThemeDark } from "../components/school/campusThemeTokens";
import { schoolWellnessTheme as baseWellnessTheme } from "../components/school/schoolWellnessTheme";

const OrgBrandingContext = createContext({
  branding: null,
  labels: getOrgPackagingLabels("jesuit"),
  modules: getOrgModuleAccess("public", null),
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

  const modules = useMemo(
    () => getOrgModuleAccess(workspace, branding),
    [workspace, branding],
  );

  const theme = useMemo(
    () => mergeBrandingIntoTheme({ ...baseWellnessTheme, ...campusThemeDark }, branding),
    [branding],
  );

  const value = useMemo(
    () => ({ branding, labels, modules, theme, loading, isSchoolUser }),
    [branding, labels, modules, theme, loading, isSchoolUser],
  );

  return <OrgBrandingContext.Provider value={value}>{children}</OrgBrandingContext.Provider>;
}

export function useOrgBranding() {
  return useContext(OrgBrandingContext);
}
