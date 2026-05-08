import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../lib/api';
import { currency, pct, signedPct } from '../lib/format';
import type { PortfolioSummary, BucketSummary, RebalanceResult } from '@portfolio/shared';

function Allocation() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rebalance, setRebalance] = useState<RebalanceResult | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<number | undefined>();
  const [newCapital, setNewCapital] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.portfolio.summary(), api.profiles.list()])
      .then(([s, p]) => {
        setSummary(s);
        setProfiles(p);
        const active = p.find((pr: any) => pr.is_active);
        if (active) setSelectedProfile(active.id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      api.portfolio.rebalance(selectedProfile, parseFloat(newCapital) || 0).then(setRebalance);
    }
  }, [selectedProfile, newCapital]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!summary) return null;

  const activeBuckets = summary.buckets.filter((b: BucketSummary) => b.total_value > 0 || (b.target_pct && b.target_pct > 0));

  const chartData = activeBuckets.map((b: BucketSummary) => ({
    name: b.name.replace('Australian ', 'AU ').replace('International ', 'Intl '),
    actual: +(b.actual_pct * 100).toFixed(1),
    target: b.target_pct != null ? +(b.target_pct * 100).toFixed(1) : 0,
  }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Allocation</h1>
        <select
          value={selectedProfile ?? ''}
          onChange={e => setSelectedProfile(Number(e.target.value))}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          {profiles.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' (active)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        <strong>How drift works:</strong> Drift = Actual % − Target %. Positive drift means you&apos;re overweight
        (holding more than planned); negative means underweight (holding less). The target comes from
        your selected allocation profile above.
      </div>

      {/* Actual vs Target Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actual vs Target Allocation</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} fontSize={11} />
            <YAxis type="category" dataKey="name" fontSize={11} width={80} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Legend />
            <Bar dataKey="actual" fill="#2563eb" name="Actual" radius={[0, 4, 4, 0]} />
            <Bar dataKey="target" fill="#d1d5db" name="Target" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Drift Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Allocation Drift</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Bucket</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Funds</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">Value</th>
                <th className="pb-2 font-medium text-right">Actual</th>
                <th className="pb-2 font-medium text-right">Target</th>
                <th className="pb-2 font-medium text-right">Drift</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeBuckets.map((b: BucketSummary) => {
                const driftAbs = Math.abs(b.drift ?? 0);
                const status = driftAbs < 0.02 ? 'on-target' : driftAbs < 0.05 ? 'minor' : 'significant';
                const statusColor = status === 'on-target' ? 'text-green-600 bg-green-50' : status === 'minor' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
                const statusLabel = status === 'on-target' ? 'On Target' : status === 'minor' ? 'Minor Drift' : 'Rebalance Needed';

                return (
                  <tr key={b.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color ?? undefined }} />
                        <span className="font-medium text-gray-900 text-xs sm:text-sm">{b.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-500 hidden sm:table-cell">
                      {b.funds.map(f => f.ticker).join(', ') || '-'}
                    </td>
                    <td className="py-3 text-right hidden md:table-cell">{currency(b.total_value)}</td>
                    <td className="py-3 text-right font-medium">{pct(b.actual_pct)}</td>
                    <td className="py-3 text-right text-gray-500">{b.target_pct != null ? pct(b.target_pct) : '-'}</td>
                    <td className={`py-3 text-right font-medium ${(b.drift ?? 0) > 0 ? 'text-red-600' : (b.drift ?? 0) < -0.02 ? 'text-amber-600' : 'text-green-600'}`}>
                      {b.drift != null ? signedPct(b.drift) : '-'}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rebalance Suggestions */}
      {rebalance && rebalance.actions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Rebalance Actions</h2>
          <p className="text-sm text-gray-500 mb-4">
            To align with <strong>{rebalance.profile}</strong> profile
            {newCapital ? ` (adding ${currency(parseFloat(newCapital))} new capital)` : ''}:
          </p>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mr-2">New capital to deploy:</label>
            <input
              type="number"
              value={newCapital}
              onChange={e => setNewCapital(e.target.value)}
              placeholder="0"
              className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
            />
          </div>

          <div className="space-y-3">
            {rebalance.actions.map((a, i) => (
              <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg ${a.action === 'buy' ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase self-start ${a.action === 'buy' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                  {a.action}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{currency(a.amount)}</span>
                  <span className="text-gray-600"> of </span>
                  <span className="font-medium">{a.ticker_suggestion}</span>
                  <span className="text-gray-500"> ({a.bucket_name})</span>
                </div>
                <span className="text-xs text-gray-500">{a.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Allocation;
