import { Router } from 'express';
import db from '../db/connection.js';
import type { TaxReport } from '@portfolio/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/transactions', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { from, to, fund_id, format } = req.query;
  let sql = `
    SELECT t.*, f.ticker, f.name as fund_name
    FROM transactions t
    JOIN funds f ON t.fund_id = f.id AND f.user_id = t.user_id
    WHERE t.user_id = ?
  `;
  const params: any[] = [userId];

  if (fund_id) { sql += ' AND t.fund_id = ?'; params.push(fund_id); }
  if (from) { sql += ' AND t.date >= ?'; params.push(from); }
  if (to) { sql += ' AND t.date <= ?'; params.push(to); }
  sql += ' ORDER BY t.date DESC';

  const rows = db.prepare(sql).all(...params) as any[];

  if (format === 'csv') {
    const csv = toCsv(rows, ['date', 'ticker', 'fund_name', 'type', 'quantity', 'price', 'amount', 'notes']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    return res.send(csv);
  }

  res.json(rows);
});

router.get('/holdings', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { format } = req.query;
  const funds = db.prepare(`
    SELECT f.*, b.name as bucket_name
    FROM funds f
    LEFT JOIN buckets b ON f.bucket_id = b.id AND b.user_id = f.user_id
    WHERE f.user_id = ?
  `).all(userId) as any[];

  const holdings = funds.map(f => {
    const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'buy'`).get(userId, f.id) as any;
    const sellQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'sell'`).get(userId, f.id) as any;
    const qty = buyQty.total - sellQty.total;
    if (qty <= 0) return null;

    const invested = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ?`).get(userId, f.id) as any;
    const latestPrice = db.prepare(`SELECT price FROM price_history WHERE user_id = ? AND fund_id = ? ORDER BY date DESC LIMIT 1`).get(userId, f.id) as any;
    const price = latestPrice?.price ?? 0;
    const value = qty * price;

    return {
      ticker: f.ticker,
      name: f.name,
      bucket: f.bucket_name,
      quantity: qty,
      avg_cost: invested.total / qty,
      current_price: price,
      cost_basis: invested.total,
      market_value: value,
      unrealised_gain: value - invested.total,
      unrealised_gain_pct: invested.total !== 0 ? (value - invested.total) / invested.total : 0,
    };
  }).filter(Boolean);

  if (format === 'csv') {
    const csv = toCsv(holdings as any[], ['ticker', 'name', 'bucket', 'quantity', 'avg_cost', 'current_price', 'cost_basis', 'market_value', 'unrealised_gain', 'unrealised_gain_pct']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="holdings.csv"');
    return res.send(csv);
  }

  res.json(holdings);
});

router.get('/tax', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { year, format } = req.query;

  const fy = parseInt(year as string) || new Date().getFullYear();
  const fyStart = `${fy - 1}-07-01`;
  const fyEnd = `${fy}-06-30`;

  const distributions = db.prepare(`
    SELECT d.amount, d.date, f.ticker, f.name
    FROM distributions d
    JOIN funds f ON d.fund_id = f.id AND f.user_id = d.user_id
    WHERE d.user_id = ? AND d.date >= ? AND d.date <= ?
    ORDER BY d.date
  `).all(userId, fyStart, fyEnd) as any[];

  const totalDistributions = distributions.reduce((s: number, d: any) => s + d.amount, 0);

  const distByFund = new Map<string, { ticker: string; name: string; total: number }>();
  for (const d of distributions) {
    const existing = distByFund.get(d.ticker) || { ticker: d.ticker, name: d.name, total: 0 };
    existing.total += d.amount;
    distByFund.set(d.ticker, existing);
  }

  const sells = db.prepare(`
    SELECT t.*, f.ticker
    FROM transactions t
    JOIN funds f ON t.fund_id = f.id AND f.user_id = t.user_id
    WHERE t.user_id = ? AND t.type = 'sell' AND t.date >= ? AND t.date <= ?
    ORDER BY t.date
  `).all(userId, fyStart, fyEnd) as any[];

  let realizedGains = 0;
  let realizedLosses = 0;

  for (const sell of sells) {
    const avgCostResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_cost, COALESCE(SUM(quantity), 0) as total_qty
      FROM transactions
      WHERE user_id = ? AND fund_id = ? AND type = 'buy' AND date <= ?
    `).get(userId, sell.fund_id, sell.date) as any;

    const avgCost = avgCostResult.total_qty > 0 ? avgCostResult.total_cost / avgCostResult.total_qty : 0;
    const costBasis = avgCost * sell.quantity;
    const proceeds = sell.quantity * sell.price;
    const gain = proceeds - costBasis;

    if (gain >= 0) realizedGains += gain;
    else realizedLosses += Math.abs(gain);
  }

  const report: TaxReport = {
    financial_year: `FY${fy - 1}/${fy}`,
    total_distributions: totalDistributions,
    realized_gains: realizedGains,
    realized_losses: realizedLosses,
    net_capital_gain: realizedGains - realizedLosses,
    distributions_by_fund: Array.from(distByFund.values()),
  };

  if (format === 'csv') {
    const rows = [
      { item: 'Financial Year', value: report.financial_year },
      { item: 'Total Distributions', value: report.total_distributions },
      { item: 'Realized Gains', value: report.realized_gains },
      { item: 'Realized Losses', value: report.realized_losses },
      { item: 'Net Capital Gain', value: report.net_capital_gain },
      ...report.distributions_by_fund.map(d => ({
        item: `Distribution - ${d.ticker}`,
        value: d.total,
      })),
    ];
    const csv = toCsv(rows, ['item', 'value']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tax-report-fy${fy}.csv"`);
    return res.send(csv);
  }

  res.json(report);
});

function toCsv(rows: Record<string, any>[], columns: string[]): string {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col];
      if (val == null) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

export default router;
