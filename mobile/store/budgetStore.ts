import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Budget {
  id: string;
  month: string; // e.g. "2026-08"
  category: string; // "overall" or category name e.g. "Food"
  amount: number; // amount in paise
  created_at: string;
}

interface BudgetState {
  budgets: Budget[];
  monthlyBudget: number; // overall budget for current month in paise
  categoryBudgets: Record<string, number>; // category -> paise for current month

  loadBudget: () => Promise<void>;
  saveBudget: (month: string, category: string, amountPaise: number) => Promise<boolean>;
  deleteBudget: (id: string) => Promise<boolean>;
  setMonthlyBudget: (amountPaise: number) => Promise<void>;
  setCategoryBudget: (category: string, amountPaise: number) => Promise<void>;
  removeCategoryBudget: (category: string) => Promise<void>;
}

export const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  monthlyBudget: 0,
  categoryBudgets: {},

  loadBudget: async () => {
    try {
      const stored = await AsyncStorage.getItem('offline_budgets_list');
      let list: Budget[] = stored ? JSON.parse(stored) : [];

      // Migration check from legacy single monthly_budget & category_budgets
      if (list.length === 0) {
        const mbStr = await AsyncStorage.getItem('monthly_budget');
        const cbStr = await AsyncStorage.getItem('category_budgets');
        const currentMonth = getCurrentMonthKey();

        if (mbStr && parseInt(mbStr, 10) > 0) {
          list.push({
            id: `b-overall-${currentMonth}`,
            month: currentMonth,
            category: 'overall',
            amount: parseInt(mbStr, 10),
            created_at: new Date().toISOString(),
          });
        }
        if (cbStr) {
          const cbObj = JSON.parse(cbStr);
          Object.entries(cbObj).forEach(([cat, val]) => {
            if (typeof val === 'number' && val > 0) {
              list.push({
                id: `b-${cat}-${currentMonth}`,
                month: currentMonth,
                category: cat,
                amount: val,
                created_at: new Date().toISOString(),
              });
            }
          });
        }
        if (list.length > 0) {
          await AsyncStorage.setItem('offline_budgets_list', JSON.stringify(list));
        }
      }

      const currentMonth = getCurrentMonthKey();
      const overall = list.find((b) => b.month === currentMonth && b.category === 'overall');
      const catMap: Record<string, number> = {};
      list
        .filter((b) => b.month === currentMonth && b.category !== 'overall')
        .forEach((b) => {
          catMap[b.category] = b.amount;
        });

      set({
        budgets: list,
        monthlyBudget: overall ? overall.amount : 0,
        categoryBudgets: catMap,
      });
    } catch (e) {
      console.log('Error loading budgets:', e);
    }
  },

  saveBudget: async (month: string, category: string, amountPaise: number) => {
    try {
      const currentList = [...get().budgets];
      const existingIdx = currentList.findIndex((b) => b.month === month && b.category === category);

      if (existingIdx >= 0) {
        currentList[existingIdx] = {
          ...currentList[existingIdx],
          amount: amountPaise,
        };
      } else {
        currentList.push({
          id: `b-${category}-${month}-${Date.now()}`,
          month,
          category,
          amount: amountPaise,
          created_at: new Date().toISOString(),
        });
      }

      await AsyncStorage.setItem('offline_budgets_list', JSON.stringify(currentList));

      const currentMonth = getCurrentMonthKey();
      const overall = currentList.find((b) => b.month === currentMonth && b.category === 'overall');
      const catMap: Record<string, number> = {};
      currentList
        .filter((b) => b.month === currentMonth && b.category !== 'overall')
        .forEach((b) => {
          catMap[b.category] = b.amount;
        });

      set({
        budgets: currentList,
        monthlyBudget: overall ? overall.amount : 0,
        categoryBudgets: catMap,
      });
      return true;
    } catch (e) {
      console.error('Error saving budget:', e);
      return false;
    }
  },

  deleteBudget: async (id: string) => {
    try {
      const currentList = get().budgets.filter((b) => b.id !== id);
      await AsyncStorage.setItem('offline_budgets_list', JSON.stringify(currentList));

      const currentMonth = getCurrentMonthKey();
      const overall = currentList.find((b) => b.month === currentMonth && b.category === 'overall');
      const catMap: Record<string, number> = {};
      currentList
        .filter((b) => b.month === currentMonth && b.category !== 'overall')
        .forEach((b) => {
          catMap[b.category] = b.amount;
        });

      set({
        budgets: currentList,
        monthlyBudget: overall ? overall.amount : 0,
        categoryBudgets: catMap,
      });
      return true;
    } catch (e) {
      console.error('Error deleting budget:', e);
      return false;
    }
  },

  setMonthlyBudget: async (amountPaise: number) => {
    const currentMonth = getCurrentMonthKey();
    await get().saveBudget(currentMonth, 'overall', amountPaise);
  },

  setCategoryBudget: async (category: string, amountPaise: number) => {
    const currentMonth = getCurrentMonthKey();
    await get().saveBudget(currentMonth, category, amountPaise);
  },

  removeCategoryBudget: async (category: string) => {
    const currentMonth = getCurrentMonthKey();
    const target = get().budgets.find((b) => b.month === currentMonth && b.category === category);
    if (target) {
      await get().deleteBudget(target.id);
    }
  },
}));
