/**
 * Google Sign-In hook for WiamApp mobile.
 *
 * Uses expo-auth-session/providers/google to obtain a Google ID token from the
 * device, then exchanges it for a WiamApp JWT via POST /auth/google.
 *
 * Env (app.config.js `extra`): `googleClientIdWeb`, `googleClientIdIos`,
 * `googleClientIdAndroid` from EXPO_PUBLIC_* vars.
 *
 * Expo's Google provider validates **this OS's** client id (`iosClientId` or
 * `androidClientId`, falling back to `clientId` / web). If we mount the hook
 * when neither is set for the current OS (e.g. only Android env on an iPhone),
 * React throws immediately — see `GoogleSignInSlot`.
 */
import React from 'react';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import authApi from '../api/auth';

WebBrowser.maybeCompleteAuthSession();

const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

/**
 * Whether we have OAuth client ids usable on *this* device OS.
 * (Global OR was wrong: Android-only secrets still crash Google.useAuthRequest on iOS.)
 */
export const isGoogleSignInConfigured = () => {
  const web = extra.googleClientIdWeb;
  const ios = extra.googleClientIdIos;
  const android = extra.googleClientIdAndroid;
  const os = Platform.OS;
  if (os === 'ios') return !!(ios || web);
  if (os === 'android') return !!(android || web);
  if (os === 'web') return !!web;
  return !!(web || ios || android);
};

/**
 * Renders `children(signInState)`. When Google env is incomplete for this OS,
 * skips Expo hooks entirely — `start()` only surfaces onError (“coming soon”).
 */
export function GoogleSignInSlot({ onSuccess, onError, children }) {
  if (!isGoogleSignInConfigured()) {
    return children({
      ready: false,
      signing: false,
      start: async () => {
        onError?.('Google sign-in is coming soon.');
      },
    });
  }
  return (
    <GoogleSignInLoaded onSuccess={onSuccess} onError={onError}>
      {children}
    </GoogleSignInLoaded>
  );
}

/** Internal: mounts only when Expo Google hooks are legal for this OS. */
function GoogleSignInLoaded({ onSuccess, onError, children }) {
  const state = useGoogleSignInMounted(onSuccess, onError);
  return children(state);
}

function useGoogleSignInMounted(onSuccess, onError) {
  const [signing, setSigning] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: extra.googleClientIdWeb,
    iosClientId: extra.googleClientIdIos || extra.googleClientIdWeb || undefined,
    androidClientId: extra.googleClientIdAndroid || extra.googleClientIdWeb || undefined,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken =
        response.params?.id_token || response.authentication?.idToken;
      if (!idToken) {
        setSigning(false);
        onError?.('Google sign-in did not return an ID token.');
        return;
      }
      (async () => {
        try {
          const data = await authApi.googleLogin(idToken);
          setSigning(false);
          onSuccess?.(data);
        } catch (e) {
          setSigning(false);
          onError?.(typeof e === 'string' ? e : 'Google sign-in failed.');
        }
      })();
    } else if (response.type === 'error') {
      setSigning(false);
      onError?.(response.error?.message || 'Google sign-in was cancelled.');
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      setSigning(false);
    }
  }, [response]);

  const start = async () => {
    if (!request) return;
    try {
      setSigning(true);
      await promptAsync();
    } catch (e) {
      setSigning(false);
      onError?.(typeof e === 'string' ? e : 'Could not start Google sign-in.');
    }
  };

  return { ready: true, signing, start };
}

/** @deprecated Use named import { GoogleSignInSlot } */
export default GoogleSignInSlot;
