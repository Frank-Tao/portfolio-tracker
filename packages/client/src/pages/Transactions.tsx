import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { currency, shortDate } from '../lib/format';
import type { Fund, Transaction, TransactionInput } from '@portfolio/shared';

function Transactions() {
  const [transactions, setTransactions] = useState<(Transaction & { ticker: string })[]>([]);
  const [funds, setFunds] = useState<(Fund & { bucket_name: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterFund, setFilterFund] = useState<number | undefined>();

  const [form, setForm] = useState<TransactionInput>({
    fund_id: 0,
    date: new Date().toISOString().split('T')[0],
    type: 'buy',
    quantity: 0,
    price: 0,
  });

  const fetchData = async () => {
    try {
      const [txns, fundList] = await Promise.all([
        api.transactions.list(filterFund),
        api.funds.list(),
      ]);
      setTransactions(txns);
      setFunds(fundList);
      if (form.fund_id === 0 && fundList.length > 0) {
        setForm(f => ({ ...f, fund_id: fundList[0].id }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterFund]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fund_id || !form.quantity || !form.price) return;
    setSubmitting(true);
    try {
      await api.transactions.create(form);
      setShowForm(false);
      setForm({ fund_id: funds[0]?.id ?? 0, date: new Date().toISOString().split('T')[0], type: 'buy', quantity: 0, price: 0 });
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    await api.transactions.delete(id);
    await fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex items-center gap-3">
          <select
            value={filterFund ?? ''}
            onChange={e => setFilterFund(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All Funds</option>
            {funds.map(f => (
              <option key={f.id} value={f.id}>{f.ticker} — {f.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ Add Transaction'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Transaction</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fund</label>
              <select
                value={form.fund_id}
                onChange={e => setForm({ ...form, fund_id: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                {funds.map(f => (
                  <option key={f.id} value={f.id}>{f.ticker} — {f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as 'buy' | 'sell' })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={form.quantity || ''}
                onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. 50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per unit</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={form.price || ''}
                onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. 97.50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total ({currency(form.quantity * form.price)})</label>
              <input
                type="number"
                step="any"
                value={form.amount || ''}
                onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || undefined })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Auto-calculated"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Regular BPAY investment"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Transaction'}
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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">{shortDate(t.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{t.ticker}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${t.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{t.quantity}</td>
                  <td className="px-4 py-2.5 text-right">${t.price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{currency(Math.abs(t.amount))}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[150px] truncate">{t.notes || '-'}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Transactions;
