import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  BackHandler,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Lock } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useIsDark } from '../store/themeStore';

export default function PinUnlockScreen() {
  const { unlockApp, logout } = useAuthStore();
  const isDark = useIsDark();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Intercept Android hardware Back button so app cannot bypass unlock screen
  useEffect(() => {
    const onBackPress = () => {
      return true; // Return true to disable default back action
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const handleKeyPress = (num: string) => {
    setErrorMessage('');
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);

      // Auto verify when 4 digits are entered
      if (nextPin.length === 4) {
        setTimeout(() => {
          const success = unlockApp(nextPin);
          if (!success) {
            try {
              Vibration.vibrate(100);
            } catch {}
            setErrorMessage('Incorrect PIN. Please try again.');
            setPin('');
          }
        }, 80);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMessage('');
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Forgot Passcode?',
      'You can disable the passcode lock or clear app settings by proceeding with reset.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out & Reset', style: 'destructive', onPress: logout },
      ]
    );
  };

  const bg = isDark ? '#0B0B0F' : '#F7F7FA';
  const textPrimary = isDark ? '#F7F7FA' : '#0B0B0F';
  const textMuted = isDark ? '#9494A8' : '#6E6E82';
  const keyBg = isDark ? '#161622' : '#ffffff';
  const keyBorder = isDark ? '#222232' : '#EBEBF2';

  return (
    <SafeAreaView style={[tw`flex-1 justify-between py-10 px-6`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />

      {/* Header Branding */}
      <View style={tw`items-center mt-6`}>
        <View style={tw`w-16 h-16 bg-[#6C5CE7] rounded-3xl items-center justify-center mb-4 shadow-lg`}>
          <Lock color="#ffffff" size={30} />
        </View>
        <Text style={[tw`text-2xl font-extrabold tracking-tight`, { color: textPrimary }]}>
          Apna Hisab
        </Text>
        <Text style={[tw`text-xs mt-1 font-semibold`, { color: textMuted }]}>
          Enter 4-digit PIN to unlock
        </Text>

        {errorMessage ? (
          <View style={tw`bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl px-4 py-2 mt-4`}>
            <Text style={tw`text-rose-600 dark:text-rose-400 text-xs font-bold`}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Dots Indicator */}
      <View style={tw`flex-row justify-center gap-6 my-6`}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              tw`w-4 h-4 rounded-full border-2 border-[#6C5CE7]`,
              pin.length > index ? { backgroundColor: '#6C5CE7' } : { backgroundColor: 'transparent' },
            ]}
          />
        ))}
      </View>

      {/* Keypad Grid */}
      <View style={tw`px-6 mb-6`}>
        <View style={tw`gap-4`}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row, idx) => (
            <View key={idx} style={tw`flex-row justify-around`}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    tw`w-20 h-20 rounded-full items-center justify-center border shadow-sm`,
                    { backgroundColor: keyBg, borderColor: keyBorder },
                  ]}
                  onPress={() => handleKeyPress(num)}
                  activeOpacity={0.7}
                >
                  <Text style={[tw`text-2xl font-bold`, { color: textPrimary }]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Row 4 (Forgot, 0, Backspace) */}
          <View style={tw`flex-row justify-around items-center`}>
            <TouchableOpacity
              style={tw`w-20 h-20 items-center justify-center`}
              onPress={handleReset}
            >
              <Text style={tw`text-indigo-500 text-xs font-bold text-center`}>
                Forgot?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                tw`w-20 h-20 rounded-full items-center justify-center border shadow-sm`,
                { backgroundColor: keyBg, borderColor: keyBorder },
              ]}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
            >
              <Text style={[tw`text-2xl font-bold`, { color: textPrimary }]}>
                0
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`w-20 h-20 items-center justify-center`}
              onPress={handleBackspace}
            >
              <Text style={[tw`text-xl font-bold`, { color: textMuted }]}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
