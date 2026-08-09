import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../services/api';
import { queueOfflineAction } from '../services/syncService';

export interface Transaction {
  id: string;
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
  khata_id?: string;
  recurring_id?: string;
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
  created_at: string;
}

interface TransactionState {
  transactions: Transaction[];
  khataAccounts: KhataAccount[];
  isLoading: boolean;
  error: string | null;

  // Last-used defaults for quick entry
  lastUsedExpenseCategory: string | null;
  lastUsedExpenseSubcategory: string | null;
  lastUsedPaymentMethod: string | null;
  lastUsedIncomeCategory: string | null;

  fetchTransactions: () => Promise<void>;
  addTransaction: (txData: any) => Promise<boolean>;
  recordPayment: (paymentData: any) => Promise<boolean>;
  fetchKhataAccounts: () => Promise<void>;
  createKhataAccount: (name: string, description: string) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  deleteKhataAccount: (id: string) => Promise<boolean>;
  loadLastUsedDefaults: () => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  khataAccounts: [],
  isLoading: false,
  error: null,

  lastUsedExpenseCategory: null,
  lastUsedExpenseSubcategory: null,
  lastUsedPaymentMethod: 'UPI', // Default fallback
  lastUsedIncomeCategory: null,

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

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest('/api/transactions?limit=100');
      set({ transactions: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch transactions', isLoading: false });
    }
  },

  addTransaction: async (txData) => {
    set({ isLoading: true, error: null });
    
    // Generate a client reference ID for deduplication
    const clientRefId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const txWithRef = { ...txData, client_ref_id: clientRefId };
    
    try {
      const newTx: Transaction = await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(txWithRef),
      });

      // Update state defaults depending on type
      if (newTx.type === 'expense') {
        await AsyncStorage.setItem('last_expense_cat', newTx.category);
        await AsyncStorage.setItem('last_expense_sub', newTx.subcategory);
        if (newTx.payment_method !== 'None') {
          await AsyncStorage.setItem('last_payment_method', newTx.payment_method);
        }

        set({
          lastUsedExpenseCategory: newTx.category,
          lastUsedExpenseSubcategory: newTx.subcategory,
          lastUsedPaymentMethod: newTx.payment_method !== 'None' ? newTx.payment_method : get().lastUsedPaymentMethod,
        });
      } else {
        await AsyncStorage.setItem('last_income_cat', newTx.category);
        set({ lastUsedIncomeCategory: newTx.category });
      }

      // Add to list and refetch
      set((state) => ({
        transactions: [newTx, ...state.transactions].slice(0, 100),
        isLoading: false,
      }));

      // Trigger stats refresh in background
      get().fetchKhataAccounts();

      return true;
    } catch (err: any) {
      // If network failure, perform offline fallback
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch')) {
        console.log('[Offline] Add transaction failed due to network. Saving locally in offline queue.');
        
        // Calculate local paid/pending amounts
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

        const tempId = `temp-${clientRefId}`;
        const localTx: Transaction = {
          id: tempId,
          user_id: 'local', // dummy
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
          khata_id: txData.khata_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any;

        // Queue action for syncing
        await queueOfflineAction('add_transaction', txWithRef, tempId);

        // Instantly display to user
        set((state) => ({
          transactions: [localTx, ...state.transactions].slice(0, 100),
          isLoading: false,
        }));
        
        return true;
      }
      
      set({ error: err.message || 'Failed to add transaction', isLoading: false });
      return false;
    }
  },

  recordPayment: async (paymentData) => {
    set({ isLoading: true, error: null });
    const clientRefId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payWithRef = { ...paymentData, client_ref_id: clientRefId };
    
    try {
      await apiRequest('/api/transactions/payment', {
        method: 'POST',
        body: JSON.stringify(payWithRef),
      });

      // Refresh list to update paid status/remaining amounts
      await get().fetchTransactions();
      await get().fetchKhataAccounts();
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch')) {
        console.log('[Offline] Record payment failed due to network. Saving locally in offline queue.');
        
        // Queue action for syncing
        await queueOfflineAction('record_payment', payWithRef);

        // Perform local update to the transaction record to show it as paid/partially paid instantly
        set((state) => {
          const txList = state.transactions.map((tx) => {
            if (tx.id === paymentData.transaction_id) {
              const newPaid = tx.paid_amount + paymentData.amount;
              const newPending = tx.amount - newPaid;
              const newStatus = newPending === 0 ? 'paid' : 'partially_paid';
              return {
                ...tx,
                paid_amount: newPaid,
                pending_amount: newPending,
                status: newStatus as any,
                updated_at: new Date().toISOString(),
              };
            }
            return tx;
          });
          return { transactions: txList, isLoading: false };
        });
        
        return true;
      }

      set({ error: err.message || 'Failed to record payment', isLoading: false });
      return false;
    }
  },

  fetchKhataAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest('/api/khata');
      set({ khataAccounts: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch Khata accounts', isLoading: false });
    }
  },

  createKhataAccount: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const newAcc: KhataAccount = await apiRequest('/api/khata', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });

      set((state) => ({
        khataAccounts: [...state.khataAccounts, newAcc].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }));
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create Khata account', isLoading: false });
      return false;
    }
  },

  deleteTransaction: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
      });

      set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
        isLoading: false,
      }));
      
      // Refresh list and stats
      get().fetchKhataAccounts();
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete transaction', isLoading: false });
      return false;
    }
  },

  deleteKhataAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/api/khata/${id}`, {
        method: 'DELETE',
      });

      set((state) => ({
        khataAccounts: state.khataAccounts.filter((acc) => acc.id !== id),
        isLoading: false,
      }));
      
      // Refresh transactions as they are unlinked
      get().fetchTransactions();
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete Khata account', isLoading: false });
      return false;
    }
  },
}));
