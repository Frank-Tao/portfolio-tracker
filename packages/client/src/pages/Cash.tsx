import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { currency, shortDate } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { CashSummary, CashMovementType } from '@portfolio/shared';

const TYPE_LABELS: Record<CashMovementType, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  fee: 'Fee',
  other: 'Other',
};

const TYPE_COLORS: Record<CashMovementType, string> = {
  deposit: 'bg-green-100 text-green-700',
  withdrawal: 'bg-red-100 text-red-700',
  buy: 'bg-orange-100 text-orange-700',
  sell: 'bg-blue-100 text-blue-700',
  dividend: 'bg-emerald-100 text-emerald-700',
  fee: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-700',
};

function Cash() {
  const { colorFor } = useGainLossColor();
  const [data, setData] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<CashMovementType | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<CashMovementType>('deposit');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const result = await api.cash.summary(
        filterType || undefined,
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (!amount) return;
    setSubmitting(true);
    try {
      await api.cash.create(formDate, amount, formType, formNotes || undefined);
      setShowForm(false);
      setFormAmount('');
      setFormNotes('');
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this cash movement?')) return;
    await api.cash.delete(id);
    await fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!data) return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Movement'}
        </button>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 col-span-2 lg:col-span-1">
          <p className="text-sm text-gray-500">Cash Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{currency(data.balance)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Deposits</p>
          <p className="text-lg font-bold text-green-600 mt-1">{currency(data.total_deposits)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Withdrawals</p>
          <p className="text-lg font-bold text-red-600 mt-1">{currency(data.total_withdrawals)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Dividends</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{currency(data.total_dividends)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Invested (Buys)</p>
          <p className="text-lg font-bold text-orange-600 mt-1">{currency(data.total_buys)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Sells</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{currency(data.total_sells)}</p>
        </div>
      </div>

      {/* Add Movement Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Cash Movement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as CashMovementType)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="any"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. 5000 or -2000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                type="text"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as CashMovementType | '')}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="buy">Buys</option>
          <option value="sell">Sells</option>
          <option value="dividend">Dividends</option>
        </select>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Fund</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Running Balance</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Notes</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let runningBalance = data.balance;
                const sortedMovements = [...data.movements];
                return sortedMovements.map(m => {
                  const balance = runningBalance;
                  runningBalance -= m.amount;
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">{shortDate(m.date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[m.type as CashMovementType] || TYPE_COLORS.other}`}>
                          {TYPE_LABELS[m.type as CashMovementType] || m.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{m.ticker || '-'}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${colorFor(m.amount)}`}>
                        {m.amount >= 0 ? '+' : ''}{currency(m.amount, 2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 hidden md:table-cell">
                        {currency(balance, 2)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[200px] truncate hidden sm:table-cell">{m.notes || '-'}</td>
                      <td className="px-4 py-2.5">
                        {!m.related_fund_id && (
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
              {data.movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No cash movements found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Cash;
