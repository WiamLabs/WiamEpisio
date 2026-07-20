import React from 'react';
import { View, Text, Image, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/main/HomeScreen';
import BrowseScreen from '../screens/main/BrowseScreen';
import LibraryScreen from '../screens/main/LibraryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { COLORS } from '../constants/theme';
import { Home, Compass, Library } from 'lucide-react-native';
import { lightTap } from '../utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/useAuthStore';
import LetterAvatar from '../components/common/LetterAvatar';
import resolveUrl from '../utils/resolveUrl';

/**
 * Bottom tabs: Home, Browse, Library, Studio, Profile (5 tabs per Plan.txt).
 * Search is accessible from Home/Browse header icons.
 * Premium is accessible from Profile or Wallet.
 */
const Tab = createBottomTabNavigator();

const ProfileAvatar = ({ focused, size }) => {
  const user = useAuthStore((s) => s.user);
  const avatarUrl = resolveUrl(user?.avatar_url);
  const sz = size + 2;
  const borderColor = focused ? COLORS.secondary : 'transparent';
  if (avatarUrl) {
    return (
      <View style={{ width: sz, height: sz, borderRadius: sz / 2, borderWidth: 2, borderColor, overflow: 'hidden' }}>
        <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }
  return (
    <LetterAvatar
      name={user?.display_name || 'U'}
      size={sz}
      borderWidth={2}
      borderColor={borderColor}
      bg="rgba(212,168,67,0.15)"
      color={COLORS.secondary}
    />
  );
};

const MainNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 4 : 0);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Profile') return <ProfileAvatar focused={focused} size={size} />;
          let IconComponent;
          if (route.name === 'Home') IconComponent = Home;
          else if (route.name === 'Browse') IconComponent = Compass;
          else if (route.name === 'Library') IconComponent = Library;

          return (
            <IconComponent color={color} size={size} strokeWidth={focused ? 2.5 : 2} />
          );
        },
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 4,
          position: 'relative',
          borderTopWidth: 1,
          elevation: 0,
        },
        sceneStyle: { backgroundColor: COLORS.background },
        tabBarItemStyle: { minWidth: 56 },
        headerShown: false,
      })}
      screenListeners={{
        tabPress: () => lightTap(),
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Browse" component={BrowseScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainNavigator;
