/**
 * Must be imported before `./App` so native splash stays up until we call hideAsync().
 */
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});
