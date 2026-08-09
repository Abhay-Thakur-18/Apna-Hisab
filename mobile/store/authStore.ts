import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, setAuthToken, clearAuthToken } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface AuthState {
    token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  appPin: string | null;
  isAppLocked: boolean;
  
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
  setAppPin: (pin: string | null) => Promise<void>;
  unlockApp: (pin: string) => boolean;
  lockApp: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  appPin: null,
  isAppLocked: false,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to login');
      }
      
      await AsyncStorage.setItem('token', data.access_token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setAuthToken(data.access_token);
      
      set({
        token: data.access_token,
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
      return false;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to register');
      }
      
      // Auto login after registration
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(loginData.detail || 'Failed to login after registration');
      }
      
      await AsyncStorage.setItem('token', loginData.access_token);
      await AsyncStorage.setItem('user', JSON.stringify(loginData.user));
      setAuthToken(loginData.access_token);
      
      set({
        token: loginData.access_token,
        user: loginData.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }
      
      await AsyncStorage.setItem('token', data.access_token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setAuthToken(data.access_token);
      
      set({
        token: data.access_token,
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Google login failed', isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      clearAuthToken();
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      const pin = await AsyncStorage.getItem('app_pin');
      
      if (token && userStr) {
        setAuthToken(token);
        // Verify token with backend /me check to ensure session is still valid
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const user = JSON.parse(userStr);
          set({
            token,
            user,
            appPin: pin,
            isAppLocked: pin ? true : false,
            isAuthenticated: true,
            isLoading: false
          });
          return;
        }
      }
      
      // If verification failed or no session found
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      clearAuthToken();
      set({
        token: null,
        user: null,
        appPin: pin,
        isAppLocked: false,
        isAuthenticated: false,
        isLoading: false
      });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  setAppPin: async (pin) => {
    if (pin) {
      await AsyncStorage.setItem('app_pin', pin);
    } else {
      await AsyncStorage.removeItem('app_pin');
    }
    set({ appPin: pin, isAppLocked: false });
  },

  unlockApp: (pin) => {
    // We cannot use get() in simple store setup unless we have get passed in.
    // In our create parameters, `(set, get)` is indeed passed (wait, in line 27 it's `(set) => ({`).
    // Wait, let's look at line 27: export const useAuthStore = create<AuthState>((set) => ({
    // Since `get` is not passed to create, we can just use the state directly. Or we can edit line 27 to add `get`.
    // Actually, we can read the store state using useAuthStore.getState()! That is extremely clean and works everywhere!
    const state = useAuthStore.getState();
    if (pin === state.appPin) {
      set({ isAppLocked: false });
      return true;
    }
    return false;
  },

  lockApp: () => {
    const state = useAuthStore.getState();
    if (state.appPin) {
      set({ isAppLocked: true });
    }
  },
}));
