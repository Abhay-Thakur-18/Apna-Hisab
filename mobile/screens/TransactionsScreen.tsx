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
import { formatRupees } from '../utils/money';
import { DEFAULT_EXPENSE_CATEGORIES } from '../utils/categories';

export default function TransactionsScreen({ route, navigation }: any) {
  const {
    transactions,
    fetchTransactions,
    deleteTransaction,
    isLoading,
  } = useTransactionStore();

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

  // 1. Apply frontend filtering & searching
  const filteredTransactions = transactions.filter((tx) => {
    // A. Khata Account isolation filter (if locked from route)
    if (filterKhataId && tx.khata_id !== filterKhataId) {
      return false;
    }

    // B. Type filter
    if (typeFilter === 'income' && tx.type !== 'income') return false;
    if (typeFilter === 'expense' && (tx.type !== 'expense' || tx.status === 'pending')) return false;
    if (typeFilter === 'pending' && tx.status !== 'pending') return false;

    // C. Payment method filter
    if (methodFilter !== 'All' && tx.payment_method !== methodFilter) return false;

    // D. Category filter
    if (selectedCategory !== 'All' && tx.category !== selectedCategory) return false;

    // E. Text search
    if (search.trim() !== '') {
      const query = search.toLowerCase();
      const matchCat = tx.category.toLowerCase().includes(query);
      const matchSub = tx.subcategory.toLowerCase().includes(query);
      const matchDesc = tx.description ? tx.description.toLowerCase().includes(query) : false;
      if (!matchCat && !matchSub && !matchDesc) return false;
    }

    return true;
  });

  // 2. Group transactions by date for clean ledger visualization
  const groupedTransactions: { [key: string]: typeof transactions } = {};
  filteredTransactions.forEach((tx) => {
    if (!groupedTransactions[tx.date]) {
      groupedTransactions[tx.date] = [];
    }
    groupedTransactions[tx.date].push(tx);
  });

  // Sorted dates descending
  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Search Header */}
      <View style={tw`bg-white px-6 py-4 border-b border-gray-150`}>
        <View style={tw`bg-gray-100 rounded-xl px-4 py-2 flex-row items-center mb-3`}>
          <TextInput
            style={tw`flex-1 text-sm text-gray-800`}
            placeholder="Search details, category, subcategory..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={tw`text-xs text-gray-400 font-bold px-1`}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips row */}
        <View style={tw`flex-row justify-between items-center`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1.5 py-1`}>
            {(['all', 'income', 'expense', 'pending'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={tw`rounded-lg px-3.5 py-1.5 ${
                  typeFilter === filter
                    ? 'bg-indigo-600'
                    : 'bg-gray-100 border border-gray-200'
                }`}
                onPress={() => setTypeFilter(filter)}
              >
                <Text
                  style={tw`text-xs font-bold capitalize ${
                    typeFilter === filter ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {filter === 'pending' ? 'Khata (Pending)' : filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={tw`ml-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50`}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={tw`text-xs font-bold text-gray-600`}>Filters</Text>
          </TouchableOpacity>
        </View>

        {/* Advanced Filters dropdown panel */}
        {showAdvanced && (
          <View style={tw`mt-4 pt-3 border-t border-gray-100`}>
            {/* Category Filter */}
            <View style={tw`mb-3`}>
              <Text style={tw`text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5`}>
                Category Filter
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1.5`}>
                {['All', ...DEFAULT_EXPENSE_CATEGORIES.map(c => c.name), 'Salary', 'Freelance', 'Business'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={tw`border rounded-lg px-2.5 py-1 ${
                      selectedCategory === cat ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'
                    }`}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={tw`text-[10px] font-bold ${
                      selectedCategory === cat ? 'text-indigo-600' : 'text-gray-600'
                    }`}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Payment Method Filter */}
            <View style={tw`mb-1`}>
              <Text style={tw`text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5`}>
                Payment Method
              </Text>
              <View style={tw`flex-row gap-1.5`}>
                {['All', 'UPI', 'Cash', 'Debit Card', 'Credit Card'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={tw`border rounded-lg px-3 py-1 bg-white ${
                      methodFilter === method ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                    }`}
                    onPress={() => setMethodFilter(method)}
                  >
                    <Text style={tw`text-[10px] font-bold ${
                      methodFilter === method ? 'text-indigo-600' : 'text-gray-600'
                    }`}>
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Transactions List */}
      <ScrollView
        contentContainerStyle={tw`p-6 pb-24`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
        }
      >
        {filterKhataId && (
          <View style={tw`bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex-row justify-between items-center mb-4`}>
            <Text style={tw`text-xs font-semibold text-indigo-800`}>
              Locked: Showing provider history
            </Text>
            <TouchableOpacity 
              onPress={() => {
                navigation.setParams({ filterKhataId: null });
                fetchTransactions();
              }}
            >
              <Text style={tw`text-xs font-bold text-indigo-700 underline`}>Clear Lock</Text>
            </TouchableOpacity>
          </View>
        )}

        {sortedDates.length === 0 ? (
          <View style={tw`bg-white border border-gray-100 rounded-2xl p-8 items-center border-dashed mt-4`}>
            <Text style={tw`text-gray-400 text-sm font-semibold`}>No transactions match filters</Text>
            <Text style={tw`text-gray-400 text-xs mt-1`}>Adjust your search query or chips to view history</Text>
          </View>
        ) : (
          sortedDates.map((date) => (
            <View key={date} style={tw`mb-5`}>
              {/* Date Header */}
              <Text style={tw`text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1`}>
                {date}
              </Text>

              {/* Transactions in Date Group */}
              <View style={tw`bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm`}>
                {groupedTransactions[date].map((tx, idx) => {
                  const isExpanded = expandedTxId === tx.id;
                  return (
                    <View key={tx.id}>
                      <TouchableOpacity
                        style={tw`flex-row justify-between items-center px-4 py-3.5 ${
                          idx < groupedTransactions[date].length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                        onPress={() => setExpandedTxId(isExpanded ? null : tx.id)}
                      >
                        <View style={tw`flex-1 mr-3`}>
                          <View style={tw`flex-row items-center`}>
                            <Text style={tw`font-bold text-gray-800 text-sm`}>
                              {tx.category} → {tx.subcategory}
                            </Text>
                            {tx.status === 'pending' && (
                              <View style={tw`bg-amber-100 rounded px-1.5 py-0.5 ml-2`}>
                                <Text style={tw`text-amber-800 text-[10px] font-bold`}>Pending</Text>
                              </View>
                            )}
                            {tx.status === 'partially_paid' && (
                              <View style={tw`bg-orange-100 rounded px-1.5 py-0.5 ml-2`}>
                                <Text style={tw`text-orange-800 text-[10px] font-bold`}>Partial</Text>
                              </View>
                            )}
                          </View>
                          <Text style={tw`text-xs text-gray-400 mt-1`}>
                            {tx.time} • {tx.payment_method !== 'None' ? tx.payment_method : 'Pending Pay'}
                          </Text>
                          {tx.description ? (
                            <Text style={tw`text-xs text-gray-500 italic mt-0.5`}>"{tx.description}"</Text>
                          ) : null}
                        </View>
                        
                        <Text 
                          style={tw`text-base font-extrabold ${
                            tx.type === 'income' ? 'text-emerald-600' : 'text-gray-800'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}{formatRupees(tx.type === 'income' ? tx.amount : tx.paid_amount || tx.amount)}
                        </Text>
                      </TouchableOpacity>

                      {/* Expandable details panel with Delete option */}
                      {isExpanded && (
                        <View style={tw`bg-gray-50 px-4 py-3 flex-row justify-between items-center border-t border-b border-gray-100`}>
                          <View>
                            <Text style={tw`text-[10px] text-gray-400 font-semibold uppercase`}>Full Amount</Text>
                            <Text style={tw`text-sm font-bold text-gray-700`}>{formatRupees(tx.amount)}</Text>
                          </View>
                          {tx.status !== 'paid' && (
                            <View style={tw`items-end`}>
                              <Text style={tw`text-[10px] text-gray-400 font-semibold uppercase`}>Remaining</Text>
                              <Text style={tw`text-sm font-bold text-amber-600`}>{formatRupees(tx.pending_amount)}</Text>
                            </View>
                          )}
                          <TouchableOpacity 
                            style={tw`bg-red-50 border border-red-200 rounded-lg px-3 py-1.5`}
                            onPress={() => handleDelete(tx.id)}
                          >
                            <Text style={tw`text-red-600 text-xs font-bold`}>Delete</Text>
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
    </SafeAreaView>
  );
}
