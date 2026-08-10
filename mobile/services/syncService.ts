import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, OFFLINE_ONLY } from './api';
import { useTransactionStore } from '../store/transactionStore';

export interface SyncItem {
  action: 'add_transaction' | 'update_transaction' | 'record_payment' | 'create_khata' | 'delete_transaction' | 'delete_khata';
  data: any;
  tempId?: string;
}

let isSyncing = false;

/**
 * Adds an item to the local offline synchronization queue in AsyncStorage.
 */
export async function queueOfflineAction(
  action: 'add_transaction' | 'update_transaction' | 'record_payment' | 'create_khata' | 'delete_transaction' | 'delete_khata',
  data: any,
  tempId?: string
) {
  if (OFFLINE_ONLY) return;
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
  if (OFFLINE_ONLY) return;
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
        let method = 'POST';
        let bodyContent: string | undefined = undefined;

        if (item.action === 'add_transaction') {
          endpoint = '/api/transactions';
          bodyContent = JSON.stringify(item.data);
        } else if (item.action === 'update_transaction') {
          endpoint = `/api/transactions/${item.data.id}`;
          method = 'PATCH';
          const { id, ...fields } = item.data;
          bodyContent = JSON.stringify(fields);
        } else if (item.action === 'record_payment') {
          endpoint = '/api/transactions/payment';
          bodyContent = JSON.stringify(item.data);
        } else if (item.action === 'create_khata') {
          endpoint = '/api/khata';
          bodyContent = JSON.stringify(item.data);
        } else if (item.action === 'delete_transaction') {
          endpoint = `/api/transactions/${item.data.id}`;
          method = 'DELETE';
        } else if (item.action === 'delete_khata') {
          endpoint = `/api/khata/${item.data.id}`;
          method = 'DELETE';
        }
        
        // Execute request
        const res = bodyContent 
          ? await apiRequest(endpoint, { method, body: bodyContent })
          : await apiRequest(endpoint, { method });
        
        console.log(`[Sync] Successfully synchronized item:`, item.action);
        
        // --- ID Swapping Mapping Logic ---

        if (item.action === 'create_khata' && item.tempId && res.id) {
          const newId = res.id;
          const oldTempId = item.tempId;

          // A. Swap in Zustand store's khataAccounts state
          useTransactionStore.setState((state) => ({
            khataAccounts: state.khataAccounts.map((acc) => 
              acc.id === oldTempId ? { ...acc, id: newId } : acc
            )
          }));

          // B. Swap in Zustand store's transactions state
          useTransactionStore.setState((state) => ({
            transactions: state.transactions.map((tx) => 
              tx.khata_id === oldTempId ? { ...tx, khata_id: newId } : tx
            )
          }));

          // C. Swap in remaining queued add_transaction actions
          remainingQueue.forEach((qItem) => {
            if (qItem.action === 'add_transaction' && qItem.data && qItem.data.khata_id === oldTempId) {
              qItem.data.khata_id = newId;
              console.log(`[Sync] Mapped temp khata_id ${oldTempId} -> ${newId} in remaining queue`);
            }
          });
        }

        if (item.action === 'add_transaction' && item.tempId && res.id) {
          const newId = res.id;
          const oldTempId = item.tempId;

          // A. Swap in Zustand store's transactions state
          useTransactionStore.setState((state) => ({
            transactions: state.transactions.map((tx) => 
              tx.id === oldTempId ? { ...tx, id: newId, created_at: res.created_at } : tx
            )
          }));

          // B. Swap in remaining queued record_payment actions
          remainingQueue.forEach((qItem) => {
            if (qItem.action === 'record_payment' && qItem.data && qItem.data.transaction_id === oldTempId) {
              qItem.data.transaction_id = newId;
              console.log(`[Sync] Mapped temp transaction_id ${oldTempId} -> ${newId} in remaining queue`);
            }
          });
        }
        
        // Remove from the remaining queue
        remainingQueue.shift();
        await AsyncStorage.setItem('sync_queue', JSON.stringify(remainingQueue));
        
      } catch (err: any) {
        if (err.message === 'Network request failed' || err.message.includes('Failed to fetch') || err.message.includes('unreachable')) {
          console.log('[Sync] Network connection unreachable. Pausing synchronization.');
          break;
        } else {
          // If it's a client error (e.g. invalid entity name, bad payment, etc.), discard from queue
          console.error(`[Sync] Discarding invalid action due to client error (${err.message}):`, item);
          remainingQueue.shift();
          await AsyncStorage.setItem('sync_queue', JSON.stringify(remainingQueue));
        }
      }
    }
    
    // Write back local changes to keep offline cache synced
    const latestState = useTransactionStore.getState();
    await AsyncStorage.setItem('offline_transactions', JSON.stringify(latestState.transactions));
    await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(latestState.khataAccounts));

    // Refresh from backend to ensure data consistency
    await latestState.fetchTransactions();
    await latestState.fetchKhataAccounts();
    
  } catch (e) {
    console.error('[Sync] Sync engine execution error:', e);
  } finally {
    isSyncing = false;
  }
}
