import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { api } from '../lib/api';
import { currency, pct, signedCurrency, signedPct, shortDate } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { FundPerformanceResponse, FundPerformancePoint, Transaction, Distribution } from '@portfolio/shared';

function FundDetail() {
  const { colorFor } = useGainLossColor();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FundPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.portfolio.fundPerformance(Number(id)).then(setData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!data) return <div className="text-center py-20 text-red-400">Fund not found</div>;

  const { fund, transactions, distributions, timeline } = data;
  const latest: FundPerformancePoint | null = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  return (
    <div>
      <div className="mb-6">
        <Link to="/holdings" className="text-sm text-blue-600 hover:underline">&larr; Back to Holdings</Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{fund.ticker}</h1>
        <span className="text-gray-500">{fund.name}</span>
        {fund.expense_ratio && <span className="text-xs text-gray-400">MER: {pct(fund.expense_ratio, 2)}</span>}
      </div>

      {/* Current Stats */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <StatCard label="Holdings" value={`${latest.quantity} units`} />
          <StatCard label="Market Value" value={currency(latest.market_value)} />
          <StatCard label="Cost Basis" value={currency(latest.cost_basis)} />
          <StatCard
            label="Unrealised G/L"
            value={signedCurrency(latest.gain_loss)}
            sub={signedPct(latest.cost_basis !== 0 ? latest.gain_loss / Math.abs(latest.cost_basis) : 0)}
            colorClass={colorFor(latest.gain_loss)}
          />
          <StatCard
            label="Total Return (incl. divs)"
            value={signedCurrency(latest.total_return)}
            sub={signedPct(latest.total_return_pct)}
            colorClass={colorFor(latest.total_return)}
          />
        </div>
      )}

      {/* Earnings Over Time Chart */}
      {timeline.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Earnings Over Time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
              <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} fontSize={11} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    market_value: 'Market Value',
                    cost_basis: 'Cost Basis',
                  };
                  return [currency(value), labels[name] || name];
                }}
                labelFormatter={shortDate}
              />
              <Legend formatter={(v: string) => v === 'market_value' ? 'Market Value' : v === 'cost_basis' ? 'Cost Basis' : 'Unrealised G/L'} />
              <Area type="monotone" dataKey="market_value" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
              <Area type="monotone" dataKey="cost_basis" stroke="#9ca3af" fill="#f3f4f6" strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gain/Loss Over Time */}
      {timeline.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Gain/Loss Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
              <YAxis tickFormatter={(v: number) => `$${v.toLocaleString()}`} fontSize={11} />
              <Tooltip
                formatter={(value: number) => [currency(value), 'Gain/Loss']}
                labelFormatter={shortDate}
              />
              <Area
                type="monotone"
                dataKey="gain_loss"
                stroke="#16a34a"
                fill="#dcfce7"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Price</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: Transaction) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="py-2">{shortDate(t.date)}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${t.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 text-right">{t.quantity}</td>
                  <td className="py-2 text-right">${t.price.toFixed(2)}</td>
                  <td className="py-2 text-right font-medium">{currency(Math.abs(t.amount))}</td>
                  <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{t.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution History */}
      {distributions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Distributions
            <span className="text-sm font-normal text-gray-500 ml-2">
              (Total: {currency(distributions.reduce((s: number, d: Distribution) => s + d.amount, 0))})
            </span>
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Label</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((d: Distribution) => (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="py-2">{shortDate(d.date)}</td>
                  <td className={`py-2 text-right font-medium ${colorFor(d.amount)}`}>{currency(d.amount, 2)}</td>
                  <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{d.label || 'Dividend'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, colorClass }: { label: string; value: string; sub?: string; colorClass?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base sm:text-lg font-bold mt-0.5 ${colorClass ?? 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default FundDetail;
