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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { formatRupees } from '../utils/money';
import { formatDateTime } from '../utils/date';
import { DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';

export default function TransactionsScreen({ route, navigation }: any) {
  const {
    transactions,
    fetchTransactions,
    deleteTransaction,
    isLoading,
  } = useTransactionStore();

  const isDark = useIsDark();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'pending'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Advanced filter collapse
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Selected item ID for expanding details
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

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
      'Delete Entry',
      'Are you sure you want to permanently delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(id);
          },
        },
      ]
    );
  };

  // Apply frontend filtering & searching
  const filteredTransactions = transactions.filter((tx) => {
    if (filterKhataId && tx.khata_id !== filterKhataId) return false;
    if (typeFilter === 'income' && tx.type !== 'income') return false;
    if (typeFilter === 'expense' && (tx.type !== 'expense' || tx.status === 'pending')) return false;
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

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const bg = isDark ? '#111827' : '#f9fafb';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#f3f4f6';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textSecondary = isDark ? '#9ca3af' : '#6b7280';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';
  const inputBg = isDark ? '#374151' : '#f3f4f6';
  const chipInactiveBg = isDark ? '#374151' : '#f3f4f6';
  const chipInactiveBorder = isDark ? '#4b5563' : '#e5e7eb';
  const chipInactiveText = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1f2937' : '#ffffff'}
      />

      {/* Search & Filter Header */}
      <View style={[tw`px-6 py-4 border-b`, { backgroundColor: cardBg, borderColor }]}>
        {/* Search Box */}
        <View style={[tw`rounded-xl px-4 py-2.5 flex-row items-center mb-3`, { backgroundColor: inputBg }]}>
          <TextInput
            style={[tw`flex-1 text-sm`, { color: textPrimary }]}
            placeholder="Search category, description..."
            placeholderTextColor={textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: textMuted, fontWeight: 'bold', fontSize: 12 }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={tw`flex-row justify-between items-center`}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`flex-row gap-1.5 py-1`}
            keyboardShouldPersistTaps="handled"
          >
            {(['all', 'income', 'expense', 'pending'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  tw`rounded-lg px-3.5 py-1.5`,
                  typeFilter === filter
                    ? { backgroundColor: '#4f46e5' }
                    : { backgroundColor: chipInactiveBg, borderWidth: 1, borderColor: chipInactiveBorder },
                ]}
                onPress={() => setTypeFilter(filter)}
              >
                <Text
                  style={[
                    tw`text-xs font-bold capitalize`,
                    { color: typeFilter === filter ? '#ffffff' : chipInactiveText },
                  ]}
                >
                  {filter === 'pending' ? 'Khata' : filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[
              tw`ml-2 border rounded-lg px-2 py-1.5`,
              { backgroundColor: chipInactiveBg, borderColor: chipInactiveBorder },
            ]}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={{ color: chipInactiveText, fontWeight: 'bold', fontSize: 11 }}>
              {showAdvanced ? 'Less ▲' : 'Filters ▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Advanced Filters */}
        {showAdvanced && (
          <View style={[tw`mt-3 pt-3 border-t`, { borderColor }]}>
            <View style={tw`mb-3`}>
              <Text style={[tw`text-[10px] font-bold uppercase tracking-wider mb-1.5`, { color: textMuted }]}>
                Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`flex-row gap-1.5`}
                keyboardShouldPersistTaps="handled"
              >
                {['All', ...DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name), 'Salary', 'Freelance', 'Business'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      tw`border rounded-lg px-2.5 py-1`,
                      selectedCategory === cat
                        ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' }
                        : { borderColor: chipInactiveBorder, backgroundColor: cardBg },
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: selectedCategory === cat ? '#4f46e5' : chipInactiveText,
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text style={[tw`text-[10px] font-bold uppercase tracking-wider mb-1.5`, { color: textMuted }]}>
                Payment Method
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`flex-row gap-1.5`}
                keyboardShouldPersistTaps="handled"
              >
                {['All', 'UPI', 'Cash', 'Debit Card', 'Credit Card'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      tw`border rounded-lg px-3 py-1`,
                      methodFilter === method
                        ? { borderColor: '#4f46e5', backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' }
                        : { borderColor: chipInactiveBorder, backgroundColor: cardBg },
                    ]}
                    onPress={() => setMethodFilter(method)}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: methodFilter === method ? '#4f46e5' : chipInactiveText,
                      }}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      {/* Transactions List */}
      <ScrollView
        contentContainerStyle={tw`p-6 pb-24`}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
        }
      >
        {filterKhataId && (
          <View
            style={[
              tw`border rounded-xl p-3 flex-row justify-between items-center mb-4`,
              { backgroundColor: isDark ? '#1e1b4b' : '#eef2ff', borderColor: isDark ? '#3730a3' : '#c7d2fe' },
            ]}
          >
            <Text style={{ color: isDark ? '#a5b4fc' : '#3730a3', fontSize: 12, fontWeight: '600' }}>
              Locked: Showing provider history
            </Text>
            <TouchableOpacity
              onPress={() => {
                navigation.setParams({ filterKhataId: null });
                fetchTransactions();
              }}
            >
              <Text style={{ color: '#4f46e5', fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }}>
                Clear Lock
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {sortedDates.length === 0 ? (
          <View
            style={[
              tw`border border-dashed rounded-2xl p-8 items-center mt-4`,
              { backgroundColor: cardBg, borderColor: isDark ? '#374151' : '#e5e7eb' },
            ]}
          >
            <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>
              No transactions match filters
            </Text>
            <Text style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>
              Adjust your search or filter chips
            </Text>
          </View>
        ) : (
          sortedDates.map((date) => (
            <View key={date} style={tw`mb-5`}>
              {/* Date Header */}
              <Text
                style={[
                  tw`text-xs font-bold uppercase tracking-wider mb-2.5 px-1`,
                  { color: textMuted },
                ]}
              >
                {formatDateTime(date)}
              </Text>

              {/* Cards in Date Group */}
              <View
                style={[
                  tw`border rounded-2xl overflow-hidden shadow-sm`,
                  { backgroundColor: cardBg, borderColor },
                ]}
              >
                {groupedTransactions[date].map((tx, idx) => {
                  const isExpanded = expandedTxId === tx.id;
                  return (
                    <View key={tx.id}>
                      <TouchableOpacity
                        style={[
                          tw`flex-row justify-between items-center px-4 py-3.5`,
                          idx < groupedTransactions[date].length - 1
                            ? { borderBottomWidth: 1, borderColor }
                            : {},
                        ]}
                        onPress={() => setExpandedTxId(isExpanded ? null : tx.id)}
                      >
                        <View style={tw`flex-1 mr-3`}>
                          <View style={tw`flex-row items-center flex-wrap`}>
                            <Text style={[tw`font-bold text-sm`, { color: textPrimary }]}>
                              {tx.category} → {tx.subcategory}
                            </Text>
                            {tx.status === 'pending' && (
                              <View style={tw`bg-amber-100 rounded px-1.5 py-0.5 ml-2 mt-0.5`}>
                                <Text style={tw`text-amber-800 text-[10px] font-bold`}>Pending</Text>
                              </View>
                            )}
                            {tx.status === 'partially_paid' && (
                              <View style={tw`bg-orange-100 rounded px-1.5 py-0.5 ml-2 mt-0.5`}>
                                <Text style={tw`text-orange-800 text-[10px] font-bold`}>Partial</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ color: textMuted, fontSize: 11, marginTop: 2 }}>
                            {formatDateTime(tx.date, tx.time)} • {tx.payment_method !== 'None' ? tx.payment_method : 'Pending Pay'}
                          </Text>
                          {tx.description ? (
                            <Text style={{ color: textSecondary, fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
                              "{tx.description}"
                            </Text>
                          ) : null}
                        </View>

                        <Text
                          style={[
                            tw`text-base font-extrabold`,
                            { color: tx.type === 'income' ? '#10b981' : textPrimary },
                          ]}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatRupees(tx.type === 'income' ? tx.amount : tx.paid_amount || tx.amount)}
                        </Text>
                      </TouchableOpacity>

                      {/* Expandable Detail Row */}
                      {isExpanded && (
                        <View
                          style={[
                            tw`px-4 py-3 flex-row justify-between items-center border-t border-b`,
                            {
                              backgroundColor: isDark ? '#111827' : '#f9fafb',
                              borderColor,
                            },
                          ]}
                        >
                          <View>
                            <Text style={{ color: textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>
                              Full Amount
                            </Text>
                            <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                              {formatRupees(tx.amount)}
                            </Text>
                          </View>
                          {tx.status !== 'paid' && (
                            <View style={tw`items-end`}>
                              <Text style={{ color: textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>
                                Remaining
                              </Text>
                              <Text style={tw`text-sm font-bold text-amber-500`}>
                                {formatRupees(tx.pending_amount)}
                              </Text>
                            </View>
                          )}

                          <View style={tw`flex-row gap-2`}>
                            <TouchableOpacity
                              style={[
                                tw`border rounded-lg px-3 py-1.5`,
                                { borderColor: '#4f46e5', backgroundColor: isDark ? '#1e1b4b' : '#eef2ff' },
                              ]}
                              onPress={() => {
                                setExpandedTxId(null);
                                navigation.navigate('AddTransaction', { transaction: tx });
                              }}
                            >
                              <Text style={{ color: '#4f46e5', fontSize: 12, fontWeight: 'bold' }}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                tw`border rounded-lg px-3 py-1.5`,
                                { borderColor: '#fca5a5', backgroundColor: isDark ? '#450a0a' : '#fff1f2' },
                              ]}
                              onPress={() => handleDelete(tx.id)}
                            >
                              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Delete</Text>
                            </TouchableOpacity>
                          </View>
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
    </SafeAreaView>
  );
}
