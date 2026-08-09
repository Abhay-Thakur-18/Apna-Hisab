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

export default function SignupScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      alert('Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    const success = await register(name, email, password);
    if (success) {
      // Authenticated automatically
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}
      >
        <ScrollView contentContainerStyle={tw`flex-grow justify-center px-6 py-8`}>
          {/* Logo Section */}
          <View style={tw`items-center mb-8`}>
            <View style={tw`w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center shadow-md mb-3`}>
              <Text style={tw`text-white text-2xl font-bold`}>AH</Text>
            </View>
            <Text style={tw`text-xl font-bold text-gray-900 tracking-wide`}>
              APNA HISAB
            </Text>
            <Text style={tw`text-xs text-gray-500 font-medium mt-0.5`}>
              Har Paise Ka Hisab.
            </Text>
          </View>

          {/* Form Card */}
          <View style={tw`bg-white rounded-2xl p-6 shadow-sm border border-gray-100`}>
            <Text style={tw`text-lg font-bold text-gray-800 mb-5`}>Create Account</Text>

            {error && (
              <View style={tw`bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg mb-4`}>
                <Text style={tw`text-red-700 text-sm font-medium`}>{error}</Text>
              </View>
            )}

            {/* Name Field */}
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Full Name
              </Text>
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800`}
                placeholder="enter your full name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  clearError();
                }}
              />
            </View>

            {/* Email Field */}
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Email Address
              </Text>
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800`}
                placeholder="enter your email address"
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
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Password
              </Text>
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800`}
                placeholder="create password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError();
                }}
              />
            </View>

            {/* Confirm Password Field */}
            <View style={tw`mb-6`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Confirm Password
              </Text>
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800`}
                placeholder="re-enter password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  clearError();
                }}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={tw`bg-indigo-600 rounded-xl py-3.5 items-center justify-center shadow-sm`}
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={tw`text-white text-base font-bold`}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Navigation Link */}
          <View style={tw`flex-row justify-center mt-6`}>
            <Text style={tw`text-gray-500 text-sm`}>Already have an account? </Text>
            <TouchableOpacity onPress={() => {
              clearError();
              navigation.navigate('Login');
            }}>
              <Text style={tw`text-indigo-600 text-sm font-bold`}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
