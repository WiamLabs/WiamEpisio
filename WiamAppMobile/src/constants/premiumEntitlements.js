export const PLAN_ORDER = ['none', 'basic', 'plus', 'unlimited'];

export const FEATURE_MIN_PLAN = {
  ad_free_reading: 'basic',
  smart_chapter_cache: 'basic',
  priority_chapter_cache: 'plus',
  best_offline_cache: 'unlimited',
  priority_comments: 'plus',
  custom_reader_themes: 'unlimited',
  early_access_chapters: 'unlimited',
  unlimited_bot: 'unlimited',
};

export const OFFLINE_BOOK_LIMITS = {
  none: 0,
  basic: 5,
  plus: 15,
  unlimited: 50,
};

export const normalizePlan = (plan) => {
  const p = String(plan || 'none').toLowerCase();
  return PLAN_ORDER.includes(p) ? p : 'none';
};

export const getUserPlan = (user) => {
  const active = user?.premium_status === 'active' || user?.premium_status === 'trial';
  if (!active) return 'none';
  return normalizePlan(user?.premium_plan || 'basic');
};

export const hasPlanAtLeast = (plan, minPlan) => {
  return PLAN_ORDER.indexOf(normalizePlan(plan)) >= PLAN_ORDER.indexOf(normalizePlan(minPlan));
};

export const canUseFeature = (user, featureKey) => {
  const minPlan = FEATURE_MIN_PLAN[featureKey] || 'none';
  return hasPlanAtLeast(getUserPlan(user), minPlan);
};

export const getOfflineBookLimit = (planOrUser) => {
  const plan = typeof planOrUser === 'string' ? normalizePlan(planOrUser) : getUserPlan(planOrUser);
  return OFFLINE_BOOK_LIMITS[plan] ?? 0;
};
