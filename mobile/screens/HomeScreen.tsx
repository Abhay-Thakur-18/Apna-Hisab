import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useAuthStore } from '../store/authStore';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { apiRequest } from '../services/api';
import { formatRupees } from '../utils/money';
import { formatDateTime } from '../utils/date';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const {
    transactions,
    fetchTransactions,
    khataAccounts,
    fetchKhataAccounts,
    isLoading,
  } = useTransactionStore();

  const isDark = useIsDark();

  const [refreshing, setRefreshing] = useState(false);
  const [dueRecurring, setDueRecurring] = useState<any[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Summary Stats
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  const [todayExpense, setTodayExpense] = useState(0);
  const [weekExpense, setWeekExpense] = useState(0);

  const loadData = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    await Promise.all([
      fetchTransactions(),
      fetchKhataAccounts(),
      fetchDueRecurring(todayStr),
    ]);
  };

  const fetchDueRecurring = async (todayStr: string) => {
    try {
      const data = await apiRequest(`/api/recurring/due?client_today=${todayStr}`);
      setDueRecurring(data);
    } catch (e) {
      console.log('Error fetching due recurring:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stats dynamically
  useEffect(() => {
    let incomeSum = 0;
    let expenseSum = 0;
    let pendingSum = 0;
    let todaySum = 0;
    let weekSum = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        incomeSum += tx.amount;
      } else {
        expenseSum += tx.paid_amount;
        pendingSum += tx.pending_amount;

        if (tx.date === todayStr) {
          todaySum += tx.paid_amount;
        }
        if (tx.date >= sevenDaysAgoStr) {
          weekSum += tx.paid_amount;
        }
      }
    });

    setTotalIncome(incomeSum);
    setTotalExpense(expenseSum);
    setTotalPending(pendingSum);
    setTodayExpense(todaySum);
    setWeekExpense(weekSum);
  }, [transactions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApproveRecurring = async (instance: any) => {
    setApprovingId(instance.recurring_id + '-' + instance.date);
    try {
      await apiRequest('/api/recurring/approve', {
        method: 'POST',
        body: JSON.stringify(instance),
      });

      setDueRecurring((prev) =>
        prev.filter(
          (item) =>
            !(item.recurring_id === instance.recurring_id && item.date === instance.date)
        )
      );

      await fetchTransactions();
      await fetchKhataAccounts();

      Alert.alert('Approved', `${instance.category} entry generated.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to approve entry.');
    } finally {
      setApprovingId(null);
    }
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good Morning';
    if (hrs < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getMonthName = () => {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const remainingBalance = totalIncome - totalExpense;

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#111827' : '#f3f4f6'}
      />

      {/* Top Welcome Bar */}
      <View
        style={[
          tw`px-6 py-4 flex-row justify-between items-center border-b`,
          { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f3f4f6' },
        ]}
      >
        <View>
          <Text style={[tw`text-xs font-semibold uppercase tracking-wider`, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
            {getGreeting()}
          </Text>
          <Text style={[tw`text-xl font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
            Namaste, {user?.name?.split(' ')[0] || 'Friend'}
          </Text>
        </View>

        <View
          style={[
            tw`border rounded-xl px-3 py-1.5`,
            { backgroundColor: isDark ? '#312e81' : '#eef2ff', borderColor: isDark ? '#4338ca' : '#c7d2fe' },
          ]}
        >
          <Text style={[tw`text-xs font-bold`, { color: isDark ? '#a5b4fc' : '#4338ca' }]}>
            {getMonthName()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={tw`p-6 pb-24`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
        }
      >
        {/* Due Recurring Notifications Banner */}
        {dueRecurring.length > 0 && (
          <TouchableOpacity
            style={tw`bg-indigo-100 border border-indigo-200 rounded-2xl p-4 flex-row justify-between items-center shadow-sm mb-6`}
            onPress={() => setShowRecurringModal(true)}
          >
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-indigo-900 text-sm font-bold`}>
                {dueRecurring.length} Recurring Entries Due
              </Text>
              <Text style={tw`text-indigo-700 text-xs mt-0.5`}>
                Tap to review and approve (Tiffin, Rent, etc.)
              </Text>
            </View>
            <View style={tw`bg-indigo-600 rounded-xl px-3.5 py-2`}>
              <Text style={tw`text-white text-xs font-bold`}>Review</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Main Dashboard Balance Card */}
        <View style={tw`bg-indigo-600 rounded-3xl p-6 shadow-md mb-6`}>
          <Text style={tw`text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1`}>
            Remaining Balance
          </Text>
          <Text style={tw`text-white text-3xl font-bold`}>
            {formatRupees(remainingBalance)}
          </Text>

          <View style={tw`h-px bg-indigo-500 my-4`} />

          <View style={tw`flex-row justify-between`}>
            <View style={tw`flex-1`}>
              <Text style={tw`text-indigo-200 text-xs font-medium mb-0.5`}>Income</Text>
              <Text style={tw`text-white text-lg font-bold`}>{formatRupees(totalIncome)}</Text>
            </View>
            <View style={tw`w-px bg-indigo-500 mx-4`} />
            <View style={tw`flex-1`}>
              <Text style={tw`text-indigo-200 text-xs font-medium mb-0.5`}>Expense</Text>
              <Text style={tw`text-white text-lg font-bold`}>{formatRupees(totalExpense)}</Text>
            </View>
          </View>
        </View>

        {/* Khata Ledger Summary Card */}
        {totalPending > 0 && (
          <TouchableOpacity
            style={tw`bg-amber-500 rounded-2xl p-4 flex-row justify-between items-center shadow-sm mb-6`}
            onPress={() => navigation.navigate('Khata')}
          >
            <View>
              <Text style={tw`text-white text-xs font-semibold uppercase tracking-wider mb-0.5`}>
                Outstanding Pending (Khata)
              </Text>
              <Text style={tw`text-white text-xl font-bold`}>{formatRupees(totalPending)}</Text>
            </View>
            <View style={tw`bg-white/20 rounded-lg px-3 py-1.5`}>
              <Text style={tw`text-white text-xs font-bold`}>Pay Now</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Period Indicators */}
        <View style={tw`flex-row gap-4 mb-6`}>
          <View
            style={[
              tw`flex-1 border rounded-2xl p-4 shadow-sm`,
              { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f3f4f6' },
            ]}
          >
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-1`, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
              Today
            </Text>
            <Text style={[tw`text-lg font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
              {formatRupees(todayExpense)}
            </Text>
          </View>
          <View
            style={[
              tw`flex-1 border rounded-2xl p-4 shadow-sm`,
              { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f3f4f6' },
            ]}
          >
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-1`, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
              This Week
            </Text>
            <Text style={[tw`text-lg font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
              {formatRupees(weekExpense)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <Text style={[tw`text-base font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
            Recent Transactions
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={tw`text-indigo-500 text-sm font-semibold`}>See All</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View
            style={[
              tw`border border-dashed rounded-2xl p-8 items-center`,
              { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' },
            ]}
          >
            <Text style={[tw`text-sm font-semibold`, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
              No transactions recorded yet
            </Text>
            <Text style={{ color: isDark ? '#4b5563' : '#9ca3af', fontSize: 12, marginTop: 4 }}>
              Tap the "+" button below to get started
            </Text>
          </View>
        ) : (
          <View
            style={[
              tw`border rounded-2xl overflow-hidden shadow-sm`,
              { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#f3f4f6' },
            ]}
          >
            {transactions.slice(0, 5).map((tx, idx) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  tw`flex-row justify-between items-center px-4 py-3.5`,
                  idx < Math.min(transactions.length, 5) - 1
                    ? { borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#f3f4f6' }
                    : {},
                ]}
                onPress={() => navigation.navigate('AddTransaction', { transaction: tx })}
              >
                <View style={tw`flex-1 mr-3`}>
                  <View style={tw`flex-row items-center`}>
                    <Text style={[tw`font-bold text-sm`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
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
                  <Text style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: 11, marginTop: 2 }}>
                    {formatDateTime(tx.date, tx.time)} • {tx.payment_method !== 'None' ? tx.payment_method : 'Pending Pay'}
                  </Text>
                  {tx.description ? (
                    <Text style={{ color: isDark ? '#6b7280' : '#6b7280', fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
                      "{tx.description}"
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={[
                    tw`text-base font-extrabold`,
                    { color: tx.type === 'income' ? '#10b981' : (isDark ? '#f9fafb' : '#1f2937') },
                  ]}
                >
                  {tx.type === 'income' ? '+' : '-'}
                  {formatRupees(tx.type === 'income' ? tx.amount : tx.paid_amount || tx.amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={tw`absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full items-center justify-center shadow-lg border border-indigo-500`}
        onPress={() => navigation.navigate('AddTransaction')}
      >
        <Text style={tw`text-white text-3xl font-semibold`}>+</Text>
      </TouchableOpacity>

      {/* DUE RECURRING MODAL */}
      {showRecurringModal && (
        <Modal
          visible={showRecurringModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRecurringModal(false)}
        >
          <View style={tw`flex-1 justify-end bg-black/50`}>
            <View
              style={[
                tw`rounded-t-3xl p-6 max-h-[80%]`,
                { backgroundColor: isDark ? '#1f2937' : '#ffffff' },
              ]}
            >
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={[tw`text-lg font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
                  Approve Recurring Entries
                </Text>
                <TouchableOpacity onPress={() => setShowRecurringModal(false)}>
                  <Text style={{ color: isDark ? '#9ca3af' : '#6b7280', fontWeight: 'bold', fontSize: 14 }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: 11, marginBottom: 16 }}>
                Review and click approve to record these transactions in your ledger.
              </Text>

              <ScrollView style={tw`mb-4`}>
                {dueRecurring.map((item) => {
                  const key = item.recurring_id + '-' + item.date;
                  const isApproving = approvingId === key;
                  return (
                    <View
                      key={key}
                      style={[
                        tw`border rounded-2xl p-4 mb-3 flex-row justify-between items-center`,
                        { backgroundColor: isDark ? '#111827' : '#f9fafb', borderColor: isDark ? '#374151' : '#e5e7eb' },
                      ]}
                    >
                      <View style={tw`flex-1 mr-3`}>
                        <Text style={[tw`text-sm font-bold`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
                          {item.category} → {item.subcategory}
                        </Text>
                        <Text style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: 11, marginTop: 2 }}>
                          Due: {formatDateTime(item.date)}
                        </Text>
                        {item.description ? (
                          <Text style={{ color: isDark ? '#6b7280' : '#6b7280', fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
                            "{item.description}"
                          </Text>
                        ) : null}
                      </View>

                      <View style={tw`items-end`}>
                        <Text style={[tw`text-sm font-black mb-2`, { color: isDark ? '#f9fafb' : '#1f2937' }]}>
                          {formatRupees(item.amount)}
                        </Text>
                        <TouchableOpacity
                          style={tw`bg-indigo-600 rounded-lg px-3 py-1.5 shadow-sm`}
                          onPress={() => handleApproveRecurring(item)}
                          disabled={isApproving}
                        >
                          {isApproving ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                          ) : (
                            <Text style={tw`text-white text-xs font-bold`}>Approve</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
