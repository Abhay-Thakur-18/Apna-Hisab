import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { formatRupees } from '../utils/money';
import { formatDateTime } from '../utils/date';

export default function ReportsScreen() {
  const { transactions } = useTransactionStore();
  const isDark = useIsDark();

  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | '6months' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Theme tokens
  const bg = isDark ? '#111827' : '#f9fafb';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#f3f4f6';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';

  // --------------- Compute report directly from local store (offline-first) ---------------
  const getDateRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let fromStr = todayStr;

    if (period === 'today') {
      fromStr = todayStr;
    } else if (period === 'weekly') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      fromStr = d.toISOString().split('T')[0];
    } else if (period === 'monthly') {
      const d = new Date(today);
      d.setDate(1);
      fromStr = d.toISOString().split('T')[0];
    } else if (period === '6months') {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      fromStr = d.toISOString().split('T')[0];
    } else if (period === 'yearly') {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      fromStr = d.toISOString().split('T')[0];
    }

    return { fromStr, toStr: todayStr };
  };

  const { fromStr, toStr } = getDateRange();

  const periodTxs = transactions.filter(
    (tx) => tx.date >= fromStr && tx.date <= toStr
  );

  let totalIncome = 0;
  let totalExpense = 0;
  let totalPending = 0;

  periodTxs.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.paid_amount;
      totalPending += tx.pending_amount;
    }
  });

  const netSavings = totalIncome - totalExpense;

  // Category breakdown
  const catMap: { [cat: string]: number } = {};
  periodTxs.filter((tx) => tx.type === 'expense' && tx.paid_amount > 0).forEach((tx) => {
    catMap[tx.category] = (catMap[tx.category] || 0) + tx.paid_amount;
  });
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Payment method breakdown
  const methodMap: { [m: string]: number } = {};
  periodTxs.filter((tx) => tx.type === 'expense' && tx.paid_amount > 0 && tx.payment_method !== 'None').forEach((tx) => {
    methodMap[tx.payment_method] = (methodMap[tx.payment_method] || 0) + tx.paid_amount;
  });
  const paymentBreakdown = Object.entries(methodMap)
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Largest expenses
  const largestExpenses = [...periodTxs]
    .filter((tx) => tx.type === 'expense' && tx.paid_amount > 0)
    .sort((a, b) => b.paid_amount - a.paid_amount)
    .slice(0, 8);

  const getPercentage = (amount: number, total: number) => {
    if (total <= 0) return 0;
    return Math.round((amount / total) * 100);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const periodLabels: { [k: string]: string } = {
    today: 'Today',
    weekly: 'Week',
    monthly: 'Month',
    '6months': '6 Months',
    yearly: 'Year',
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#1f2937' : '#ffffff'}
      />

      {/* Period Segment Selector */}
      <View style={[tw`px-6 py-3 border-b flex-row gap-2`, { backgroundColor: cardBg, borderColor }]}>
        {(['today', 'weekly', 'monthly', '6months', 'yearly'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              tw`flex-1 py-2 rounded-xl items-center`,
              period === p
                ? { backgroundColor: '#4f46e5' }
                : { backgroundColor: isDark ? '#374151' : '#f3f4f6', borderWidth: 1, borderColor },
            ]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[
                tw`text-[10px] font-bold`,
                { color: period === p ? '#ffffff' : textMuted },
              ]}
            >
              {periodLabels[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={tw`p-6 pb-24`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
        }
      >
        {/* Summary Cards */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`font-bold text-sm mb-4`, { color: textPrimary }]}>
            Period Summary — {periodLabels[period]}
          </Text>

          <View style={tw`flex-row flex-wrap gap-4`}>
            {/* Income */}
            <View style={tw`flex-1 min-w-[45%] bg-emerald-50 rounded-2xl p-4 border border-emerald-100`}>
              <Text style={tw`text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                Total Income
              </Text>
              <Text style={tw`text-emerald-800 text-lg font-bold`}>
                {formatRupees(totalIncome)}
              </Text>
            </View>

            {/* Expense */}
            <View style={tw`flex-1 min-w-[45%] bg-red-50 rounded-2xl p-4 border border-red-100`}>
              <Text style={tw`text-red-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                Total Spent
              </Text>
              <Text style={tw`text-red-800 text-lg font-bold`}>
                {formatRupees(totalExpense)}
              </Text>
            </View>

            {/* Pending */}
            <View style={tw`flex-1 min-w-[45%] bg-amber-50 rounded-2xl p-4 border border-amber-100`}>
              <Text style={tw`text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                Pending Khata
              </Text>
              <Text style={tw`text-amber-800 text-lg font-bold`}>
                {formatRupees(totalPending)}
              </Text>
            </View>

            {/* Net Savings */}
            <View style={tw`flex-1 min-w-[45%] bg-indigo-50 rounded-2xl p-4 border border-indigo-100`}>
              <Text style={tw`text-indigo-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                Net Savings
              </Text>
              <Text style={tw`text-indigo-800 text-lg font-bold`}>
                {formatRupees(netSavings)}
              </Text>
            </View>
          </View>
        </View>

        {/* Category-wise Spending */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`font-bold text-sm mb-4`, { color: textPrimary }]}>
            Category-wise Expenses
          </Text>

          {categoryBreakdown.length === 0 ? (
            <Text style={[tw`text-xs italic text-center py-4`, { color: textMuted }]}>
              No expenses recorded in this period.
            </Text>
          ) : (
            categoryBreakdown.map((item) => {
              const pct = getPercentage(item.amount, totalExpense);
              return (
                <View key={item.category} style={tw`mb-4`}>
                  <View style={tw`flex-row justify-between items-center mb-1.5`}>
                    <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>
                      {item.category}
                    </Text>
                    <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                      {formatRupees(item.amount)} ({pct}%)
                    </Text>
                  </View>
                  {/* Progress Bar — use inline style for dynamic width (twrnc limitation) */}
                  <View style={[tw`w-full h-2 rounded-full overflow-hidden`, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <View
                      style={[tw`h-full bg-indigo-600 rounded-full`, { width: `${pct}%` }]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Payment Method Breakdown */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`font-bold text-sm mb-4`, { color: textPrimary }]}>
            Payment Method Breakdown
          </Text>

          {paymentBreakdown.length === 0 ? (
            <Text style={[tw`text-xs italic text-center py-4`, { color: textMuted }]}>
              No transactions recorded in this period.
            </Text>
          ) : (
            paymentBreakdown.map((item) => {
              const pct = getPercentage(item.amount, totalExpense);
              return (
                <View key={item.method} style={tw`mb-4`}>
                  <View style={tw`flex-row justify-between items-center mb-1.5`}>
                    <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>
                      {item.method}
                    </Text>
                    <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                      {formatRupees(item.amount)} ({pct}%)
                    </Text>
                  </View>
                  <View style={[tw`w-full h-2 rounded-full overflow-hidden`, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <View
                      style={[tw`h-full bg-emerald-600 rounded-full`, { width: `${pct}%` }]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Largest Expenses */}
        <View style={[tw`border rounded-3xl p-5 shadow-sm`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`font-bold text-sm mb-4`, { color: textPrimary }]}>
            Largest Expenses
          </Text>

          {largestExpenses.length === 0 ? (
            <Text style={[tw`text-xs italic text-center py-4`, { color: textMuted }]}>
              No expenses recorded in this period.
            </Text>
          ) : (
            largestExpenses.map((tx, idx) => (
              <View
                key={tx.id}
                style={[
                  tw`flex-row justify-between items-center py-3.5`,
                  idx < largestExpenses.length - 1
                    ? { borderBottomWidth: 1, borderColor }
                    : {},
                ]}
              >
                <View style={tw`flex-1 mr-3`}>
                  <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
                    {tx.category} → {tx.subcategory}
                  </Text>
                  <Text style={[tw`text-xs mt-1`, { color: textMuted }]}>
                    {formatDateTime(tx.date, tx.time)}
                  </Text>
                  {tx.description ? (
                    <Text style={[tw`text-xs italic mt-0.5`, { color: textMuted }]}>
                      "{tx.description}"
                    </Text>
                  ) : null}
                </View>
                <Text style={[tw`text-base font-extrabold`, { color: textPrimary }]}>
                  {formatRupees(tx.paid_amount || tx.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
