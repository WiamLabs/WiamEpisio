import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeBonusScreen from '../screens/auth/WelcomeBonusScreen';
import PostOnboardingPremiumScreen from '../screens/auth/PostOnboardingPremiumScreen';
import PostOnboardingCreatorScreen from '../screens/auth/PostOnboardingCreatorScreen';
import PostOnboardingMissionScreen from '../screens/auth/PostOnboardingMissionScreen';
import { COLORS } from '../constants/theme';

const Stack = createNativeStackNavigator();

/**
 * Sequenced welcome flow that runs once after onboarding finishes.
 * Each screen replaces the previous so back-swipe can't jump steps,
 * and the final screen calls clearPostOnboarding() — at which point
 * AppNavigator's authPhaseKey flips to 'phase_app' and the stack
 * remounts onto Home.
 */
const PostOnboardingNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: COLORS.background },
      gestureEnabled: false,
      animation: 'fade',
    }}
    initialRouteName="WelcomeBonus"
  >
    <Stack.Screen name="WelcomeBonus" component={WelcomeBonusScreen} />
    <Stack.Screen
      name="PostOnboardingPremium"
      component={PostOnboardingPremiumScreen}
    />
    <Stack.Screen
      name="PostOnboardingCreator"
      component={PostOnboardingCreatorScreen}
    />
    <Stack.Screen
      name="PostOnboardingMission"
      component={PostOnboardingMissionScreen}
    />
  </Stack.Navigator>
);

export default PostOnboardingNavigator;
