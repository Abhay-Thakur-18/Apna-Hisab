import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import Svg, { Rect, Path, Circle, Line, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { PieChart, TrendingUp, TrendingDown, Wallet, Tag, CreditCard } from 'lucide-react-native';
import { useTransactionStore } from '../store/transactionStore';
import { useIsDark } from '../store/themeStore';
import { formatRupees } from '../utils/money';
import { formatDateTime } from '../utils/date';

export default function ReportsScreen() {
  const { transactions } = useTransactionStore();
  const isDark = useIsDark();

  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | '6months' | 'yearly'>('monthly');
  const [refreshing, setRefreshing] = useState(false);

  // Theme tokens
  const bg = isDark ? '#0B0B0F' : '#F7F7FA';
  const cardBg = isDark ? '#161622' : '#ffffff';
  const borderColor = isDark ? '#222232' : '#EBEBF2';
  const textPrimary = isDark ? '#F7F7FA' : '#0B0B0F';
  const textMuted = isDark ? '#9494A8' : '#6E6E82';

  // --------------- Compute date bounds ---------------
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
      totalExpense += tx.paid_amount || tx.amount;
      totalPending += tx.pending_amount || 0;
    }
  });

  const netSavings = totalIncome - totalExpense;

  // Category breakdown
  const catMap: { [cat: string]: number } = {};
  periodTxs
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const paid = tx.paid_amount || tx.amount;
      if (paid > 0) {
        catMap[tx.category] = (catMap[tx.category] || 0) + paid;
      }
    });

  const categoryBreakdown = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Payment method breakdown
  const methodMap: { [m: string]: number } = {};
  periodTxs
    .filter((tx) => tx.type === 'expense' && tx.payment_method !== 'None')
    .forEach((tx) => {
      const paid = tx.paid_amount || tx.amount;
      if (paid > 0) {
        methodMap[tx.payment_method] = (methodMap[tx.payment_method] || 0) + paid;
      }
    });

  const paymentBreakdown = Object.entries(methodMap)
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);

  const getPercentage = (amount: number, total: number) => {
    if (total <= 0) return 0;
    return Math.round((amount / total) * 100);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const categoryColors = [
    '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#3b82f6'
  ];

  // Highest value for bar height calculations
  const maxIncomeExpense = Math.max(totalIncome, totalExpense, 1);
  const incomeBarHeight = Math.max(Math.round((totalIncome / maxIncomeExpense) * 120), 10);
  const expenseBarHeight = Math.max(Math.round((totalExpense / maxIncomeExpense) * 120), 10);

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={cardBg}
      />

      {/* Header Bar */}
      <View
        style={[
          tw`px-6 py-4 border-b flex-row justify-between items-center`,
          { backgroundColor: cardBg, borderColor },
        ]}
      >
        <Text style={[tw`text-lg font-bold`, { color: textPrimary }]}>Financial Analytics</Text>
        <PieChart color="#7c3aed" size={22} />
      </View>

      <ScrollView
        contentContainerStyle={tw`p-6 pb-28`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#7c3aed']} />
        }
      >
        {/* Horizontal Time Period Filter Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row mb-6`}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'weekly', label: '7 Days' },
            { id: 'monthly', label: 'This Month' },
            { id: '6months', label: '6 Months' },
            { id: 'yearly', label: 'This Year' },
          ].map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                tw`border rounded-2xl px-4 py-2.5 mr-2.5 shadow-sm`,
                period === p.id
                  ? tw`bg-[#6C5CE7] border-[#6C5CE7]`
                  : { backgroundColor: cardBg, borderColor },
              ]}
              onPress={() => setPeriod(p.id as any)}
            >
              <Text
                style={[
                  tw`text-xs font-bold`,
                  period === p.id ? tw`text-white` : { color: textPrimary },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Overview Financial Summary Cards */}
        <View style={tw`flex-row gap-4 mb-6`}>
          <View style={tw`flex-1 bg-emerald-600 rounded-3xl p-5 shadow-lg`}>
            <View style={tw`flex-row items-center gap-1.5 mb-1`}>
              <TrendingUp color="#ffffff" size={16} />
              <Text style={tw`text-emerald-100 text-xs font-bold uppercase tracking-wider`}>
                Income
              </Text>
            </View>
            <Text style={tw`text-white text-xl font-extrabold`}>{formatRupees(totalIncome)}</Text>
          </View>

          <View style={tw`flex-1 bg-rose-600 rounded-3xl p-5 shadow-lg`}>
            <View style={tw`flex-row items-center gap-1.5 mb-1`}>
              <TrendingDown color="#ffffff" size={16} />
              <Text style={tw`text-rose-100 text-xs font-bold uppercase tracking-wider`}>
                Expense
              </Text>
            </View>
            <Text style={tw`text-white text-xl font-extrabold`}>{formatRupees(totalExpense)}</Text>
          </View>
        </View>

        {/* SVG CHART 1: Income vs Expense Comparison */}
        <View style={[tw`border rounded-3xl p-6 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[tw`text-sm font-bold mb-4`, { color: textPrimary }]}>
            Income vs. Expense Comparison
          </Text>

          <View style={tw`items-center justify-center py-2`}>
            <Svg height="160" width="280">
              <Defs>
                <LinearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#10b981" stopOpacity="1" />
                  <Stop offset="1" stopColor="#059669" stopOpacity="0.8" />
                </LinearGradient>
                <LinearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#f43f5e" stopOpacity="1" />
                  <Stop offset="1" stopColor="#e11d48" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>

              {/* Baseline */}
              <Line x1="20" y1="140" x2="260" y2="140" stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth="2" />

              {/* Income Bar */}
              <Rect
                x="65"
                y={140 - incomeBarHeight}
                width="45"
                height={incomeBarHeight}
                rx="8"
                fill="url(#incomeGrad)"
              />
              <SvgText
                x="87"
                y={130 - incomeBarHeight}
                fill={isDark ? '#a7f3d0' : '#047857'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {formatRupees(totalIncome)}
              </SvgText>

              {/* Expense Bar */}
              <Rect
                x="170"
                y={140 - expenseBarHeight}
                width="45"
                height={expenseBarHeight}
                rx="8"
                fill="url(#expenseGrad)"
              />
              <SvgText
                x="192"
                y={130 - expenseBarHeight}
                fill={isDark ? '#fecdd3' : '#be123c'}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {formatRupees(totalExpense)}
              </SvgText>
            </Svg>
          </View>

          <View style={tw`flex-row justify-center gap-6 mt-2`}>
            <View style={tw`flex-row items-center gap-2`}>
              <View style={tw`w-3 h-3 rounded-full bg-emerald-500`} />
              <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>Income</Text>
            </View>
            <View style={tw`flex-row items-center gap-2`}>
              <View style={tw`w-3 h-3 rounded-full bg-rose-500`} />
              <Text style={[tw`text-xs font-semibold`, { color: textPrimary }]}>Expense</Text>
            </View>
          </View>
        </View>

        {/* SVG CHART 2: Category Spending Breakdown */}
        <View style={[tw`border rounded-3xl p-6 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <View style={tw`flex-row justify-between items-center mb-4`}>
            <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
              Spending by Category
            </Text>
            <Tag color="#7c3aed" size={18} />
          </View>

          {categoryBreakdown.length === 0 ? (
            <View style={tw`py-6 items-center`}>
              <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>
                No category expenses recorded for this period
              </Text>
            </View>
          ) : (
            categoryBreakdown.map((item, idx) => {
              const pct = getPercentage(item.amount, totalExpense);
              const color = categoryColors[idx % categoryColors.length];
              return (
                <View key={item.category} style={tw`mb-4`}>
                  <View style={tw`flex-row justify-between items-center mb-1.5`}>
                    <View style={tw`flex-row items-center gap-2`}>
                      <View style={[tw`w-3 h-3 rounded-full`, { backgroundColor: color }]} />
                      <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                        {item.category}
                      </Text>
                    </View>
                    <View style={tw`flex-row items-center gap-2`}>
                      <Text style={[tw`text-xs font-black`, { color: textPrimary }]}>
                        {formatRupees(item.amount)}
                      </Text>
                      <Text style={tw`text-xs font-bold text-violet-600 dark:text-violet-400`}>
                        {pct}%
                      </Text>
                    </View>
                  </View>

                  {/* Horizontal SVG Progress Meter */}
                  <View style={[tw`w-full h-3 rounded-full overflow-hidden`, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <View
                      style={[
                        tw`h-full rounded-full`,
                        { width: `${pct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Payment Method Distribution */}
        <View style={[tw`border rounded-3xl p-6 shadow-sm mb-6`, { backgroundColor: cardBg, borderColor }]}>
          <View style={tw`flex-row justify-between items-center mb-4`}>
            <Text style={[tw`text-sm font-bold`, { color: textPrimary }]}>
              Payment Method Breakdown
            </Text>
            <CreditCard color="#7c3aed" size={18} />
          </View>

          {paymentBreakdown.length === 0 ? (
            <View style={tw`py-6 items-center`}>
              <Text style={[tw`text-xs font-semibold`, { color: textMuted }]}>
                No payment methods recorded for this period
              </Text>
            </View>
          ) : (
            paymentBreakdown.map((item) => {
              const pct = getPercentage(item.amount, totalExpense);
              return (
                <View style={tw`flex-row justify-between items-center py-2.5 border-b border-gray-100 dark:border-gray-800`} key={item.method}>
                  <Text style={[tw`text-xs font-bold`, { color: textPrimary }]}>
                    {item.method}
                  </Text>
                  <View style={tw`flex-row items-center gap-2`}>
                    <Text style={[tw`text-xs font-black`, { color: textPrimary }]}>
                      {formatRupees(item.amount)}
                    </Text>
                    <Text style={[tw`text-xs font-bold`, { color: textMuted }]}>({pct}%)</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
