import CONFIG from '../constants/config';

/** Site origin (no /api/v1) — Episio Flask host. */
export function siteOrigin() {
  return CONFIG.SITE_ORIGIN
    || CONFIG.API_URL.replace(/\/api\/v1\/?$/i, '')
    || 'https://episio.wiamlabs.com';
}

/** Legal pages still live on wiamapp.com until Episio copies ship. */
export function legalOrigin() {
  return CONFIG.LEGAL_ORIGIN || 'https://wiamapp.com';
}
