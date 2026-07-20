import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LandingScreen from '../screens/auth/LandingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import BrowseScreen from '../screens/main/BrowseScreen';
import GlobalSearchScreen from '../screens/main/GlobalSearchScreen';
import BookDetailScreen from '../screens/content/BookDetailScreen';
import ReaderScreen from '../screens/content/ReaderScreen';
import { COLORS } from '../constants/theme';
import { Home, Compass, Search, LogIn } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const GuestTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size, focused }) => {
        let Icon = Home;
        if (route.name === 'Browse') Icon = Compass;
        if (route.name === 'Search') Icon = Search;
        if (route.name === 'LoginTab') Icon = LogIn;
        return <Icon color={color} size={size} strokeWidth={focused ? 2.5 : 2} />;
      },
      tabBarActiveTintColor: COLORS.secondary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarHideOnKeyboard: false,
      tabBarStyle: {
        backgroundColor: COLORS.background,
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        height: 62,
        paddingBottom: 8,
        paddingTop: 4,
      },
      headerStyle: { backgroundColor: COLORS.background },
      headerTintColor: COLORS.text,
      headerShadowVisible: false,
      sceneStyle: { backgroundColor: COLORS.background },
    })}
  >
    <Tab.Screen name="Home" component={LandingScreen} options={{ headerShown: false }} />
    <Tab.Screen name="Browse" component={BrowseScreen} />
    <Tab.Screen name="Search" component={GlobalSearchScreen} options={{ headerShown: false }} />
    <Tab.Screen name="LoginTab" component={LoginScreen} options={{ headerShown: false, title: 'Sign in' }} />
  </Tab.Navigator>
);

const AuthNavigator = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
      initialRouteName="GuestTabs"
    >
      <Stack.Screen name="GuestTabs" component={GuestTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="BookDetail"
        component={BookDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
