import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useTransactionStore } from '../store/transactionStore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../utils/categories';
import { rupeesToPaise } from '../utils/money';

export default function AddTransactionScreen({ route, navigation }: any) {
  const {
    addTransaction,
    updateTransaction,
    khataAccounts,
    fetchKhataAccounts,
    lastUsedExpenseCategory,
    lastUsedExpenseSubcategory,
    lastUsedPaymentMethod,
    lastUsedIncomeCategory,
    loadLastUsedDefaults,
    isLoading,
  } = useTransactionStore();

  const editTx = route.params?.transaction || null;
  const isEditing = !!editTx;

  const [txType, setTxType] = useState<'expense' | 'income' | 'khata'>(
    editTx ? (editTx.khata_id ? 'khata' : editTx.type) : 'expense'
  );
  const [amountStr, setAmountStr] = useState(
    editTx ? (editTx.amount / 100).toString() : ''
  );
  const [category, setCategory] = useState(editTx ? editTx.category : '');
  const [subcategory, setSubcategory] = useState(editTx ? editTx.subcategory : '');
  const [paymentMethod, setPaymentMethod] = useState(editTx ? editTx.payment_method : 'UPI');
  const [description, setDescription] = useState(editTx ? editTx.description || '' : '');
  
  // Khata selection
  const [selectedKhataId, setSelectedKhataId] = useState(editTx ? editTx.khata_id || '' : '');

  // Date and Time (Auto-filled)
  const [showDateTimeEdit, setShowDateTimeEdit] = useState(false);
  const [dateStr, setDateStr] = useState(editTx ? editTx.date : '');
  const [timeStr, setTimeStr] = useState(editTx ? editTx.time : '');

  // Initialize date/time on mount
  useEffect(() => {
    if (!isEditing) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      
      setDateStr(`${yyyy}-${mm}-${dd}`);
      setTimeStr(`${hh}:${min}:${ss}`);
    }
    
    // Fetch Khata accounts and load user settings
    fetchKhataAccounts();
    loadLastUsedDefaults();
  }, []);

  // Pre-populate defaults when store variables load or type changes
  useEffect(() => {
    if (isEditing) return;
    if (txType === 'expense') {
      setCategory(lastUsedExpenseCategory || DEFAULT_EXPENSE_CATEGORIES[0].name);
      setSubcategory(lastUsedExpenseSubcategory || DEFAULT_EXPENSE_CATEGORIES[0].subcategories[0]);
      setPaymentMethod(lastUsedPaymentMethod || 'UPI');
    } else if (txType === 'income') {
      setCategory(lastUsedIncomeCategory || DEFAULT_INCOME_CATEGORIES[0]);
      setSubcategory('General');
      setPaymentMethod('None');
    } else { // khata
      setCategory(lastUsedExpenseCategory || DEFAULT_EXPENSE_CATEGORIES[0].name);
      setSubcategory(lastUsedExpenseSubcategory || DEFAULT_EXPENSE_CATEGORIES[0].subcategories[0]);
      setPaymentMethod('None'); // pending transactions have no payment method
      if (khataAccounts.length > 0) {
        setSelectedKhataId(khataAccounts[0].id);
      }
    }
  }, [txType, lastUsedExpenseCategory, lastUsedExpenseSubcategory, lastUsedPaymentMethod, lastUsedIncomeCategory]);

  // Adjust subcategories when category changes
  const activeSubcategories = DEFAULT_EXPENSE_CATEGORIES.find(
    (c) => c.name === category
  )?.subcategories || ['General'];

  const handleSubmit = async () => {
    const amountVal = parseFloat(amountStr);
    if (!amountStr || isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monetary amount.');
      return;
    }

    if (txType === 'khata' && !selectedKhataId) {
      Alert.alert('Select Khata Account', 'Please select a person/supplier for this entry.');
      return;
    }

    const paise = rupeesToPaise(amountVal);

    let txData: any = {
      amount: paise,
      type: txType === 'income' ? 'income' : 'expense',
      status: txType === 'khata' ? 'pending' : (editTx ? editTx.status : 'paid'),
      category,
      subcategory: txType === 'income' ? 'General' : subcategory,
      payment_method: txType === 'khata' ? 'None' : paymentMethod,
      date: dateStr,
      time: timeStr,
      description,
    };

    if (txType === 'khata') {
      txData.khata_id = selectedKhataId;
    } else {
      txData.khata_id = null;
    }

    let success = false;
    if (isEditing) {
      success = await updateTransaction(editTx.id, txData);
    } else {
      success = await addTransaction(txData);
    }

    if (success) {
      // Clear forms
      setAmountStr('');
      setDescription('');
      Alert.alert('Success', isEditing ? 'Transaction updated successfully!' : 'Transaction recorded successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } else {
      Alert.alert('Error', 'Failed to save transaction.');
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      <View style={tw`flex-row items-center justify-between px-6 py-4 border-b border-gray-100 bg-white`}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={tw`text-indigo-600 text-sm font-semibold`}>Cancel</Text>
        </TouchableOpacity>
        <Text style={tw`text-lg font-bold text-gray-800`}>
          {isEditing ? 'Edit Entry' : 'Record Entry'}
        </Text>
        <View style={tw`w-10`} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}
      >
        <ScrollView contentContainerStyle={tw`p-6 pb-12`} keyboardShouldPersistTaps="handled">
        {/* Transaction Type Segment Selector */}
        <View style={tw`flex-row bg-gray-200 rounded-xl p-1 mb-6`}>
          {(['expense', 'income', 'khata'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={tw`flex-1 py-2.5 rounded-lg items-center ${
                txType === type ? 'bg-white shadow-sm' : ''
              }`}
              onPress={() => setTxType(type)}
            >
              <Text
                style={tw`text-sm font-bold capitalize ${
                  txType === type ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {type === 'khata' ? 'Khata (Pending)' : type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Card */}
        <View style={tw`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6`}>
          {/* Amount input */}
          <View style={tw`items-center mb-6`}>
            <Text style={tw`text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2`}>
              Amount (Rupees)
            </Text>
            <View style={tw`flex-row items-center`}>
              <Text style={tw`text-3xl font-bold text-gray-800 mr-1`}>₹</Text>
              <TextInput
                style={tw`text-3xl font-bold text-gray-800 w-44 text-center pb-1 border-b border-gray-200`}
                placeholder="0.00"
                placeholderTextColor="#d1d5db"
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
                autoFocus
              />
            </View>
          </View>

          {/* Dynamic selector based on type */}
          {txType === 'khata' && (
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Person / Supplier (Khata Account)
              </Text>
              {khataAccounts.length === 0 ? (
                <TouchableOpacity
                  style={tw`bg-indigo-50 border border-indigo-100 rounded-xl py-3 px-4 items-center`}
                  onPress={() => navigation.navigate('Khata')}
                >
                  <Text style={tw`text-indigo-600 text-sm font-bold`}>
                    + Create a Khata Account First
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={tw`flex-row flex-wrap gap-2`}>
                  {khataAccounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={tw`border rounded-xl px-4 py-2.5 ${
                        selectedKhataId === acc.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      onPress={() => setSelectedKhataId(acc.id)}
                    >
                      <Text
                        style={tw`text-sm font-bold ${
                          selectedKhataId === acc.id ? 'text-indigo-600' : 'text-gray-600'
                        }`}
                      >
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Category Selector */}
          <View style={tw`mb-4`}>
            <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
              Category
            </Text>
            {txType === 'income' ? (
              <View style={tw`flex-row flex-wrap gap-2`}>
                {DEFAULT_INCOME_CATEGORIES.map((catName) => (
                  <TouchableOpacity
                    key={catName}
                    style={tw`border rounded-xl px-4 py-2.5 ${
                      category === catName
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                    onPress={() => setCategory(catName)}
                  >
                    <Text
                      style={tw`text-sm font-bold ${
                        category === catName ? 'text-indigo-600' : 'text-gray-600'
                      }`}
                    >
                      {catName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={tw`flex-row flex-wrap gap-2`}>
                {DEFAULT_EXPENSE_CATEGORIES.map((catObj) => (
                  <TouchableOpacity
                    key={catObj.name}
                    style={tw`border rounded-xl px-4 py-2.5 ${
                      category === catObj.name
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                    onPress={() => {
                      setCategory(catObj.name);
                      setSubcategory(catObj.subcategories[0]);
                    }}
                  >
                    <Text
                      style={tw`text-sm font-bold ${
                        category === catObj.name ? 'text-indigo-600' : 'text-gray-600'
                      }`}
                    >
                      {catObj.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Subcategory (Only Expense & Khata) */}
          {txType !== 'income' && (
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Subcategory
              </Text>
              <View style={tw`flex-row flex-wrap gap-2`}>
                {activeSubcategories.map((subName) => (
                  <TouchableOpacity
                    key={subName}
                    style={tw`border rounded-xl px-3 py-2 ${
                      subcategory === subName
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                    onPress={() => setSubcategory(subName)}
                  >
                    <Text
                      style={tw`text-xs font-semibold ${
                        subcategory === subName ? 'text-indigo-600' : 'text-gray-600'
                      }`}
                    >
                      {subName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Payment Method (Only Expense & Income) */}
          {txType !== 'khata' && (
            <View style={tw`mb-4`}>
              <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                Payment Method
              </Text>
              <View style={tw`flex-row gap-2`}>
                {['UPI', 'Cash', 'Debit Card', 'Credit Card'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={tw`flex-1 border rounded-xl py-2.5 items-center ${
                      paymentMethod === method
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      style={tw`text-xs font-bold ${
                        paymentMethod === method ? 'text-indigo-600' : 'text-gray-600'
                      }`}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={tw`mb-2`}>
            <Text style={tw`text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
              Description (Optional)
            </Text>
            <TextInput
              style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800`}
              placeholder="e.g. dinner, laundry, grocery bills"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>

        {/* Date and Time (Custom modification) */}
        <View style={tw`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6`}>
          <View style={tw`flex-row justify-between items-center`}>
            <View>
              <Text style={tw`text-sm font-semibold text-gray-800`}>Date & Time</Text>
              <Text style={tw`text-xs text-gray-400 mt-0.5`}>
                {dateStr} at {timeStr} (Auto-filled)
              </Text>
            </View>
            <TouchableOpacity
              style={tw`border border-gray-200 rounded-lg px-3 py-1.5`}
              onPress={() => setShowDateTimeEdit(!showDateTimeEdit)}
            >
              <Text style={tw`text-xs font-bold text-gray-600`}>
                {showDateTimeEdit ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDateTimeEdit && (
            <View style={tw`flex-row gap-3 mt-4`}>
              <View style={tw`flex-1`}>
                <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Date</Text>
                <TextInput
                  style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800`}
                  placeholder="YYYY-MM-DD"
                  value={dateStr}
                  onChangeText={setDateStr}
                />
              </View>
              <View style={tw`flex-1`}>
                <Text style={tw`text-xs font-semibold text-gray-500 mb-1.5`}>Time</Text>
                <TextInput
                  style={tw`bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800`}
                  placeholder="HH:MM:SS"
                  value={timeStr}
                  onChangeText={setTimeStr}
                />
              </View>
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={tw`bg-indigo-600 rounded-xl py-3.5 items-center justify-center shadow-md mb-8`}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={tw`text-white text-base font-bold`}>Save Transaction</Text>
          )}
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
