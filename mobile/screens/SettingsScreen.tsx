import React, { useEffect, useState, useRef } from 'react';
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
  Animated,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Check, AlertCircle } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useTransactionStore } from '../store/transactionStore';
import { useBudgetStore } from '../store/budgetStore';
import { useThemeStore, useIsDark } from '../store/themeStore';
import { API_URL, apiRequest, OFFLINE_ONLY } from '../services/api';
import { formatRupees, rupeesToPaise } from '../utils/money';
import { DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';

export default function SettingsScreen({ navigation }: any) {
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

  // Download My Data - Export state
  const [isExporting, setIsExporting] = useState(false);

  // Premium Material 3 Result Dialog State & Animations
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalType, setResultModalType] = useState<'success' | 'error'>('success');
  const [resultModalMessage, setResultModalMessage] = useState('');
  const resultScaleAnim = useRef(new Animated.Value(0.7)).current;
  const resultOpacityAnim = useRef(new Animated.Value(0)).current;

  const triggerResultModal = (type: 'success' | 'error', message: string) => {
    setResultModalType(type);
    setResultModalMessage(message);
    setShowResultModal(true);
    resultScaleAnim.setValue(0.7);
    resultOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(resultOpacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(resultScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const dismissResultModal = () => {
    try { Vibration.vibrate(40); } catch {}
    Animated.parallel([
      Animated.timing(resultOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(resultScaleAnim, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowResultModal(false);
    });
  };

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

  // Download My Data handler — exports real local data
  const handleDownloadMyData = async () => {
    setIsExporting(true);
    try {
      // Gather all real current data from stores and AsyncStorage
      const txStore = useTransactionStore.getState();
      const budgetState = useBudgetStore.getState();

      // Profile data (exclude secrets)
      const profileName = await AsyncStorage.getItem('profile_name');
      const profilePhotoUri = await AsyncStorage.getItem('profile_photo');

      // Theme preference
      const themeMode = await AsyncStorage.getItem('theme_mode');

      // Custom categories
      const customCatsStr = await AsyncStorage.getItem('offline_custom_categories');
      const customCategories = customCatsStr ? JSON.parse(customCatsStr) : [];

      // Recurring templates
      const recStr = await AsyncStorage.getItem('offline_recurring_templates');
      const recurringTemplatesData = recStr ? JSON.parse(recStr) : [];

      // Build clean export object
      const exportData = {
        app: {
          name: 'Apna Hisab',
          version: '1.7.0',
          exportedAt: new Date().toISOString(),
        },
        profile: {
          name: profileName || (user?.name !== 'Offline User' ? user?.name : null) || 'Abhay',
          photoUri: profilePhotoUri || null,
        },
        transactions: txStore.transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          paid_amount: tx.paid_amount,
          pending_amount: tx.pending_amount,
          type: tx.type,
          status: tx.status,
          category: tx.category,
          subcategory: tx.subcategory,
          payment_method: tx.payment_method,
          date: tx.date,
          time: tx.time,
          description: tx.description,
          khata_id: tx.khata_id || null,
          khata_type: tx.khata_type || null,
          recurring_id: tx.recurring_id || null,
          created_at: tx.created_at,
          updated_at: tx.updated_at,
        })),
        khataAccounts: txStore.khataAccounts.map((acc) => ({
          id: acc.id,
          name: acc.name,
          description: acc.description,
          total_pending: acc.total_pending,
          total_paid: acc.total_paid,
          outstanding: acc.outstanding,
          total_udhar_diya_pending: acc.total_udhar_diya_pending,
          total_udhar_liya_pending: acc.total_udhar_liya_pending,
          created_at: acc.created_at,
        })),
        budgets: budgetState.budgets.map((b) => ({
          id: b.id,
          month: b.month,
          category: b.category,
          amount: b.amount,
          created_at: b.created_at,
        })),
        customCategories: customCategories,
        recurringTemplates: recurringTemplatesData,
        settings: {
          theme: themeMode || 'light',
        },
      };

      const json = JSON.stringify(exportData, null, 2);
      const fileName = `apna_hisab_data_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${documentDirectory}${fileName}`;
      await writeAsStringAsync(fileUri, json);
      await shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your Apna Hisab data',
      });

      setIsExporting(false);
      triggerResultModal('success', 'Your data has been exported successfully.');
    } catch (e: any) {
      setIsExporting(false);
      triggerResultModal('error', e.message || 'Failed to export your data. Please try again.');
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

  const bg = isDark ? '#0B0B0F' : '#F7F7FA';
  const cardBg = isDark ? '#161622' : '#ffffff';
  const borderColor = isDark ? '#222232' : '#EBEBF2';
  const textPrimary = isDark ? '#F7F7FA' : '#0B0B0F';
  const textMuted = isDark ? '#9494A8' : '#6E6E82';

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={cardBg}
      />
      
      <ScrollView contentContainerStyle={tw`p-6 pb-24`}>
        {/* User Card */}
        <TouchableOpacity
          style={[tw`border rounded-3xl p-6 shadow-sm mb-6 items-center`, { backgroundColor: cardBg, borderColor }]}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={tw`w-20 h-20 bg-[#6C5CE7]/15 rounded-full justify-center items-center mb-4 border border-[#6C5CE7]/30`}>
            <Text style={tw`text-[#6C5CE7] text-3xl font-extrabold`}>
              {user?.name && user.name !== 'Offline User' ? user.name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </View>
          <Text style={[tw`text-xl font-extrabold`, { color: textPrimary }]}>{user?.name && user.name !== 'Offline User' ? user.name : 'Abhay'}</Text>
          <Text style={[tw`text-xs mt-1 font-medium`, { color: textMuted }]}>{user?.email || 'Personal Finance Account'}</Text>
          <Text style={tw`text-[#6C5CE7] text-xs font-bold mt-2.5`}>View & Edit Profile →</Text>
        </TouchableOpacity>

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
          <View style={tw`flex-row justify-between items-center px-5 py-4`}>
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
              thumbColor={appPin ? '#6C5CE7' : '#f3f4f6'}
            />
          </View>
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
                    ? { borderColor: '#6C5CE7', backgroundColor: isDark ? '#1e1b4b' : '#EEEEFC' }
                    : { borderColor: borderColor, backgroundColor: isDark ? '#11111A' : '#f9fafb' },
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
                    color: theme === t ? '#6C5CE7' : textMuted,
                  }}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Data & Privacy Card */}
        <View style={[tw`border rounded-3xl overflow-hidden shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <View style={[tw`px-5 py-3.5 border-b`, { borderColor }]}>
            <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Data & Privacy</Text>
          </View>
          <TouchableOpacity
            style={tw`flex-row justify-between items-center px-5 py-4`}
            onPress={handleDownloadMyData}
            disabled={isExporting}
          >
            <View style={tw`flex-1 mr-3`}>
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>Download My Data</Text>
              <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>Export a copy of your Apna Hisab data</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <Text style={{ color: textMuted, fontWeight: 'bold' }}>›</Text>
            )}
          </TouchableOpacity>
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

      {/* PREMIUM MATERIAL 3 RESULT DIALOG (Success / Error) */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="none"
        onRequestClose={dismissResultModal}
      >
        <Animated.View style={[tw`flex-1 justify-center items-center bg-black/50 px-6`, { opacity: resultOpacityAnim }]}>
          <Animated.View
            style={[
              tw`rounded-[24px] p-6 w-[85%] max-w-sm items-center shadow-2xl`,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                transform: [{ scale: resultScaleAnim }],
              },
            ]}
          >
            {/* Icon */}
            <View style={tw`w-16 h-16 ${resultModalType === 'success' ? 'bg-[#22C55E]/15' : 'bg-[#EF4444]/15'} rounded-full items-center justify-center mb-4 border ${resultModalType === 'success' ? 'border-[#22C55E]/30' : 'border-[#EF4444]/30'}`}>
              <View style={tw`w-12 h-12 ${resultModalType === 'success' ? 'bg-[#22C55E]' : 'bg-[#EF4444]'} rounded-full items-center justify-center shadow-md`}>
                {resultModalType === 'success' ? (
                  <Check color="#FFFFFF" size={28} strokeWidth={3} />
                ) : (
                  <AlertCircle color="#FFFFFF" size={28} strokeWidth={2.5} />
                )}
              </View>
            </View>

            {/* Title */}
            <Text style={[tw`text-[22px] font-bold text-center mb-1.5`, { color: isDark ? '#F7F7FA' : '#0B0B0F' }]}>
              {resultModalType === 'success' ? 'Success' : 'Error'}
            </Text>

            {/* Message */}
            <Text style={[tw`text-[16px] font-medium text-center mb-6 px-2`, { color: isDark ? '#9494A8' : '#6E6E82' }]}>
              {resultModalMessage}
            </Text>

            {/* Continue Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={tw`w-full h-12 ${resultModalType === 'success' ? 'bg-[#22C55E]' : 'bg-[#EF4444]'} rounded-xl items-center justify-center shadow-md`}
              onPress={dismissResultModal}
            >
              <Text style={tw`text-white font-bold text-[16px]`}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
