import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useTransactionStore, Transaction } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { formatRupees, rupeesToPaise } from '../utils/money';
import { formatDateTime } from '../utils/date';

export default function ChecklistScreen({ navigation }: any) {
  const {
    transactions,
    fetchTransactions,
    updateTransaction,
    deleteTransaction,
    addTransaction,
    isLoading,
  } = useTransactionStore();

  const isDark = useIsDark();

  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
  
  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const openAddModal = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    setDateStr(`${yyyy}-${mm}-${dd}`);
    setTimeStr(`${hh}:${min}:${ss}`);
    setTitle('');
    setAmountStr('');
    setNote('');
    setShowAddModal(true);
  };

  const handleAddChecklistItem = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the checklist item.');
      return;
    }
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const txData = {
      amount: rupeesToPaise(amt),
      type: 'expense',
      status: 'pending',
      category: 'Checklist',
      subcategory: title.trim(),
      payment_method: 'None',
      date: dateStr,
      time: timeStr,
      description: note.trim(),
    };

    const success = await addTransaction(txData);
    if (success) {
      setShowAddModal(false);
    } else {
      Alert.alert('Error', 'Failed to save checklist item.');
    }
  };

  const toggleStatus = async (tx: Transaction) => {
    const nextStatus = tx.status === 'pending' ? 'paid' : 'pending';
    const updatedFields: any = {
      status: nextStatus,
    };
    if (nextStatus === 'paid') {
      updatedFields.paid_amount = tx.amount;
      updatedFields.pending_amount = 0;
      updatedFields.payment_method = 'UPI'; // Default payment method on mark paid
    } else {
      updatedFields.paid_amount = 0;
      updatedFields.pending_amount = tx.amount;
      updatedFields.payment_method = 'None';
    }

    await updateTransaction(tx.id, updatedFields);
  };

  const handleDelete = (tx: Transaction) => {
    Alert.alert(
      'Delete Checklist Item',
      `Are you sure you want to delete "${tx.subcategory}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(tx.id);
          },
        },
      ]
    );
  };

  // Checklist items are expense transactions that:
  // - Are pending (outstanding checklist items, tiffin, daily khata, etc.)
  // - Are paid and categorized under 'Checklist'
  const pendingItems = transactions.filter(
    (tx) => tx.type === 'expense' && tx.status === 'pending'
  );
  
  const paidItems = transactions.filter(
    (tx) => tx.type === 'expense' && tx.status === 'paid' && tx.category === 'Checklist'
  );

  const displayedItems = activeTab === 'pending' ? pendingItems : paidItems;
  const totalPendingChecklist = pendingItems.reduce((sum, tx) => sum + tx.pending_amount, 0);

  return (
    <SafeAreaView style={[tw`flex-1 bg-gray-50`, isDark && tw`bg-gray-900`]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#111827' : '#f9fafb'} />
      
      {/* Top Header info */}
      <View style={[tw`bg-white px-6 py-5 border-b border-gray-150`, isDark && tw`bg-gray-800 border-gray-700`]}>
        <Text style={[tw`text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1`, isDark && tw`text-gray-400`]}>
          Pending Checklist Total
        </Text>
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={[tw`text-2xl font-bold text-gray-800`, isDark && tw`text-white`]}>
            {formatRupees(totalPendingChecklist)}
          </Text>
          <TouchableOpacity
            style={tw`bg-indigo-600 rounded-xl px-4 py-2.5 shadow-sm`}
            onPress={openAddModal}
          >
            <Text style={tw`text-white text-xs font-bold`}>+ Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Selector */}
      <View style={[tw`bg-white px-6 py-3 border-b border-gray-100 flex-row gap-2`, isDark && tw`bg-gray-800 border-gray-700`]}>
        <TouchableOpacity
          style={[
            tw`flex-1 py-2 rounded-xl items-center`,
            activeTab === 'pending' ? tw`bg-indigo-600` : [tw`bg-gray-100`, isDark && tw`bg-gray-700`]
          ]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[
            tw`text-xs font-bold`,
            activeTab === 'pending' ? tw`text-white` : [tw`text-gray-600`, isDark && tw`text-gray-300`]
          ]}>
            Pending ({pendingItems.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            tw`flex-1 py-2 rounded-xl items-center`,
            activeTab === 'paid' ? tw`bg-indigo-600` : [tw`bg-gray-100`, isDark && tw`bg-gray-700`]
          ]}
          onPress={() => setActiveTab('paid')}
        >
          <Text style={[
            tw`text-xs font-bold`,
            activeTab === 'paid' ? tw`text-white` : [tw`text-gray-600`, isDark && tw`text-gray-300`]
          ]}>
            Completed ({paidItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Checklist Items Scroll */}
      <ScrollView contentContainerStyle={tw`p-6 pb-24`}>
        {displayedItems.length === 0 ? (
          <View style={[tw`bg-white border border-gray-100 rounded-2xl p-8 items-center border-dashed mt-4`, isDark && tw`bg-gray-800 border-gray-700`]}>
            <Text style={[tw`text-gray-400 text-sm font-semibold`, isDark && tw`text-gray-400`]}>
              No items in this section
            </Text>
            {activeTab === 'pending' ? (
              <Text style={tw`text-gray-400 text-xs mt-1 text-center`}>
                Tap "+ Add Item" to note down things you need to pay or complete
              </Text>
            ) : (
              <Text style={tw`text-gray-400 text-xs mt-1 text-center`}>
                Mark items as completed and they will show up here
              </Text>
            )}
          </View>
        ) : (
          displayedItems.map((item) => (
            <View
              key={item.id}
              style={[
                tw`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-3 flex-row items-center justify-between`,
                isDark && tw`bg-gray-800 border-gray-750`
              ]}
            >
              {/* Left Action Box + Checkbox */}
              <TouchableOpacity
                style={tw`flex-row items-center flex-1 mr-4`}
                onPress={() => toggleStatus(item)}
              >
                <View
                  style={[
                    tw`w-6 h-6 border-2 border-indigo-600 rounded-lg mr-3.5 items-center justify-center`,
                    item.status === 'paid' ? tw`bg-indigo-600` : tw`bg-transparent`
                  ]}
                >
                  {item.status === 'paid' && (
                    <Text style={tw`text-white text-[10px] font-bold`}>✓</Text>
                  )}
                </View>
                
                <View style={tw`flex-1`}>
                  <Text
                    style={[
                      tw`font-bold text-sm text-gray-800`,
                      isDark && tw`text-white`,
                      item.status === 'paid' && tw`line-through text-gray-400`
                    ]}
                  >
                    {item.subcategory}
                  </Text>
                  <Text style={[tw`text-xs text-gray-400 mt-0.5`, isDark && tw`text-gray-400`]}>
                    {formatDateTime(item.date, item.time)}
                  </Text>
                  {item.description ? (
                    <Text style={[tw`text-xs text-gray-500 italic mt-0.5`, isDark && tw`text-gray-400`]}>
                      "{item.description}"
                    </Text>
                  ) : null}
                  {item.khata_id && (
                    <View style={tw`bg-amber-100 dark:bg-amber-950/40 rounded px-1.5 py-0.5 self-start mt-1`}>
                      <Text style={tw`text-amber-800 dark:text-amber-300 text-[9px] font-bold`}>Khata Linked</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Right Action side */}
              <View style={tw`items-end`}>
                <Text style={[tw`text-sm font-black text-gray-800 mb-2`, isDark && tw`text-white`]}>
                  {formatRupees(item.amount)}
                </Text>
                
                <View style={tw`flex-row gap-2.5`}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AddTransaction', { transaction: item })}
                  >
                    <Text style={tw`text-indigo-600 text-xs font-bold`}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={tw`text-red-500 text-xs font-bold`}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ADD ITEM MODAL */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/40 px-6`}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={tw`w-full max-w-sm`}
          >
            <View style={[tw`bg-white rounded-2xl p-6`, isDark && tw`bg-gray-800`]}>
              <Text style={[tw`text-lg font-bold text-gray-800 mb-4`, isDark && tw`text-white`]}>
                Add Checklist Item
              </Text>
              
              <TextInput
                style={[tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3`, isDark && tw`bg-gray-700 border-gray-600 text-white`]}
                placeholder="Title (e.g. Newspaper, Milk, Rent)"
                placeholderTextColor={isDark ? '#9ca3af' : '#9ca3af'}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
              
              <TextInput
                style={[tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 font-bold`, isDark && tw`bg-gray-700 border-gray-600 text-white`]}
                placeholder="Amount (₹)"
                placeholderTextColor={isDark ? '#9ca3af' : '#9ca3af'}
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
              />
              
              <TextInput
                style={[tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4`, isDark && tw`bg-gray-700 border-gray-600 text-white`]}
                placeholder="Note / Description (Optional)"
                placeholderTextColor={isDark ? '#9ca3af' : '#9ca3af'}
                value={note}
                onChangeText={setNote}
              />

              <View style={tw`flex-row gap-3`}>
                <TouchableOpacity
                  style={[tw`flex-1 border border-gray-200 rounded-xl py-3 items-center`, isDark && tw`border-gray-600`]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={[tw`text-gray-600 font-semibold text-sm`, isDark && tw`text-gray-300`]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`flex-1 bg-indigo-600 rounded-xl py-3 items-center`}
                  onPress={handleAddChecklistItem}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={tw`text-white font-bold text-sm`}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
