import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { currency, signedCurrency, signedPct, shortDate } from '../lib/format';
import { useGainLossColor } from '../lib/useGainLossColor';
import type { PortfolioSummary, FundHolding } from '@portfolio/shared';

function Holdings() {
  const { colorFor } = useGainLossColor();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.portfolio.summary().then(setSummary).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!summary) return null;

  const allFunds: (FundHolding & { bucket_name: string; bucket_color: string | null })[] = summary.buckets
    .flatMap(b => b.funds.map(f => ({ ...f, bucket_name: b.name, bucket_color: b.color })))
    .filter(f => f.current_qty > 0)
    .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Holdings</h1>
        {summary.last_price_update && (
          <p className="text-sm text-gray-500 mt-1">
            Prices as of <span className="font-medium">{shortDate(summary.last_price_update)}</span>
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b">
                <th className="px-4 py-3 font-medium">Fund</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Bucket</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Avg Cost</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Current Price</th>
                <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">Cost Basis</th>
                <th className="px-4 py-3 font-medium text-right">Market Value</th>
                <th className="px-4 py-3 font-medium text-right">Unrealised G/L</th>
                <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">Dividends</th>
                <th className="px-4 py-3 font-medium text-right hidden xl:table-cell">Total Return</th>
              </tr>
            </thead>
            <tbody>
              {allFunds.map(f => {
                const totalReturn = (f.gain_loss ?? 0) + (f.total_distributions ?? 0);
                const totalReturnPct = f.total_invested !== 0 ? totalReturn / Math.abs(f.total_invested) : 0;
                return (
                  <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/holdings/${f.id}`} className="font-medium text-blue-600 hover:underline">
                        {f.ticker}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5 max-w-[180px] truncate">{f.name}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.bucket_color ?? undefined }} />
                        <span className="text-gray-600 text-xs">{f.bucket_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{f.current_qty}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">${f.avg_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">${f.current_price?.toFixed(2) ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">{currency(f.total_invested)}</td>
                    <td className="px-4 py-3 text-right font-medium">{f.current_value ? currency(f.current_value) : '-'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${colorFor(f.gain_loss)}`}>
                      {f.gain_loss != null ? signedCurrency(f.gain_loss) : '-'}
                      {f.gain_loss_pct != null && <div className="text-xs">{signedPct(f.gain_loss_pct)}</div>}
                    </td>
                    <td className={`px-4 py-3 text-right hidden lg:table-cell ${colorFor(f.total_distributions ?? 0)}`}>
                      {currency(f.total_distributions ?? 0)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium hidden xl:table-cell ${colorFor(totalReturn)}`}>
                      {signedCurrency(totalReturn)}
                      <div className="text-xs">{signedPct(totalReturnPct)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t-2">
                <td className="px-4 py-3" colSpan={2}>Portfolio Total</td>
                <td className="px-4 py-3 hidden sm:table-cell"></td>
                <td className="px-4 py-3 hidden md:table-cell"></td>
                <td className="px-4 py-3 hidden md:table-cell"></td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{currency(summary.total_invested)}</td>
                <td className="px-4 py-3 text-right">{currency(summary.total_value)}</td>
                <td className={`px-4 py-3 text-right ${colorFor(summary.total_gain_loss)}`}>
                  {signedCurrency(summary.total_gain_loss)}
                  <div className="text-xs">{signedPct(summary.total_gain_loss_pct)}</div>
                </td>
                <td className={`px-4 py-3 text-right hidden lg:table-cell ${colorFor(summary.total_distributions)}`}>{currency(summary.total_distributions)}</td>
                <td className={`px-4 py-3 text-right hidden xl:table-cell ${colorFor(summary.total_gain_loss + summary.total_distributions)}`}>
                  {signedCurrency(summary.total_gain_loss + summary.total_distributions)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Holdings;
