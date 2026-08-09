import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Please fill all fields');
      return;
    }
    const success = await login(email, password);
    if (success) {
      // Navigation will update automatically because of the auth state listener in App.tsx
    }
  };

  const handleGoogleLogin = async () => {
    // In local development, we verify the Google integration via a simulated flow
    // or by accepting a mock token. Let's provide a mock prompt for demonstration:
    const mockGoogleToken = "mock-google-id-token-123456";
    const success = await loginWithGoogle(mockGoogleToken);
    if (success) {
      // Logged in
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}
      >
        <ScrollView contentContainerStyle={tw`flex-grow justify-center px-6 py-12`}>
          {/* Logo Section */}
          <View style={tw`items-center mb-10`}>
            <View style={tw`w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center shadow-md mb-4`}>
              <Text style={tw`text-white text-3xl font-bold`}>AH</Text>
            </View>
            <Text style={tw`text-2xl font-bold text-gray-900 tracking-wide`}>
              APNA HISAB
            </Text>
            <Text style={tw`text-sm text-gray-500 font-medium mt-1`}>
              Har Paise Ka Hisab.
            </Text>
          </View>

          {/* Form Card */}
          <View style={tw`bg-white rounded-2xl p-6 shadow-sm border border-gray-100`}>
            <Text style={tw`text-lg font-bold text-gray-800 mb-6`}>Log In</Text>

            {error && (
              <View style={tw`bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg mb-4`}>
                <Text style={tw`text-red-700 text-sm font-medium`}>{error}</Text>
              </View>
            )}

            {/* Email Field */}
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Email Address
              </Text>
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800`}
                placeholder="enter your email"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  clearError();
                }}
              />
            </View>

            {/* Password Field */}
            <View style={tw`mb-6`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Password
              </Text>
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800`}
                placeholder="enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError();
                }}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={tw`bg-indigo-600 rounded-xl py-3.5 items-center justify-center shadow-sm`}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={tw`text-white text-base font-bold`}>Log In</Text>
              )}
            </TouchableOpacity>

            {/* Google Sign-In */}
            <TouchableOpacity
              style={tw`border border-gray-200 rounded-xl py-3.5 items-center justify-center flex-row mt-3`}
              onPress={handleGoogleLogin}
              disabled={isLoading}
            >
              <View style={tw`w-5 h-5 rounded-full bg-red-500 mr-2 items-center justify-center`}>
                <Text style={tw`text-white text-xs font-bold`}>G</Text>
              </View>
              <Text style={tw`text-gray-700 text-sm font-semibold`}>
                Continue with Google
              </Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Link */}
          <View style={tw`flex-row justify-center mt-6`}>
            <Text style={tw`text-gray-500 text-sm`}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => {
              clearError();
              navigation.navigate('Signup');
            }}>
              <Text style={tw`text-indigo-600 text-sm font-bold`}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
