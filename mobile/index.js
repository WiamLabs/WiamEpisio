// © 2026 WiamApp. Powered by WiamLabs
import { registerRootComponent } from 'expo';
import App from './App';

// Do NOT call SplashScreen.preventAutoHideAsync() here.
// Holding the native splash is what trapped testers on a logo forever
// when JS failed or auth hung. Let Expo auto-hide the splash when the
// JS bundle mounts; App.js also forces hide on first render.
registerRootComponent(App);
