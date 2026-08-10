import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useAuthStore } from '../store/authStore';
import { useTransactionStore } from '../store/transactionStore';
import { useThemeStore, useIsDark } from '../store/themeStore';
import { API_URL, apiRequest, OFFLINE_ONLY } from '../services/api';
import { formatRupees, rupeesToPaise } from '../utils/money';
import { DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';
import { documentDirectory, downloadAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { getDocumentAsync } from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { user, logout, appPin, setAppPin } = useAuthStore();
  const { khataAccounts, fetchKhataAccounts } = useTransactionStore();
  const { theme, setTheme } = useThemeStore();
  const isDark = useIsDark();

  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<'enable' | 'disable'>('enable');
  const [enteredPin, setEnteredPin] = useState('');

  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // New template form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Food');
  const [subcategory, setSubcategory] = useState('Tiffin');
  const [payMethod, setPayMethod] = useState('UPI');
  const [desc, setDesc] = useState('');
  const [startDate, setStartDate] = useState('');

  // Fetch templates when modal opens
  const openRecurringManager = async () => {
    setShowRecurringModal(true);
    setLoadingTemplates(true);
    try {
      const data = await apiRequest('/api/recurring');
      setRecurringTemplates(data);
    } catch (e) {
      console.log('Error fetching recurring templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    // Prefill date on mount
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
  }, []);

  const handleCreateTemplate = async () => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const paise = rupeesToPaise(amt);
    const body = {
      amount: paise,
      type,
      category,
      subcategory: type === 'income' ? 'General' : subcategory,
      payment_method: type === 'income' ? 'None' : payMethod,
      frequency: freq,
      start_date: startDate,
      description: desc || `Recurring ${freq}`,
    };

    try {
      const newTemp = await apiRequest('/api/recurring', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setRecurringTemplates((prev) => [...prev, newTemp]);
      // Reset form
      setAmountStr('');
      setDesc('');
      setShowCreateForm(false);
      Alert.alert('Success', 'Recurring schedule created.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create schedule.');
    }
  };

  const handleToggleTemplateStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const updated = await apiRequest(`/api/recurring/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setRecurringTemplates((prev) => 
        prev.map((t) => (t.id === id ? updated : t))
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to update schedule status.');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to stop this recurring schedule? Historical entries will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/api/recurring/${id}`, { method: 'DELETE' });
              setRecurringTemplates((prev) => prev.filter((t) => t.id !== id));
            } catch (e) {
              Alert.alert('Error', 'Failed to delete schedule.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'DELETE EVERYTHING PERMANENTLY',
      'This will clear ALL your transaction history, khata ledger, and settings. This action is IRREVERSIBLE. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE EVERYTHING',
          style: 'destructive',
          onPress: async () => {
            try {
              if (OFFLINE_ONLY) {
                await AsyncStorage.removeItem('offline_transactions');
                await AsyncStorage.removeItem('offline_khata_accounts');
                await AsyncStorage.removeItem('offline_recurring_templates');
                await AsyncStorage.removeItem('last_expense_cat');
                await AsyncStorage.removeItem('last_expense_sub');
                await AsyncStorage.removeItem('last_payment_method');
                await AsyncStorage.removeItem('last_income_cat');
                await AsyncStorage.removeItem('app_pin');
                const store = useTransactionStore.getState();
                await store.fetchTransactions();
                await store.fetchKhataAccounts();
                Alert.alert('Data Wiped', 'All local database entries have been deleted.');
                return;
              }
              await apiRequest('/api/auth/delete-account', { method: 'POST' });
              logout(); // Wipes local store session details
              Alert.alert('Account Deleted', 'Your data has been wiped.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    try {
      const fileUri = `${documentDirectory}apna_hisab_statement.csv`;

      if (OFFLINE_ONLY) {
        const txStr = await AsyncStorage.getItem('offline_transactions');
        const transactions = txStr ? JSON.parse(txStr) : [];
        
        transactions.sort((a: any, b: any) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
        });

        const headers = [
          "Date", "Time", "Type", "Category", "Subcategory", 
          "Amount (INR)", "Paid Amount (INR)", "Pending Amount (INR)", 
          "Status", "Payment Method", "Description"
        ];
        const rows = transactions.map((tx: any) => [
          tx.date,
          tx.time,
          tx.type.toUpperCase(),
          tx.category,
          tx.subcategory,
          (tx.amount / 100).toFixed(2),
          ((tx.paid_amount || tx.amount) / 100).toFixed(2),
          ((tx.pending_amount || 0) / 100).toFixed(2),
          (tx.status || 'paid').toUpperCase(),
          tx.payment_method,
          tx.description || ''
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row: any[]) => row.map((val: any) => {
            const s = String(val).replace(/"/g, '""');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
          }).join(','))
        ].join('\n');

        await writeAsStringAsync(fileUri, csvContent);
        await shareAsync(fileUri);
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      
      const downloadRes = await downloadAsync(
        `${API_URL}/api/backup/export/csv`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (downloadRes.status === 200) {
        await shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Failed to generate CSV statement.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Export failed.');
    }
  };

  const handleExportJSON = async () => {
    try {
      const fileUri = `${documentDirectory}apna_hisab_backup.json`;

      if (OFFLINE_ONLY) {
        const txStr = await AsyncStorage.getItem('offline_transactions');
        const transactions = txStr ? JSON.parse(txStr) : [];
        
        const khStr = await AsyncStorage.getItem('offline_khata_accounts');
        const khata_accounts = khStr ? JSON.parse(khStr) : [];

        const recStr = await AsyncStorage.getItem('offline_recurring_templates');
        const recurring_templates = recStr ? JSON.parse(recStr) : [];

        const backupData = {
          export_date: new Date().toISOString(),
          user_email: 'offline@local.app',
          transactions,
          khata_accounts,
          recurring_templates,
          payments: [],
          categories: []
        };

        await writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));
        await shareAsync(fileUri);
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      
      const downloadRes = await downloadAsync(
        `${API_URL}/api/backup/export/json`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (downloadRes.status === 200) {
        await shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Failed to generate JSON backup.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Export failed.');
    }
  };

  const handleImportJSON = async () => {
    try {
      const result = await getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) return;
      const file = result.assets[0];
      
      const content = await readAsStringAsync(file.uri);
      const backupData = JSON.parse(content);
      
      if (!backupData.transactions || !backupData.khata_accounts) {
        Alert.alert('Invalid Backup File', 'The selected JSON is not a valid Apna Hisab backup.');
        return;
      }
      
      Alert.alert(
        'Confirm Restore',
        'Restoring this backup will overwrite all your current transactions, khata records, and custom categories. This cannot be undone. Proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              try {
                if (OFFLINE_ONLY) {
                  await AsyncStorage.setItem('offline_transactions', JSON.stringify(backupData.transactions));
                  await AsyncStorage.setItem('offline_khata_accounts', JSON.stringify(backupData.khata_accounts));
                  if (backupData.recurring_templates) {
                    await AsyncStorage.setItem('offline_recurring_templates', JSON.stringify(backupData.recurring_templates));
                  }
                  Alert.alert('Success', 'Backup restored successfully.');
                  const store = useTransactionStore.getState();
                  await store.fetchTransactions();
                  await store.fetchKhataAccounts();
                  return;
                }

                const token = await AsyncStorage.getItem('token');
                const response = await fetch(`${API_URL}/api/backup/import/json`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: content,
                });
                
                const resData = await response.json();
                if (response.ok) {
                  Alert.alert('Success', 'Backup restored successfully. Please reload your dashboard.');
                  // Trigger refresh of lists
                  const store = useTransactionStore.getState();
                  store.fetchTransactions();
                  store.fetchKhataAccounts();
                } else {
                  Alert.alert('Failed', resData.detail || 'Import failed.');
                }
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Restore request failed.');
              }
            }
          }
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to parse or read the file.');
    }
  };

  const handleTogglePinLock = () => {
    setEnteredPin('');
    if (appPin) {
      setPinSetupMode('disable');
    } else {
      setPinSetupMode('enable');
    }
    setShowPinSetupModal(true);
  };

  const handleConfirmPinSetup = async () => {
    if (enteredPin.length !== 4 || isNaN(parseInt(enteredPin))) {
      Alert.alert('Invalid PIN', 'Passcode must be a 4-digit number.');
      return;
    }
    
    if (pinSetupMode === 'enable') {
      await setAppPin(enteredPin);
      setShowPinSetupModal(false);
      Alert.alert('Lock Enabled', 'Passcode lock has been enabled.');
    } else {
      if (enteredPin === appPin) {
        await setAppPin(null);
        setShowPinSetupModal(false);
        Alert.alert('Lock Disabled', 'Passcode lock has been disabled.');
      } else {
        Alert.alert('Incorrect PIN', 'The passcode you entered is incorrect.');
      }
    }
  };

  const activeSubcategories = DEFAULT_EXPENSE_CATEGORIES.find(
    (c) => c.name === category
  )?.subcategories || ['General'];

  const bg = isDark ? '#111827' : '#f9fafb';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#f3f4f6';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#111827' : '#f9fafb'}
      />
      
      <ScrollView contentContainerStyle={tw`p-6 pb-24`}>
        {/* User Card */}
        <View style={[tw`border rounded-3xl p-6 shadow-sm mb-6 items-center`, { backgroundColor: cardBg, borderColor }]}>
          <View style={tw`w-20 h-20 bg-indigo-100 rounded-full justify-center items-center mb-4`}>
            <Text style={tw`text-indigo-600 text-3xl font-extrabold`}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </Text>
          </View>
          <Text style={[tw`text-xl font-bold`, { color: textPrimary }]}>{user?.name || 'Offline User'}</Text>
          <Text style={[tw`text-sm mt-1`, { color: textMuted }]}>{user?.email || 'offline@local.app'}</Text>
        </View>

        {/* Settings options list */}
        <View style={[tw`border rounded-3xl overflow-hidden shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          {/* Recurring transactions item */}
          <TouchableOpacity
            style={[tw`flex-row justify-between items-center px-5 py-4 border-b`, { borderColor }]}
            onPress={openRecurringManager}
          >
            <View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Recurring Transactions</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Manage daily, weekly or monthly repeats</Text>
            </View>
            <Text style={{ color: textMuted, fontWeight: 'bold' }}>›</Text>
          </TouchableOpacity>

          {/* PIN Lock settings item */}
          {!OFFLINE_ONLY && (
            <View style={[tw`flex-row justify-between items-center px-5 py-3.5 border-b`, { borderColor }]}>
              <View style={tw`flex-1 mr-3`}>
                <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>App Passcode Lock</Text>
                <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>
                  {appPin ? 'Lock is currently active' : 'Secure your financial records'}
                </Text>
              </View>
              <Switch
                value={!!appPin}
                onValueChange={handleTogglePinLock}
                trackColor={{ false: '#d1d5db', true: '#c7d2fe' }}
                thumbColor={appPin ? '#4f46e5' : '#f3f4f6'}
              />
            </View>
          )}

          {/* Export CSV item */}
          <TouchableOpacity
            style={[tw`flex-row justify-between items-center px-5 py-4 border-b`, { borderColor }]}
            onPress={handleExportCSV}
          >
            <View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Export CSV Statement</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Download financial ledger for Excel/Sheets</Text>
            </View>
            <Text style={{ color: textMuted, fontWeight: 'bold' }}>›</Text>
          </TouchableOpacity>

          {/* Export JSON item */}
          <TouchableOpacity
            style={[tw`flex-row justify-between items-center px-5 py-4 border-b`, { borderColor }]}
            onPress={handleExportJSON}
          >
            <View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Backup Data (JSON)</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Export a backup file of your account records</Text>
            </View>
            <Text style={{ color: textMuted, fontWeight: 'bold' }}>›</Text>
          </TouchableOpacity>

          {/* Import JSON item */}
          <TouchableOpacity
            style={tw`flex-row justify-between items-center px-5 py-4`}
            onPress={handleImportJSON}
          >
            <View>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Restore Data (JSON)</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Import previous data backup to your account</Text>
            </View>
            <Text style={{ color: textMuted, fontWeight: 'bold' }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Theme Selector Card */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`text-sm font-bold mb-4`, { color: textPrimary }]}>Appearance Theme</Text>
          <View style={tw`flex-row gap-3`}>
            {(['light', 'system', 'dark'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center border-2`,
                  theme === t
                    ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' }
                    : { borderColor: borderColor, backgroundColor: isDark ? '#374151' : '#f9fafb' },
                ]}
                onPress={() => setTheme(t)}
              >
                <Text style={{ fontSize: 18, marginBottom: 2 }}>
                  {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '⚙️'}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: 'bold',
                    textTransform: 'capitalize',
                    color: theme === t ? '#4f46e5' : textMuted,
                  }}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Danger zone card */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`text-sm font-bold mb-4`, { color: textPrimary }]}>Danger Zone</Text>
          
          <TouchableOpacity 
            style={tw`bg-red-50 border border-red-200 rounded-xl py-3 items-center`}
            onPress={handleDeleteAccount}
          >
            <Text style={tw`text-red-600 font-bold text-sm`}>Delete Account & Data</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        {!OFFLINE_ONLY && (
          <TouchableOpacity 
            style={tw`bg-gray-200 rounded-xl py-3.5 items-center justify-center mb-8`}
            onPress={logout}
          >
            <Text style={tw`text-gray-700 font-bold text-base`}>Log Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* RECURRING TRANSACTIONS MODAL */}
      {showRecurringModal && (
        <Modal
          visible={showRecurringModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRecurringModal(false)}
        >
          <View style={tw`flex-1 justify-end bg-black/50`}>
            <View style={tw`bg-white rounded-t-3xl p-6 h-[85%]`}>
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={tw`text-lg font-bold text-gray-800`}>
                  Recurring Manager
                </Text>
                <TouchableOpacity onPress={() => setShowRecurringModal(false)}>
                  <Text style={tw`text-gray-500 font-bold text-sm`}>Close</Text>
                </TouchableOpacity>
              </View>

              {loadingTemplates ? (
                <View style={tw`flex-1 justify-center items-center`}>
                  <ActivityIndicator size="large" color="#4f46e5" />
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={tw`flex-1`}>
                  {/* Create New Section Toggle */}
                  <TouchableOpacity
                    style={tw`bg-indigo-50 border border-indigo-100 rounded-xl py-3 px-4 items-center mb-4`}
                    onPress={() => setShowCreateForm(!showCreateForm)}
                  >
                    <Text style={tw`text-indigo-600 text-sm font-bold`}>
                      {showCreateForm ? 'View Active Schedules' : '+ Create Recurring Schedule'}
                    </Text>
                  </TouchableOpacity>

                  {showCreateForm ? (
                    /* CREATE SCHEDULE FORM */
                    <View style={tw`bg-gray-50 border border-gray-150 rounded-2xl p-4 mb-4`}>
                      <Text style={tw`text-sm font-bold text-gray-800 mb-4`}>New Schedule</Text>

                      {/* Type toggle */}
                      <View style={tw`flex-row bg-gray-200 rounded-xl p-1 mb-4`}>
                        {['expense', 'income'].map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={tw`flex-1 py-1.5 rounded-lg items-center ${
                              type === t ? 'bg-white shadow-sm' : ''
                            }`}
                            onPress={() => setType(t)}
                          >
                            <Text style={tw`text-xs font-bold capitalize ${
                              type === t ? 'text-gray-800' : 'text-gray-500'
                            }`}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Amount */}
                      <View style={tw`mb-3`}>
                        <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Amount (Rupees)</Text>
                        <TextInput
                          style={tw`bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold`}
                          placeholder="e.g. 80.00"
                          keyboardType="numeric"
                          value={amountStr}
                          onChangeText={setAmountStr}
                        />
                      </View>

                      {/* Frequency */}
                      <View style={tw`mb-3`}>
                        <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Frequency</Text>
                        <View style={tw`flex-row gap-2`}>
                          {['daily', 'weekly', 'monthly'].map((f) => (
                            <TouchableOpacity
                              key={f}
                              style={tw`flex-1 border rounded-lg py-2 items-center bg-white ${
                                freq === f ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                              }`}
                              onPress={() => setFreq(f)}
                            >
                              <Text style={tw`text-xs font-bold capitalize ${
                                freq === f ? 'text-indigo-600' : 'text-gray-600'
                              }`}>{f}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Category Selection */}
                      <View style={tw`mb-3`}>
                        <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row gap-1.5`}>
                          {type === 'income' ? (
                            ['Salary', 'Freelance', 'Business', 'Other'].map((cat) => (
                              <TouchableOpacity
                                key={cat}
                                style={tw`border rounded-lg px-3 py-1.5 bg-white ${
                                  category === cat ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                                }`}
                                onPress={() => setCategory(cat)}
                              >
                                <Text style={tw`text-xs font-semibold`}>{cat}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            DEFAULT_EXPENSE_CATEGORIES.map((catObj) => (
                              <TouchableOpacity
                                key={catObj.name}
                                style={tw`border rounded-lg px-3 py-1.5 bg-white ${
                                  category === catObj.name ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                                }`}
                                onPress={() => {
                                  setCategory(catObj.name);
                                  setSubcategory(catObj.subcategories[0]);
                                }}
                              >
                                <Text style={tw`text-xs font-semibold`}>{catObj.name}</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>

                      {/* Subcategory */}
                      {type !== 'income' && (
                        <View style={tw`mb-3`}>
                          <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Subcategory</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row gap-1.5`}>
                            {activeSubcategories.map((sub) => (
                              <TouchableOpacity
                                key={sub}
                                style={tw`border rounded-lg px-2.5 py-1 bg-white ${
                                  subcategory === sub ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                                }`}
                                onPress={() => setSubcategory(sub)}
                              >
                                <Text style={tw`text-[10px] font-semibold`}>{sub}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {/* Start Date */}
                      <View style={tw`mb-3`}>
                        <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Start Date</Text>
                        <TextInput
                          style={tw`bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm`}
                          placeholder="YYYY-MM-DD"
                          value={startDate}
                          onChangeText={setStartDate}
                        />
                      </View>

                      {/* Notes */}
                      <View style={tw`mb-4`}>
                        <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Notes / Description</Text>
                        <TextInput
                          style={tw`bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm`}
                          placeholder="e.g. Daily lunch rent"
                          value={desc}
                          onChangeText={setDesc}
                        />
                      </View>

                      {/* Form action buttons */}
                      <View style={tw`flex-row gap-3`}>
                        <TouchableOpacity
                          style={tw`flex-1 border border-gray-200 rounded-xl py-2.5 items-center bg-white`}
                          onPress={() => setShowCreateForm(false)}
                        >
                          <Text style={tw`text-gray-600 text-xs font-bold`}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={tw`flex-1 bg-indigo-600 rounded-xl py-2.5 items-center`}
                          onPress={handleCreateTemplate}
                        >
                          <Text style={tw`text-white text-xs font-bold`}>Start Schedule</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* LIST OF RECURRING TEMPLATES */
                    recurringTemplates.length === 0 ? (
                      <Text style={tw`text-gray-400 text-xs italic text-center py-8`}>
                        No recurring templates configured.
                      </Text>
                    ) : (
                      recurringTemplates.map((item) => (
                        <View 
                          key={item.id} 
                          style={tw`border border-gray-150 rounded-2xl p-4 mb-3 bg-gray-50 flex-row justify-between items-center`}
                        >
                          <View style={tw`flex-grow mr-2`}>
                            <Text style={tw`text-sm font-bold text-gray-800`}>
                              {item.category} → {item.subcategory}
                            </Text>
                            <Text style={tw`text-xs text-gray-400 mt-1 capitalize`}>
                              Repeat: {item.frequency} • {formatRupees(item.amount)}
                            </Text>
                            <Text style={tw`text-[10px] text-gray-500 italic mt-0.5`}>
                              "{item.description}"
                            </Text>
                            <Text style={tw`text-[9px] text-indigo-500 font-bold mt-1`}>
                              Last check: {item.last_generated_date || 'Never'}
                            </Text>
                          </View>
                          
                          <View style={tw`items-end gap-2`}>
                            <View style={tw`flex-row items-center gap-1.5`}>
                              <Text style={tw`text-[10px] font-bold text-gray-400`}>Active</Text>
                              <Switch
                                value={item.status === 'active'}
                                onValueChange={() => handleToggleTemplateStatus(item.id, item.status)}
                                trackColor={{ false: '#d1d5db', true: '#c7d2fe' }}
                                thumbColor={item.status === 'active' ? '#4f46e5' : '#f3f4f6'}
                              />
                            </View>
                            <TouchableOpacity onPress={() => handleDeleteTemplate(item.id)}>
                              <Text style={tw`text-red-500 text-xs font-semibold`}>Stop</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* PIN CONFIGURATION SETUP MODAL */}
      {showPinSetupModal && (
        <Modal
          visible={showPinSetupModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPinSetupModal(false)}
        >
          <View style={tw`flex-1 justify-center items-center bg-black/40 px-6`}>
            <View style={tw`bg-white rounded-2xl p-6 w-full max-w-sm`}>
              <Text style={tw`text-lg font-bold text-gray-800 mb-2`}>
                {pinSetupMode === 'enable' ? 'Set App Passcode' : 'Disable Passcode'}
              </Text>
              <Text style={tw`text-xs text-gray-400 mb-4`}>
                {pinSetupMode === 'enable' 
                  ? 'Create a 4-digit PIN code to lock your financial data.'
                  : 'Enter your current 4-digit passcode to confirm.'
                }
              </Text>
              
              <TextInput
                style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-bold mb-4 tracking-widest`}
                placeholder="0000"
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                value={enteredPin}
                onChangeText={setEnteredPin}
                autoFocus
              />

              <View style={tw`flex-row gap-3`}>
                <TouchableOpacity
                  style={tw`flex-1 border border-gray-200 rounded-xl py-3 items-center`}
                  onPress={() => setShowPinSetupModal(false)}
                >
                  <Text style={tw`text-gray-600 font-semibold text-sm`}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`flex-1 bg-indigo-600 rounded-xl py-3 items-center`}
                  onPress={handleConfirmPinSetup}
                >
                  <Text style={tw`text-white font-bold text-sm`}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
