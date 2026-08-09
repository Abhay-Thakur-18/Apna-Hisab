import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, apiRequest } from './api';
import { useTransactionStore } from '../store/transactionStore';

export interface SyncItem {
  action: 'add_transaction' | 'record_payment';
  data: any;
  tempId?: string;
}

let isSyncing = false;

/**
 * Adds an item to the local offline synchronization queue in AsyncStorage.
 */
export async function queueOfflineAction(action: 'add_transaction' | 'record_payment', data: any, tempId?: string) {
  try {
    const queueStr = await AsyncStorage.getItem('sync_queue');
    const queue: SyncItem[] = queueStr ? JSON.parse(queueStr) : [];
    
    queue.push({ action, data, tempId });
    await AsyncStorage.setItem('sync_queue', JSON.stringify(queue));
    console.log(`[Sync] Queued action '${action}' offline. Queue length: ${queue.length}`);
  } catch (e) {
    console.error('[Sync] Error queuing offline action:', e);
  }
}

/**
 * Retrieves the count of items waiting in the offline queue.
 */
export async function getSyncQueueLength(): Promise<number> {
  try {
    const queueStr = await AsyncStorage.getItem('sync_queue');
    if (!queueStr) return 0;
    const queue = JSON.parse(queueStr);
    return queue.length;
  } catch (e) {
    return 0;
  }
}

/**
 * Sequentially synchronizes queued offline actions with the backend.
 * Gracefully handles network failures (pauses sync) and client errors (discards invalid actions).
 */
export async function processSyncQueue() {
  if (isSyncing) return;
  isSyncing = true;
  
  try {
    const queueStr = await AsyncStorage.getItem('sync_queue');
    if (!queueStr) {
      isSyncing = false;
      return;
    }
    
    let queue: SyncItem[] = JSON.parse(queueStr);
    if (queue.length === 0) {
      isSyncing = false;
      return;
    }
    
    console.log(`[Sync] Starting sync processing for ${queue.length} items...`);
    const store = useTransactionStore.getState();
    const token = await AsyncStorage.getItem('token');
    
    if (!token) {
      console.log('[Sync] No authorization token found, skipping sync.');
      isSyncing = false;
      return;
    }
    
    const remainingQueue: SyncItem[] = [...queue];
    
    for (const item of queue) {
      try {
        let endpoint = '';
        if (item.action === 'add_transaction') {
          endpoint = '/api/transactions';
        } else if (item.action === 'record_payment') {
          endpoint = '/api/transactions/payment';
        }
        
        // Execute request
        const res = await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify(item.data),
        });
        
        console.log(`[Sync] Successfully synchronized item:`, item.action);
        
        // If it was a transaction creation, update the local cache to swap the tempId
        if (item.action === 'add_transaction' && item.tempId && res.id) {
          useTransactionStore.setState((state) => ({
            transactions: state.transactions.map((tx) => 
              tx.id === item.tempId ? { ...tx, id: res.id, created_at: res.created_at } : tx
            )
          }));
        }
        
        // Remove from the remaining queue
        remainingQueue.shift();
        await AsyncStorage.setItem('sync_queue', JSON.stringify(remainingQueue));
        
      } catch (err: any) {
        // If it's a network error, stop sync and try again later when connection returns
        if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
          console.log('[Sync] Network connection unreachable. Pausing synchronization.');
          break;
        } else {
          // If it's a validation error (400 Bad Request, 404, etc.), discard the action from queue
          console.error(`[Sync] Discarding invalid action due to client error (${err.message}):`, item);
          remainingQueue.shift();
          await AsyncStorage.setItem('sync_queue', JSON.stringify(remainingQueue));
        }
      }
    }
    
    // Refresh stores to ensure UI matches backend state
    await store.fetchTransactions();
    await store.fetchKhataAccounts();
    
  } catch (e) {
    console.error('[Sync] Sync engine execution error:', e);
  } finally {
    isSyncing = false;
  }
}
