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
import { apiRequest } from '../services/api';
import { formatRupees } from '../utils/money';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | '6months' | 'yearly'>('monthly');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const data = await apiRequest(`/api/reports?period=${period}&client_today=${todayStr}`);
      setReport(data);
    } catch (e) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const data = await apiRequest(`/api/reports?period=${period}&client_today=${todayStr}`);
      setReport(data);
    } catch (e) {}
    setRefreshing(false);
  };

  const getPercentage = (amount: number, total: number) => {
    if (total <= 0) return 0;
    return Math.round((amount / total) * 100);
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      
      {/* Period Segment Selector */}
      <View style={tw`bg-white px-6 py-4 border-b border-gray-150 flex-row gap-2`}>
        {(['weekly', 'monthly', '6months', 'yearly'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={tw`flex-1 py-2 rounded-xl items-center ${
              period === p ? 'bg-indigo-600' : 'bg-gray-100 border border-gray-200'
            }`}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={tw`text-xs font-bold capitalize ${
                period === p ? 'text-white' : 'text-gray-600'
              }`}
            >
              {p === '6months' ? '6 Months' : p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={tw`text-gray-400 text-xs mt-2 font-medium`}>Analyzing accounts...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={tw`p-6 pb-24`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4f46e5']} />
          }
        >
          {report && (
            <>
              {/* Summary Cards */}
              <View style={tw`bg-white border border-gray-100 rounded-3xl p-5 shadow-sm mb-6`}>
                <Text style={tw`text-gray-800 font-bold text-sm mb-4`}>Period Summary</Text>
                
                <View style={tw`flex-row flex-wrap gap-4`}>
                  {/* Income */}
                  <View style={tw`flex-1 min-w-[45%] bg-emerald-50 rounded-2xl p-4 border border-emerald-100`}>
                    <Text style={tw`text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                      Total Income
                    </Text>
                    <Text style={tw`text-emerald-800 text-lg font-bold`}>
                      {formatRupees(report.summary.total_income)}
                    </Text>
                  </View>
                  
                  {/* Expense */}
                  <View style={tw`flex-1 min-w-[45%] bg-red-50 rounded-2xl p-4 border border-red-100`}>
                    <Text style={tw`text-red-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                      Total Spent
                    </Text>
                    <Text style={tw`text-red-800 text-lg font-bold`}>
                      {formatRupees(report.summary.total_expense)}
                    </Text>
                  </View>
                  
                  {/* Pending */}
                  <View style={tw`flex-1 min-w-[45%] bg-amber-50 rounded-2xl p-4 border border-amber-100`}>
                    <Text style={tw`text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                      Pending Khata
                    </Text>
                    <Text style={tw`text-amber-800 text-lg font-bold`}>
                      {formatRupees(report.summary.total_pending)}
                    </Text>
                  </View>
                  
                  {/* Remaining */}
                  <View style={tw`flex-1 min-w-[45%] bg-indigo-50 rounded-2xl p-4 border border-indigo-100`}>
                    <Text style={tw`text-indigo-800 text-[10px] font-bold uppercase tracking-wider mb-1`}>
                      Net Savings
                    </Text>
                    <Text style={tw`text-indigo-800 text-lg font-bold`}>
                      {formatRupees(report.summary.remaining_balance)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Category-wise Spending (Progress Bars) */}
              <View style={tw`bg-white border border-gray-100 rounded-3xl p-5 shadow-sm mb-6`}>
                <Text style={tw`text-gray-800 font-bold text-sm mb-4`}>Category-wise Expenses</Text>
                
                {report.category_breakdown.length === 0 ? (
                  <Text style={tw`text-gray-400 text-xs italic text-center py-4`}>
                    No expenses recorded in this period.
                  </Text>
                ) : (
                  report.category_breakdown.map((item: any) => {
                    const percentage = getPercentage(item.amount, report.summary.total_expense);
                    return (
                      <View key={item.category} style={tw`mb-4`}>
                        <View style={tw`flex-row justify-between items-center mb-1.5`}>
                          <Text style={tw`text-xs font-semibold text-gray-700`}>{item.category}</Text>
                          <Text style={tw`text-xs font-bold text-gray-800`}>
                            {formatRupees(item.amount)} ({percentage}%)
                          </Text>
                        </View>
                        {/* Progress Bar container */}
                        <View style={tw`w-full h-2 bg-gray-100 rounded-full overflow-hidden`}>
                          <View 
                            style={tw`h-full bg-indigo-600 rounded-full w-[${percentage}%]`} 
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Payment Method Breakdown */}
              <View style={tw`bg-white border border-gray-100 rounded-3xl p-5 shadow-sm mb-6`}>
                <Text style={tw`text-gray-800 font-bold text-sm mb-4`}>Payment Method Breakdown</Text>
                
                {report.payment_breakdown.length === 0 ? (
                  <Text style={tw`text-gray-400 text-xs italic text-center py-4`}>
                    No transactions recorded in this period.
                  </Text>
                ) : (
                  report.payment_breakdown.map((item: any) => {
                    const percentage = getPercentage(item.amount, report.summary.total_expense);
                    return (
                      <View key={item.method} style={tw`mb-4`}>
                        <View style={tw`flex-row justify-between items-center mb-1.5`}>
                          <Text style={tw`text-xs font-semibold text-gray-700`}>{item.method}</Text>
                          <Text style={tw`text-xs font-bold text-gray-800`}>
                            {formatRupees(item.amount)} ({percentage}%)
                          </Text>
                        </View>
                        <View style={tw`w-full h-2 bg-gray-100 rounded-full overflow-hidden`}>
                          <View 
                            style={tw`h-full bg-emerald-600 rounded-full w-[${percentage}%]`} 
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Largest Expenses list */}
              <View style={tw`bg-white border border-gray-100 rounded-3xl p-5 shadow-sm`}>
                <Text style={tw`text-gray-800 font-bold text-sm mb-4`}>Largest Expenses</Text>
                
                {report.largest_expenses.length === 0 ? (
                  <Text style={tw`text-gray-400 text-xs italic text-center py-4`}>
                    No expenses recorded in this period.
                  </Text>
                ) : (
                  report.largest_expenses.map((tx: any, idx: number) => (
                    <View 
                      key={tx.id}
                      style={tw`flex-row justify-between items-center py-3.5 ${
                        idx < report.largest_expenses.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                    >
                      <View style={tw`flex-1 mr-3`}>
                        <Text style={tw`text-sm font-bold text-gray-800`}>
                          {tx.category} → {tx.subcategory}
                        </Text>
                        <Text style={tw`text-xs text-gray-400 mt-1`}>{tx.date}</Text>
                        {tx.description ? (
                          <Text style={tw`text-xs text-gray-500 italic mt-0.5`}>"{tx.description}"</Text>
                        ) : null}
                      </View>
                      <Text style={tw`text-base font-extrabold text-gray-800`}>
                        {formatRupees(tx.amount)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
