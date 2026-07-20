import CONFIG from '../constants/config';

/**
 * Convert a potentially relative avatar/image URL to an absolute URL.
 * Handles: null, relative paths (/img/123), and already-absolute URLs.
 */
const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = (CONFIG.API_URL || '').replace(/\/api\/v1\/?$/, '');
  return base + url;
};

export default resolveUrl;
