import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import tw from 'twrnc';
import { Target, X, Trash2, Edit3, Plus, AlertTriangle } from 'lucide-react-native';
import { useBudgetStore, getCurrentMonthKey } from '../store/budgetStore';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { rupeesToPaise, formatRupees } from '../utils/money';
import { DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';
import Toast from './Toast';

interface BudgetModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BudgetModal({ visible, onClose }: BudgetModalProps) {
  const isDark = useIsDark();
  const {
    budgets,
    monthlyBudget,
    categoryBudgets,
    saveBudget,
    deleteBudget,
    setMonthlyBudget,
    setCategoryBudget,
    removeCategoryBudget,
  } = useBudgetStore();

  const { transactions, customCategories } = useTransactionStore();

  const [activeTab, setActiveTab] = useState<'overall' | 'category'>('overall');
  const [monthlyStr, setMonthlyStr] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [catBudgetStr, setCatBudgetStr] = useState('');

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const currentMonthKey = getCurrentMonthKey();

  // Compute actual spending for current month per category & overall
  const now = new Date();
  const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  let totalMonthExpense = 0;
  const categorySpentMap: Record<string, number> = {};

  transactions.forEach((tx) => {
    if (tx.type === 'expense' && tx.date >= firstDayOfMonth) {
      const paid = tx.paid_amount || tx.amount;
      totalMonthExpense += paid;
      categorySpentMap[tx.category] = (categorySpentMap[tx.category] || 0) + paid;
    }
  });

  useEffect(() => {
    if (visible) {
      setMonthlyStr(monthlyBudget > 0 ? (monthlyBudget / 100).toString() : '');
    }
  }, [visible, monthlyBudget]);

  const handleSaveMonthly = async () => {
    const val = parseFloat(monthlyStr);
    if (isNaN(val) || val <= 0) {
      await setMonthlyBudget(0);
      setToastMessage('Monthly budget cleared.');
      setToastVisible(true);
      return;
    }
    await setMonthlyBudget(rupeesToPaise(val));
    setToastMessage('Overall monthly budget saved!');
    setToastVisible(true);
  };

  const handleSaveCategoryBudget = async () => {
    if (!selectedCat) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }
    const val = parseFloat(catBudgetStr);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount in rupees.');
      return;
    }
    await setCategoryBudget(selectedCat, rupeesToPaise(val));
    setSelectedCat('');
    setCatBudgetStr('');
    setToastMessage(`Budget for ${selectedCat} saved!`);
    setToastVisible(true);
  };

  const handleDeleteBudget = (id: string, categoryName: string) => {
    Alert.alert(
      'Delete this budget?',
      `Are you sure you want to delete the budget target for "${categoryName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBudget(id);
            setToastMessage(`Budget for ${categoryName} removed.`);
            setToastVisible(true);
          },
        },
      ]
    );
  };

  if (!visible) return null;

  const bg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const cardBg = isDark ? '#111827' : '#f9fafb';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  const allCategories = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name),
    ...customCategories.filter((c) => c.type === 'expense').map((c) => c.name),
  ];

  const overallPct = monthlyBudget > 0 ? Math.min(Math.round((totalMonthExpense / monthlyBudget) * 100), 100) : 0;
  const isOverallExceeded = monthlyBudget > 0 && totalMonthExpense > monthlyBudget;

  const currentMonthBudgets = budgets.filter((b) => b.month === currentMonthKey && b.category !== 'overall');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-end bg-black/60`}>
        <Toast visible={toastVisible} message={toastMessage} type="success" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={tw`w-full`}
        >
          <View style={[tw`rounded-t-3xl p-6 max-h-[88%]`, { backgroundColor: bg }]}>
            {/* Header Bar */}
            <View style={tw`flex-row justify-between items-center mb-5`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Target color="#6C5CE7" size={24} />
                <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
                  Budget Planner
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={tw`p-1`}>
                <X color={textMuted} size={22} />
              </TouchableOpacity>
            </View>

            {/* Sub-Tab Navigation */}
            <View style={tw`flex-row bg-gray-200 dark:bg-gray-800 p-1.5 rounded-2xl mb-5`}>
              <TouchableOpacity
                style={[
                  tw`flex-1 py-2.5 rounded-xl items-center`,
                  activeTab === 'overall' ? tw`bg-[#6C5CE7] shadow-sm` : {},
                ]}
                onPress={() => setActiveTab('overall')}
              >
                <Text
                  style={[
                    tw`text-xs font-bold`,
                    activeTab === 'overall' ? tw`text-white` : { color: textMuted },
                  ]}
                >
                  Overall Limit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  tw`flex-1 py-2.5 rounded-xl items-center`,
                  activeTab === 'category' ? tw`bg-[#6C5CE7] shadow-sm` : {},
                ]}
                onPress={() => setActiveTab('category')}
              >
                <Text
                  style={[
                    tw`text-xs font-bold`,
                    activeTab === 'category' ? tw`text-white` : { color: textMuted },
                  ]}
                >
                  Per Category
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {activeTab === 'overall' ? (
                /* Overall Monthly Budget Card */
                <View style={[tw`border rounded-3xl p-5 mb-5 shadow-sm`, { backgroundColor: cardBg, borderColor }]}>
                  <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                    Total Monthly Budget (₹)
                  </Text>
                  <View style={tw`flex-row gap-3 items-center mb-4`}>
                    <TextInput
                      style={[
                        tw`flex-1 border rounded-2xl px-4 py-3 text-base font-bold`,
                        { color: textPrimary, backgroundColor: bg, borderColor },
                      ]}
                      placeholder="e.g. 15000"
                      placeholderTextColor={textMuted}
                      keyboardType="decimal-pad"
                      value={monthlyStr}
                      onChangeText={setMonthlyStr}
                    />
                    <TouchableOpacity
                      style={tw`bg-violet-600 rounded-2xl px-5 py-3.5 shadow-md`}
                      onPress={handleSaveMonthly}
                    >
                      <Text style={tw`text-white font-bold text-xs`}>Save</Text>
                    </TouchableOpacity>
                  </View>

                  {monthlyBudget > 0 && (
                    <View style={[tw`mt-2 border-t pt-4`, { borderColor }]}>
                      <View style={tw`flex-row justify-between items-center mb-2`}>
                        <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                          Spent: {formatRupees(totalMonthExpense)} / Budget: {formatRupees(monthlyBudget)}
                        </Text>
                        <Text
                          style={[
                            tw`text-xs font-extrabold`,
                            isOverallExceeded ? tw`text-rose-600 dark:text-rose-400` : tw`text-violet-600 dark:text-violet-400`,
                          ]}
                        >
                          {overallPct}%
                        </Text>
                      </View>

                      {/* Progress Bar */}
                      <View style={[tw`w-full h-3 rounded-full overflow-hidden`, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                        <View
                          style={[
                            tw`h-full rounded-full`,
                            isOverallExceeded ? tw`bg-rose-500` : tw`bg-violet-600`,
                            { width: `${overallPct}%` },
                          ]}
                        />
                      </View>

                      {isOverallExceeded && (
                        <View style={tw`flex-row items-center gap-1.5 mt-3`}>
                          <AlertTriangle color="#ef4444" size={14} />
                          <Text style={tw`text-rose-500 text-xs font-semibold`}>
                            Warning: Overall monthly budget limit exceeded!
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                /* Category-Specific Budget CRUD */
                <View>
                  {/* Add / Set Category Budget Card */}
                  <View style={[tw`border rounded-3xl p-5 mb-5 shadow-sm`, { backgroundColor: cardBg, borderColor }]}>
                    <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                      Set Category Target
                    </Text>

                    {/* Category Selector Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row mb-3`}>
                      {allCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            tw`border rounded-2xl px-3.5 py-2 mr-2`,
                            selectedCat === cat
                              ? tw`bg-violet-600 border-violet-600`
                              : { backgroundColor: bg, borderColor },
                          ]}
                          onPress={() => setSelectedCat(cat)}
                        >
                          <Text
                            style={[
                              tw`text-xs font-bold`,
                              selectedCat === cat ? tw`text-white` : { color: textPrimary },
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <View style={tw`flex-row gap-3 items-center`}>
                      <TextInput
                        style={[
                          tw`flex-1 border rounded-2xl px-4 py-3 text-sm font-bold`,
                          { color: textPrimary, backgroundColor: bg, borderColor },
                        ]}
                        placeholder="Limit e.g. 5000"
                        placeholderTextColor={textMuted}
                        keyboardType="decimal-pad"
                        value={catBudgetStr}
                        onChangeText={setCatBudgetStr}
                      />
                      <TouchableOpacity
                        style={tw`bg-violet-600 rounded-2xl px-5 py-3.5 shadow-md`}
                        onPress={handleSaveCategoryBudget}
                      >
                        <Text style={tw`text-white font-bold text-xs`}>Add Target</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Vertically Stacked Category Budget Cards */}
                  <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-3 px-1`, { color: textMuted }]}>
                    Current Category Targets ({currentMonthBudgets.length})
                  </Text>

                  {currentMonthBudgets.length === 0 ? (
                    <View style={[tw`border border-dashed rounded-3xl p-6 items-center mb-6`, { borderColor }]}>
                      <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>
                        No category targets set for this month yet.
                      </Text>
                    </View>
                  ) : (
                    currentMonthBudgets.map((b) => {
                      const spent = categorySpentMap[b.category] || 0;
                      const pct = b.amount > 0 ? Math.min(Math.round((spent / b.amount) * 100), 100) : 0;
                      const isExceeded = b.amount > 0 && spent > b.amount;

                      return (
                        <View
                          key={b.id}
                          style={[
                            tw`border rounded-3xl p-5 mb-4 shadow-sm`,
                            { backgroundColor: cardBg, borderColor },
                          ]}
                        >
                          <View style={tw`flex-row justify-between items-center mb-2`}>
                            <Text style={[tw`text-sm font-extrabold`, { color: textPrimary }]}>
                              {b.category}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleDeleteBudget(b.id, b.category)}
                              style={tw`p-1.5 bg-rose-100 dark:bg-rose-950/80 rounded-full`}
                            >
                              <Trash2 color="#ef4444" size={14} />
                            </TouchableOpacity>
                          </View>

                          <View style={tw`flex-row justify-between items-center mb-2`}>
                            <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>
                              Spent: {formatRupees(spent)} / Limit: {formatRupees(b.amount)}
                            </Text>
                            <Text
                              style={[
                                tw`text-xs font-extrabold`,
                                isExceeded ? tw`text-rose-600 dark:text-rose-400` : tw`text-violet-600 dark:text-violet-400`,
                              ]}
                            >
                              {pct}%
                            </Text>
                          </View>

                          {/* Progress Meter */}
                          <View style={[tw`w-full h-2.5 rounded-full overflow-hidden`, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
                            <View
                              style={[
                                tw`h-full rounded-full`,
                                isExceeded ? tw`bg-rose-500` : tw`bg-violet-600`,
                                { width: `${pct}%` },
                              ]}
                            />
                          </View>

                          {isExceeded && (
                            <Text style={tw`text-rose-500 text-[10px] font-semibold mt-2`}>
                              ⚠️ Limit exceeded for {b.category}!
                            </Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
