import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { User, Shield, Moon, Download, Upload, Camera, FileText } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, useIsDark } from '../store/themeStore';
import Toast from '../components/Toast';

export default function ProfileScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const isDark = useIsDark();

  const [name, setName] = useState(user?.name || 'Offline User');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    // Load local avatar preference
    AsyncStorage.getItem('user_avatar').then((uri) => {
      if (uri) setAvatarUri(uri);
    });
    AsyncStorage.getItem('user_name').then((n) => {
      if (n) setName(n);
    });
  }, []);

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setAvatarUri(uri);
        await AsyncStorage.setItem('user_avatar', uri);
        setToastMessage('Profile photo updated!');
        setToastVisible(true);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select image.');
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    await AsyncStorage.setItem('user_name', name.trim());
    setToastMessage('Profile name saved!');
    setToastVisible(true);
  };

  const bg = isDark ? '#111827' : '#f9fafb';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#f3f4f6';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={cardBg}
      />

      <Toast visible={toastVisible} message={toastMessage} type="success" />

      {/* Header */}
      <View style={[tw`px-6 py-4 border-b flex-row justify-between items-center`, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>My Profile</Text>
        <TouchableOpacity onPress={handleSaveName}>
          <Text style={tw`text-violet-600 dark:text-violet-400 font-bold text-sm`}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={tw`p-6 pb-24`}>
        {/* User Avatar Card */}
        <View style={[tw`border rounded-3xl p-6 items-center shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <TouchableOpacity onPress={handlePickAvatar} style={tw`relative mb-4`}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={tw`w-24 h-24 rounded-full border-2 border-violet-600`} />
            ) : (
              <View style={tw`w-24 h-24 bg-violet-100 dark:bg-violet-950 rounded-full justify-center items-center border-2 border-violet-500`}>
                <Text style={tw`text-violet-600 dark:text-violet-400 text-4xl font-black`}>
                  {name.charAt(0).toUpperCase() || 'A'}
                </Text>
              </View>
            )}
            <View style={tw`absolute bottom-0 right-0 bg-violet-600 p-2 rounded-full border-2 border-white dark:border-gray-800`}>
              <Camera color="#ffffff" size={14} />
            </View>
          </TouchableOpacity>

          <TextInput
            style={[
              tw`text-xl font-bold text-center border-b pb-1 px-4 mb-1`,
              { color: textPrimary, borderColor: isDark ? '#4b5563' : '#e5e7eb' },
            ]}
            value={name}
            onChangeText={setName}
            onEndEditing={handleSaveName}
          />
          <Text style={[tw`text-xs mt-1`, { color: textMuted }]}>
            {user?.email || 'Personal Finance Account'}
          </Text>
        </View>

        {/* Financial Preferences */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`text-sm font-bold mb-3`, { color: textPrimary }]}>
            App & Regional Preferences
          </Text>
          <View style={tw`flex-row justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800`}>
            <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>Currency</Text>
            <Text style={tw`text-xs font-bold text-violet-600 dark:text-violet-400`}>Indian Rupee (₹)</Text>
          </View>
          <View style={tw`flex-row justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800`}>
            <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>Data Engine</Text>
            <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>Offline Local First + Cloud Sync</Text>
          </View>
          <View style={tw`flex-row justify-between items-center py-2`}>
            <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>App Version</Text>
            <Text style={[tw`text-xs font-bold`, { color: textMuted }]}>v1.2.0 (Build 3)</Text>
          </View>
        </View>

        {/* Quick Settings Links */}
        <View style={[tw`border rounded-3xl overflow-hidden shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <TouchableOpacity
            style={[tw`flex-row items-center px-5 py-4 border-b gap-3`, { borderColor }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Shield color="#7c3aed" size={20} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Security & Passcode</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Manage app PIN lock</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center px-5 py-4 gap-3`}
            onPress={() => navigation.navigate('Settings')}
          >
            <Download color="#7c3aed" size={20} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Backup & Statement Export</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Export CSV or JSON backup files</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
