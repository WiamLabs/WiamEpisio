import { LogBox } from 'react-native';
import { getErrorHint } from './errorHints';

/**
 * Configure LogBox for clearer error display in dev.
 * Call this as early as possible (e.g. in index.js before importing App).
 */
export function setupLogBox() {
  if (!__DEV__) return;

  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
  ]);
}

/**
 * Set global handler for unhandled JS errors.
 * Logs hint suggestions to console before the default handler runs.
 */
export function setupGlobalErrorHandler() {
  const original = global.ErrorUtils?.getGlobalHandler?.();
  if (!original) return;

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = error?.message || String(error);
    const hint = getErrorHint(msg);
    if (hint && __DEV__) {
      console.error(
        `[WiamApp Error] ${msg}\n→ Cause: ${hint.cause}\n→ Fix: ${hint.fix}`
      );
    }
    original(error, isFatal);
  });
}
