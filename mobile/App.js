// © 2026 WiamApp. Powered by WiamLabs
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from './constants/colors';
import { AuthProvider, useAuth } from './lib/AuthContext';

// ── Splash + Landing ──────────────────────────────────────────
import SplashScreen      from './screens/SplashScreen';
import LandingScreen     from './screens/LandingScreen';
import OnboardingScreen  from './screens/OnboardingScreen';

// ── Auth ──────────────────────────────────────────────────────
import LoginScreen          from './screens/LoginScreen';
import RegisterScreen       from './screens/RegisterScreen';
import EmailOTPScreen       from './screens/EmailOTPScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen  from './screens/ResetPasswordScreen';

// ── Customer Verification ─────────────────────────────────────
import CustomerVerifyIntroScreen   from './screens/CustomerVerifyIntroScreen';
import CustomerIDUploadScreen      from './screens/CustomerIDUploadScreen';
import CustomerSelfieScreen        from './screens/CustomerSelfieScreen';
import CustomerVerifyPendingScreen from './screens/CustomerVerifyPendingScreen';

// ── Worker Verification ───────────────────────────────────────
import WorkerVerifyIntroScreen    from './screens/WorkerVerifyIntroScreen';
import IDTypeScreen               from './screens/IDTypeScreen';
import IDUploadScreen             from './screens/IDUploadScreen';
import WorkerSelfieScreen         from './screens/WorkerSelfieScreen';
import VerificationPendingScreen  from './screens/VerificationPendingScreen';
import VerificationApprovedScreen from './screens/VerificationApprovedScreen';
import VerificationRejectedScreen from './screens/VerificationRejectedScreen';

// ── Customer Screens ──────────────────────────────────────────
import CustomerHomeScreen    from './screens/CustomerHomeScreen';
import SearchScreen          from './screens/SearchScreen';
import CategoryScreen        from './screens/CategoryScreen';
import WorkerProfileScreen   from './screens/WorkerProfileScreen';
import QuoteRequestScreen    from './screens/QuoteRequestScreen';
import QuotesListScreen      from './screens/QuotesListScreen';
import BookingScreen         from './screens/BookingScreen';
import BookingSuccessScreen  from './screens/BookingSuccessScreen';
import BookingsListScreen    from './screens/BookingsListScreen';
import BookingDetailScreen   from './screens/BookingDetailScreen';
import PaymentScreen         from './screens/PaymentScreen';
import PaymentSuccessScreen  from './screens/PaymentSuccessScreen';
import ChatListScreen        from './screens/ChatListScreen';
import ChatScreen            from './screens/ChatScreen';
import ReviewScreen          from './screens/ReviewScreen';
import CustomerProfileScreen from './screens/CustomerProfileScreen';
import NotificationsScreen   from './screens/NotificationsScreen';
import EmergencyModeScreen   from './screens/EmergencyModeScreen';
import CustomerSafetyScreen  from './screens/CustomerSafetyScreen';

// ── Worker Screens ────────────────────────────────────────────
import WorkerDashboardScreen      from './screens/WorkerDashboardScreen';
import WorkerJobsScreen           from './screens/WorkerJobsScreen';
import WorkerProfileEditScreen    from './screens/WorkerProfileEditScreen';
import EarningsScreen             from './screens/EarningsScreen';
import PortfolioManagerScreen     from './screens/PortfolioManagerScreen';
import SkillsManagerScreen        from './screens/SkillsManagerScreen';
import SpotlightManagerScreen     from './screens/SpotlightManagerScreen';
import WorkerNotificationsScreen  from './screens/WorkerNotificationsScreen';
import WorkerSafetyScreen         from './screens/WorkerSafetyScreen';
import AvailabilityCalendarScreen from './screens/AvailabilityCalendarScreen';
import WorkerRankingsScreen       from './screens/WorkerRankingsScreen';
import WorkerSettingsScreen       from './screens/WorkerSettingsScreen';
import JobDetailScreen            from './screens/JobDetailScreen';
import SubscriptionScreen         from './screens/SubscriptionScreen';
import WebViewScreen              from './screens/WebViewScreen';
import BlockedUsersScreen         from './screens/BlockedUsersScreen';
import CustomerEditProfileScreen  from './screens/CustomerEditProfileScreen';
import MyReviewsScreen            from './screens/MyReviewsScreen';
import CustomerSettingsScreen     from './screens/CustomerSettingsScreen';

