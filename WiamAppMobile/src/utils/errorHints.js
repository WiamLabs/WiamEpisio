/**
 * Maps common error patterns to user-friendly fix suggestions.
 * Used by ErrorBoundary and global error handler.
 */
const ERROR_HINTS = [
  {
    pattern: /Property 'Platform' doesn't exist|Platform is not defined/i,
    fix: "Add: import { Platform } from 'react-native';",
    cause: 'Platform used but not imported',
  },
  {
    pattern: /Property 'Dimensions' doesn't exist|Dimensions is not defined/i,
    fix: "Add: import { Dimensions } from 'react-native';",
    cause: 'Dimensions used but not imported',
  },
  {
    pattern: /Property 'StyleSheet' doesn't exist|StyleSheet is not defined/i,
    fix: "Add: import { StyleSheet } from 'react-native';",
    cause: 'StyleSheet used but not imported',
  },
  {
    pattern: /Property 'Alert' doesn't exist|Alert is not defined/i,
    fix: "Add: import { Alert } from 'react-native';",
    cause: 'Alert used but not imported',
  },
  {
    pattern: /Property 'ScrollView' doesn't exist|ScrollView is not defined/i,
    fix: "Add: import { ScrollView } from 'react-native';",
    cause: 'ScrollView used but not imported',
  },
  {
    pattern: /Property 'FlatList' doesn't exist|FlatList is not defined/i,
    fix: "Add: import { FlatList } from 'react-native';",
    cause: 'FlatList used but not imported',
  },
  {
    pattern: /Property 'Image' doesn't exist|Image is not defined/i,
    fix: "Add: import { Image } from 'react-native';",
    cause: 'Image used but not imported',
  },
  {
    pattern: /Property 'KeyboardAvoidingView' doesn't exist/i,
    fix: "Add: import { KeyboardAvoidingView } from 'react-native';",
    cause: 'KeyboardAvoidingView used but not imported',
  },
  {
    pattern: /Property 'TouchableOpacity' doesn't exist|TouchableOpacity is not defined/i,
    fix: "Add: import { TouchableOpacity } from 'react-native';",
    cause: 'TouchableOpacity used but not imported',
  },
  {
    pattern: /useLegacyImplementation|Reanimated 3|Reanimated 1 legacy/i,
    fix: 'Remove useLegacyImplementation from Drawer.Navigator, or upgrade @react-navigation/drawer',
    cause: 'Reanimated / Drawer compatibility',
  },
  {
    pattern: /useAnimatedGestureHandler is not a function/i,
    fix: 'Upgrade @react-navigation/drawer and react-native-reanimated to compatible versions',
    cause: 'Reanimated API changed',
  },
  {
    pattern: /Network Error|ECONNREFUSED|Failed to fetch/i,
    fix: 'Check EXPO_PUBLIC_API_URL in .env matches your backend. Ensure backend is running.',
    cause: 'API not reachable',
  },
  {
    pattern: /Unable to resolve module|Cannot find module/i,
    fix: 'Check file path and spelling. Run: npx expo start --clear',
    cause: 'Missing or wrong import path',
  },
  {
    pattern: /undefined is not an object|Cannot read property .* of undefined/i,
    fix: 'Add null/undefined checks before accessing the property',
    cause: 'Accessing property on undefined',
  },
  {
    pattern: /Invariant Violation/i,
    fix: 'Check React/React Native component usage and required props',
    cause: 'Invalid React usage',
  },
];

/**
 * Get fix suggestion for an error message.
 * @param {string} message - Error message
 * @returns {{ fix: string, cause: string } | null}
 */
export function getErrorHint(message) {
  if (!message || typeof message !== 'string') return null;
  for (const { pattern, fix, cause } of ERROR_HINTS) {
    if (pattern.test(message)) {
      return { fix, cause };
    }
  }
  return null;
}

/**
 * Extract file:line from error stack if available.
 * @param {Error} error
 * @returns {string|null}
 */
export function getErrorLocation(error) {
  if (!error?.stack) return null;
  const lines = error.stack.split('\n');
  for (const line of lines) {
    const match = line.match(/at\s+.+?\s+\((.+?):(\d+):(\d+)\)/) ||
      line.match(/@\s*(.+?):(\d+):(\d+)/) ||
      line.match(/(.+?):(\d+):(\d+)/);
    if (match) {
      const path = match[1];
      const fileName = path.split(/[/\\]/).pop();
      return `${fileName}:${match[2]}`;
    }
  }
  return null;
}
