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

export const themeColors = {
  primary: '#6C5CE7',
  primaryHover: '#5B4BC4',
  primaryLight: '#EEEEFC',
  bgLight: '#F7F7FA',
  bgDark: '#0B0B0F',
  cardLight: '#FFFFFF',
  cardDark: '#161622',
  borderLight: '#EBEBF2',
  borderDark: '#222232',
  textLightPrimary: '#0B0B0F',
  textLightMuted: '#6E6E82',
  textDarkPrimary: '#F7F7FA',
  textDarkMuted: '#9494A8',
  incomeGreen: '#10B981',
  expenseRed: '#EF4444',
};

export function useThemeColors() {
  const isDark = useIsDark();
  return {
    isDark,
    bg: isDark ? themeColors.bgDark : themeColors.bgLight,
    cardBg: isDark ? themeColors.cardDark : themeColors.cardLight,
    borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
    textPrimary: isDark ? themeColors.textDarkPrimary : themeColors.textLightPrimary,
    textMuted: isDark ? themeColors.textDarkMuted : themeColors.textLightMuted,
    primary: themeColors.primary,
    incomeGreen: themeColors.incomeGreen,
    expenseRed: themeColors.expenseRed,
  };
}

