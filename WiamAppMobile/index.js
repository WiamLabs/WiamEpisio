import './splash-init';

import { registerRootComponent } from 'expo';
import { setupLogBox, setupGlobalErrorHandler } from './src/utils/globalErrorHandler';

setupLogBox();
setupGlobalErrorHandler();

import App from './App';

registerRootComponent(App);
