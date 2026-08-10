import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useAuthStore } from './store/authStore';
import { useThemeStore, useIsDark } from './store/themeStore';
import { processSyncQueue } from './services/syncService';
import { OFFLINE_ONLY } from './services/api';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import AddTransactionScreen from './screens/AddTransactionScreen';
import KhataScreen from './screens/KhataScreen';
import ReportsScreen from './screens/ReportsScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PinUnlockScreen from './screens/PinUnlockScreen';
import ChecklistScreen from './screens/ChecklistScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AppTabs() {
  const isDark = useIsDark();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          tw`border-t border-gray-150 h-16 pb-2 pt-2`,
          { backgroundColor: isDark ? '#1f2937' : '#ffffff' },
        ],
        headerStyle: [
          tw`border-b border-gray-100`,
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
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'History' }}
      />
      <Tab.Screen
        name="Khata"
        component={KhataScreen}
        options={{ title: 'Khata' }}
      />
      <Tab.Screen
        name="Checklist"
        component={ChecklistScreen}
        options={{ title: 'Checklist', headerShown: false }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Analytics' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isAuthenticated, isLoading, isAppLocked, restoreSession } = useAuthStore();
  const { loadTheme } = useThemeStore();

  useEffect(() => {
    // Load persisted theme preference
    loadTheme();
    restoreSession();

    if (OFFLINE_ONLY) return;

    // Periodically process offline sync queue (every 30 seconds)
    const syncInterval = setInterval(() => {
      processSyncQueue();
    }, 30000);

    // Process immediately on mount/boot
    processSyncQueue();

    return () => clearInterval(syncInterval);
  }, []);

  if (isLoading && !OFFLINE_ONLY) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-gray-50`}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={tw`text-gray-500 text-sm font-semibold mt-4`}>
          Securing session...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {OFFLINE_ONLY ? (
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
            </>
          ) : isAuthenticated ? (
            isAppLocked ? (
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
              </>
            )
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
