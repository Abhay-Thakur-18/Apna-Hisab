import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useTransactionStore } from '../store/transactionStore';
import { formatRupees } from '../utils/money';

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

  const [refreshing, setRefreshing] = useState(false);
  
  // Create Account State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

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
      Alert.alert('Success', 'Khata account created.');
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

  const totalOutstanding = khataAccounts.reduce((sum, acc) => sum + acc.outstanding, 0);

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      
      {/* Top Ledger stats header */}
      <View style={tw`bg-white px-6 py-6 border-b border-gray-150`}>
        <Text style={tw`text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1`}>
          Total Outstanding Khata
        </Text>
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={tw`text-2xl font-bold text-gray-800`}>
            {formatRupees(totalOutstanding)}
          </Text>
          <TouchableOpacity
            style={tw`bg-indigo-600 rounded-xl px-4 py-2 shadow-sm`}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={tw`text-white text-xs font-bold`}>+ Add Ledger</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={tw`p-6 pb-24`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
        }
      >
        {khataAccounts.length === 0 ? (
          <View style={tw`bg-white border border-gray-100 rounded-2xl p-8 items-center border-dashed mt-6`}>
            <Text style={tw`text-gray-400 text-sm font-semibold`}>No Khata records created yet</Text>
            <Text style={tw`text-gray-400 text-xs mt-1`}>Tap "+ Add Ledger" to record daily suppliers like Tiffin, Milk, etc.</Text>
          </View>
        ) : (
          khataAccounts.map((account) => (
            <View 
              key={account.id} 
              style={tw`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-4`}
            >
              <View style={tw`flex-row justify-between items-start mb-3`}>
                <View style={tw`flex-1`}>
                  <Text style={tw`text-base font-bold text-gray-800`}>{account.name}</Text>
                  {account.description ? (
                    <Text style={tw`text-xs text-gray-400 mt-0.5`}>{account.description}</Text>
                  ) : null}
                </View>
                
                <TouchableOpacity onPress={() => handleDeleteAccount(account.id, account.name)}>
                  <Text style={tw`text-red-500 text-xs font-semibold`}>Delete</Text>
                </TouchableOpacity>
              </View>

              {/* Stats grid */}
              <View style={tw`flex-row justify-between bg-gray-50 rounded-xl p-3 mb-4`}>
                <View style={tw`flex-1`}>
                  <Text style={tw`text-[10px] font-semibold text-gray-400 uppercase`}>Outstanding</Text>
                  <Text style={tw`text-sm font-bold text-amber-600 mt-0.5`}>
                    {formatRupees(account.outstanding)}
                  </Text>
                </View>
                <View style={tw`w-px bg-gray-200 mx-2`} />
                <View style={tw`flex-1`}>
                  <Text style={tw`text-[10px] font-semibold text-gray-400 uppercase`}>Paid</Text>
                  <Text style={tw`text-sm font-bold text-gray-700 mt-0.5`}>
                    {formatRupees(account.total_paid)}
                  </Text>
                </View>
                <View style={tw`w-px bg-gray-200 mx-2`} />
                <View style={tw`flex-1`}>
                  <Text style={tw`text-[10px] font-semibold text-gray-400 uppercase`}>Total</Text>
                  <Text style={tw`text-sm font-bold text-gray-600 mt-0.5`}>
                    {formatRupees(account.outstanding + account.total_paid)}
                  </Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={tw`flex-row gap-2`}>
                <TouchableOpacity 
                  style={tw`flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center`}
                  onPress={() => navigation.navigate('Transactions', { filterKhataId: account.id })}
                >
                  <Text style={tw`text-gray-700 text-xs font-semibold`}>View History</Text>
                </TouchableOpacity>
                
                {account.outstanding > 0 && (
                  <TouchableOpacity 
                    style={tw`flex-1 bg-indigo-600 rounded-xl py-2.5 items-center shadow-sm`}
                    onPress={() => openPaymentFlow(account)}
                  >
                    <Text style={tw`text-white text-xs font-bold`}>Record Payment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
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
          <View style={tw`bg-white rounded-2xl p-6 w-full max-w-sm`}>
            <Text style={tw`text-lg font-bold text-gray-800 mb-4`}>Add Khata Ledger</Text>
            
            <TextInput
              style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3`}
              placeholder="e.g. Milk Vendor, Daily Tiffin"
              value={newName}
              onChangeText={setNewName}
            />
            
            <TextInput
              style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4`}
              placeholder="Description (Optional)"
              value={newDesc}
              onChangeText={setNewDesc}
            />

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={tw`flex-1 border border-gray-200 rounded-xl py-3 items-center`}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={tw`text-gray-600 font-semibold text-sm`}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`flex-1 bg-indigo-600 rounded-xl py-3 items-center`}
                onPress={handleCreateAccount}
              >
                <Text style={tw`text-white font-bold text-sm`}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
            <View style={tw`bg-white rounded-t-3xl p-6`}>
              <View style={tw`flex-row justify-between items-center mb-5`}>
                <Text style={tw`text-lg font-bold text-gray-800`}>
                  Pay Outstanding → {activeAccount.name}
                </Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                  <Text style={tw`text-gray-500 font-bold text-sm`}>Close</Text>
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
                      <Text style={tw`text-xs font-semibold text-gray-500`}>
                        {tx.date} • {tx.subcategory}
                      </Text>
                      <Text style={tw`text-sm font-bold text-gray-800 mt-1`}>
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
                  style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-bold`}
                  placeholder="0.00"
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
                  style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800`}
                  placeholder="e.g. Paid via PhonePe"
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
