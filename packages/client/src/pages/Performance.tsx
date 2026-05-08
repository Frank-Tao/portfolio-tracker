import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { api } from '../lib/api';
import { pct, signedPct } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { PerformanceMetrics } from '@portfolio/shared';

function Performance() {
  const { colorFor, hexFor } = useGainLossColor();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ updated: { ticker: string; months_added: number }[]; errors: string[] } | null>(null);

  const fetchData = async () => {
    api.performance.metrics().then(setMetrics).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const fetchHistoricalPrices = async () => {
    setFetchingHistory(true);
    setHistoryResult(null);
    try {
      const result = await api.prices.refreshHistorical();
      setHistoryResult(result);
      await fetchData();
    } finally {
      setFetchingHistory(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!metrics) return <div className="text-center py-20 text-red-400">Failed to load performance data</div>;

  const chartData = metrics.monthly_returns
    .filter(m => m.start_value > 0 || m.end_value > 0)
    .map(m => ({
      month: m.month,
      return_pct: +(m.return_pct * 100).toFixed(2),
    }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Based on month-end closing prices</p>
        </div>
        <button
          onClick={fetchHistoricalPrices}
          disabled={fetchingHistory}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {fetchingHistory ? 'Fetching...' : 'Fetch Historical Prices'}
        </button>
      </div>

      {historyResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-blue-900 mb-1">Historical price fetch complete</p>
          {historyResult.updated.filter(u => u.months_added > 0).length > 0 ? (
            <ul className="text-blue-800 space-y-0.5">
              {historyResult.updated.filter(u => u.months_added > 0).map(u => (
                <li key={u.ticker}>{u.ticker}: {u.months_added} month-end prices added</li>
              ))}
            </ul>
          ) : (
            <p className="text-blue-800">All month-end prices already up to date.</p>
          )}
          {historyResult.errors.length > 0 && (
            <ul className="text-red-700 mt-1">
              {historyResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Time-Weighted Return"
          value={signedPct(metrics.time_weighted_return)}
          colorClass={colorFor(metrics.time_weighted_return)}
        />
        <MetricCard
          label="Money-Weighted Return (XIRR)"
          value={signedPct(metrics.money_weighted_return)}
          colorClass={colorFor(metrics.money_weighted_return)}
        />
        <MetricCard
          label="Annualized Return"
          value={signedPct(metrics.annualized_return)}
          colorClass={colorFor(metrics.annualized_return)}
        />
        <MetricCard
          label="Max Drawdown"
          value={pct(metrics.max_drawdown)}
          colorClass={metrics.max_drawdown === 0 ? undefined : colorFor(-metrics.max_drawdown)}
        />
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Sharpe Ratio"
          value={metrics.sharpe_ratio != null ? metrics.sharpe_ratio.toFixed(2) : 'N/A'}
          colorClass={metrics.sharpe_ratio != null ? colorFor(metrics.sharpe_ratio) : undefined}
        />
        <MetricCard
          label="Best Month"
          value={metrics.best_month ? `${signedPct(metrics.best_month.return_pct)} (${metrics.best_month.date})` : 'N/A'}
          colorClass={metrics.best_month ? colorFor(metrics.best_month.return_pct) : undefined}
        />
        <MetricCard
          label="Worst Month"
          value={metrics.worst_month ? `${signedPct(metrics.worst_month.return_pct)} (${metrics.worst_month.date})` : 'N/A'}
          colorClass={metrics.worst_month ? colorFor(metrics.worst_month.return_pct) : undefined}
        />
      </div>

      {/* Monthly Returns Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Returns</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={60} />
              <YAxis tickFormatter={v => `${v}%`} fontSize={11} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Return']} />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Bar dataKey="return_pct" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={hexFor(entry.return_pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly Returns Table */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium text-right">Return</th>
                  <th className="pb-2 font-medium text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cumulative = 1;
                  return metrics.monthly_returns
                    .filter(m => m.start_value > 0 || m.end_value > 0)
                    .map(m => {
                      cumulative *= (1 + m.return_pct);
                      return (
                        <tr key={m.month} className="border-b border-gray-50">
                          <td className="py-2">{m.month}</td>
                          <td className={`py-2 text-right font-medium ${colorFor(m.return_pct)}`}>
                            {signedPct(m.return_pct)}
                          </td>
                          <td className={`py-2 text-right ${colorFor(cumulative - 1)}`}>
                            {signedPct(cumulative - 1)}
                          </td>
                        </tr>
                      );
                    });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${colorClass ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

export default Performance;
