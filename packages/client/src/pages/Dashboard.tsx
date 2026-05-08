import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../lib/api';
import { currency, signedCurrency, signedPct, shortDate } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { PortfolioSummary, FundHolding, PerformancePoint } from '@portfolio/shared';

function Dashboard() {
  const { colorFor } = useGainLossColor();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [history, setHistory] = useState<PerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [s, h] = await Promise.all([api.portfolio.summary(), api.portfolio.history()]);
      setSummary(s);
      setHistory(h);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshPrices = async () => {
    setRefreshing(true);
    try {
      await api.prices.refresh();
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!summary) return <div className="text-center py-20 text-red-400">Failed to load</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {summary.last_price_update && (
            <p className="text-sm text-gray-500 mt-1">
              Prices as of <span className="font-medium">{shortDate(summary.last_price_update)}</span>
            </p>
          )}
        </div>
        <button
          onClick={refreshPrices}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Prices'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Card label="Portfolio Value" value={currency(summary.total_value)} subtitle={`Cash: ${currency(summary.cash_balance)}`} />
        <Card
          label="Total Gain/Loss"
          value={signedCurrency(summary.total_gain_loss)}
          subtitle={signedPct(summary.total_gain_loss_pct)}
          colorClass={colorFor(summary.total_gain_loss)}
        />
        <Card label="Grand Total" value={currency(summary.grand_total)} subtitle="Holdings + Cash" />
        <Card label="Distributions" value={currency(summary.total_distributions)} subtitle="Dividends received" />
      </div>

      {/* Portfolio Growth Chart */}
      {history.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Growth</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
              <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} />
              <Tooltip
                formatter={(value: number, name: string) => [currency(value), name === 'total_value' ? 'Market Value' : 'Cost Basis']}
                labelFormatter={shortDate}
              />
              <Legend formatter={(v: string) => v === 'total_value' ? 'Market Value' : 'Cost Basis'} />
              <Line type="monotone" dataKey="total_value" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total_invested" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Holdings Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Holdings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Ticker</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Name</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">Avg Cost</th>
                <th className="pb-2 font-medium text-right">Price</th>
                <th className="pb-2 font-medium text-right hidden lg:table-cell">Cost Basis</th>
                <th className="pb-2 font-medium text-right">Value</th>
                <th className="pb-2 font-medium text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {summary.buckets
                .flatMap(b => b.funds)
                .filter((f: FundHolding) => f.current_qty > 0)
                .sort((a: FundHolding, b: FundHolding) => (b.current_value ?? 0) - (a.current_value ?? 0))
                .map((fund: FundHolding) => (
                  <tr key={fund.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5">
                      <Link to={`/holdings/${fund.id}`} className="font-medium text-blue-600 hover:underline">
                        {fund.ticker}
                      </Link>
                    </td>
                    <td className="py-2.5 text-gray-600 max-w-[200px] truncate hidden sm:table-cell">{fund.name}</td>
                    <td className="py-2.5 text-right">{fund.current_qty}</td>
                    <td className="py-2.5 text-right text-gray-500 hidden md:table-cell">${fund.avg_cost.toFixed(2)}</td>
                    <td className="py-2.5 text-right">${fund.current_price?.toFixed(2) ?? '-'}</td>
                    <td className="py-2.5 text-right text-gray-500 hidden lg:table-cell">{currency(fund.total_invested)}</td>
                    <td className="py-2.5 text-right font-medium">{fund.current_value ? currency(fund.current_value) : '-'}</td>
                    <td className={`py-2.5 text-right font-medium ${colorFor(fund.gain_loss)}`}>
                      {fund.gain_loss != null ? `${signedCurrency(fund.gain_loss)}` : '-'}
                      {fund.gain_loss_pct != null && <span className="hidden sm:inline"> ({signedPct(fund.gain_loss_pct)})</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2.5" colSpan={2}>Total</td>
                <td className="py-2.5 hidden sm:table-cell"></td>
                <td className="py-2.5 hidden md:table-cell"></td>
                <td className="py-2.5 text-right hidden lg:table-cell">{currency(summary.total_invested)}</td>
                <td className="py-2.5 text-right">{currency(summary.total_value)}</td>
                <td className={`py-2.5 text-right ${colorFor(summary.total_gain_loss)}`}>
                  {signedCurrency(summary.total_gain_loss)} ({signedPct(summary.total_gain_loss_pct)})
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}

function Card({ label, value, subtitle, colorClass }: { label: string; value: string; subtitle: string; colorClass?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
      <p className="text-xs sm:text-sm text-gray-500">{label}</p>
      <p className={`text-lg sm:text-xl font-bold mt-1 ${colorClass ?? 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

export default Dashboard;
