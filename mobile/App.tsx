import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import {
  Home as HomeIcon,
  History as HistoryIcon,
  Wallet as WalletIcon,
  PieChart as AnalyticsIcon,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { useAuthStore } from './store/authStore';
import { useThemeStore, useIsDark } from './store/themeStore';
import { processSyncQueue } from './services/syncService';

// Screens
import HomeScreen from './screens/HomeScreen';
import AddTransactionScreen from './screens/AddTransactionScreen';
import KhataScreen from './screens/KhataScreen';
import ReportsScreen from './screens/ReportsScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PinUnlockScreen from './screens/PinUnlockScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AppTabs() {
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  const tabHeight = 58 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#6C5CE7',
        tabBarInactiveTintColor: isDark ? '#8E8EA0' : '#6E6E82',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: isDark ? '#0B0B0F' : '#ffffff',
          borderTopColor: isDark ? '#222232' : '#EBEBF2',
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 3,
        },
        headerStyle: {
          backgroundColor: isDark ? '#0B0B0F' : '#ffffff',
          borderBottomColor: isDark ? '#222232' : '#EBEBF2',
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: isDark ? '#F7F7FA' : '#0B0B0F',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} size={22} />,
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          title: 'History',
          headerShown: false,
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <HistoryIcon color={color} size={22} />,
        }}
      />
      <Tab.Screen
        name="Khata"
        component={KhataScreen}
        options={{
          title: 'Khata',
          headerShown: false,
          tabBarLabel: 'Khata',
          tabBarIcon: ({ color }) => <WalletIcon color={color} size={22} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: 'Analytics',
          headerShown: false,
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color }) => <AnalyticsIcon color={color} size={22} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <SettingsIcon color={color} size={22} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isAppLocked, restoreSession, lockApp } = useAuthStore();
  const { loadTheme } = useThemeStore();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Load persisted theme preference and session
    loadTheme();
    restoreSession();

    // App background/foreground lock listener
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        lockApp();
      }
      appState.current = nextAppState;
    });

    // Periodically process offline sync queue (every 30 seconds)
    const syncInterval = setInterval(() => {
      processSyncQueue();
    }, 30000);

    // Process immediately on mount/boot
    processSyncQueue();

    return () => {
      subscription.remove();
      clearInterval(syncInterval);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isAppLocked ? (
            <Stack.Screen name="PinUnlock" component={PinUnlockScreen} />
          ) : (
            <>
              <Stack.Screen name="AppTabs" component={AppTabs} />
              <Stack.Screen
                name="AddTransaction"
                component={AddTransactionScreen}
                options={{
                  presentation: 'modal',
                  cardStyle: { backgroundColor: 'transparent' },
                }}
              />
              <Stack.Screen name="Profile" component={ProfileScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