// ── Business Screens ──────────────────────────────────────────
import BusinessDashboardScreen   from './screens/BusinessDashboardScreen';
import BusinessBookingsScreen    from './screens/BusinessBookingsScreen';
import BusinessTeamScreen        from './screens/BusinessTeamScreen';
import BusinessProfileScreen     from './screens/BusinessProfileScreen';
import BusinessApplicationScreen from './screens/BusinessApplicationScreen';
import ReferralScreen from './screens/ReferralScreen';
import DisputeScreen from './screens/DisputeScreen';
import BookingPhotosScreen from './screens/BookingPhotosScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Customer Tabs ─────────────────────────────────────────────
function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home:     focused ? 'home'         : 'home-outline',
            Search:   focused ? 'search'       : 'search-outline',
            Bookings: focused ? 'calendar'     : 'calendar-outline',
            Chat:     focused ? 'chatbubbles'  : 'chatbubbles-outline',
            Profile:  focused ? 'person'       : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   Colors.gold,
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#EBEBEB', borderTopWidth: 0.5, paddingBottom: 6, height: 60 },
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home"     component={CustomerHomeScreen} />
      <Tab.Screen name="Search"   component={SearchScreen} />
      <Tab.Screen name="Bookings" component={BookingsListScreen} />
      <Tab.Screen name="Chat"     component={ChatListScreen} />
      <Tab.Screen name="Profile"  component={CustomerProfileScreen} />
    </Tab.Navigator>
  );
}

// ── Worker Tabs ───────────────────────────────────────────────
function WorkerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard:     focused ? 'grid'          : 'grid-outline',
            Jobs:          focused ? 'briefcase'     : 'briefcase-outline',
            WorkerNotifs:  focused ? 'notifications' : 'notifications-outline',
            WorkerProfileTab: focused ? 'person'        : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarStyle: { backgroundColor: Colors.navyDeep, borderTopColor: '#1E1E4A', borderTopWidth: 0.5, paddingBottom: 6, height: 60 },
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard"     component={WorkerDashboardScreen} />
      <Tab.Screen name="Jobs"          component={WorkerJobsScreen} />
      <Tab.Screen name="WorkerNotifs"  component={WorkerNotificationsScreen} options={{ title: 'Alerts' }} />
      <Tab.Screen name="WorkerProfileTab" component={WorkerProfileEditScreen}   options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ── Business Tabs ─────────────────────────────────────────────
function BusinessTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            BizHome:    focused ? 'grid'      : 'grid-outline',
            BizJobs:    focused ? 'briefcase' : 'briefcase-outline',
            BizTeam:    focused ? 'people'    : 'people-outline',
            BizProfile: focused ? 'business'  : 'business-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarStyle: { backgroundColor: Colors.navyDeep, borderTopColor: '#1E1E4A', borderTopWidth: 0.5, paddingBottom: 6, height: 60 },
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="BizHome"    component={BusinessDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="BizJobs"    component={BusinessBookingsScreen}  options={{ title: 'Bookings' }} />
      <Tab.Screen name="BizTeam"    component={BusinessTeamScreen}      options={{ title: 'Team' }} />
      <Tab.Screen name="BizProfile" component={BusinessProfileScreen}   options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ── Root navigator with smart auth redirect ───────────────────
function RootNavigator() {
  const { user, loading } = useAuth();

  // Show spinner while checking session
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.navyDeep, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </View>
    );
  }

  // Decide initial route
  let initialRoute = 'Splash';
  if (user) {
    if (user.role === 'worker')   initialRoute = 'WorkerApp';
    else if (user.role === 'business') initialRoute = 'BusinessApp';
    else                          initialRoute = 'CustomerApp';
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {/* Splash + Onboarding + Landing */}
      <Stack.Screen name="Splash"      component={SplashScreen} />
      <Stack.Screen name="Onboarding"  component={OnboardingScreen} />
      <Stack.Screen name="Landing"     component={LandingScreen} />

      {/* Auth */}
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="EmailOTP"       component={EmailOTPScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} />

      {/* Customer Verification */}
      <Stack.Screen name="CustomerVerifyIntro"   component={CustomerVerifyIntroScreen} />
      <Stack.Screen name="CustomerIDUpload"      component={CustomerIDUploadScreen} />
      <Stack.Screen name="CustomerSelfie"        component={CustomerSelfieScreen} />
      <Stack.Screen name="CustomerVerifyPending" component={CustomerVerifyPendingScreen} />

      {/* Worker Verification */}
      <Stack.Screen name="WorkerVerifyIntro"    component={WorkerVerifyIntroScreen} />
      <Stack.Screen name="IDType"               component={IDTypeScreen} />
      <Stack.Screen name="IDUpload"             component={IDUploadScreen} />
      <Stack.Screen name="WorkerSelfie"         component={WorkerSelfieScreen} />
      <Stack.Screen name="VerificationPending"  component={VerificationPendingScreen} />
      <Stack.Screen name="VerificationApproved" component={VerificationApprovedScreen} />
      <Stack.Screen name="VerificationRejected" component={VerificationRejectedScreen} />

      {/* Customer App */}
      <Stack.Screen name="CustomerApp"    component={CustomerTabs} />
      <Stack.Screen name="Category"       component={CategoryScreen} />
      <Stack.Screen name="WorkerProfile"  component={WorkerProfileScreen} />
      <Stack.Screen name="QuoteRequest"   component={QuoteRequestScreen} />
      <Stack.Screen name="QuotesList"     component={QuotesListScreen} />
      <Stack.Screen name="Booking"        component={BookingScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
      <Stack.Screen name="BookingDetail"  component={BookingDetailScreen} />
      <Stack.Screen name="BookingPhotos"  component={BookingPhotosScreen} />
      <Stack.Screen name="Dispute"        component={DisputeScreen} />
      <Stack.Screen name="Referral"       component={ReferralScreen} />
      <Stack.Screen name="Payment"        component={PaymentScreen} />
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <Stack.Screen name="ChatRoom"        component={ChatScreen} />
      <Stack.Screen name="Review"         component={ReviewScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
      <Stack.Screen name="EmergencyMode"  component={EmergencyModeScreen} />
      <Stack.Screen name="CustomerSafety" component={CustomerSafetyScreen} />

      {/* Worker App */}
      <Stack.Screen name="WorkerApp"            component={WorkerTabs} />
      <Stack.Screen name="JobDetail"            component={JobDetailScreen} />
      <Stack.Screen name="Earnings"             component={EarningsScreen} />
      <Stack.Screen name="PortfolioManager"     component={PortfolioManagerScreen} />
      <Stack.Screen name="SkillsManager"        component={SkillsManagerScreen} />
      <Stack.Screen name="SpotlightManager"     component={SpotlightManagerScreen} />
      <Stack.Screen name="WorkerSafety"         component={WorkerSafetyScreen} />
      <Stack.Screen name="AvailabilityCalendar" component={AvailabilityCalendarScreen} />
      <Stack.Screen name="WorkerRankings"       component={WorkerRankingsScreen} />
      <Stack.Screen name="WorkerSettings"       component={WorkerSettingsScreen} />
      <Stack.Screen name="Subscription"         component={SubscriptionScreen} />
      <Stack.Screen name="WebView"               component={WebViewScreen} />
      <Stack.Screen name="BlockedUsers"          component={BlockedUsersScreen} />
      <Stack.Screen name="CustomerEditProfile"   component={CustomerEditProfileScreen} />
      <Stack.Screen name="MyReviews"              component={MyReviewsScreen} />
      <Stack.Screen name="CustomerSettings"       component={CustomerSettingsScreen} />

      {/* Business App */}
      <Stack.Screen name="BusinessApp"         component={BusinessTabs} />
      <Stack.Screen name="BusinessApplication" component={BusinessApplicationScreen} />
    </Stack.Navigator>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
