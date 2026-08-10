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
  updateTransaction: (id: string, updatedFields: any) => Promise<boolean>;
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
    // 1. Try to load from AsyncStorage first if state is empty
    try {
      const cached = await AsyncStorage.getItem('offline_transactions');
      if (cached && get().transactions.length === 0) {
        set({ transactions: JSON.parse(cached) });
      }
    } catch (e) {
      console.log('Error loading cached transactions:', e);
    }

    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest('/api/transactions?limit=100');
      set({ transactions: data, isLoading: false });
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(data));
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        console.log('[Offline] Failed to fetch transactions from server. Keeping cached data.');
        set({ isLoading: false });
      } else {
        set({ error: err.message || 'Failed to fetch transactions', isLoading: false });
      }
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

      // Add to list and cache
      const updatedTxList = [newTx, ...get().transactions].slice(0, 100);
      set({
        transactions: updatedTxList,
        isLoading: false,
      });
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedTxList));

      // Trigger stats refresh in background
      get().fetchKhataAccounts();

      return true;
    } catch (err: any) {
      // If network failure, perform offline fallback
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
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

        // Instantly display to user and cache
        const updatedTxList = [localTx, ...get().transactions].slice(0, 100);
        set({
          transactions: updatedTxList,
          isLoading: false,
        });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedTxList));
        
        // Trigger stats refresh in background locally
        get().fetchKhataAccounts();
        
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
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        console.log('[Offline] Record payment failed due to network. Saving locally in offline queue.');
        
        // Queue action for syncing
        await queueOfflineAction('record_payment', payWithRef);

        // Perform local update to the transaction record to show it as paid/partially paid instantly
        const txList = get().transactions.map((tx) => {
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
        
        set({ transactions: txList, isLoading: false });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(txList));
        
        // Refresh Khata accounts locally to update outstanding calculation
        get().fetchKhataAccounts();
        
        return true;
      }

      set({ error: err.message || 'Failed to record payment', isLoading: false });
      return false;
    }
  },

  fetchKhataAccounts: async () => {
    try {
      const cached = await AsyncStorage.getItem('offline_khata_accounts');
      if (cached && get().khataAccounts.length === 0) {
        set({ khataAccounts: JSON.parse(cached) });
      }
    } catch (e) {
      console.log('Error loading cached Khata accounts:', e);
    }

    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest('/api/khata');
      set({ khataAccounts: data, isLoading: false });
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(data));
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        console.log('[Offline] Failed to fetch Khata accounts from server. Keeping cached data.');
        set({ isLoading: false });
      } else {
        set({ error: err.message || 'Failed to fetch Khata accounts', isLoading: false });
      }
    }
  },

  createKhataAccount: async (name, description) => {
    set({ isLoading: true, error: null });
    const clientRefId = `khata-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const khataWithRef = { name, description, client_ref_id: clientRefId };
    
    try {
      const newAcc: KhataAccount = await apiRequest('/api/khata', {
        method: 'POST',
        body: JSON.stringify(khataWithRef),
      });

      const updatedAcc = [...get().khataAccounts, newAcc].sort((a, b) => a.name.localeCompare(b.name));
      set({
        khataAccounts: updatedAcc,
        isLoading: false,
      });
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedAcc));
      return true;
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        console.log('[Offline] Create Khata account failed due to network. Saving locally in offline queue.');
        
        const tempId = `temp-${clientRefId}`;
        const localAcc: KhataAccount = {
          id: tempId,
          name,
          description,
          total_pending: 0,
          total_paid: 0,
          outstanding: 0,
          created_at: new Date().toISOString(),
        };

        // Queue action for syncing
        await queueOfflineAction('create_khata', khataWithRef, tempId);

        // Instantly display to user
        const updatedAcc = [...get().khataAccounts, localAcc].sort((a, b) => a.name.localeCompare(b.name));
        set({
          khataAccounts: updatedAcc,
          isLoading: false,
        });
        await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updatedAcc));
        
        return true;
      }
      
      set({ error: err.message || 'Failed to create Khata account', isLoading: false });
      return false;
    }
  },

  deleteTransaction: async (id) => {
    set({ isLoading: true, error: null });
    try {
      if (id.startsWith('temp-')) {
        const updated = get().transactions.filter((tx) => tx.id !== id);
        set({ transactions: updated, isLoading: false });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(updated));
        
        const queueStr = await AsyncStorage.getItem('sync_queue');
        if (queueStr) {
          const queue = JSON.parse(queueStr);
          const filteredQueue = queue.filter((item: any) => item.tempId !== id);
          await AsyncStorage.setItem('sync_queue', JSON.stringify(filteredQueue));
        }
        return true;
      }

      await apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
      });

      const updated = get().transactions.filter((tx) => tx.id !== id);
      set({ transactions: updated, isLoading: false });
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updated));
      
      get().fetchKhataAccounts();
      return true;
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        await queueOfflineAction('delete_transaction', { id });
        
        const updated = get().transactions.filter((tx) => tx.id !== id);
        set({ transactions: updated, isLoading: false });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(updated));
        
        get().fetchKhataAccounts();
        return true;
      }
      set({ error: err.message || 'Failed to delete transaction', isLoading: false });
      return false;
    }
  },

  deleteKhataAccount: async (id) => {
    set({ isLoading: true, error: null });
    try {
      if (id.startsWith('temp-')) {
        const updated = get().khataAccounts.filter((acc) => acc.id !== id);
        set({ khataAccounts: updated, isLoading: false });
        await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updated));
        
        const queueStr = await AsyncStorage.getItem('sync_queue');
        if (queueStr) {
          const queue = JSON.parse(queueStr);
          const filteredQueue = queue.filter((item: any) => item.tempId !== id);
          await AsyncStorage.setItem('sync_queue', JSON.stringify(filteredQueue));
        }
        return true;
      }

      await apiRequest(`/api/khata/${id}`, {
        method: 'DELETE',
      });

      const updated = get().khataAccounts.filter((acc) => acc.id !== id);
      set({ khataAccounts: updated, isLoading: false });
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updated));
      
      get().fetchTransactions();
      return true;
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        await queueOfflineAction('delete_khata', { id });
        
        const updated = get().khataAccounts.filter((acc) => acc.id !== id);
        set({ khataAccounts: updated, isLoading: false });
        await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(updated));
        
        get().fetchTransactions();
        return true;
      }
      set({ error: err.message || 'Failed to delete Khata account', isLoading: false });
      return false;
    }
  },

  updateTransaction: async (id, updatedFields) => {
    set({ isLoading: true, error: null });
    try {
      if (id.startsWith('temp-')) {
        // If it is a temporary local item, we don't send API update yet. We update it in the offline queue instead.
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

        set({
          transactions: updatedList,
          isLoading: false,
        });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedList));

        // Update the queued action
        const queueStr = await AsyncStorage.getItem('sync_queue');
        if (queueStr) {
          const queue = JSON.parse(queueStr);
          const updatedQueue = queue.map((item: any) => {
            if (item.tempId === id && item.action === 'add_transaction') {
              return {
                ...item,
                data: {
                  ...item.data,
                  ...updatedFields,
                },
              };
            }
            return item;
          });
          await AsyncStorage.setItem('sync_queue', JSON.stringify(updatedQueue));
        }

        get().fetchKhataAccounts();
        return true;
      }

      const updatedTx = await apiRequest(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updatedFields),
      });

      const updatedList = get().transactions.map((t) => (t.id === id ? updatedTx : t));
      set({
        transactions: updatedList,
        isLoading: false,
      });
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedList));

      get().fetchKhataAccounts();
      return true;
    } catch (err: any) {
      if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
        console.log('[Offline] Update transaction failed due to network. Saving in offline queue.');

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

        set({
          transactions: updatedList,
          isLoading: false,
        });
        await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedList));

        await queueOfflineAction('update_transaction', { id, ...updatedFields });

        get().fetchKhataAccounts();
        return true;
      }

      set({ error: err.message || 'Failed to update transaction', isLoading: false });
      return false;
    }
  },
}));
