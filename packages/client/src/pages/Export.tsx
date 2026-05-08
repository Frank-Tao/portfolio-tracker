import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { currency } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { TaxReport, Snapshot, SnapshotDetail } from '@portfolio/shared';

function Export() {
  const { colorFor } = useGainLossColor();
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotDetail | null>(null);
  const [takingSnapshot, setTakingSnapshot] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tax, snaps] = await Promise.all([
        api.export.taxReport(taxYear),
        api.snapshots.list(),
      ]);
      setTaxReport(tax);
      setSnapshots(snaps);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [taxYear]);

  const takeSnapshot = async () => {
    setTakingSnapshot(true);
    try {
      await api.snapshots.take();
      const snaps = await api.snapshots.list();
      setSnapshots(snaps);
    } finally {
      setTakingSnapshot(false);
    }
  };

  const viewSnapshot = async (id: number) => {
    const detail = await api.snapshots.get(id);
    setSelectedSnapshot(detail);
  };

  const deleteSnapshot = async (id: number) => {
    if (!confirm('Delete this snapshot?')) return;
    await api.snapshots.delete(id);
    setSnapshots(s => s.filter(snap => snap.id !== id));
    if (selectedSnapshot?.id === id) setSelectedSnapshot(null);
  };

  const download = (url: string) => {
    window.open(url, '_blank');
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Export & Reports</h1>

      {/* Data Export */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ExportButton
            label="Transactions (CSV)"
            description="All buy/sell transactions"
            onClick={() => download(api.export.transactionsUrl('csv'))}
          />
          <ExportButton
            label="Holdings (CSV)"
            description="Current holdings with values"
            onClick={() => download(api.export.holdingsUrl('csv'))}
          />
          <ExportButton
            label="Tax Report (CSV)"
            description={`FY${taxYear - 1}/${taxYear} tax data`}
            onClick={() => download(api.export.taxReportUrl(taxYear))}
          />
        </div>
      </div>

      {/* Tax Report */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Tax Summary</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Financial Year ending:</label>
            <select
              value={taxYear}
              onChange={e => setTaxYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>FY{y - 1}/{y}</option>
              ))}
            </select>
          </div>
        </div>

        {taxReport && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-500">Total Distributions</p>
                <p className="text-lg font-bold text-gray-900">{currency(taxReport.total_distributions)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-500">Realized Gains</p>
                <p className={`text-lg font-bold ${colorFor(taxReport.realized_gains)}`}>{currency(taxReport.realized_gains)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-500">Realized Losses</p>
                <p className={`text-lg font-bold ${colorFor(-taxReport.realized_losses)}`}>{currency(taxReport.realized_losses)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-500">Net Capital Gain</p>
                <p className={`text-lg font-bold ${colorFor(taxReport.net_capital_gain)}`}>
                  {currency(taxReport.net_capital_gain)}
                </p>
              </div>
            </div>

            {taxReport.distributions_by_fund.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Distributions by Fund</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Fund</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxReport.distributions_by_fund.map(d => (
                      <tr key={d.ticker} className="border-b border-gray-50">
                        <td className="py-2">{d.ticker} — {d.name}</td>
                        <td className="py-2 text-right font-medium">{currency(d.total, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snapshots */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Snapshots</h2>
          <button
            onClick={takeSnapshot}
            disabled={takingSnapshot}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {takingSnapshot ? 'Taking...' : 'Take Snapshot'}
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Snapshots capture your portfolio state at a point in time for historical reference.
        </p>

        {snapshots.length > 0 ? (
          <div className="space-y-2">
            {snapshots.map(s => (
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

        {selectedSnapshot && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">
              Snapshot: {selectedSnapshot.date}
            </h3>
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
                {selectedSnapshot.holdings.map(h => (
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
    </div>
  );
}

function ExportButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
    >
      <p className="font-medium text-gray-900 text-sm">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </button>
  );
}

export default Export;
