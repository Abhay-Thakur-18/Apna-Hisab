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
  const bottomPadding = Math.max(insets.bottom, 8);
  const tabHeight = 56 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          tw`border-t border-gray-200 dark:border-gray-800`,
          {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            height: tabHeight,
            paddingBottom: bottomPadding,
            paddingTop: 6,
          },
        ],
        tabBarLabelStyle: tw`text-[10px] font-semibold mt-0.5`,
        headerStyle: [
          tw`border-b border-gray-100 dark:border-gray-800`,
          { backgroundColor: isDark ? '#1f2937' : '#ffffff' },
        ],
        headerTitleStyle: [
          tw`font-bold text-lg`,
          { color: isDark ? '#ffffff' : '#1f2937' },
        ],
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          title: 'History',
          headerShown: false,
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <HistoryIcon color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="Khata"
        component={KhataScreen}
        options={{
          title: 'Khata',
          headerShown: false,
          tabBarLabel: 'Khata',
          tabBarIcon: ({ color, size }) => <WalletIcon color={color} size={size - 2} />,
        }}
      />

      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: 'Analytics',
          headerShown: false,
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, size }) => <AnalyticsIcon color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size - 2} />,
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
