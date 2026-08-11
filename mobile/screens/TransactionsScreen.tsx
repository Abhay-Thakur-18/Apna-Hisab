import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Search, Filter, Trash2, Edit3, ChevronDown, ChevronUp, Tag } from 'lucide-react-native';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { formatRupees } from '../utils/money';
import { formatDateTime, formatTime } from '../utils/date';
import Toast from '../components/Toast';

export default function TransactionsScreen({ route, navigation }: any) {
  const {
    transactions,
    fetchTransactions,
    deleteTransaction,
    customCategories,
    isLoading,
  } = useTransactionStore();

  const isDark = useIsDark();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'khata' | 'pending'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Selected item ID for expanding details
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Toast feedback
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Handle route params when navigating from Khata Screen
  const filterKhataId = route.params?.filterKhataId || null;

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction? Your balance, totals, and budget will update immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteTransaction(id);
            if (success) {
              setToastMessage('Transaction deleted.');
              setToastVisible(true);
            }
          },
        },
      ]
    );
  };

  // Apply frontend filtering & searching
  const filteredTransactions = transactions.filter((tx) => {
    if (filterKhataId && tx.khata_id !== filterKhataId) return false;
    if (typeFilter === 'income' && tx.type !== 'income') return false;
    if (typeFilter === 'expense' && tx.type !== 'expense') return false;
    if (typeFilter === 'khata' && !tx.khata_id) return false;
    if (typeFilter === 'pending' && tx.status !== 'pending') return false;
    if (methodFilter !== 'All' && tx.payment_method !== methodFilter) return false;
    if (selectedCategory !== 'All' && tx.category !== selectedCategory) return false;

    if (search.trim() !== '') {
      const query = search.toLowerCase();
      const matchCat = tx.category.toLowerCase().includes(query);
      const matchSub = tx.subcategory.toLowerCase().includes(query);
      const matchDesc = tx.description ? tx.description.toLowerCase().includes(query) : false;
      if (!matchCat && !matchSub && !matchDesc) return false;
    }

    return true;
  });

  // Group transactions by date
  const groupedTransactions: { [key: string]: typeof transactions } = {};
  filteredTransactions.forEach((tx) => {
    if (!groupedTransactions[tx.date]) {
      groupedTransactions[tx.date] = [];
    }
    groupedTransactions[tx.date].push(tx);
  });

  const dates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

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

      <Toast visible={toastVisible} message={toastMessage} type="info" />

      {/* Header Bar */}
      <View
        style={[
          tw`px-6 py-4 border-b flex-row justify-between items-center`,
          { backgroundColor: cardBg, borderColor },
        ]}
      >
        <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>Transaction History</Text>
        <Text style={[tw`text-xs font-bold text-violet-600 dark:text-violet-400`]}>
          {filteredTransactions.length} records
        </Text>
      </View>

      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={tw`p-6 pb-2`}>
          {/* Search Box */}
          <View
            style={[
              tw`flex-row items-center border rounded-2xl px-4 py-3 mb-4 shadow-sm`,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <Search color={textMuted} size={18} style={tw`mr-2.5`} />
            <TextInput
              style={[tw`flex-1 text-sm font-medium`, { color: textPrimary }]}
              placeholder="Search category, note, or amount..."
              placeholderTextColor={textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Horizontal Filter Scroll Pill Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`flex-row pr-6 py-1`}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'income', label: 'Income' },
              { id: 'expense', label: 'Expense' },
              { id: 'khata', label: 'Khata' },
              { id: 'pending', label: 'Pending' },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  tw`border rounded-2xl px-4 py-2.5 mr-2.5 shadow-sm`,
                  typeFilter === f.id
                    ? tw`bg-[#6C5CE7] border-[#6C5CE7]`
                    : { backgroundColor: cardBg, borderColor },
                ]}
                onPress={() => setTypeFilter(f.id as any)}
              >
                <Text
                  style={[
                    tw`text-xs font-bold`,
                    typeFilter === f.id ? tw`text-white` : { color: textPrimary },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Transactions List */}
        <ScrollView
          contentContainerStyle={tw`px-6 pb-24`}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#7c3aed']} />
          }
        >
          {dates.length === 0 ? (
            <View
              style={[
                tw`border border-dashed rounded-3xl p-10 items-center mt-6`,
                { backgroundColor: cardBg, borderColor },
              ]}
            >
              <Tag color={textMuted} size={40} style={tw`mb-3`} />
              <Text style={[tw`text-base font-bold text-center mb-1`, { color: textPrimary }]}>
                No transactions found
              </Text>
              <Text style={[tw`text-xs text-center mb-5`, { color: textMuted }]}>
                {search || typeFilter !== 'all'
                  ? 'Try clearing your search filters'
                  : 'Add your first income or expense transaction to start tracking'}
              </Text>
              <TouchableOpacity
                style={tw`bg-violet-600 rounded-2xl px-5 py-3 shadow-md`}
                onPress={() => navigation.navigate('AddTransaction')}
              >
                <Text style={tw`text-white font-bold text-xs`}>+ Add Transaction</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dates.map((date) => (
              <View key={date} style={tw`mb-6`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2.5 px-1`, { color: textMuted }]}>
                  {formatDateTime(date)}
                </Text>

                <View
                  style={[
                    tw`border rounded-3xl overflow-hidden shadow-sm`,
                    { backgroundColor: cardBg, borderColor },
                  ]}
                >
                  {groupedTransactions[date].map((tx, idx) => {
                    const isExpanded = expandedTxId === tx.id;
                    return (
                      <View
                        key={tx.id}
                        style={[
                          idx < groupedTransactions[date].length - 1
                            ? { borderBottomWidth: 1, borderColor }
                            : {},
                        ]}
                      >
                        <TouchableOpacity
                          style={tw`flex-row justify-between items-center p-4`}
                          onPress={() => setExpandedTxId(isExpanded ? null : tx.id)}
                        >
                          <View style={tw`flex-1 mr-3`}>
                            <View style={tw`flex-row items-center flex-wrap`}>
                              <Text style={[tw`font-bold text-sm`, { color: textPrimary }]}>
                                {tx.category} → {tx.subcategory}
                              </Text>
                              {tx.status === 'pending' && (
                                <View style={tw`bg-amber-100 dark:bg-amber-950 rounded px-1.5 py-0.5 ml-2 mt-0.5`}>
                                  <Text style={tw`text-amber-800 dark:text-amber-300 text-[10px] font-bold`}>
                                    Pending
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ color: textMuted, fontSize: 11, marginTop: 2 }}>
                              {tx.time ? formatTime(tx.time) : ''} • {tx.payment_method !== 'None' ? tx.payment_method : 'Pending Pay'}
                            </Text>
                            {tx.description ? (
                              <Text style={{ color: textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
                                "{tx.description}"
                              </Text>
                            ) : null}
                          </View>

                          <View style={tw`items-end flex-row items-center gap-2`}>
                            <Text
                              style={[
                                tw`text-base font-black`,
                                { color: tx.type === 'income' ? '#10B981' : '#EF4444' },
                              ]}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                              {formatRupees(tx.type === 'income' ? tx.amount : tx.paid_amount || tx.amount)}
                            </Text>
                            {isExpanded ? (
                              <ChevronUp color={textMuted} size={16} />
                            ) : (
                              <ChevronDown color={textMuted} size={16} />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Expanded Actions Bar */}
                        {isExpanded && (
                          <View
                            style={[
                              tw`px-4 py-3 border-t flex-row justify-end gap-3`,
                              { backgroundColor: isDark ? '#111827' : '#f9fafb', borderColor },
                            ]}
                          >
                            <TouchableOpacity
                              style={tw`flex-row items-center bg-violet-600 px-3.5 py-2 rounded-xl shadow-sm`}
                              onPress={() => navigation.navigate('AddTransaction', { transaction: tx })}
                            >
                              <Edit3 color="#ffffff" size={14} style={tw`mr-1.5`} />
                              <Text style={tw`text-white text-xs font-bold`}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={tw`flex-row items-center bg-rose-600 px-3.5 py-2 rounded-xl shadow-sm`}
                              onPress={() => handleDelete(tx.id)}
                            >
                              <Trash2 color="#ffffff" size={14} style={tw`mr-1.5`} />
                              <Text style={tw`text-white text-xs font-bold`}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
