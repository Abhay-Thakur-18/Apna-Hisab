import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, OFFLINE_ONLY } from '../services/api';
import { queueOfflineAction, processSyncQueue } from '../services/syncService';

export interface Transaction {
  id: string;
  user_id?: string;
  amount: number;
  paid_amount: number;
  pending_amount: number;
  type: 'income' | 'expense';
  status: 'paid' | 'pending' | 'partially_paid';
  category: string;
  subcategory: string;
  payment_method: string;
  date: string;
  time: string;
  description: string;
  khata_id?: string | null;
  khata_type?: 'udhar_diya' | 'udhar_liya' | null;
  recurring_id?: string | null;
  client_ref_id?: string;
  created_at: string;
  updated_at: string;
}

export interface KhataAccount {
  id: string;
  name: string;
  description: string;
  total_pending: number;
  total_paid: number;
  outstanding: number;
  total_udhar_diya_pending: number;
  total_udhar_liya_pending: number;
  created_at: string;
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color?: string;
  type: 'income' | 'expense';
}

interface TransactionState {
  transactions: Transaction[];
  khataAccounts: KhataAccount[];
  customCategories: CustomCategory[];
  isLoading: boolean;
  error: string | null;

  // Last-used defaults for quick entry
  lastUsedExpenseCategory: string | null;
  lastUsedExpenseSubcategory: string | null;
  lastUsedPaymentMethod: string | null;
  lastUsedIncomeCategory: string | null;

  // Single Source of Truth Selectors
  getTotalIncome: () => number;
  getTotalExpenses: () => number;
  getCurrentBalance: () => number;

  fetchTransactions: () => Promise<void>;
  addTransaction: (txData: any) => Promise<boolean>;
  updateTransaction: (id: string, updatedFields: any) => Promise<boolean>;
  recordPayment: (paymentData: any) => Promise<boolean>;
  fetchKhataAccounts: () => Promise<void>;
  createKhataAccount: (name: string, description: string) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  deleteKhataAccount: (id: string) => Promise<boolean>;
  loadLastUsedDefaults: () => Promise<void>;

  // Custom Category Actions
  loadCustomCategories: () => Promise<void>;
  addCustomCategory: (cat: Omit<CustomCategory, 'id'>) => Promise<boolean>;
  deleteCustomCategory: (id: string) => Promise<boolean>;
}

/**
 * Computes live Khata account metrics from the local transaction list.
 */
