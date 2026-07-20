import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import MainNavigator from './MainNavigator';
import CustomDrawerContent from './CustomDrawerContent';
import { COLORS } from '../constants/theme';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: '#08081a',
          width: '80%',
        },
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.7)',
        sceneContainerStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainNavigator} />
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
