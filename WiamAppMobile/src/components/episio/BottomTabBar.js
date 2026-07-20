/**
 * Custom tab bar — Watcher mood (Home HTML) or Creator mood (WiamStudio-Home.html).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home, LayoutGrid, Clapperboard, Bookmark, User, BarChart3, Wallet, Layers,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const WATCHER_ICONS = {
  Home,
  Discover: LayoutGrid,
  Member: Clapperboard,
  MyList: Bookmark,
  Profile: User,
};

const CREATOR_ICONS = {
  CreatorHome: Home,
  CreatorSeries: Layers,
  CreatorAnalytics: BarChart3,
  CreatorEarnings: Wallet,
  CreatorProfile: User,
};

const BottomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const isCreatorNav = state.routes.some((r) => r.name === 'CreatorHome');
  const icons = isCreatorNav ? CREATOR_ICONS : WATCHER_ICONS;

  return (
    <View style={[styles.bar, { paddingBottom: bottom, height: 64 + bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const focused = state.index === index;
        const Icon = icons[route.name] || Home;
        const color = focused ? COLORS.gold : COLORS.textFaint;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.item}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
          >
            <Icon
              size={20}
              color={color}
              fill={focused && (route.name === 'Home' || route.name === 'CreatorHome') ? color : 'transparent'}
            />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: COLORS.navySoft,
    borderTopWidth: 1,
    borderTopColor: '#1C1C38',
    paddingTop: 12,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  item: {
    width: 64,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 9.5,
    fontFamily: FONTS.medium,
  },
});

export default BottomTabBar;
