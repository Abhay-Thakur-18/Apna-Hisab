import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  StatusBar,
  Modal,
  ActivityIndicator,
  Animated,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Check } from 'lucide-react-native';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { formatRupees } from '../utils/money';
import { formatDateTime } from '../utils/date';

export default function KhataScreen({ navigation }: any) {
  const {
    khataAccounts,
    fetchKhataAccounts,
    createKhataAccount,
    deleteKhataAccount,
    transactions,
    fetchTransactions,
    recordPayment,
    isLoading,
  } = useTransactionStore();

  const isDark = useIsDark();
  const [refreshing, setRefreshing] = useState(false);
  
  // Create Account State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Premium Material 3 Success Modal State & Animations
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const triggerSuccessModal = () => {
    setShowSuccessModal(true);
    scaleAnim.setValue(0.7);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDismissSuccessModal = () => {
    try {
      Vibration.vibrate(40);
    } catch {}
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessModal(false);
    });
  };

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeAccount, setActiveAccount] = useState<any>(null);
  const [pendingTxList, setPendingTxList] = useState<any[]>([]);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payDesc, setPayDesc] = useState('');

  const loadData = async () => {
    await Promise.all([
      fetchKhataAccounts(),
      fetchTransactions(),
    ]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateAccount = async () => {
    if (!newName.trim()) {
      Alert.alert('Required', 'Please enter a name for the account.');
      return;
    }
    const success = await createKhataAccount(newName, newDesc);
    if (success) {
      setNewName('');
      setNewDesc('');
      setShowCreateModal(false);
      triggerSuccessModal();
    } else {
      Alert.alert('Error', 'Failed to create Khata account.');
    }
  };

  const handleDeleteAccount = (id: string, name: string) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete ${name}? Historical transactions will be unlinked and preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteKhataAccount(id);
          },
        },
      ]
    );
  };

  // Setup payment form for selected account
  const openPaymentFlow = (account: any) => {
    const list = transactions.filter(
      (tx) => tx.khata_id === account.id && tx.status !== 'paid'
    );
    
    if (list.length === 0) {
      Alert.alert('No Outstanding Balance', 'This account has no pending transactions to pay.');
      return;
    }
    
    setActiveAccount(account);
    setPendingTxList(list);
    setSelectedTxId(list[0].id);
    setPayAmountStr((list[0].pending_amount / 100).toString()); // pre-fill outstanding
    setShowPaymentModal(true);
  };

  // Adjust prefilled amount when changing selected transaction inside modal
  useEffect(() => {
    if (selectedTxId) {
      const selected = pendingTxList.find((tx) => tx.id === selectedTxId);
      if (selected) {
        setPayAmountStr((selected.pending_amount / 100).toString());
      }
    }
  }, [selectedTxId]);

  const handleRecordPayment = async () => {
    const payVal = parseFloat(payAmountStr);
    if (isNaN(payVal) || payVal <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    
    const selectedTx = pendingTxList.find((tx) => tx.id === selectedTxId);
    if (!selectedTx) return;

    const paise = Math.round(payVal * 100);
    if (paise > selectedTx.pending_amount) {
      Alert.alert('Invalid Amount', `Payment cannot exceed outstanding pending amount (${formatRupees(selectedTx.pending_amount)}).`);
      return;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const paymentData = {
      transaction_id: selectedTxId,
      amount: paise,
      payment_method: payMethod,
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}:${ss}`,
      description: payDesc || `Payment to ${activeAccount.name}`,
    };

    const success = await recordPayment(paymentData);
    if (success) {
      setShowPaymentModal(false);
      setPayDesc('');
      Alert.alert('Success', 'Payment recorded successfully.');
    } else {
      Alert.alert('Error', 'Failed to record payment.');
    }
  };

  const totalUdharDiya = transactions
    .filter((t) => t.khata_id && t.status !== 'paid' && (t.khata_type === 'udhar_diya' || (!t.khata_type && t.type === 'expense')))
    .reduce((sum, t) => sum + (t.pending_amount || 0), 0);

  const totalUdharLiya = transactions
    .filter((t) => t.khata_id && t.status !== 'paid' && (t.khata_type === 'udhar_liya' || (!t.khata_type && t.type === 'income')))
    .reduce((sum, t) => sum + (t.pending_amount || 0), 0);

  const totalOutstanding = totalUdharDiya + totalUdharLiya;

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

      {/* Top Ledger stats header */}
      <View style={[tw`px-6 py-5 border-b`, { backgroundColor: cardBg, borderColor }]}>
        <View style={tw`flex-row justify-between items-center mb-3`}>
          <Text style={[tw`text-xs font-semibold uppercase tracking-wider`, { color: textMuted }]}>
            Khata Overview
          </Text>
          <TouchableOpacity
            style={tw`bg-indigo-600 rounded-xl px-3.5 py-1.5 shadow-sm`}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={tw`text-white text-xs font-bold`}>+ Add Ledger</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-row gap-3`}>
          <View style={tw`flex-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-3.5`}>
            <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300`}>
              You Will Receive
            </Text>
            <Text style={tw`text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5`}>
              {formatRupees(totalUdharDiya)}
            </Text>
            <Text style={tw`text-[10px] text-emerald-600 dark:text-emerald-400 font-medium`}>Udhar Diya</Text>
          </View>

          <View style={tw`flex-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-3.5`}>
            <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300`}>
              You Have To Pay
            </Text>
            <Text style={tw`text-lg font-extrabold text-amber-700 dark:text-amber-400 mt-0.5`}>
              {formatRupees(totalUdharLiya)}
            </Text>
            <Text style={tw`text-[10px] text-amber-600 dark:text-amber-400 font-medium`}>Udhar Liya</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={tw`p-6 pb-24`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
        }
      >
        {khataAccounts.length === 0 ? (
          <View style={[tw`border border-dashed rounded-2xl p-8 items-center mt-6`, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[tw`text-sm font-semibold`, { color: textMuted }]}>No Khata records created yet</Text>
            <Text style={[tw`text-xs mt-1 text-center`, { color: textMuted }]}>Tap "+ Add Ledger" to record daily suppliers or contacts (Tiffin, Friends, Vendor)</Text>
          </View>
        ) : (
          khataAccounts.map((account) => {
            return (
              <View
                key={account.id}
                style={[tw`border rounded-2xl p-5 shadow-sm mb-4`, { backgroundColor: cardBg, borderColor }]}
              >
                <View style={tw`flex-row justify-between items-start mb-3`}>
                  <View style={tw`flex-1`}>
                    <Text style={[tw`text-base font-bold`, { color: textPrimary }]}>{account.name}</Text>
                    {account.description ? (
                      <Text style={[tw`text-xs mt-0.5`, { color: textMuted }]}>{account.description}</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity onPress={() => handleDeleteAccount(account.id, account.name)}>
                    <Text style={tw`text-red-500 text-xs font-semibold`}>Delete</Text>
                  </TouchableOpacity>
                </View>

                {/* Udhar Diya vs Udhar Liya stats */}
                <View style={[tw`flex-row justify-between rounded-xl p-3 mb-4`, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400`}>Udhar Diya</Text>
                    <Text style={tw`text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5`}>
                      {formatRupees(account.total_udhar_diya_pending || 0)}
                    </Text>
                  </View>
                  <View style={[tw`w-px mx-2`, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400`}>Udhar Liya</Text>
                    <Text style={tw`text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5`}>
                      {formatRupees(account.total_udhar_liya_pending || 0)}
                    </Text>
                  </View>
                  <View style={[tw`w-px mx-2`, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
                  <View style={tw`flex-1`}>
                    <Text style={[tw`text-[9px] font-bold uppercase`, { color: textMuted }]}>Paid</Text>
                    <Text style={[tw`text-sm font-bold mt-0.5`, { color: textPrimary }]}>
                      {formatRupees(account.total_paid || 0)}
                    </Text>
                  </View>
                </View>

                {/* Quick Add Udhar Diya / Liya controls */}
                <View style={tw`flex-row gap-2 mb-2`}>
                  <TouchableOpacity
                    style={tw`flex-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl py-2 items-center`}
                    onPress={() => navigation.navigate('AddTransaction', { khataId: account.id, khataType: 'udhar_diya' })}
                  >
                    <Text style={tw`text-emerald-700 dark:text-emerald-300 text-xs font-bold`}>+ Udhar Diya</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={tw`flex-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl py-2 items-center`}
                    onPress={() => navigation.navigate('AddTransaction', { khataId: account.id, khataType: 'udhar_liya' })}
                  >
                    <Text style={tw`text-amber-700 dark:text-amber-300 text-xs font-bold`}>+ Udhar Liya</Text>
                  </TouchableOpacity>
                </View>

                {/* Action buttons */}
                <View style={tw`flex-row gap-2`}>
                  <TouchableOpacity
                    style={[tw`flex-1 border rounded-xl py-2 items-center`, { backgroundColor: cardBg, borderColor }]}
                    onPress={() => navigation.navigate('Transactions', { filterKhataId: account.id })}
                  >
                    <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>View History</Text>
                  </TouchableOpacity>

                  {account.outstanding > 0 && (
                    <TouchableOpacity
                      style={tw`flex-1 bg-indigo-600 rounded-xl py-2 items-center shadow-sm`}
                      onPress={() => openPaymentFlow(account)}
                    >
                      <Text style={tw`text-white text-xs font-bold`}>Record Payment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE ACCOUNT MODAL */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/40 px-6`}>
          <View style={[tw`rounded-2xl p-6 w-full max-w-sm`, { backgroundColor: cardBg }]}>
            <Text style={[tw`text-lg font-bold mb-4`, { color: textPrimary }]}>Add Khata Ledger</Text>

            <TextInput
              style={[tw`border rounded-xl px-4 py-3 text-sm mb-3`, { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor, color: textPrimary }]}
              placeholder="e.g. Milk Vendor, Daily Tiffin"
              placeholderTextColor={textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <TextInput
              style={[tw`border rounded-xl px-4 py-3 text-sm mb-4`, { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor, color: textPrimary }]}
              placeholder="Description (Optional)"
              placeholderTextColor={textMuted}
              value={newDesc}
              onChangeText={setNewDesc}
            />

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={[tw`flex-1 border rounded-xl py-3 items-center`, { borderColor }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={[tw`font-semibold text-sm`, { color: textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 bg-[#6C5CE7] rounded-xl py-3 items-center`}
                onPress={handleCreateAccount}
              >
                <Text style={tw`text-white font-bold text-sm`}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PREMIUM MATERIAL 3 SUCCESS DIALOG FOR KHATA ACCOUNT CREATION */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="none"
        onRequestClose={handleDismissSuccessModal}
      >
        <Animated.View style={[tw`flex-1 justify-center items-center bg-black/50 px-6`, { opacity: opacityAnim }]}>
          <Animated.View
            style={[
              tw`rounded-[24px] p-6 w-[85%] max-w-sm items-center shadow-2xl`,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Green Circular Success Icon */}
            <View style={tw`w-16 h-16 bg-[#22C55E]/15 rounded-full items-center justify-center mb-4 border border-[#22C55E]/30`}>
              <View style={tw`w-12 h-12 bg-[#22C55E] rounded-full items-center justify-center shadow-md`}>
                <Check color="#FFFFFF" size={28} strokeWidth={3} />
              </View>
            </View>

            {/* Title */}
            <Text style={[tw`text-[22px] font-bold text-center mb-1.5`, { color: textPrimary }]}>
              Success
            </Text>

            {/* Message */}
            <Text style={[tw`text-[16px] font-medium text-center mb-6 px-2`, { color: textMuted }]}>
              Khata account created successfully.
            </Text>

            {/* Continue Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={tw`w-full h-12 bg-[#22C55E] rounded-xl items-center justify-center shadow-md active:scale-98`}
              onPress={handleDismissSuccessModal}
            >
              <Text style={tw`text-white font-bold text-[16px]`}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && activeAccount && (
        <Modal
          visible={showPaymentModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <View style={tw`flex-1 justify-end bg-black/50`}>
            <View style={[tw`rounded-t-3xl p-6`, { backgroundColor: cardBg }]}>
              <View style={tw`flex-row justify-between items-center mb-5`}>
                <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
                  Pay → {activeAccount.name}
                </Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                  <Text style={[tw`font-bold text-sm`, { color: textMuted }]}>Close</Text>
                </TouchableOpacity>
              </View>

              {/* Transaction Selector */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                  Choose Entry to Pay
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row gap-2`}>
                  {pendingTxList.map((tx) => (
                    <TouchableOpacity
                      key={tx.id}
                      style={tw`border rounded-xl px-4 py-3 ${
                        selectedTxId === tx.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      onPress={() => setSelectedTxId(tx.id)}
                    >
                      <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>
                        {formatDateTime(tx.date)} • {tx.subcategory}
                      </Text>
                      <Text style={[tw`text-sm font-bold mt-1`, { color: textPrimary }]}>
                        Outstanding: {formatRupees(tx.pending_amount)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Amount to Pay */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                  Payment Amount (Rupees)
                </Text>
                <TextInput
                  style={[tw`border rounded-xl px-4 py-3 text-sm font-bold`, { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor, color: textPrimary }]}
                  placeholder="0.00"
                  placeholderTextColor={textMuted}
                  keyboardType="numeric"
                  value={payAmountStr}
                  onChangeText={setPayAmountStr}
                />
              </View>

              {/* Payment Method */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                  Payment Method
                </Text>
                <View style={tw`flex-row gap-2`}>
                  {['UPI', 'Cash', 'Debit Card', 'Credit Card'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={tw`flex-1 border rounded-xl py-2.5 items-center ${
                        payMethod === method
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      onPress={() => setPayMethod(method)}
                    >
                      <Text style={tw`text-xs font-bold ${
                        payMethod === method ? 'text-indigo-600' : 'text-gray-600'
                      }`}>
                        {method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={tw`mb-6`}>
                <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                  Notes (Optional)
                </Text>
                <TextInput
                  style={[tw`border rounded-xl px-4 py-3 text-sm`, { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor, color: textPrimary }]}
                  placeholder="e.g. Paid via PhonePe"
                  placeholderTextColor={textMuted}
                  value={payDesc}
                  onChangeText={setPayDesc}
                />
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={tw`bg-indigo-600 rounded-xl py-3.5 items-center justify-center shadow-md mb-4`}
                onPress={handleRecordPayment}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={tw`text-white text-base font-bold`}>Confirm Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
