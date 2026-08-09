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
import { apiRequest } from '../services/api';
import { formatRupees } from '../utils/money';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const {
    transactions,
    fetchTransactions,
    khataAccounts,
    fetchKhataAccounts,
    isLoading,
  } = useTransactionStore();

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
      
      // Update list
      setDueRecurring((prev) => 
        prev.filter((item) => !(item.recurring_id === instance.recurring_id && item.date === instance.date))
      );
      
      // Refresh transactions and balances
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
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
      
      {/* Top Welcome Bar */}
      <View style={tw`px-6 py-4 flex-row justify-between items-center bg-white border-b border-gray-100`}>
        <View>
          <Text style={tw`text-xs font-semibold text-gray-400 uppercase tracking-wider`}>
            {getGreeting()}
          </Text>
          <Text style={tw`text-xl font-bold text-gray-800`}>
            Namaste, {user?.name.split(' ')[0]}
          </Text>
        </View>
        
        {/* Banner with Active Period */}
        <View style={tw`bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5`}>
          <Text style={tw`text-xs font-bold text-indigo-700`}>{getMonthName()}</Text>
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

        {/* Main Dashboard Balance Cards */}
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
          <View style={tw`flex-1 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm`}>
            <Text style={tw`text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1`}>
              Today
            </Text>
            <Text style={tw`text-gray-800 text-lg font-bold`}>
              {formatRupees(todayExpense)}
            </Text>
          </View>
          <View style={tw`flex-1 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm`}>
            <Text style={tw`text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1`}>
              This Week
            </Text>
            <Text style={tw`text-gray-800 text-lg font-bold`}>
              {formatRupees(weekExpense)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions List Header */}
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <Text style={tw`text-base font-bold text-gray-800`}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={tw`text-indigo-600 text-sm font-semibold`}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions Items */}
        {transactions.length === 0 ? (
          <View style={tw`bg-white border border-gray-100 rounded-2xl p-8 items-center border-dashed`}>
            <Text style={tw`text-gray-400 text-sm font-semibold`}>No transactions recorded yet</Text>
            <Text style={tw`text-gray-400 text-xs mt-1`}>Tap the "+" button below to get started</Text>
          </View>
        ) : (
          <View style={tw`bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm`}>
            {transactions.slice(0, 5).map((tx, idx) => (
              <View 
                key={tx.id} 
                style={tw`flex-row justify-between items-center px-4 py-3.5 ${
                  idx < 4 ? 'border-b border-gray-100' : ''
                }`}
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
                    {tx.date} • {tx.payment_method !== 'None' ? tx.payment_method : 'Pending Pay'}
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
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button (FAB) for Add Entry */}
      <TouchableOpacity
        style={tw`absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full items-center justify-center shadow-lg border border-indigo-500`}
        onPress={() => navigation.navigate('AddTransaction')}
      >
        <Text style={tw`text-white text-3xl font-semibold`}>+</Text>
      </TouchableOpacity>

      {/* DUE RECURRING MODAL REVIEW PANEL */}
      {showRecurringModal && (
        <Modal
          visible={showRecurringModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRecurringModal(false)}
        >
          <View style={tw`flex-1 justify-end bg-black/50`}>
            <View style={tw`bg-white rounded-t-3xl p-6 max-h-[80%]`}>
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={tw`text-lg font-bold text-gray-800`}>
                  Approve Recurring Entries
                </Text>
                <TouchableOpacity onPress={() => setShowRecurringModal(false)}>
                  <Text style={tw`text-gray-500 font-bold text-sm`}>Close</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={tw`text-xs text-gray-400 mb-4`}>
                Review and click approve to record these transactions in your ledger.
              </Text>

              <ScrollView style={tw`mb-4`}>
                {dueRecurring.map((item, idx) => {
                  const key = item.recurring_id + '-' + item.date;
                  const isApproving = approvingId === key;
                  return (
                    <View 
                      key={key} 
                      style={tw`border border-gray-150 rounded-2xl p-4 mb-3 bg-gray-50 flex-row justify-between items-center`}
                    >
                      <View style={tw`flex-1 mr-3`}>
                        <Text style={tw`text-sm font-bold text-gray-800`}>
                          {item.category} → {item.subcategory}
                        </Text>
                        <Text style={tw`text-xs text-gray-400 mt-1`}>
                          Due Date: {item.date}
                        </Text>
                        {item.description ? (
                          <Text style={tw`text-xs text-gray-500 italic mt-0.5`}>"{item.description}"</Text>
                        ) : null}
                      </View>
                      
                      <View style={tw`items-end`}>
                        <Text style={tw`text-sm font-black text-gray-800 mb-2`}>
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
