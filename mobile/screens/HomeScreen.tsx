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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { Target, AlertTriangle, ChevronRight, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useTransactionStore } from '../store/transactionStore';
import { useBudgetStore } from '../store/budgetStore';
import { useIsDark } from '../store/themeStore';
import { apiRequest } from '../services/api';
import { formatRupees } from '../utils/money';
import { formatDateTime } from '../utils/date';
import BudgetModal from '../components/BudgetModal';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const {
    transactions,
    fetchTransactions,
    fetchKhataAccounts,
    getTotalIncome,
    getTotalExpenses,
    getCurrentBalance,
  } = useTransactionStore();

  const { monthlyBudget, loadBudget } = useBudgetStore();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();

  const [userName, setUserName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dueRecurring, setDueRecurring] = useState<any[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [todayExpense, setTodayExpense] = useState(0);
  const [weekExpense, setWeekExpense] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  const [totalUdharDiya, setTotalUdharDiya] = useState(0);
  const [totalUdharLiya, setTotalUdharLiya] = useState(0);

  const loadData = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const savedName = await AsyncStorage.getItem('user_name');
    if (savedName) {
      setUserName(savedName);
    } else if (user?.name && user.name !== 'Offline User') {
      setUserName(user.name);
    } else {
      setUserName('Abhay');
    }

    await Promise.all([
      fetchTransactions(),
      fetchKhataAccounts(),
      loadBudget(),
      fetchDueRecurring(todayStr),
    ]);
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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

    // Listen to screen focus to reload name if changed in Profile
    const unsubscribe = navigation.addListener('focus', () => {
      AsyncStorage.getItem('user_name').then((n) => {
        if (n) setUserName(n);
      });
    });
    return unsubscribe;
  }, [navigation]);

  // Compute breakdown stats dynamically from single source of truth
  useEffect(() => {
    let mExpenseSum = 0;
    let diyaSum = 0;
    let liyaSum = 0;
    let todaySum = 0;
    let weekSum = 0;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const firstDayOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        const paid = tx.paid_amount || tx.amount;
        if (tx.date >= firstDayOfMonthStr) {
          mExpenseSum += paid;
        }
        if (tx.date === todayStr) {
          todaySum += paid;
        }
        if (tx.date >= sevenDaysAgoStr) {
          weekSum += paid;
        }
      }

      if (tx.khata_id && tx.status !== 'paid') {
        const kType = tx.khata_type || (tx.type === 'expense' ? 'udhar_diya' : 'udhar_liya');
        if (kType === 'udhar_diya') {
          diyaSum += (tx.pending_amount || 0);
        } else {
          liyaSum += (tx.pending_amount || 0);
        }
      }
    });

    setMonthExpense(mExpenseSum);
    setTotalUdharDiya(diyaSum);
    setTotalUdharLiya(liyaSum);
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

      Alert.alert('Approved', `${instance.category} entry recorded.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to approve entry.');
    } finally {
      setApprovingId(null);
    }
  };

  const getMonthName = () => {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Single Source of Truth Values
  const totalIncome = getTotalIncome();
  const totalExpense = getTotalExpenses();
  const remainingBalance = getCurrentBalance();

  // Budget Calculations
  const budgetPercentage = monthlyBudget > 0 ? Math.min(Math.round((monthExpense / monthlyBudget) * 100), 100) : 0;
  const isBudgetExceeded = monthlyBudget > 0 && monthExpense > monthlyBudget;

  const bg = isDark ? '#0B0B0F' : '#F7F7FA';
  const cardBg = isDark ? '#161622' : '#ffffff';
  const borderColor = isDark ? '#222232' : '#EBEBF2';
  const textPrimary = isDark ? '#F7F7FA' : '#0B0B0F';
  const textMuted = isDark ? '#9494A8' : '#6E6E82';

  const bottomFabPadding = 70 + Math.max(insets.bottom, 10);

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={cardBg}
      />

      {/* Top Welcome Bar */}
      <View
        style={[
          tw`px-6 py-4 flex-row justify-between items-center border-b`,
          { backgroundColor: cardBg, borderColor },
        ]}
      >
        <View>
          <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: textMuted }]}>
            {getTimeGreeting()}
          </Text>
          <Text style={[tw`text-2xl font-extrabold`, { color: textPrimary }]}>
            {userName || 'Abhay'}
          </Text>
          <Text style={[tw`text-xs mt-0.5 font-medium`, { color: textMuted }]}>
            Manage your money with confidence
          </Text>
        </View>

        <TouchableOpacity
          style={[
            tw`border rounded-2xl px-3 py-1.5 shadow-sm`,
            { backgroundColor: isDark ? '#232042' : '#EEEEFC', borderColor: '#6C5CE7' },
          ]}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={tw`text-xs font-bold text-[#6C5CE7]`}>
            {getMonthName()}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={tw`p-6 pb-28`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6C5CE7']} />
        }
      >
        {/* Due Recurring Notifications Banner */}
        {dueRecurring.length > 0 && (
          <TouchableOpacity
            style={tw`bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex-row justify-between items-center shadow-sm mb-6`}
            onPress={() => setShowRecurringModal(true)}
          >
            <View style={tw`flex-1 mr-3`}>
              <Text style={tw`text-indigo-900 dark:text-indigo-200 text-sm font-bold`}>
                {dueRecurring.length} Recurring Entries Due
              </Text>
              <Text style={tw`text-indigo-700 dark:text-indigo-400 text-xs mt-0.5`}>
                Tap to review and approve (Rent, Tiffin, etc.)
              </Text>
            </View>
            <View style={tw`bg-[#6C5CE7] rounded-xl px-3.5 py-2`}>
              <Text style={tw`text-white text-xs font-bold`}>Review</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Main Dashboard Balance Card */}
        <View style={tw`bg-[#6C5CE7] rounded-3xl p-6 shadow-xl mb-6`}>
          <Text style={tw`text-violet-200 text-xs font-semibold uppercase tracking-wider mb-1`}>
            Current Balance
          </Text>
          <Text style={tw`text-white text-3.5xl font-black tracking-tight`}>
            {formatRupees(remainingBalance)}
          </Text>

          <View style={tw`h-px bg-white/20 my-4`} />

          <View style={tw`flex-row justify-between mb-4`}>
            <View style={tw`flex-1`}>
              <Text style={tw`text-violet-200 text-xs font-medium mb-0.5`}>Total Income</Text>
              <Text style={tw`text-white text-lg font-bold`}>{formatRupees(totalIncome)}</Text>
            </View>
            <View style={tw`w-px bg-white/20 mx-4`} />
            <View style={tw`flex-1`}>
              <Text style={tw`text-violet-200 text-xs font-medium mb-0.5`}>Total Expenses</Text>
              <Text style={tw`text-white text-lg font-bold`}>{formatRupees(totalExpense)}</Text>
            </View>
          </View>

          {/* Quick Action Buttons */}
          <View style={tw`flex-row gap-3 mt-1`}>
            <TouchableOpacity
              style={tw`flex-1 bg-emerald-500/25 border border-emerald-300/40 rounded-2xl py-3 items-center flex-row justify-center gap-1.5`}
              onPress={() => navigation.navigate('AddTransaction', { initialType: 'income' })}
            >
              <ArrowDownLeft color="#ffffff" size={16} />
              <Text style={tw`text-white font-bold text-xs`}>+ Quick Income</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`flex-1 bg-rose-500/25 border border-rose-300/40 rounded-2xl py-3 items-center flex-row justify-center gap-1.5`}
              onPress={() => navigation.navigate('AddTransaction', { initialType: 'expense' })}
            >
              <ArrowUpRight color="#ffffff" size={16} />
              <Text style={tw`text-white font-bold text-xs`}>+ Quick Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Budget Summary Card */}
        <TouchableOpacity
          style={[tw`border rounded-2xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}
          onPress={() => setShowBudgetModal(true)}
        >
          <View style={tw`flex-row justify-between items-center mb-3`}>
            <View style={tw`flex-row items-center gap-2`}>
              <Target color="#7c3aed" size={20} />
              <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                Monthly Budget
              </Text>
            </View>
            <ChevronRight color={textMuted} size={18} />
          </View>

          {monthlyBudget > 0 ? (
            <View>
              <View style={tw`flex-row justify-between items-center mb-2`}>
                <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                  {formatRupees(monthExpense)} spent of {formatRupees(monthlyBudget)}
                </Text>
                <Text
                  style={[
                    tw`text-xs font-extrabold`,
                    isBudgetExceeded ? tw`text-rose-600 dark:text-rose-400` : tw`text-violet-600 dark:text-violet-400`,
                  ]}
                >
                  {budgetPercentage}%
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={[tw`w-full h-2.5 rounded-full overflow-hidden`, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                <View
                  style={[
                    tw`h-full rounded-full`,
                    isBudgetExceeded ? tw`bg-rose-500` : tw`bg-violet-600`,
                    { width: `${budgetPercentage}%` },
                  ]}
                />
              </View>

              {isBudgetExceeded && (
                <View style={tw`flex-row items-center gap-1.5 mt-2.5`}>
                  <AlertTriangle color="#ef4444" size={14} />
                  <Text style={tw`text-rose-500 text-xs font-semibold`}>
                    Warning: Monthly budget limit exceeded!
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={tw`flex-row justify-between items-center py-1`}>
              <Text style={[tw`text-xs`, { color: textMuted }]}>
                No budget limit configured for this month.
              </Text>
              <Text style={tw`text-violet-600 dark:text-violet-400 text-xs font-bold`}>
                Manage Budget →
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Khata Ledger Udhar Diya & Udhar Liya Cards */}
        {(totalUdharDiya > 0 || totalUdharLiya > 0) && (
          <View style={tw`flex-row gap-4 mb-6`}>
            <TouchableOpacity
              style={tw`flex-1 bg-emerald-600 dark:bg-emerald-700 rounded-2xl p-4 shadow-sm`}
              onPress={() => navigation.navigate('Khata')}
            >
              <Text style={tw`text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-0.5`}>
                You Will Receive
              </Text>
              <Text style={tw`text-white text-lg font-extrabold`}>{formatRupees(totalUdharDiya)}</Text>
              <Text style={tw`text-emerald-200 text-[10px] mt-0.5`}>Udhar Diya</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`flex-1 bg-amber-600 dark:bg-amber-700 rounded-2xl p-4 shadow-sm`}
              onPress={() => navigation.navigate('Khata')}
            >
              <Text style={tw`text-amber-100 text-[10px] font-bold uppercase tracking-wider mb-0.5`}>
                You Have To Pay
              </Text>
              <Text style={tw`text-white text-lg font-extrabold`}>{formatRupees(totalUdharLiya)}</Text>
              <Text style={tw`text-amber-200 text-[10px] mt-0.5`}>Udhar Liya</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Period Indicators */}
        <View style={tw`flex-row gap-4 mb-6`}>
          <View
            style={[
              tw`flex-1 border rounded-2xl p-4 shadow-sm`,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-1`, { color: textMuted }]}>
              Today
            </Text>
            <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
              {formatRupees(todayExpense)}
            </Text>
          </View>
          <View
            style={[
              tw`flex-1 border rounded-2xl p-4 shadow-sm`,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <Text style={[tw`text-xs font-semibold uppercase tracking-wider mb-1`, { color: textMuted }]}>
              This Week
            </Text>
            <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
              {formatRupees(weekExpense)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <Text style={[tw`text-base font-bold`, { color: textPrimary }]}>
            Recent Transactions
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={tw`text-violet-600 dark:text-violet-400 text-sm font-semibold`}>See All</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View
            style={[
              tw`border border-dashed rounded-2xl p-8 items-center`,
              { backgroundColor: cardBg, borderColor: isDark ? '#374151' : '#e5e7eb' },
            ]}
          >
            <Text style={[tw`text-sm font-semibold`, { color: textMuted }]}>
              No transactions recorded yet
            </Text>
            <Text style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>
              Tap the "+" button below to add your first transaction
            </Text>
          </View>
        ) : (
          <View
            style={[
              tw`border rounded-2xl overflow-hidden shadow-sm`,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            {transactions.slice(0, 5).map((tx, idx) => (
              <TouchableOpacity
                key={tx.id}
                style={[
                  tw`flex-row justify-between items-center px-4 py-3.5`,
                  idx < Math.min(transactions.length, 5) - 1
                    ? { borderBottomWidth: 1, borderColor }
                    : {},
                ]}
                onPress={() => navigation.navigate('AddTransaction', { transaction: tx })}
              >
                <View style={tw`flex-1 mr-3`}>
                  <View style={tw`flex-row items-center flex-wrap`}>
                    <Text style={[tw`font-bold text-sm`, { color: textPrimary }]}>
                      {tx.category} → {tx.subcategory}
                    </Text>
                    {tx.status === 'pending' && (
                      <View style={tw`bg-amber-100 dark:bg-amber-950 rounded px-1.5 py-0.5 ml-2 mt-0.5`}>
                        <Text style={tw`text-amber-800 dark:text-amber-300 text-[10px] font-bold`}>Pending</Text>
                      </View>
                    )}
                    {tx.status === 'partially_paid' && (
                      <View style={tw`bg-orange-100 dark:bg-orange-950 rounded px-1.5 py-0.5 ml-2 mt-0.5`}>
                        <Text style={tw`text-orange-800 dark:text-orange-300 text-[10px] font-bold`}>Partial</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: textMuted, fontSize: 11, marginTop: 2 }}>
                    {formatDateTime(tx.date, tx.time)} • {tx.payment_method !== 'None' ? tx.payment_method : 'Pending Pay'}
                  </Text>
                  {tx.description ? (
                    <Text style={{ color: textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
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
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[
          tw`absolute right-6 w-14 h-14 bg-violet-600 rounded-full items-center justify-center shadow-lg border border-violet-500`,
          { bottom: bottomFabPadding },
        ]}
        onPress={() => navigation.navigate('AddTransaction')}
        activeOpacity={0.8}
      >
        <Plus color="#ffffff" size={28} />
      </TouchableOpacity>

      {/* BUDGET MODAL */}
      <BudgetModal visible={showBudgetModal} onClose={() => setShowBudgetModal(false)} />

      {/* DUE RECURRING MODAL */}
      {showRecurringModal && (
        <Modal
          visible={showRecurringModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRecurringModal(false)}
        >
          <View style={tw`flex-1 justify-end bg-black/50`}>
            <View style={[tw`rounded-t-3xl p-6 max-h-[80%]`, { backgroundColor: cardBg }]}>
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>
                  Approve Recurring Entries
                </Text>
                <TouchableOpacity onPress={() => setShowRecurringModal(false)}>
                  <Text style={{ color: textMuted, fontWeight: 'bold', fontSize: 14 }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: textMuted, fontSize: 11, marginBottom: 16 }}>
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
                        { backgroundColor: isDark ? '#111827' : '#f9fafb', borderColor },
                      ]}
                    >
                      <View style={tw`flex-1 mr-3`}>
                        <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                          {item.category} → {item.subcategory}
                        </Text>
                        <Text style={{ color: textMuted, fontSize: 11, marginTop: 2 }}>
                          Due: {formatDateTime(item.date)}
                        </Text>
                        {item.description ? (
                          <Text style={{ color: textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>
                            "{item.description}"
                          </Text>
                        ) : null}
                      </View>

                      <View style={tw`items-end`}>
                        <Text style={[tw`text-sm font-black mb-2`, { color: textPrimary }]}>
                          {formatRupees(item.amount)}
                        </Text>
                        <TouchableOpacity
                          style={tw`bg-violet-600 rounded-lg px-3 py-1.5 shadow-sm`}
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
