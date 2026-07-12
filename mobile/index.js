// © 2026 WiamApp. Powered by WiamLabs
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';

// Keep native splash visible until App hides it after first render
SplashScreen.preventAutoHideAsync().catch(() => {});

registerRootComponent(App);
