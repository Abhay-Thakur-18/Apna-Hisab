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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Camera, Image as ImageIcon, Calendar, Clock, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../utils/categories';
import { rupeesToPaise } from '../utils/money';
import { formatDateTime } from '../utils/date';
import DateTimePickerModal from '../components/DateTimePickerModal';
import Toast from '../components/Toast';

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

  const isDark = useIsDark();

  const editTx = route.params?.transaction || null;
  const initialKhataId = route.params?.khataId || (editTx ? editTx.khata_id || '' : '');
  const initialKhataType = route.params?.khataType || (editTx ? editTx.khata_type || 'udhar_diya' : 'udhar_diya');
  const isEditing = !!editTx;

  const [txType, setTxType] = useState<'expense' | 'income' | 'khata'>(
    editTx ? (editTx.khata_id ? 'khata' : editTx.type) : (route.params?.khataId ? 'khata' : 'expense')
  );
  const [khataType, setKhataType] = useState<'udhar_diya' | 'udhar_liya'>(initialKhataType);
  const [amountStr, setAmountStr] = useState(
    editTx ? (editTx.amount / 100).toString() : ''
  );
  const [category, setCategory] = useState(editTx ? editTx.category : '');
  const [subcategory, setSubcategory] = useState(editTx ? editTx.subcategory : '');
  const [paymentMethod, setPaymentMethod] = useState(editTx ? editTx.payment_method : 'UPI');
  const [description, setDescription] = useState(editTx ? editTx.description || '' : '');

  // Khata selection
  const [selectedKhataId, setSelectedKhataId] = useState(initialKhataId);

  // Date and Time picker state
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateStr, setDateStr] = useState(editTx ? editTx.date : '');
  const [timeStr, setTimeStr] = useState(editTx ? editTx.time : '');

  // Photo / Receipt state
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // Toast feedback
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Initialize date/time on mount
  useEffect(() => {
    const now = new Date();
    if (isEditing && editTx?.date) {
      try {
        const [y, m, d] = editTx.date.split('-').map(Number);
        const [hh, mm, ss] = (editTx.time || '12:00:00').split(':').map(Number);
        const parsed = new Date(y, m - 1, d, hh || 12, mm || 0, ss || 0);
        setPickerDate(parsed);
      } catch {
        setPickerDate(now);
      }
    } else {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');

      setDateStr(`${yyyy}-${mm}-${dd}`);
      setTimeStr(`${hh}:${min}:${ss}`);
      setPickerDate(now);
    }

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
    } else {
      setCategory(lastUsedExpenseCategory || DEFAULT_EXPENSE_CATEGORIES[0].name);
      setSubcategory(lastUsedExpenseSubcategory || DEFAULT_EXPENSE_CATEGORIES[0].subcategories[0]);
      setPaymentMethod('None');
      if (khataAccounts.length > 0 && !selectedKhataId) {
        setSelectedKhataId(khataAccounts[0].id);
      }
    }
  }, [txType, lastUsedExpenseCategory, lastUsedExpenseSubcategory, lastUsedPaymentMethod, lastUsedIncomeCategory]);

  const activeSubcategories = DEFAULT_EXPENSE_CATEGORIES.find(
    (c) => c.name === category
  )?.subcategories || ['General'];

  // Handle Date picker selection
  const handleDateConfirm = (selectedDate: Date) => {
    setShowDatePicker(false);
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');

    setDateStr(`${yyyy}-${mm}-${dd}`);

    // Preserve existing time
    const updated = new Date(selectedDate);
    const [hh, min, ss] = timeStr.split(':').map(Number);
    if (!isNaN(hh)) updated.setHours(hh, min || 0, ss || 0);
    setPickerDate(updated);
  };

  // Handle Time picker selection
  const handleTimeConfirm = (selectedTime: Date) => {
    setShowTimePicker(false);
    const hh = String(selectedTime.getHours()).padStart(2, '0');
    const min = String(selectedTime.getMinutes()).padStart(2, '0');
    const ss = String(selectedTime.getSeconds()).padStart(2, '0');

    setTimeStr(`${hh}:${min}:${ss}`);

    const updated = new Date(pickerDate);
    updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds());
    setPickerDate(updated);
  };

  // Image Picker — Camera
  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Camera permission is required to capture receipt images.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message || 'Could not launch camera.');
    }
  };

  // Image Picker — Gallery
  const handlePickGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Photo gallery permission is required to select receipt images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message || 'Could not launch photo gallery.');
    }
  };

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
    const isExpenseType = txType === 'khata' ? (khataType === 'udhar_diya') : (txType === 'expense');

    let txData: any = {
      amount: paise,
      type: isExpenseType ? 'expense' : 'income',
      status: txType === 'khata' ? 'pending' : (editTx ? editTx.status : 'paid'),
      category,
      subcategory: txType === 'income' ? 'General' : subcategory,
      payment_method: txType === 'khata' ? 'None' : paymentMethod,
      date: dateStr,
      time: timeStr,
      description,
      khata_type: txType === 'khata' ? khataType : null,
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
      setToastMessage(isEditing ? 'Transaction updated successfully!' : 'Transaction recorded successfully!');
      setToastVisible(true);
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } else {
      Alert.alert('Error', 'Failed to save transaction locally.');
    }
  };

  const bg = isDark ? '#111827' : '#f9fafb';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#f3f4f6';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1f2937' : '#f9fafb'}
      />

      <Toast visible={toastVisible} message={toastMessage} type="success" />

      {/* Top Bar */}
      <View style={[tw`flex-row items-center justify-between px-6 py-4 border-b`, { backgroundColor: cardBg, borderColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={tw`text-indigo-500 text-sm font-semibold`}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
          {isEditing ? 'Edit Entry' : 'Record Entry'}
        </Text>
        <View style={tw`w-10`} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={tw`flex-1`}
      >
        <ScrollView contentContainerStyle={tw`p-6 pb-16`} keyboardShouldPersistTaps="handled">
          {/* Transaction Type Segment Selector */}
          <View style={[tw`flex-row rounded-xl p-1 mb-6`, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
            {(['expense', 'income', 'khata'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  tw`flex-1 py-2.5 rounded-lg items-center`,
                  txType === type ? { backgroundColor: cardBg } : {},
                ]}
                onPress={() => setTxType(type)}
              >
                <Text
                  style={[
                    tw`text-sm font-bold capitalize`,
                    { color: txType === type ? textPrimary : textMuted },
                  ]}
                >
                  {type === 'khata' ? 'Khata (Pending)' : type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Card */}
          <View style={[tw`rounded-2xl p-6 shadow-sm border mb-6`, { backgroundColor: cardBg, borderColor }]}>
            <View style={tw`items-center mb-4`}>
              <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Amount (Rupees)
              </Text>
              <View style={tw`flex-row items-center`}>
                <Text style={[tw`text-3xl font-bold mr-1`, { color: textPrimary }]}>₹</Text>
                <TextInput
                  style={[
                    tw`text-3xl font-bold w-48 text-center pb-1 border-b`,
                    { color: textPrimary, borderColor: isDark ? '#4b5563' : '#e5e7eb' },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={textMuted}
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                  autoFocus
                />
              </View>
            </View>

            {/* Dynamic Khata Selector & Udhar Diya/Liya option */}
            {txType === 'khata' && (
              <View style={tw`mb-4`}>
                <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                  Khata Entry Type
                </Text>
                <View style={tw`flex-row gap-2 mb-4`}>
                  <TouchableOpacity
                    style={[
                      tw`flex-1 border rounded-xl py-2.5 items-center`,
                      khataType === 'udhar_diya'
                        ? { borderColor: '#10b981', backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }
                        : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                    ]}
                    onPress={() => setKhataType('udhar_diya')}
                  >
                    <Text style={[tw`text-xs font-bold`, { color: khataType === 'udhar_diya' ? '#10b981' : textMuted }]}>
                      Udhar Diya (I Gave)
                    </Text>
                    <Text style={[tw`text-[10px] mt-0.5`, { color: textMuted }]}>Receivable</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      tw`flex-1 border rounded-xl py-2.5 items-center`,
                      khataType === 'udhar_liya'
                        ? { borderColor: '#f59e0b', backgroundColor: isDark ? '#78350f' : '#fffbeb' }
                        : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                    ]}
                    onPress={() => setKhataType('udhar_liya')}
                  >
                    <Text style={[tw`text-xs font-bold`, { color: khataType === 'udhar_liya' ? '#f59e0b' : textMuted }]}>
                      Udhar Liya (I Took)
                    </Text>
                    <Text style={[tw`text-[10px] mt-0.5`, { color: textMuted }]}>Payable</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                  Person / Party (Khata Account)
                </Text>
                {khataAccounts.length === 0 ? (
                  <TouchableOpacity
                    style={[tw`border rounded-xl py-3 px-4 items-center`, { backgroundColor: isDark ? '#312e81' : '#eef2ff', borderColor: '#4f46e5' }]}
                    onPress={() => navigation.navigate('Khata')}
                  >
                    <Text style={tw`text-indigo-500 text-sm font-bold`}>
                      + Create a Khata Account First
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={tw`flex-row flex-wrap gap-2`}>
                    {khataAccounts.map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          tw`border rounded-xl px-4 py-2.5`,
                          selectedKhataId === acc.id
                            ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#312e81' : '#eef2ff' }
                            : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                        ]}
                        onPress={() => setSelectedKhataId(acc.id)}
                      >
                        <Text
                          style={[
                            tw`text-sm font-bold`,
                            { color: selectedKhataId === acc.id ? '#4f46e5' : textPrimary },
                          ]}
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
              <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Category
              </Text>
              {txType === 'income' ? (
                <View style={tw`flex-row flex-wrap gap-2`}>
                  {DEFAULT_INCOME_CATEGORIES.map((catName) => (
                    <TouchableOpacity
                      key={catName}
                      style={[
                        tw`border rounded-xl px-4 py-2.5`,
                        category === catName
                          ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#312e81' : '#eef2ff' }
                          : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                      ]}
                      onPress={() => setCategory(catName)}
                    >
                      <Text
                        style={[
                          tw`text-sm font-bold`,
                          { color: category === catName ? '#4f46e5' : textPrimary },
                        ]}
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
                      style={[
                        tw`border rounded-xl px-4 py-2.5`,
                        category === catObj.name
                          ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#312e81' : '#eef2ff' }
                          : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                      ]}
                      onPress={() => {
                        setCategory(catObj.name);
                        setSubcategory(catObj.subcategories[0]);
                      }}
                    >
                      <Text
                        style={[
                          tw`text-sm font-bold`,
                          { color: category === catObj.name ? '#4f46e5' : textPrimary },
                        ]}
                      >
                        {catObj.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Subcategory */}
            {txType !== 'income' && (
              <View style={tw`mb-4`}>
                <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                  Subcategory
                </Text>
                <View style={tw`flex-row flex-wrap gap-2`}>
                  {activeSubcategories.map((subName) => (
                    <TouchableOpacity
                      key={subName}
                      style={[
                        tw`border rounded-xl px-3 py-2`,
                        subcategory === subName
                          ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#312e81' : '#eef2ff' }
                          : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                      ]}
                      onPress={() => setSubcategory(subName)}
                    >
                      <Text
                        style={[
                          tw`text-xs font-semibold`,
                          { color: subcategory === subName ? '#4f46e5' : textPrimary },
                        ]}
                      >
                        {subName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Payment Method */}
            {txType !== 'khata' && (
              <View style={tw`mb-4`}>
                <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                  Payment Method
                </Text>
                <View style={tw`flex-row gap-2`}>
                  {['UPI', 'Cash', 'Debit Card', 'Credit Card'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        tw`flex-1 border rounded-xl py-2.5 items-center`,
                        paymentMethod === method
                          ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#312e81' : '#eef2ff' }
                          : { borderColor: isDark ? '#4b5563' : '#e5e7eb', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          tw`text-xs font-bold`,
                          { color: paymentMethod === method ? '#4f46e5' : textPrimary },
                        ]}
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
              <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[
                  tw`border rounded-xl px-4 py-3 text-sm`,
                  { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor: isDark ? '#4b5563' : '#e5e7eb', color: textPrimary },
                ]}
                placeholder="e.g. dinner, laundry, grocery bills"
                placeholderTextColor={textMuted}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Date and Time Native Picker Section */}
          <View style={[tw`rounded-2xl p-5 shadow-sm border mb-6`, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-3`, { color: textMuted }]}>
              Transaction Date & Time
            </Text>

            <View style={tw`flex-row gap-3`}>
              {/* Date Button */}
              <TouchableOpacity
                style={[
                  tw`flex-1 border rounded-xl p-3 flex-row items-center gap-2.5`,
                  { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor: isDark ? '#4b5563' : '#e5e7eb' },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar color="#4f46e5" size={18} />
                <View>
                  <Text style={[tw`text-[10px] uppercase font-bold`, { color: textMuted }]}>Date</Text>
                  <Text style={[tw`text-xs font-bold mt-0.5`, { color: textPrimary }]}>{dateStr}</Text>
                </View>
              </TouchableOpacity>

              {/* Time Button */}
              <TouchableOpacity
                style={[
                  tw`flex-1 border rounded-xl p-3 flex-row items-center gap-2.5`,
                  { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor: isDark ? '#4b5563' : '#e5e7eb' },
                ]}
                onPress={() => setShowTimePicker(true)}
              >
                <Clock color="#4f46e5" size={18} />
                <View>
                  <Text style={[tw`text-[10px] uppercase font-bold`, { color: textMuted }]}>Time</Text>
                  <Text style={[tw`text-xs font-bold mt-0.5`, { color: textPrimary }]}>{timeStr}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Receipt / Photo Section */}
          <View style={[tw`rounded-2xl p-5 shadow-sm border mb-6`, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-3`, { color: textMuted }]}>
              Receipt Photo (Optional)
            </Text>

            {receiptUri ? (
              <View style={tw`items-center`}>
                <View style={tw`relative rounded-xl overflow-hidden mb-2 border border-gray-300 dark:border-gray-700`}>
                  <Image source={{ uri: receiptUri }} style={tw`w-full h-44`} resizeMode="cover" />
                  <TouchableOpacity
                    style={tw`absolute top-2 right-2 bg-black/60 rounded-full p-1.5`}
                    onPress={() => setReceiptUri(null)}
                  >
                    <X color="#ffffff" size={16} />
                  </TouchableOpacity>
                </View>
                <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>
                  Receipt attached successfully
                </Text>
              </View>
            ) : (
              <View style={tw`flex-row gap-3`}>
                <TouchableOpacity
                  style={[
                    tw`flex-1 border border-dashed rounded-xl p-3 flex-row items-center justify-center gap-2`,
                    { borderColor: isDark ? '#4b5563' : '#d1d5db', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                  ]}
                  onPress={handleTakePhoto}
                >
                  <Camera color="#4f46e5" size={18} />
                  <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    tw`flex-1 border border-dashed rounded-xl p-3 flex-row items-center justify-center gap-2`,
                    { borderColor: isDark ? '#4b5563' : '#d1d5db', backgroundColor: isDark ? '#374151' : '#f9fafb' },
                  ]}
                  onPress={handlePickGallery}
                >
                  <ImageIcon color="#4f46e5" size={18} />
                  <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button */}
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

      {/* Date Picker Modal */}
      <DateTimePickerModal
        visible={showDatePicker}
        mode="date"
        value={pickerDate}
        onChange={(event, selectedDate) => {
          if (selectedDate) setPickerDate(selectedDate);
        }}
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
        title="Select Date"
      />

      {/* Time Picker Modal */}
      <DateTimePickerModal
        visible={showTimePicker}
        mode="time"
        value={pickerDate}
        onChange={(event, selectedDate) => {
          if (selectedDate) setPickerDate(selectedDate);
        }}
        onConfirm={handleTimeConfirm}
        onCancel={() => setShowTimePicker(false)}
        title="Select Time"
      />
    </SafeAreaView>
  );
}
