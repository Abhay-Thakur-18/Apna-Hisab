import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auto-resolve local IP of development machine during local Expo debugging
// Auto-resolve local IP of development machine during local Expo debugging
let localIp = '127.0.0.1';
const hostUri = Constants.expoConfig?.hostUri;
if (hostUri) {
  localIp = hostUri.split(':')[0];
}

// Support dev host resolution and production endpoints fallback via build env variable
export const API_URL = process.env.EXPO_PUBLIC_API_URL || (
  __DEV__ 
    ? `http://${localIp}:8000`
    : 'https://api.apnahisab.com' // Production secure HTTPS fallback (no cleartext HTTP errors)
);

let authToken: string | null = null;

export const setAuthToken = (token: string) => {
  authToken = token;
};

export const clearAuthToken = () => {
  authToken = null;
};

// Generic fetch client with JWT authorization token injection
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (!authToken) {
    authToken = await AsyncStorage.getItem('token');
  }
  
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  // If unauthorized session, clear token and throw error
  if (response.status === 401) {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    authToken = null;
    throw new Error('Session expired. Please log in again.');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'An error occurred');
  }
  
  return data;
};
