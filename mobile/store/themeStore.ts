import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  setTheme: async (theme) => {
    try {
      await AsyncStorage.setItem('theme_mode', theme);
      set({ theme });
    } catch (e) {
      console.log('Error saving theme:', e);
    }
  },
  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem('theme_mode');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ theme: stored });
      } else {
        set({ theme: 'light' });
      }
    } catch (e) {
      set({ theme: 'light' });
    }
  },
}));

export function useIsDark(): boolean {
  const theme = useThemeStore((state) => state.theme);
  const systemScheme = useColorScheme();
  
  if (theme === 'system') {
    return systemScheme === 'dark';
  }
  return theme === 'dark';
}
