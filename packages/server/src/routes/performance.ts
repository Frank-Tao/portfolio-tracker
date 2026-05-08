import { Router } from 'express';
import db from '../db/connection.js';
import type { PerformanceMetrics, MonthlyReturn } from '@portfolio/shared';

const router = Router();

router.get('/', (_req, res) => {
  const metrics = calculatePerformance();
  res.json(metrics);
});

function calculatePerformance(): PerformanceMetrics {
  const priceDates = db.prepare('SELECT DISTINCT date FROM price_history ORDER BY date ASC').all() as any[];
  if (priceDates.length < 2) {
    return emptyMetrics();
  }

  const funds = db.prepare('SELECT id FROM funds').all() as any[];
  const allMonths = getMonthBoundaries(priceDates.map(p => p.date));

  const monthlyReturns: MonthlyReturn[] = [];
  let prevValue = 0;

  for (const month of allMonths) {
    const { startDate, endDate, label } = month;

    let startValue = 0;
    let endValue = 0;
    let netFlows = 0;

    for (const fund of funds) {
      const startQty = getQtyAtDate(fund.id, startDate);
      const endQty = getQtyAtDate(fund.id, endDate);

      const startPrice = getPriceAtDate(fund.id, startDate);
      const endPrice = getPriceAtDate(fund.id, endDate);

      startValue += startQty * startPrice;
      endValue += endQty * endPrice;

      const flows = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE fund_id = ? AND date > ? AND date <= ?
      `).get(fund.id, startDate, endDate) as any;
      netFlows += flows.total;
    }

    const cashFlowsInMonth = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_movements
      WHERE date > ? AND date <= ?
    `).get(startDate, endDate) as any;
    netFlows += cashFlowsInMonth.total;

    const denominator = startValue + netFlows / 2;
    const returnPct = denominator !== 0 ? (endValue - startValue - netFlows) / denominator : 0;

    monthlyReturns.push({
      month: label,
      start_value: startValue,
      end_value: endValue,
      net_flows: netFlows,
      return_pct: returnPct,
    });

    prevValue = endValue;
  }

  const validReturns = monthlyReturns.filter(m => m.start_value > 0 || m.end_value > 0);

  const twr = validReturns.reduce((acc, m) => acc * (1 + m.return_pct), 1) - 1;

  const years = validReturns.length / 12;
  const annualizedReturn = years > 0 ? Math.pow(1 + twr, 1 / years) - 1 : 0;

  const mwr = calculateXIRR(funds);

  let peak = 0;
  let maxDrawdown = 0;
  let runningValue = 1;
  for (const m of validReturns) {
    runningValue *= (1 + m.return_pct);
    if (runningValue > peak) peak = runningValue;
    const drawdown = peak > 0 ? (peak - runningValue) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const avgReturn = validReturns.length > 0
    ? validReturns.reduce((s, m) => s + m.return_pct, 0) / validReturns.length
    : 0;
  const variance = validReturns.length > 1
    ? validReturns.reduce((s, m) => s + Math.pow(m.return_pct - avgReturn, 2), 0) / (validReturns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const riskFreeRate = 0.035 / 12;
  const sharpeRatio = stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev * Math.sqrt(12) : null;

  const bestMonth = validReturns.length > 0
    ? validReturns.reduce((best, m) => m.return_pct > best.return_pct ? m : best)
    : null;
  const worstMonth = validReturns.length > 0
    ? validReturns.reduce((worst, m) => m.return_pct < worst.return_pct ? m : worst)
    : null;

  return {
    time_weighted_return: twr,
    money_weighted_return: mwr,
    annualized_return: annualizedReturn,
    sharpe_ratio: sharpeRatio,
    max_drawdown: maxDrawdown,
    best_month: bestMonth ? { date: bestMonth.month, return_pct: bestMonth.return_pct } : null,
    worst_month: worstMonth ? { date: worstMonth.month, return_pct: worstMonth.return_pct } : null,
    monthly_returns: monthlyReturns,
  };
}

function getQtyAtDate(fundId: number, date: string): number {
  const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = ? AND type = 'buy' AND date <= ?`).get(fundId, date) as any;
  const sellQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = ? AND type = 'sell' AND date <= ?`).get(fundId, date) as any;
  return buyQty.total - sellQty.total;
}

function getPriceAtDate(fundId: number, date: string): number {
  const price = db.prepare(`SELECT price FROM price_history WHERE fund_id = ? AND date <= ? ORDER BY date DESC LIMIT 1`).get(fundId, date) as any;
  return price?.price ?? 0;
}

function getMonthBoundaries(dates: string[]): { startDate: string; endDate: string; label: string }[] {
  if (dates.length === 0) return [];

  const first = dates[0];
  const last = dates[dates.length - 1];

  const start = new Date(first);
  const end = new Date(last);
  const months: { startDate: string; endDate: string; label: string }[] = [];

  const current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const lastDay = new Date(nextMonth.getTime() - 86400000);

    const startDate = current.toISOString().split('T')[0];
    const endDate = lastDay > end ? last : lastDay.toISOString().split('T')[0];
    const label = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

    months.push({ startDate, endDate, label });
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

function calculateXIRR(funds: any[]): number {
  const cashflows: { date: Date; amount: number }[] = [];

  const transactions = db.prepare('SELECT date, amount, type FROM transactions ORDER BY date').all() as any[];
  for (const t of transactions) {
    cashflows.push({
      date: new Date(t.date),
      amount: t.type === 'buy' ? -t.amount : t.amount,
    });
  }

  const cashMovements = db.prepare('SELECT date, amount FROM cash_movements ORDER BY date').all() as any[];
  for (const c of cashMovements) {
    cashflows.push({ date: new Date(c.date), amount: -c.amount });
  }

  const distributions = db.prepare('SELECT date, amount FROM distributions ORDER BY date').all() as any[];
  for (const d of distributions) {
    cashflows.push({ date: new Date(d.date), amount: d.amount });
  }

  let currentValue = 0;
  for (const fund of funds) {
    const qty = getQtyAtDate(fund.id, new Date().toISOString().split('T')[0]);
    const price = getPriceAtDate(fund.id, new Date().toISOString().split('T')[0]);
    currentValue += qty * price;
  }

  const cashBalance = (db.prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM cash_movements').get() as any).balance;
  currentValue += cashBalance;

  if (cashflows.length === 0 || currentValue === 0) return 0;

  cashflows.push({ date: new Date(), amount: currentValue });

  return xirr(cashflows);
}

function xirr(cashflows: { date: Date; amount: number }[]): number {
  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sorted[0].date;

  const npv = (rate: number): number => {
    return sorted.reduce((sum, cf) => {
      const years = (cf.date.getTime() - firstDate.getTime()) / (365.25 * 86400000);
      return sum + cf.amount / Math.pow(1 + rate, years);
    }, 0);
  };

  let low = -0.99;
  let high = 10;
  let mid = 0.1;

  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 0.01) break;
    if (val > 0) low = mid;
    else high = mid;
  }

  return mid;
}

function emptyMetrics(): PerformanceMetrics {
  return {
    time_weighted_return: 0,
    money_weighted_return: 0,
    annualized_return: 0,
    sharpe_ratio: null,
    max_drawdown: 0,
    best_month: null,
    worst_month: null,
    monthly_returns: [],
  };
}

export default router;
