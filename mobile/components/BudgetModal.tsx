import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import tw from 'twrnc';
import { Target, X } from 'lucide-react-native';
import { useBudgetStore } from '../store/budgetStore';
import { useIsDark } from '../store/themeStore';
import { rupeesToPaise, formatRupees } from '../utils/money';
import { DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';

interface BudgetModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BudgetModal({ visible, onClose }: BudgetModalProps) {
  const isDark = useIsDark();
  const {
    monthlyBudget,
    categoryBudgets,
    setMonthlyBudget,
    setCategoryBudget,
    removeCategoryBudget,
  } = useBudgetStore();

  const [monthlyStr, setMonthlyStr] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [catBudgetStr, setCatBudgetStr] = useState('');

  useEffect(() => {
    if (visible) {
      setMonthlyStr(monthlyBudget > 0 ? (monthlyBudget / 100).toString() : '');
    }
  }, [visible, monthlyBudget]);

  const handleSaveMonthly = async () => {
    const val = parseFloat(monthlyStr);
    if (isNaN(val) || val <= 0) {
      await setMonthlyBudget(0); // clear
      onClose();
      return;
    }
    await setMonthlyBudget(rupeesToPaise(val));
    onClose();
  };

  const handleSaveCategoryBudget = async () => {
    if (!selectedCat) return;
    const val = parseFloat(catBudgetStr);
    if (isNaN(val) || val <= 0) {
      await removeCategoryBudget(selectedCat);
    } else {
      await setCategoryBudget(selectedCat, rupeesToPaise(val));
    }
    setSelectedCat('');
    setCatBudgetStr('');
  };

  if (!visible) return null;

  const bg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const cardBg = isDark ? '#111827' : '#f9fafb';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-end bg-black/50`}>
        <View style={[tw`rounded-t-3xl p-6 max-h-[85%]`, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={tw`flex-row justify-between items-center mb-5`}>
            <View style={tw`flex-row items-center gap-2`}>
              <Target color="#7c3aed" size={22} />
              <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
                Monthly Budget Settings
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X color={textMuted} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Overall Monthly Budget */}
            <View style={[tw`border rounded-2xl p-4 mb-5`, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: textMuted }]}>
                Overall Monthly Limit (Rupees)
              </Text>
              <View style={tw`flex-row gap-3 items-center`}>
                <TextInput
                  style={[
                    tw`flex-1 border rounded-xl px-4 py-3 text-base font-bold`,
                    { backgroundColor: bg, borderColor, color: textPrimary },
                  ]}
                  placeholder="e.g. 25000"
                  placeholderTextColor={textMuted}
                  keyboardType="numeric"
                  value={monthlyStr}
                  onChangeText={setMonthlyStr}
                />
                <TouchableOpacity
                  style={tw`bg-violet-600 rounded-xl px-5 py-3.5 shadow-sm`}
                  onPress={handleSaveMonthly}
                >
                  <Text style={tw`text-white text-xs font-bold`}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Budgets */}
            <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-3`, { color: textMuted }]}>
              Category Budgets (Optional)
            </Text>

            {/* Existing Category Budgets List */}
            {Object.keys(categoryBudgets).length > 0 && (
              <View style={[tw`border rounded-2xl p-4 mb-4`, { backgroundColor: cardBg, borderColor }]}>
                {Object.entries(categoryBudgets).map(([cat, amountPaise]) => (
                  <View
                    key={cat}
                    style={[tw`flex-row justify-between items-center py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0`]}
                  >
                    <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>{cat}</Text>
                    <View style={tw`flex-row items-center gap-3`}>
                      <Text style={tw`text-sm font-extrabold text-violet-600 dark:text-violet-400`}>
                        {formatRupees(amountPaise)}
                      </Text>
                      <TouchableOpacity onPress={() => removeCategoryBudget(cat)}>
                        <Text style={tw`text-rose-500 text-xs font-bold`}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Add Category Budget Section */}
            <View style={[tw`border rounded-2xl p-4 mb-6`, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[tw`text-xs font-semibold mb-2`, { color: textPrimary }]}>
                Set Category Target
              </Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row gap-2 mb-3`}>
                {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={[
                      tw`border rounded-xl px-3 py-2`,
                      selectedCat === c.name
                        ? { borderColor: '#7c3aed', backgroundColor: isDark ? '#3b0764' : '#f3e8ff' }
                        : { borderColor, backgroundColor: bg },
                    ]}
                    onPress={() => setSelectedCat(c.name)}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: selectedCat === c.name ? '#7c3aed' : textPrimary,
                      }}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedCat !== '' && (
                <View style={tw`flex-row gap-3 items-center mt-1`}>
                  <TextInput
                    style={[
                      tw`flex-1 border rounded-xl px-4 py-2.5 text-sm font-bold`,
                      { backgroundColor: bg, borderColor, color: textPrimary },
                    ]}
                    placeholder={`Budget for ${selectedCat}`}
                    placeholderTextColor={textMuted}
                    keyboardType="numeric"
                    value={catBudgetStr}
                    onChangeText={setCatBudgetStr}
                  />
                  <TouchableOpacity
                    style={tw`bg-violet-600 rounded-xl px-4 py-2.5 shadow-sm`}
                    onPress={handleSaveCategoryBudget}
                  >
                    <Text style={tw`text-white text-xs font-bold`}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
