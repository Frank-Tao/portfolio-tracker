import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../lib/api';
import { currency, signedCurrency, signedPct, shortDate } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { Snapshot, SnapshotDetail } from '@portfolio/shared';

function Snapshots() {
  const { colorFor } = useGainLossColor();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotDetail | null>(null);
  const [takingSnapshot, setTakingSnapshot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    try {
      setError(null);
      const snaps = await api.snapshots.list();
      setSnapshots(snaps);
    } catch (err: any) {
      setError(err?.message || 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const takeSnapshot = async () => {
    setTakingSnapshot(true);
    try {
      const created = await api.snapshots.take();
      await fetchSnapshots();
      await viewSnapshot(created.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to take snapshot');
    } finally {
      setTakingSnapshot(false);
    }
  };

  const viewSnapshot = async (id: number) => {
    try {
      const detail = await api.snapshots.get(id);
      setSelectedSnapshot(detail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load snapshot detail');
    }
  };

  const deleteSnapshot = async (id: number) => {
    if (!confirm('Delete this snapshot?')) return;
    await api.snapshots.delete(id);
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    if (selectedSnapshot?.id === id) {
      setSelectedSnapshot(null);
    }
  };

  const trend = useMemo(() => {
    return [...snapshots]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        date: s.date,
        total_value: s.total_value,
        total_invested: s.total_invested,
        cash_balance: s.cash_balance,
        gain_loss: s.total_value - s.total_invested,
      }));
  }, [snapshots]);

  const trendSummary = useMemo(() => {
    if (trend.length < 2) return null;
    const first = trend[0];
    const last = trend[trend.length - 1];
    const valueChange = last.total_value - first.total_value;
    const valueChangePct = first.total_value !== 0 ? valueChange / first.total_value : 0;
    const gainChange = last.gain_loss - first.gain_loss;
    return {
      from: first.date,
      to: last.date,
      valueChange,
      valueChangePct,
      gainChange,
    };
  }, [trend]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Snapshots</h1>
          <p className="text-sm text-gray-500 mt-1">Capture point-in-time portfolio records and monitor trend over time.</p>
        </div>
        <button
          onClick={takeSnapshot}
          disabled={takingSnapshot}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {takingSnapshot ? 'Taking...' : 'Take Snapshot'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Report</h2>
        {trend.length > 1 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Portfolio Value Change"
                value={signedCurrency(trendSummary?.valueChange ?? 0)}
                subtitle={`${signedPct(trendSummary?.valueChangePct ?? 0)} since ${shortDate(trendSummary?.from ?? '')}`}
                colorClass={colorFor(trendSummary?.valueChange ?? 0)}
              />
              <StatCard
                label="Gain/Loss Change"
                value={signedCurrency(trendSummary?.gainChange ?? 0)}
                subtitle={`${shortDate(trendSummary?.from ?? '')} -> ${shortDate(trendSummary?.to ?? '')}`}
                colorClass={colorFor(trendSummary?.gainChange ?? 0)}
              />
              <StatCard
                label="Snapshots Captured"
                value={String(trend.length)}
                subtitle={`Latest: ${shortDate(trend[trend.length - 1].date)}`}
              />
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
                <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) => [currency(value), name === 'total_value' ? 'Total Value' : name === 'total_invested' ? 'Invested' : 'Cash']}
                  labelFormatter={shortDate}
                />
                <Legend formatter={(v: string) => v === 'total_value' ? 'Total Value' : v === 'total_invested' ? 'Invested' : 'Cash'} />
                <Line type="monotone" dataKey="total_value" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total_invested" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="cash_balance" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Need at least 2 snapshots to build a trend report.
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Snapshot History</h2>
        {snapshots.length > 0 ? (
          <div className="space-y-2">
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <span className="font-medium text-sm">{s.date}</span>
                  <span className="text-sm text-gray-500 ml-4">Value: {currency(s.total_value)}</span>
                  <span className="text-sm text-gray-500 ml-2">Cash: {currency(s.cash_balance)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => viewSnapshot(s.id)}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    View
                  </button>
                  <button
                    onClick={() => deleteSnapshot(s.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-4">No snapshots yet. Take one to record your current portfolio state.</p>
        )}
      </div>

      {selectedSnapshot && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Snapshot Detail: {selectedSnapshot.date}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Ticker</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Price</th>
                <th className="pb-2 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {selectedSnapshot.holdings.map((h) => (
                <tr key={h.ticker} className="border-b border-gray-50">
                  <td className="py-2 font-medium">{h.ticker}</td>
                  <td className="py-2 text-gray-600">{h.name}</td>
                  <td className="py-2 text-right">{h.quantity}</td>
                  <td className="py-2 text-right">${h.price.toFixed(2)}</td>
                  <td className="py-2 text-right font-medium">{currency(h.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2" colSpan={4}>Total</td>
                <td className="py-2 text-right">{currency(selectedSnapshot.total_value)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, subtitle, colorClass }: { label: string; value: string; subtitle: string; colorClass?: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-md">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${colorClass ?? 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

export default Snapshots;
