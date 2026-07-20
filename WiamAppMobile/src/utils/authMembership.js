/**
 * Membership for UI: token alone is not enough.
 * Guest UX until email verified + age confirmed.
 */

export function hasSession(user, token) {
  return !!(token && user);
}

export function isEmailVerified(user) {
  return !!(user?.email_verified || user?.emailVerified);
}

export function isAgeConfirmed(user) {
  return !!(user?.age_confirmed || user?.age_confirmed_at || user?.ageConfirmed);
}

/** Fully signed-up member (not guest chrome). */
export function isVerifiedMember(user, token) {
  return hasSession(user, token) && isEmailVerified(user) && isAgeConfirmed(user);
}

/** After login/register — next sticky gate screen name or null for Main. */
export function nextSignupGate(user) {
  if (!user) return 'Login';
  if (!isEmailVerified(user)) return 'VerifyMethod';
  if (!isAgeConfirmed(user)) return 'AgeGate';
  return null;
}

export default {
  hasSession,
  isEmailVerified,
  isAgeConfirmed,
  isVerifiedMember,
  nextSignupGate,
};