function computeKhataMetrics(accounts: KhataAccount[], transactions: Transaction[]): KhataAccount[] {
  return accounts.map((acc) => {
    const accTx = transactions.filter((t) => t.khata_id === acc.id);
    let total_pending = 0;
    let total_paid = 0;
    let total_udhar_diya_pending = 0;
    let total_udhar_liya_pending = 0;

    accTx.forEach((t) => {
      total_pending += (t.pending_amount || 0);
      total_paid += (t.paid_amount || 0);

      const kType = t.khata_type || (t.type === 'expense' ? 'udhar_diya' : 'udhar_liya');
      if (kType === 'udhar_diya') {
        total_udhar_diya_pending += (t.pending_amount || 0);
      } else {
        total_udhar_liya_pending += (t.pending_amount || 0);
      }
    });

    return {
      ...acc,
      total_pending,
      total_paid,
      outstanding: total_pending,
      total_udhar_diya_pending,
      total_udhar_liya_pending,
    };
  });
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  khataAccounts: [],
  customCategories: [],
  isLoading: false,
  error: null,

  lastUsedExpenseCategory: null,
  lastUsedExpenseSubcategory: null,
  lastUsedPaymentMethod: 'UPI',
  lastUsedIncomeCategory: null,

  // Single Source of Truth Money Engine
  getTotalIncome: () => {
    return get().transactions.reduce((sum, tx) => {
      if (tx.type === 'income') {
        return sum + (tx.amount || 0);
      }
      return sum;
    }, 0);
  },

  getTotalExpenses: () => {
    return get().transactions.reduce((sum, tx) => {
      if (tx.type === 'expense') {
        return sum + (tx.paid_amount || tx.amount || 0);
      }
      return sum;
    }, 0);
  },

  getCurrentBalance: () => {
    return get().getTotalIncome() - get().getTotalExpenses();
  },

  loadLastUsedDefaults: async () => {
    try {
      const cat = await AsyncStorage.getItem('last_expense_cat');
      const sub = await AsyncStorage.getItem('last_expense_sub');
      const pay = await AsyncStorage.getItem('last_payment_method');
      const inc = await AsyncStorage.getItem('last_income_cat');

      set({
        lastUsedExpenseCategory: cat,
        lastUsedExpenseSubcategory: sub,
        lastUsedPaymentMethod: pay || 'UPI',
        lastUsedIncomeCategory: inc,
      });
    } catch (e) {
      // Ignore storage errors
    }
  },

  loadCustomCategories: async () => {
    try {
      const stored = await AsyncStorage.getItem('offline_custom_categories');
      if (stored) {
        set({ customCategories: JSON.parse(stored) });
      }
    } catch (e) {
      console.log('Error loading custom categories:', e);
    }
  },

  addCustomCategory: async (catData) => {
    try {
      const newCat: CustomCategory = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...catData,
      };
      const updated = [...get().customCategories, newCat];
      set({ customCategories: updated });
      await AsyncStorage.setItem('offline_custom_categories', JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error adding custom category:', e);
      return false;
    }
  },

  deleteCustomCategory: async (id) => {
    try {
      const updated = get().customCategories.filter((c) => c.id !== id);
      set({ customCategories: updated });
      await AsyncStorage.setItem('offline_custom_categories', JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error deleting custom category:', e);
      return false;
    }
  },

  fetchTransactions: async () => {
    try {
      const cached = await AsyncStorage.getItem('offline_transactions');
      if (cached) {
        const parsed: Transaction[] = JSON.parse(cached);
        parsed.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
        });
        set({ transactions: parsed });
      }
    } catch (e) {
      console.log('Error loading cached transactions:', e);
    }

    if (OFFLINE_ONLY) return;

    try {
      const data = await apiRequest('/api/transactions?limit=100');
      if (Array.isArray(data)) {
        data.sort((a: Transaction, b: Transaction) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
        });
        set({ transactions: data });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(data));
      }
    } catch (err: any) {
      console.log('[Offline] Using local transactions data.');
    }
  },

  fetchKhataAccounts: async () => {
    try {
      const cachedAccounts = await AsyncStorage.getItem('offline_khata_accounts');
      const accountsList: KhataAccount[] = cachedAccounts ? JSON.parse(cachedAccounts) : [];
      const computed = computeKhataMetrics(accountsList, get().transactions);
      set({ khataAccounts: computed });
    } catch (e) {
      console.log('Error loading cached Khata accounts:', e);
    }

    if (OFFLINE_ONLY) return;

    try {
      const data = await apiRequest('/api/khata');
      if (Array.isArray(data)) {
        const computed = computeKhataMetrics(data, get().transactions);
        set({ khataAccounts: computed });
        await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(computed));
      }
    } catch (err: any) {
      console.log('[Offline] Using local Khata accounts data.');
    }
  },

  addTransaction: async (txData) => {
    try {
      const amount = txData.amount;
      const status = txData.status || 'paid';
      let paid_amount = amount;
      let pending_amount = 0;

      if (status === 'pending') {
        paid_amount = 0;
        pending_amount = amount;
      } else if (status === 'partially_paid') {
        paid_amount = txData.paid_amount || 0;
        pending_amount = amount - paid_amount;
      }

      const clientRefId = txData.client_ref_id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const txId = txData.id || clientRefId;

      const khataType = txData.khata_type || (txData.type === 'expense' ? 'udhar_diya' : 'udhar_liya');

      const localTx: Transaction = {
        id: txId,
        user_id: 'local_user',
        amount,
        paid_amount,
        pending_amount,
        type: txData.type,
        status,
        category: txData.category,
        subcategory: txData.subcategory || 'General',
        payment_method: txData.payment_method || 'None',
        date: txData.date,
        time: txData.time,
        description: txData.description || '',
        khata_id: txData.khata_id || null,
        khata_type: txData.khata_id ? khataType : null,
        client_ref_id: clientRefId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const currentList = get().transactions.filter((t) => t.id !== txId);
      const updatedTxList = [localTx, ...currentList].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });

      const updatedKhataAccounts = computeKhataMetrics(get().khataAccounts, updatedTxList);

      set({
        transactions: updatedTxList,
        khataAccounts: updatedKhataAccounts,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedTxList));
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedKhataAccounts));

      if (localTx.type === 'expense') {
        await AsyncStorage.setItem('last_expense_cat', localTx.category);
        await AsyncStorage.setItem('last_expense_sub', localTx.subcategory);
        if (localTx.payment_method !== 'None') {
          await AsyncStorage.setItem('last_payment_method', localTx.payment_method);
        }
        set({
          lastUsedExpenseCategory: localTx.category,
          lastUsedExpenseSubcategory: localTx.subcategory,
          lastUsedPaymentMethod: localTx.payment_method !== 'None' ? localTx.payment_method : get().lastUsedPaymentMethod,
        });
      } else {
        await AsyncStorage.setItem('last_income_cat', localTx.category);
        set({ lastUsedIncomeCategory: localTx.category });
      }

      await queueOfflineAction('add_transaction', localTx, txId);
      processSyncQueue().catch((e) => console.log('Background sync trigger:', e));

      return true;
    } catch (e: any) {
      console.error('Error saving transaction locally:', e);
      set({ error: e.message || 'Failed to save transaction locally', isLoading: false });
      return false;
    }
  },

  updateTransaction: async (id, updatedFields) => {
    try {
      const updatedList = get().transactions.map((t) => {
        if (t.id === id) {
          const updated = {
            ...t,
            ...updatedFields,
            updated_at: new Date().toISOString(),
          };

          if (updatedFields.amount !== undefined || updatedFields.status !== undefined) {
            const amt = updatedFields.amount !== undefined ? updatedFields.amount : t.amount;
            const stat = updatedFields.status !== undefined ? updatedFields.status : t.status;
            if (stat === 'paid') {
              updated.paid_amount = amt;
              updated.pending_amount = 0;
            } else if (stat === 'pending') {
              updated.paid_amount = 0;
              updated.pending_amount = amt;
            } else if (stat === 'partially_paid') {
              const paid = updatedFields.paid_amount !== undefined ? updatedFields.paid_amount : t.paid_amount;
              updated.paid_amount = paid;
              updated.pending_amount = amt - paid;
            }
          }
          return updated as Transaction;
        }
        return t;
      });

      const updatedKhataAccounts = computeKhataMetrics(get().khataAccounts, updatedList);

      set({
        transactions: updatedList,
        khataAccounts: updatedKhataAccounts,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedList));
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedKhataAccounts));

      await queueOfflineAction('update_transaction', { id, ...updatedFields });
      processSyncQueue().catch((e) => console.log('Background sync trigger:', e));

      return true;
    } catch (e: any) {
      console.error('Error updating transaction locally:', e);
      set({ error: e.message || 'Failed to update transaction', isLoading: false });
      return false;
    }
  },

  recordPayment: async (paymentData) => {
    try {
      const clientRefId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payWithRef = { ...paymentData, client_ref_id: clientRefId };

      const txList = get().transactions.map((tx) => {
        if (tx.id === paymentData.transaction_id) {
          const newPaid = (tx.paid_amount || 0) + paymentData.amount;
          const newPending = tx.amount - newPaid;
          const newStatus = newPending <= 0 ? 'paid' : 'partially_paid';
          return {
            ...tx,
            paid_amount: newPaid,
            pending_amount: newPending <= 0 ? 0 : newPending,
            status: newStatus as any,
            updated_at: new Date().toISOString(),
          };
        }
        return tx;
      });

      const updatedKhataAccounts = computeKhataMetrics(get().khataAccounts, txList);

      set({
        transactions: txList,
        khataAccounts: updatedKhataAccounts,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem('offline_transactions', JSON.stringify(txList));
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedKhataAccounts));

      await queueOfflineAction('record_payment', payWithRef);
      processSyncQueue().catch((e) => console.log('Background sync trigger:', e));

      return true;
    } catch (e: any) {
      console.error('Error recording payment locally:', e);
      set({ error: e.message || 'Failed to record payment', isLoading: false });
      return false;
    }
  },

  createKhataAccount: async (name, description) => {
    try {
      const clientRefId = `khata-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const localAcc: KhataAccount = {
        id: clientRefId,
        name,
        description: description || '',
        total_pending: 0,
        total_paid: 0,
        outstanding: 0,
        total_udhar_diya_pending: 0,
        total_udhar_liya_pending: 0,
        created_at: new Date().toISOString(),
      };

      const updatedAcc = [...get().khataAccounts, localAcc].sort((a, b) => a.name.localeCompare(b.name));

      set({
        khataAccounts: updatedAcc,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedAcc));

      const khataWithRef = { id: clientRefId, name, description, client_ref_id: clientRefId };
      await queueOfflineAction('create_khata', khataWithRef, clientRefId);
      processSyncQueue().catch((e) => console.log('Background sync trigger:', e));

      return true;
    } catch (e: any) {
      console.error('Error creating Khata account locally:', e);
      set({ error: e.message || 'Failed to create Khata account', isLoading: false });
      return false;
    }
  },

  deleteTransaction: async (id) => {
    try {
      const updatedList = get().transactions.filter((tx) => tx.id !== id);
      const updatedKhataAccounts = computeKhataMetrics(get().khataAccounts, updatedList);

      set({
        transactions: updatedList,
        khataAccounts: updatedKhataAccounts,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedList));
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedKhataAccounts));

      await queueOfflineAction('delete_transaction', { id });
      processSyncQueue().catch((e) => console.log('Background sync trigger:', e));

      return true;
    } catch (e: any) {
      console.error('Error deleting transaction locally:', e);
      set({ error: e.message || 'Failed to delete transaction', isLoading: false });
      return false;
    }
  },

  deleteKhataAccount: async (id) => {
    try {
      const updatedAcc = get().khataAccounts.filter((acc) => acc.id !== id);
      const updatedTx = get().transactions.map((t) => (t.khata_id === id ? { ...t, khata_id: null } : t));

      set({
        khataAccounts: updatedAcc,
        transactions: updatedTx,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedAcc));
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedTx));

      await queueOfflineAction('delete_khata', { id });
      processSyncQueue().catch((e) => console.log('Background sync trigger:', e));

      return true;
    } catch (e: any) {
      console.error('Error deleting Khata account locally:', e);
      set({ error: e.message || 'Failed to delete Khata account', isLoading: false });
      return false;
    }
  },
}));
