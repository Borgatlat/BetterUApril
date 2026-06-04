/**
 * Safe navigation helpers — avoid router.back() landing on hidden tab routes
 * (e.g. school-wellness) that are not valid for public users.
 */
export function navigateToHome(router) {
  router.replace('/(tabs)/home');
}

export function navigateToAccountability(router) {
  router.replace('/accountability');
}

/** School wellness hub — only verified students (workspace === "student"). */
export function navigateToSchoolWellness(router, workspace) {
  if (workspace !== 'student') {
    router.replace('/(tabs)/home');
    return;
  }
  router.replace('/(tabs)/school-wellness');
}
