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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Camera, Image as ImageIcon, Calendar, Clock, X, Plus, Tag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
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
    customCategories,
    loadCustomCategories,
    addCustomCategory,
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

  // Custom Category Modal State
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Toast feedback
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Initialize date/time & custom categories on mount
  useEffect(() => {
    loadCustomCategories();
    loadLastUsedDefaults();
    fetchKhataAccounts();

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
  }, []);

  // Set category defaults when type changes
  useEffect(() => {
    if (isEditing) return;

    if (txType === 'expense') {
      const defCat = lastUsedExpenseCategory || DEFAULT_EXPENSE_CATEGORIES[0].name;
      setCategory(defCat);

      const found = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === defCat);
      const defSub = lastUsedExpenseSubcategory || (found?.subcategories[0] || 'General');
      setSubcategory(defSub);
      setPaymentMethod(lastUsedPaymentMethod || 'UPI');
    } else if (txType === 'income') {
      const defInc = lastUsedIncomeCategory || DEFAULT_INCOME_CATEGORIES[0];
      setCategory(defInc);
      setSubcategory('General');
      setPaymentMethod(lastUsedPaymentMethod || 'UPI');
    } else if (txType === 'khata') {
      const catName = khataType === 'udhar_diya' ? 'Udhar Diya' : 'Udhar Liya';
      setCategory(catName);
      setSubcategory(khataType === 'udhar_diya' ? 'Money Given' : 'Money Borrowed');
      setPaymentMethod('UPI');
    }
  }, [txType, khataType]);

  // Update subcategory options when category changes
  const handleCategorySelect = (catName: string) => {
    setCategory(catName);
    const found = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === catName);
    if (found && found.subcategories.length > 0) {
      setSubcategory(found.subcategories[0]);
    } else {
      setSubcategory('General');
    }
  };

  // Image Pickers
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required to attach receipt images.');
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
      Alert.alert('Error', e.message || 'Failed to select image.');
    }
  };

  const handleTakeCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture receipt images.');
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
      Alert.alert('Error', e.message || 'Failed to take photo.');
    }
  };

  const handleAddCustomCat = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }
    const catType = txType === 'income' ? 'income' : 'expense';
    const success = await addCustomCategory({
      name: newCatName.trim(),
      icon: 'Tag',
      type: catType,
    });
    if (success) {
      setCategory(newCatName.trim());
      setSubcategory('General');
      setNewCatName('');
      setShowAddCatModal(false);
      setToastMessage(`Custom category "${newCatName.trim()}" created!`);
      setToastVisible(true);
    }
  };

  // Form Submission
  const handleSubmit = async () => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for amount.');
      return;
    }

    if (!category) {
      Alert.alert('Category Required', 'Please select or add a category.');
      return;
    }

    if (txType === 'khata' && !selectedKhataId) {
      Alert.alert('Khata Account Required', 'Please select a Khata customer/vendor account.');
      return;
    }

    const amountPaise = rupeesToPaise(amt);
    const backendType = txType === 'khata' ? (khataType === 'udhar_diya' ? 'expense' : 'income') : txType;

    const payload: any = {
      amount: amountPaise,
      type: backendType,
      category,
      subcategory: subcategory || 'General',
      payment_method: paymentMethod,
      date: dateStr,
      time: timeStr,
      description,
      khata_id: txType === 'khata' ? selectedKhataId : null,
      khata_type: txType === 'khata' ? khataType : null,
      status: 'paid',
    };

    let success = false;
    if (isEditing && editTx) {
      success = await updateTransaction(editTx.id, payload);
    } else {
      success = await addTransaction(payload);
    }

    if (success) {
      setToastMessage(isEditing ? 'Transaction updated successfully!' : 'Transaction recorded successfully!');
      setToastVisible(true);
      setTimeout(() => {
        navigation.goBack();
      }, 700);
    } else {
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
    }
  };

  const activeSubcategories =
    DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === category)?.subcategories || ['General'];

  const customExpenseCats = customCategories.filter((c) => c.type === 'expense');
  const customIncomeCats = customCategories.filter((c) => c.type === 'income');

  const bg = isDark ? '#111827' : '#f9fafb';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#f3f4f6';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={cardBg}
      />

      <Toast visible={toastVisible} message={toastMessage} type="success" />

      {/* Header */}
      <View
        style={[
          tw`px-6 py-4 border-b flex-row justify-between items-center`,
          { backgroundColor: cardBg, borderColor },
        ]}
      >
        <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
          {isEditing ? 'Edit Transaction' : 'Record Transaction'}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-1`}>
          <X color={textMuted} size={24} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={tw`p-6 pb-28`}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Selector Pills */}
          <View style={tw`flex-row bg-gray-200 dark:bg-gray-800 p-1.5 rounded-2xl mb-6`}>
            <TouchableOpacity
              style={[
                tw`flex-1 py-2.5 rounded-xl items-center`,
                txType === 'expense' ? tw`bg-rose-600 shadow-sm` : {},
              ]}
              onPress={() => setTxType('expense')}
            >
              <Text
                style={[
                  tw`text-xs font-bold`,
                  txType === 'expense' ? tw`text-white` : { color: textMuted },
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                tw`flex-1 py-2.5 rounded-xl items-center`,
                txType === 'income' ? tw`bg-emerald-600 shadow-sm` : {},
              ]}
              onPress={() => setTxType('income')}
            >
              <Text
                style={[
                  tw`text-xs font-bold`,
                  txType === 'income' ? tw`text-white` : { color: textMuted },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                tw`flex-1 py-2.5 rounded-xl items-center`,
                txType === 'khata' ? tw`bg-violet-600 shadow-sm` : {},
              ]}
              onPress={() => setTxType('khata')}
            >
              <Text
                style={[
                  tw`text-xs font-bold`,
                  txType === 'khata' ? tw`text-white` : { color: textMuted },
                ]}
              >
                Khata
              </Text>
            </TouchableOpacity>
          </View>

          {/* Khata Sub-Type Selector */}
          {txType === 'khata' && (
            <View style={tw`mb-6`}>
              <Text style={[tw`text-xs font-semibold mb-2 uppercase tracking-wider`, { color: textMuted }]}>
                Khata Record Type
              </Text>
              <View style={tw`flex-row gap-3`}>
                <TouchableOpacity
                  style={[
                    tw`flex-1 py-3 border rounded-2xl items-center`,
                    khataType === 'udhar_diya'
                      ? tw`bg-emerald-500/10 border-emerald-500`
                      : { backgroundColor: cardBg, borderColor },
                  ]}
                  onPress={() => setKhataType('udhar_diya')}
                >
                  <Text style={tw`text-xs font-bold text-emerald-600 dark:text-emerald-400`}>
                    Udhar Diya (Given)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    tw`flex-1 py-3 border rounded-2xl items-center`,
                    khataType === 'udhar_liya'
                      ? tw`bg-amber-500/10 border-amber-500`
                      : { backgroundColor: cardBg, borderColor },
                  ]}
                  onPress={() => setKhataType('udhar_liya')}
                >
                  <Text style={tw`text-xs font-bold text-amber-600 dark:text-amber-400`}>
                    Udhar Liya (Borrowed)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Account Dropdown Selector */}
              <Text style={[tw`text-xs font-semibold mt-4 mb-2 uppercase tracking-wider`, { color: textMuted }]}>
                Select Khata Account
              </Text>
              {khataAccounts.length === 0 ? (
                <TouchableOpacity
                  style={[tw`border border-dashed rounded-2xl p-4 items-center`, { borderColor }]}
                  onPress={() => navigation.navigate('Khata')}
                >
                  <Text style={tw`text-violet-600 dark:text-violet-400 text-xs font-bold`}>
                    + Create New Khata Account
                  </Text>
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row`}>
                  {khataAccounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        tw`border rounded-2xl px-4 py-2.5 mr-2.5 shadow-sm`,
                        selectedKhataId === acc.id
                          ? tw`bg-violet-600 border-violet-600`
                          : { backgroundColor: cardBg, borderColor },
                      ]}
                      onPress={() => setSelectedKhataId(acc.id)}
                    >
                      <Text
                        style={[
                          tw`text-xs font-bold`,
                          selectedKhataId === acc.id ? tw`text-white` : { color: textPrimary },
                        ]}
                      >
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Amount Input */}
          <View style={[tw`border rounded-3xl p-5 mb-6 shadow-sm`, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
              Amount (₹)
            </Text>
            <View style={tw`flex-row items-center`}>
              <Text style={[tw`text-3xl font-black mr-2`, { color: textPrimary }]}>₹</Text>
              <TextInput
                style={[tw`flex-1 text-3xl font-extrabold`, { color: textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={textMuted}
                keyboardType="decimal-pad"
                value={amountStr}
                onChangeText={setAmountStr}
                autoFocus={!isEditing}
              />
            </View>
          </View>

          {/* Date & Time Selector Cards */}
          <View style={tw`flex-row gap-3 mb-6`}>
            <TouchableOpacity
              style={[
                tw`flex-1 border rounded-2xl p-4 flex-row items-center gap-3 shadow-sm`,
                { backgroundColor: cardBg, borderColor },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar color="#7c3aed" size={20} />
              <View>
                <Text style={[tw`text-[10px] font-bold uppercase`, { color: textMuted }]}>Date</Text>
                <Text style={[tw`text-xs font-bold mt-0.5`, { color: textPrimary }]}>
                  {dateStr || 'Select Date'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                tw`flex-1 border rounded-2xl p-4 flex-row items-center gap-3 shadow-sm`,
                { backgroundColor: cardBg, borderColor },
              ]}
              onPress={() => setShowTimePicker(true)}
            >
              <Clock color="#7c3aed" size={20} />
              <View>
                <Text style={[tw`text-[10px] font-bold uppercase`, { color: textMuted }]}>Time</Text>
                <Text style={[tw`text-xs font-bold mt-0.5`, { color: textPrimary }]}>
                  {timeStr || 'Select Time'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Category Selector Pills */}
          <View style={tw`mb-6`}>
            <View style={tw`flex-row justify-between items-center mb-2`}>
              <Text style={[tw`text-xs font-semibold uppercase tracking-wider`, { color: textMuted }]}>
                Category
              </Text>
              <TouchableOpacity onPress={() => setShowAddCatModal(true)}>
                <Text style={tw`text-violet-600 dark:text-violet-400 text-xs font-bold`}>
                  + Add Category
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row py-1`}>
              {txType === 'expense'
                ? [
                    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name),
                    ...customExpenseCats.map((c) => c.name),
                  ].map((catName) => (
                    <TouchableOpacity
                      key={catName}
                      style={[
                        tw`border rounded-2xl px-4 py-2.5 mr-2 shadow-sm`,
                        category === catName
                          ? tw`bg-violet-600 border-violet-600`
                          : { backgroundColor: cardBg, borderColor },
                      ]}
                      onPress={() => handleCategorySelect(catName)}
                    >
                      <Text
                        style={[
                          tw`text-xs font-bold`,
                          category === catName ? tw`text-white` : { color: textPrimary },
                        ]}
                      >
                        {catName}
                      </Text>
                    </TouchableOpacity>
                  ))
                : [
                    ...DEFAULT_INCOME_CATEGORIES,
                    ...customIncomeCats.map((c) => c.name),
                  ].map((catName) => (
                    <TouchableOpacity
                      key={catName}
                      style={[
                        tw`border rounded-2xl px-4 py-2.5 mr-2 shadow-sm`,
                        category === catName
                          ? tw`bg-emerald-600 border-emerald-600`
                          : { backgroundColor: cardBg, borderColor },
                      ]}
                      onPress={() => setCategory(catName)}
                    >
                      <Text
                        style={[
                          tw`text-xs font-bold`,
                          category === catName ? tw`text-white` : { color: textPrimary },
                        ]}
                      >
                        {catName}
                      </Text>
                    </TouchableOpacity>
                  ))}
            </ScrollView>
          </View>

          {/* Subcategory Pills (for Expense) */}
          {txType === 'expense' && activeSubcategories.length > 0 && (
            <View style={tw`mb-6`}>
              <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Subcategory
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row py-1`}>
                {activeSubcategories.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    style={[
                      tw`border rounded-xl px-3.5 py-2 mr-2`,
                      subcategory === sub
                        ? tw`bg-violet-100 border-violet-500 dark:bg-violet-950`
                        : { backgroundColor: cardBg, borderColor },
                    ]}
                    onPress={() => setSubcategory(sub)}
                  >
                    <Text
                      style={[
                        tw`text-xs font-semibold`,
                        subcategory === sub ? tw`text-violet-600 dark:text-violet-300` : { color: textPrimary },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Payment Method Selector */}
          <View style={tw`mb-6`}>
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
              Payment Method
            </Text>
            <View style={tw`flex-row flex-wrap gap-2`}>
              {['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank Transfer'].map((pm) => (
                <TouchableOpacity
                  key={pm}
                  style={[
                    tw`border rounded-2xl px-4 py-2.5 shadow-sm`,
                    paymentMethod === pm
                      ? tw`bg-violet-600 border-violet-600`
                      : { backgroundColor: cardBg, borderColor },
                  ]}
                  onPress={() => setPaymentMethod(pm)}
                >
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      paymentMethod === pm ? tw`text-white` : { color: textPrimary },
                    ]}
                  >
                    {pm}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Optional Note / Description Input */}
          <View style={[tw`border rounded-3xl p-5 mb-6 shadow-sm`, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-2`, { color: textMuted }]}>
              Note / Description (Optional)
            </Text>
            <TextInput
              style={[tw`text-sm font-medium`, { color: textPrimary }]}
              placeholder="e.g. Swiggy lunch with team"
              placeholderTextColor={textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* Attach Receipt Photo Section */}
          <View style={[tw`border rounded-3xl p-5 mb-8 shadow-sm`, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-3`, { color: textMuted }]}>
              Attach Receipt Photo
            </Text>
            {receiptUri ? (
              <View style={tw`relative items-center`}>
                <Image source={{ uri: receiptUri }} style={tw`w-full h-44 rounded-2xl`} resizeMode="cover" />
                <TouchableOpacity
                  style={tw`absolute top-2 right-2 bg-black/70 p-2 rounded-full`}
                  onPress={() => setReceiptUri(null)}
                >
                  <X color="#ffffff" size={16} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={tw`flex-row gap-3`}>
                <TouchableOpacity
                  style={[tw`flex-1 border border-dashed rounded-2xl p-4 items-center gap-1.5`, { borderColor }]}
                  onPress={handleTakeCamera}
                >
                  <Camera color="#7c3aed" size={20} />
                  <Text style={tw`text-violet-600 dark:text-violet-400 text-xs font-bold`}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[tw`flex-1 border border-dashed rounded-2xl p-4 items-center gap-1.5`, { borderColor }]}
                  onPress={handlePickImage}
                >
                  <ImageIcon color="#7c3aed" size={20} />
                  <Text style={tw`text-violet-600 dark:text-violet-400 text-xs font-bold`}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={tw`bg-violet-600 rounded-3xl py-4 items-center shadow-lg mb-8`}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={tw`text-white font-black text-base`}>
                {isEditing ? 'Update Record' : 'Save Record'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date & Time Picker Modals */}
      <DateTimePickerModal
        visible={showDatePicker}
        mode="date"
        value={pickerDate}
        onConfirm={(selectedDate) => {
          setShowDatePicker(false);
          setPickerDate(selectedDate);
          const yyyy = selectedDate.getFullYear();
          const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const dd = String(selectedDate.getDate()).padStart(2, '0');
          setDateStr(`${yyyy}-${mm}-${dd}`);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      <DateTimePickerModal
        visible={showTimePicker}
        mode="time"
        value={pickerDate}
        onConfirm={(selectedTime) => {
          setShowTimePicker(false);
          setPickerDate(selectedTime);
          const hh = String(selectedTime.getHours()).padStart(2, '0');
          const min = String(selectedTime.getMinutes()).padStart(2, '0');
          const ss = String(selectedTime.getSeconds()).padStart(2, '0');
          setTimeStr(`${hh}:${min}:${ss}`);
        }}
        onCancel={() => setShowTimePicker(false)}
      />

      {/* Custom Category Creation Modal */}
      {showAddCatModal && (
        <Modal
          visible={showAddCatModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddCatModal(false)}
        >
          <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
            <View style={[tw`w-full rounded-3xl p-6 shadow-xl`, { backgroundColor: cardBg }]}>
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
                  Create Custom Category
                </Text>
                <TouchableOpacity onPress={() => setShowAddCatModal(false)}>
                  <X color={textMuted} size={20} />
                </TouchableOpacity>
              </View>

              <Text style={[tw`text-xs font-semibold uppercase mb-2`, { color: textMuted }]}>
                Category Name
              </Text>
              <TextInput
                style={[
                  tw`border rounded-2xl px-4 py-3 text-sm font-semibold mb-5`,
                  { color: textPrimary, backgroundColor: bg, borderColor },
                ]}
                placeholder="e.g. Subscriptions, Pet Care"
                placeholderTextColor={textMuted}
                value={newCatName}
                onChangeText={setNewCatName}
                autoFocus
              />

              <TouchableOpacity
                style={tw`bg-violet-600 rounded-2xl py-3.5 items-center shadow-md`}
                onPress={handleAddCustomCat}
              >
                <Text style={tw`text-white font-bold text-sm`}>Add Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
