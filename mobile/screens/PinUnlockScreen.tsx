import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useAuthStore } from '../store/authStore';

export default function PinUnlockScreen() {
  const { unlockApp, logout } = useAuthStore();
  const [pin, setPin] = useState('');

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      // Auto verify when 4 digits are completed
      if (nextPin.length === 4) {
        // Give a tiny timeout so the 4th dot turns active visually before verification alerts
        setTimeout(() => {
          const success = unlockApp(nextPin);
          if (!success) {
            Alert.alert('Invalid PIN', 'The passcode you entered is incorrect.');
            setPin(''); // clear
          }
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Passcode',
      'For your data protection, you must log out of Apna Hisab and sign in again to clear/reset your passcode lock. Proceed to Log Out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-white justify-between py-12`}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={tw`items-center mt-6`}>
        <View style={tw`w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center mb-4`}>
          <Text style={tw`text-white text-2xl font-bold`}>AH</Text>
        </View>
        <Text style={tw`text-lg font-bold text-gray-800`}>App Locked</Text>
        <Text style={tw`text-xs text-gray-400 mt-1`}>
          Enter your 4-digit PIN to unlock Apna Hisab
        </Text>
      </View>

      {/* Dots Indicator */}
      <View style={tw`flex-row justify-center gap-6 my-8`}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={tw`w-4 h-4 rounded-full border-2 border-indigo-600 ${
              pin.length > index ? 'bg-indigo-600' : 'bg-transparent'
            }`}
          />
        ))}
      </View>

      {/* keypad */}
      <View style={tw`px-12`}>
        <View style={tw`flex-col gap-5`}>
          {/* Row 1-3 */}
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ].map((row, idx) => (
            <View key={idx} style={tw`flex-row justify-between`}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={tw`w-18 h-18 bg-gray-50 border border-gray-100 rounded-full items-center justify-center shadow-sm`}
                  onPress={() => handleKeyPress(num)}
                >
                  <Text style={tw`text-xl font-bold text-gray-700`}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          
          {/* Row 4 (Reset, 0, Backspace) */}
          <View style={tw`flex-row justify-between items-center`}>
            <TouchableOpacity
              style={tw`w-18 h-18 items-center justify-center`}
              onPress={handleReset}
            >
              <Text style={tw`text-indigo-600 text-xs font-bold text-center`}>
                Forgot?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`w-18 h-18 bg-gray-50 border border-gray-100 rounded-full items-center justify-center shadow-sm`}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={tw`text-xl font-bold text-gray-700`}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`w-18 h-18 items-center justify-center`}
              onPress={handleBackspace}
            >
              <Text style={tw`text-gray-500 text-sm font-bold`}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
