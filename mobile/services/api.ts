import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Offline Configuration Mode — set to true to skip all network calls
export const OFFLINE_ONLY = false;

// --------------------------------------------------------------------------
// API URL Resolution (priority order):
//   1. EXPO_PUBLIC_API_URL build/env variable (set in .env or eas.json)
//   2. Expo Metro bundler host IP (auto-detected during `expo start`)
//   3. LAN fallback IP for personal device testing
//   4. Production URL for release builds
// --------------------------------------------------------------------------
const PERSONAL_LAN_IP = '10.214.82.233'; // Your laptop LAN IP for personal phone testing

let localIp = PERSONAL_LAN_IP;
const hostUri = Constants.expoConfig?.hostUri;
if (hostUri) {
  localIp = hostUri.split(':')[0];
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || (
  __DEV__
    ? `http://${localIp}:8000`
    : 'https://api.apnahisab.com'
);

let authToken: string | null = null;

export const setAuthToken = (token: string) => {
  authToken = token;
};

export const clearAuthToken = () => {
  authToken = null;
};

// --- MOCK API CLIENT ROUTER ---
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (dateStr: string, days: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};

const subDays = (dateStr: string, days: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
};

const addMonths = (dateStr: string, months: number): string => {
  const d = parseLocalDate(dateStr);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  if (d.getMonth() > (targetMonth % 12 + 12) % 12) {
    d.setDate(0);
  }
  return formatLocalDate(d);
};

const localApiRequest = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  // Parse clean endpoint path and query parameters
  const [path, queryString] = endpoint.split('?');
  const queryParams = new URLSearchParams(queryString || '');
  const method = (options.method || 'GET').toUpperCase();

  // Helper to parse JSON body
  const getBody = () => {
    try {
      return options.body ? JSON.parse(options.body as string) : {};
    } catch {
      return {};
    }
  };

  // --- Auth Endpoints ---
  if (path === '/api/auth/login' || path === '/api/auth/register' || path === '/api/auth/google') {
    return {
      access_token: 'offline_token',
      user: {
        id: 'offline_user',
        name: 'Offline User',
        email: 'offline@local.app',
        created_at: new Date().toISOString()
      }
    };
  }

  if (path === '/api/auth/me') {
    return {
      id: 'offline_user',
      name: 'Offline User',
      email: 'offline@local.app',
      created_at: new Date().toISOString()
    };
  }

  if (path === '/api/auth/delete-account') {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('app_pin');
    await AsyncStorage.removeItem('offline_transactions');
    await AsyncStorage.removeItem('offline_khata_accounts');
    await AsyncStorage.removeItem('offline_recurring_templates');
    await AsyncStorage.removeItem('sync_queue');
    return { status: 'success', message: 'All local data deleted.' };
  }

  // --- Transactions Endpoints ---
  if (path === '/api/transactions') {
    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];

    if (method === 'GET') {
      return transactions;
    }

    if (method === 'POST') {
      const body = getBody();
      const clientRefId = body.client_ref_id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const amount = body.amount;
      const status = body.status || 'paid';
      let paid_amount = amount;
      let pending_amount = 0;
      
      if (status === 'pending') {
        paid_amount = 0;
        pending_amount = amount;
      } else if (status === 'partially_paid') {
        paid_amount = body.paid_amount || 0;
        pending_amount = amount - paid_amount;
      }

      const newTx = {
        id: body.id || clientRefId,
        user_id: 'offline_user',
        amount,
        paid_amount,
        pending_amount,
        type: body.type,
        status,
        category: body.category,
        subcategory: body.subcategory || 'General',
        payment_method: body.payment_method || 'None',
        date: body.date,
        time: body.time,
        description: body.description || '',
        khata_id: body.khata_id || null,
        khata_type: body.khata_type || null,
        client_ref_id: clientRefId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      transactions.unshift(newTx);
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(transactions));
      return newTx;
    }
  }

  if (path === '/api/transactions/payment' && method === 'POST') {
    const body = getBody();
    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];

    const txIdx = transactions.findIndex((t: any) => t.id === body.transaction_id);
    if (txIdx === -1) {
      throw new Error('Transaction not found');
    }

    const tx = transactions[txIdx];
    tx.paid_amount = (tx.paid_amount || 0) + body.amount;
    tx.pending_amount = tx.amount - tx.paid_amount;
    
    if (tx.pending_amount <= 0) {
      tx.pending_amount = 0;
      tx.status = 'paid';
    } else {
      tx.status = 'partially_paid';
    }
    tx.updated_at = new Date().toISOString();

    transactions[txIdx] = tx;
    await AsyncStorage.setItem('offline_transactions', JSON.stringify(transactions));
    return tx;
  }

  if (path.startsWith('/api/transactions/') && method === 'PATCH') {
    const txId = path.split('/').pop();
    const body = getBody();
    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];
    
    const idx = transactions.findIndex((t: any) => t.id === txId);
    if (idx !== -1) {
      const existing = transactions[idx];
      const updated = {
        ...existing,
        ...body,
        updated_at: new Date().toISOString()
      };
      
      if (body.amount !== undefined || body.status !== undefined) {
        const amt = body.amount !== undefined ? body.amount : existing.amount;
        const stat = body.status !== undefined ? body.status : existing.status;
        if (stat === 'paid') {
          updated.paid_amount = amt;
          updated.pending_amount = 0;
        } else if (stat === 'pending') {
          updated.paid_amount = 0;
          updated.pending_amount = amt;
        } else if (stat === 'partially_paid') {
          const paid = body.paid_amount !== undefined ? body.paid_amount : existing.paid_amount;
          updated.paid_amount = paid;
          updated.pending_amount = amt - paid;
        }
      }
      
      transactions[idx] = updated;
      await AsyncStorage.setItem('offline_transactions', JSON.stringify(transactions));
      return updated;
    }
    throw new Error('Transaction not found');
  }

  if (path.startsWith('/api/transactions/') && method === 'DELETE') {
    const txId = path.split('/').pop();
    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];
    
    const filtered = transactions.filter((t: any) => t.id !== txId);
    await AsyncStorage.setItem('offline_transactions', JSON.stringify(filtered));
    return { status: 'success' };
  }

  // --- Khata Ledger Endpoints ---
  if (path === '/api/khata') {
    const khStr = await AsyncStorage.getItem('offline_khata_accounts');
    const accounts = khStr ? JSON.parse(khStr) : [];

    if (method === 'GET') {
      const txStr = await AsyncStorage.getItem('offline_transactions');
      const transactions = txStr ? JSON.parse(txStr) : [];

      const computedAccounts = accounts.map((acc: any) => {
        const accTx = transactions.filter((t: any) => t.khata_id === acc.id);
        const total_pending = accTx.reduce((sum: number, t: any) => sum + (t.pending_amount || 0), 0);
        const total_paid = accTx.reduce((sum: number, t: any) => sum + (t.paid_amount || 0), 0);
        return {
          ...acc,
          total_pending,
          total_paid,
          outstanding: total_pending
        };
      });

      return computedAccounts.sort((a: any, b: any) => a.name.localeCompare(b.name));
    }

    if (method === 'POST') {
      const body = getBody();
      const newAcc = {
        id: `khata-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: body.name,
        description: body.description || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      accounts.push(newAcc);
      await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(accounts));
      return {
        ...newAcc,
        total_pending: 0,
        total_paid: 0,
        outstanding: 0
      };
    }
  }

  if (path.startsWith('/api/khata/') && method === 'DELETE') {
    const khId = path.split('/').pop();
    const khStr = await AsyncStorage.getItem('offline_khata_accounts');
    const accounts = khStr ? JSON.parse(khStr) : [];
    
    const filteredAccounts = accounts.filter((a: any) => a.id !== khId);
    await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(filteredAccounts));

    // Dissociate transactions belonging to this Khata account
    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];
    const updatedTx = transactions.map((t: any) => {
      if (t.khata_id === khId) {
        return { ...t, khata_id: null };
      }
      return t;
    });
    await AsyncStorage.setItem('offline_transactions', JSON.stringify(updatedTx));

    return { status: 'success' };
  }

  // --- Recurring Schedule Endpoints ---
  if (path === '/api/recurring') {
    const recStr = await AsyncStorage.getItem('offline_recurring_templates');
    const templates = recStr ? JSON.parse(recStr) : [];

    if (method === 'GET') {
      return templates;
    }

    if (method === 'POST') {
      const body = getBody();
      const newTemp = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        user_id: 'offline_user',
        amount: body.amount,
        type: body.type,
        category: body.category,
        subcategory: body.subcategory,
        payment_method: body.payment_method,
        frequency: body.frequency,
        start_date: body.start_date,
        last_generated_date: null,
        status: 'active',
        description: body.description || '',
        khata_id: body.khata_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      templates.push(newTemp);
      await AsyncStorage.setItem('offline_recurring_templates', JSON.stringify(templates));
      return newTemp;
    }
  }

  if (path.startsWith('/api/recurring/') && method === 'PATCH') {
    const recId = path.split('/').pop();
    const recStr = await AsyncStorage.getItem('offline_recurring_templates');
    const templates = recStr ? JSON.parse(recStr) : [];
    const body = getBody();

    const idx = templates.findIndex((t: any) => t.id === recId);
    if (idx !== -1) {
      templates[idx] = {
        ...templates[idx],
        ...body,
        updated_at: new Date().toISOString()
      };
      await AsyncStorage.setItem('offline_recurring_templates', JSON.stringify(templates));
      return templates[idx];
    }
    throw new Error('Recurring template not found');
  }

  if (path.startsWith('/api/recurring/') && method === 'DELETE') {
    const recId = path.split('/').pop();
    const recStr = await AsyncStorage.getItem('offline_recurring_templates');
    const templates = recStr ? JSON.parse(recStr) : [];
    
    const filtered = templates.filter((t: any) => t.id !== recId);
    await AsyncStorage.setItem('offline_recurring_templates', JSON.stringify(filtered));
    return { status: 'success' };
  }

  if (path === '/api/recurring/due' && method === 'GET') {
    const clientToday = queryParams.get('client_today') || formatLocalDate(new Date());
    const recStr = await AsyncStorage.getItem('offline_recurring_templates');
    const templates = recStr ? JSON.parse(recStr) : [];

    const dueItems: any[] = [];
    for (const sched of templates) {
      if (sched.status !== 'active') continue;

      const startStr = sched.last_generated_date || sched.start_date;
      let current = startStr;
      
      while (true) {
        let nextDateStr = '';
        if (sched.frequency === 'daily') {
          nextDateStr = addDays(current, 1);
        } else if (sched.frequency === 'weekly') {
          nextDateStr = addDays(current, 7);
        } else if (sched.frequency === 'monthly') {
          nextDateStr = addMonths(current, 1);
        } else {
          break;
        }

        if (nextDateStr <= clientToday) {
          dueItems.push({
            recurring_id: sched.id,
            amount: sched.amount,
            type: sched.type,
            category: sched.category,
            subcategory: sched.subcategory,
            payment_method: sched.payment_method,
            date: nextDateStr,
            time: '09:00:00',
            description: sched.description || `Recurring ${sched.frequency}`,
            khata_id: sched.khata_id || null,
            status: sched.khata_id ? 'pending' : 'paid'
          });
          current = nextDateStr;
        } else {
          break;
        }
      }
    }
    return dueItems;
  }

  if (path === '/api/recurring/approve' && method === 'POST') {
    const instance = getBody();
    
    // Add transaction locally
    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];
    
    const newTx = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: 'offline_user',
      amount: instance.amount,
      paid_amount: instance.status === 'pending' ? 0 : instance.amount,
      pending_amount: instance.status === 'pending' ? instance.amount : 0,
      type: instance.type,
      status: instance.status || 'paid',
      category: instance.category,
      subcategory: instance.subcategory || 'General',
      payment_method: instance.payment_method || 'None',
      date: instance.date,
      time: instance.time || '09:00:00',
      description: instance.description || '',
      khata_id: instance.khata_id || null,
      recurring_id: instance.recurring_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    transactions.unshift(newTx);
    await AsyncStorage.setItem('offline_transactions', JSON.stringify(transactions));

    // Update parent template
    const recStr = await AsyncStorage.getItem('offline_recurring_templates');
    const templates = recStr ? JSON.parse(recStr) : [];
    const idx = templates.findIndex((t: any) => t.id === instance.recurring_id);
    if (idx !== -1) {
      templates[idx].last_generated_date = instance.date;
      templates[idx].updated_at = new Date().toISOString();
      await AsyncStorage.setItem('offline_recurring_templates', JSON.stringify(templates));
    }

    return newTx;
  }

  // --- Financial Analytics / Reports Endpoints ---
  if (path === '/api/reports' && method === 'GET') {
    const period = queryParams.get('period') || 'monthly';
    const clientToday = queryParams.get('client_today') || formatLocalDate(new Date());

    let resolvedStart = '';
    const resolvedEnd = clientToday;

    if (period === 'weekly') {
      resolvedStart = subDays(clientToday, 6);
    } else if (period === 'monthly') {
      resolvedStart = subDays(clientToday, 29);
    } else if (period === '6months') {
      resolvedStart = subDays(clientToday, 179);
    } else if (period === 'yearly') {
      resolvedStart = subDays(clientToday, 364);
    } else {
      resolvedStart = subDays(clientToday, 29);
    }

    const txStr = await AsyncStorage.getItem('offline_transactions');
    const transactions = txStr ? JSON.parse(txStr) : [];

    const filtered = transactions.filter((t: any) => t.date >= resolvedStart && t.date <= resolvedEnd);

    // Sum aggregates
    let totalIncome = 0;
    let totalExpense = 0;
    let totalPending = 0;

    // Category Breakdown map
    const catMap: Record<string, number> = {};
    // Payment Breakdown map
    const payMap: Record<string, number> = {};

    filtered.forEach((t: any) => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += (t.paid_amount || 0);
        totalPending += (t.pending_amount || 0);

        catMap[t.category] = (catMap[t.category] || 0) + (t.paid_amount || 0);

        if (t.status !== 'pending' && t.payment_method && t.payment_method !== 'None') {
          payMap[t.payment_method] = (payMap[t.payment_method] || 0) + (t.paid_amount || 0);
        }
      }
    });

    const category_breakdown = Object.keys(catMap).map(cat => ({
      category: cat,
      amount: catMap[cat]
    })).sort((a, b) => b.amount - a.amount);

    const payment_breakdown = Object.keys(payMap).map(method => ({
      method,
      amount: payMap[method]
    })).sort((a, b) => b.amount - a.amount);

    // Largest Individual Expenses (max 5)
    const largest_expenses = filtered
      .filter((t: any) => t.type === 'expense')
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 5);

    return {
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        total_pending: totalPending,
        remaining_balance: totalIncome - totalExpense
      },
      category_breakdown,
      payment_breakdown,
      largest_expenses
    };
  }

  // Fallback for unhandled path
  throw new Error(`Unhandled mock API route: ${method} ${path}`);
};

// Generic fetch client with JWT authorization token injection
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const method = (options.method || 'GET').toUpperCase();

  if (OFFLINE_ONLY) {
    return localApiRequest(endpoint, options);
  }

  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (!authToken) {
    authToken = await AsyncStorage.getItem('token');
  }
  
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    // If unauthorized session, clear token and throw error
    if (response.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      authToken = null;
      throw new Error('Session expired. Please log in again.');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || 'An error occurred');
    }
    
    return data;
  } catch (err: any) {
    // If it's a GET request and network is down, fall back to local storage
    if (method === 'GET') {
      console.warn(`[API] Network failure for GET ${endpoint}. Falling back to local offline storage.`, err.message);
      return localApiRequest(endpoint, options);
    }
    
    // For write requests, propagate the error so transactionStore/syncService can handle queuing/errors
    throw err;
  }
};
