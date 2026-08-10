import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BudgetState {
  monthlyBudget: number; // in paise
  categoryBudgets: Record<string, number>; // category -> paise
  loadBudget: () => Promise<void>;
  setMonthlyBudget: (amountPaise: number) => Promise<void>;
  setCategoryBudget: (category: string, amountPaise: number) => Promise<void>;
  removeCategoryBudget: (category: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  monthlyBudget: 0,
  categoryBudgets: {},

  loadBudget: async () => {
    try {
      const mbStr = await AsyncStorage.getItem('monthly_budget');
      const cbStr = await AsyncStorage.getItem('category_budgets');

      const mb = mbStr ? parseInt(mbStr, 10) : 0;
      const cb = cbStr ? JSON.parse(cbStr) : {};

      set({ monthlyBudget: mb, categoryBudgets: cb });
    } catch (e) {
      console.log('Error loading budget:', e);
    }
  },

  setMonthlyBudget: async (amountPaise: number) => {
    try {
      await AsyncStorage.setItem('monthly_budget', amountPaise.toString());
      set({ monthlyBudget: amountPaise });
    } catch (e) {
      console.error('Error saving monthly budget:', e);
    }
  },

  setCategoryBudget: async (category: string, amountPaise: number) => {
    try {
      const current = { ...get().categoryBudgets, [category]: amountPaise };
      await AsyncStorage.setItem('category_budgets', JSON.stringify(current));
      set({ categoryBudgets: current });
    } catch (e) {
      console.error('Error saving category budget:', e);
    }
  },

  removeCategoryBudget: async (category: string) => {
    try {
      const current = { ...get().categoryBudgets };
      delete current[category];
      await AsyncStorage.setItem('category_budgets', JSON.stringify(current));
      set({ categoryBudgets: current });
    } catch (e) {
      console.error('Error removing category budget:', e);
    }
  },
}));
