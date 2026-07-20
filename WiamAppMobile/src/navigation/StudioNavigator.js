/**
 * StudioNavigator (Push 9) — 5-tab bottom-tab Studio shell.
 *
 * Tabs:
 *   1. Library  — StudioLibraryScreen (V2 root)
 *   2. Editor   — direct shortcut to StudioDashboardScreen (legacy
 *                 dashboard kept for power users; chapter/story editing
 *                 still flows through StoryManagerScreen).
 *   3. Schedule — StudioScheduleScreen
 *   4. Money    — StudioMoneyScreen
 *   5. Settings — StudioSettingsScreen
 *
 * The legacy stack screens (NewStory, StoryManager, ChapterEditor,
 * Earnings, StoryAnalytics, StudioProPaywall, Universe
 * and Series editors) remain reachable as modal-style routes via a
 * thin wrapper stack.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BookOpen, PenLine, Calendar, Coins, Settings as Cog } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../constants/theme';
import { STUDIO_COLORS } from '../constants/studioTheme';

import StudioDashboardScreen from '../screens/studio/StudioDashboardScreen';
import NewStoryScreen from '../screens/studio/NewStoryScreen';
import StoryManagerScreen from '../screens/studio/StoryManagerScreen';
import ChapterEditorScreen from '../screens/studio/ChapterEditorScreen';
import EarningsScreen from '../screens/studio/EarningsScreen';
import StoryAnalyticsScreen from '../screens/studio/StoryAnalyticsScreen';

import StudioLibraryScreen from '../screens/studio/v2/StudioLibraryScreen';
import StudioScheduleScreen from '../screens/studio/v2/StudioScheduleScreen';
import StudioMoneyScreen from '../screens/studio/v2/StudioMoneyScreen';
import StudioSettingsScreen from '../screens/studio/v2/StudioSettingsScreen';
import StudioProPaywallScreen from '../screens/studio/v2/StudioProPaywallScreen';
import UniverseEditorScreen from '../screens/studio/v2/UniverseEditorScreen';
import SeriesEditorScreen from '../screens/studio/v2/SeriesEditorScreen';
import AIComingSoonScreen from '../screens/studio/v2/AIComingSoonScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const StudioTabs = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: STUDIO_COLORS.surface,
        borderTopColor: STUDIO_COLORS.border,
        borderTopWidth: 1,
        height: 56 + bottomInset,
        paddingBottom: bottomInset,
        paddingTop: 6,
        // Keep the tab bar above Android system nav/home buttons.
        marginBottom: Platform.OS === 'android' ? 6 : 0,
      },
      tabBarActiveTintColor: STUDIO_COLORS.accent,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      tabBarIcon: ({ color, size }) => {
        const sz = size || 18;
        if (route.name === 'Library') return <BookOpen size={sz} color={color} />;
        if (route.name === 'Editor') return <PenLine size={sz} color={color} />;
        if (route.name === 'Schedule') return <Calendar size={sz} color={color} />;
        if (route.name === 'Money') return <Coins size={sz} color={color} />;
        if (route.name === 'StudioSettings') return <Cog size={sz} color={color} />;
        return null;
      },
    })}
  >
    <Tab.Screen name="Library" component={StudioLibraryScreen} />
    <Tab.Screen name="Editor" component={StudioDashboardScreen} options={{ tabBarLabel: 'Editor' }} />
    <Tab.Screen name="Schedule" component={StudioScheduleScreen} />
    <Tab.Screen name="Money" component={StudioMoneyScreen} />
    <Tab.Screen
      name="StudioSettings"
      component={StudioSettingsScreen}
      options={{ tabBarLabel: 'Settings' }}
    />
  </Tab.Navigator>
  );
};

/**
 * Outer Studio stack: tab shell at the root, plus all the legacy + V2
 * editor screens pushed on top.
 */
const StudioNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: STUDIO_COLORS.background },
      animation: 'slide_from_right',
    }}
    initialRouteName="StudioRoot"
  >
    <Stack.Screen name="StudioRoot" component={StudioTabs} />

    {/* Legacy editor stack (still wired) */}
    <Stack.Screen name="StudioHome" component={StudioDashboardScreen} />
    <Stack.Screen name="NewStory" component={NewStoryScreen} />
    <Stack.Screen name="StoryManager" component={StoryManagerScreen} />
    <Stack.Screen name="ChapterEditor" component={ChapterEditorScreen} />
    <Stack.Screen name="Earnings" component={EarningsScreen} />
    <Stack.Screen name="StoryAnalytics" component={StoryAnalyticsScreen} />

    {/* V2 modal-style routes */}
    <Stack.Screen
      name="StudioProPaywall"
      component={StudioProPaywallScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
    <Stack.Screen name="UniverseEditor" component={UniverseEditorScreen} />
    <Stack.Screen name="SeriesEditor" component={SeriesEditorScreen} />
    <Stack.Screen name="AIComingSoon" component={AIComingSoonScreen} />
  </Stack.Navigator>
);

export default StudioNavigator;
