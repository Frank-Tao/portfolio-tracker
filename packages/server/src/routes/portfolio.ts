import { Router } from 'express';
import db from '../db/connection.js';
import type { PortfolioSummary, BucketSummary, FundHolding, RebalanceAction } from '@portfolio/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/summary', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const funds = db.prepare(`
    SELECT f.*, b.name as bucket_name, b.color as bucket_color, b.id as bucket_id
    FROM funds f
    LEFT JOIN buckets b ON f.bucket_id = b.id AND b.user_id = f.user_id
    WHERE f.user_id = ?
  `).all(userId) as any[];

  const holdings: FundHolding[] = funds.map(f => {
    const buyQty = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'buy'
    `).get(userId, f.id) as any;
    const sellQty = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'sell'
    `).get(userId, f.id) as any;
    const totalInvested = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ?
    `).get(userId, f.id) as any;
    const totalDistributions = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM distributions WHERE user_id = ? AND fund_id = ?
    `).get(userId, f.id) as any;

    const latestPrice = db.prepare(`
      SELECT price FROM price_history WHERE user_id = ? AND fund_id = ? ORDER BY date DESC LIMIT 1
    `).get(userId, f.id) as any;

    const currentQty = buyQty.total - sellQty.total;
    const currentPrice = latestPrice?.price ?? null;
    const currentValue = currentPrice ? currentQty * currentPrice : null;
    const invested = totalInvested.total;
    const gainLoss = currentValue !== null ? currentValue - invested : null;
    const gainLossPct = invested !== 0 && gainLoss !== null ? gainLoss / Math.abs(invested) : null;

    return {
      ...f,
      current_qty: currentQty,
      avg_cost: currentQty > 0 ? invested / currentQty : 0,
      total_invested: invested,
      total_distributions: totalDistributions.total,
      current_price: currentPrice,
      current_value: currentValue,
      gain_loss: gainLoss,
      gain_loss_pct: gainLossPct,
    };
  });

  const activeHoldings = holdings.filter(h => h.current_qty > 0);
  const totalValue = activeHoldings.reduce((sum, h) => sum + (h.current_value ?? 0), 0);
  const totalInvested = activeHoldings.reduce((sum, h) => sum + h.total_invested, 0);

  const cashResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM cash_movements WHERE user_id = ?').get(userId) as any;
  const totalDistributions = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM distributions WHERE user_id = ?').get(userId) as any;
  const lastPriceUpdate = db.prepare('SELECT MAX(date) as last_date FROM price_history WHERE user_id = ?').get(userId) as any;

  const buckets = db.prepare('SELECT * FROM buckets WHERE user_id = ? ORDER BY name').all(userId) as any[];
  const activeProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ? AND is_active = 1').get(userId) as any;

  const bucketSummaries: BucketSummary[] = buckets.map(b => {
    const bucketFunds = activeHoldings.filter(h => h.bucket_id === b.id);
    const bucketValue = bucketFunds.reduce((sum, h) => sum + (h.current_value ?? 0), 0);
    const actualPct = totalValue > 0 ? bucketValue / totalValue : 0;

    let targetPct: number | null = null;
    if (activeProfile) {
      const alloc = db.prepare(`
        SELECT target_pct FROM profile_allocations WHERE user_id = ? AND profile_id = ? AND bucket_id = ?
      `).get(userId, activeProfile.id, b.id) as any;
      targetPct = alloc?.target_pct ?? 0;
    }

    return {
      ...b,
      total_value: bucketValue,
      actual_pct: actualPct,
      target_pct: targetPct,
      drift: targetPct !== null ? actualPct - targetPct : null,
      funds: bucketFunds,
    };
  });

  const summary: PortfolioSummary = {
    total_invested: totalInvested,
    total_value: totalValue,
    total_gain_loss: totalValue - totalInvested,
    total_gain_loss_pct: totalInvested !== 0 ? (totalValue - totalInvested) / totalInvested : 0,
    cash_balance: cashResult.balance,
    total_distributions: totalDistributions.total,
    grand_total: totalValue + cashResult.balance,
    buckets: bucketSummaries,
    last_price_update: lastPriceUpdate?.last_date ?? null,
  };

  res.json(summary);
});

router.get('/history', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const priceDates = db.prepare(`
    SELECT DISTINCT date FROM price_history WHERE user_id = ? ORDER BY date ASC
  `).all(userId) as any[];

  const txnDates = db.prepare(`
    SELECT DISTINCT date FROM transactions WHERE user_id = ? ORDER BY date ASC
  `).all(userId) as any[];

  const allDates = [...new Set([
    ...priceDates.map((p: any) => p.date),
    ...txnDates.map((t: any) => t.date),
  ])].sort();

  const funds = db.prepare('SELECT id, ticker, bucket_id FROM funds WHERE user_id = ?').all(userId) as any[];

  const history = allDates.map(date => {
    let totalValue = 0;
    let totalInvested = 0;

    for (const fund of funds) {
      const buyQty = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'buy' AND date <= ?
      `).get(userId, fund.id, date) as any;
      const sellQty = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'sell' AND date <= ?
      `).get(userId, fund.id, date) as any;
      const invested = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND date <= ?
      `).get(userId, fund.id, date) as any;

      const qty = buyQty.total - sellQty.total;
      if (qty <= 0) continue;

      const price = db.prepare(`
        SELECT price FROM price_history WHERE user_id = ? AND fund_id = ? AND date <= ? ORDER BY date DESC LIMIT 1
      `).get(userId, fund.id, date) as any;

      if (price) {
        totalValue += qty * price.price;
      }
      totalInvested += invested.total;
    }

    return {
      date,
      total_value: totalValue,
      total_invested: totalInvested,
      gain_loss: totalValue - totalInvested,
    };
  }).filter(h => h.total_value > 0);

  res.json(history);
});

router.get('/fund/:id/performance', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const fundId = req.params.id;

  const fund = db.prepare('SELECT * FROM funds WHERE id = ? AND user_id = ?').get(fundId, userId) as any;
  if (!fund) return res.status(404).json({ error: 'Fund not found' });

  const transactions = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? AND fund_id = ? ORDER BY date ASC
  `).all(userId, fundId) as any[];

  const distributions = db.prepare(`
    SELECT * FROM distributions WHERE user_id = ? AND fund_id = ? ORDER BY date ASC
  `).all(userId, fundId) as any[];

  const prices = db.prepare(`
    SELECT * FROM price_history WHERE user_id = ? AND fund_id = ? ORDER BY date ASC
  `).all(userId, fundId) as any[];

  const timeline = prices.map(p => {
    const buyQty = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'buy' AND date <= ?
    `).get(userId, fundId, p.date) as any;
    const sellQty = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'sell' AND date <= ?
    `).get(userId, fundId, p.date) as any;
    const invested = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND date <= ?
    `).get(userId, fundId, p.date) as any;
    const divsToDate = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM distributions WHERE user_id = ? AND fund_id = ? AND date <= ?
    `).get(userId, fundId, p.date) as any;

    const qty = buyQty.total - sellQty.total;
    const value = qty * p.price;
    const costBasis = invested.total;
    const totalReturn = value - costBasis + divsToDate.total;

    return {
      date: p.date,
      price: p.price,
      quantity: qty,
      market_value: value,
      cost_basis: costBasis,
      gain_loss: value - costBasis,
      distributions_to_date: divsToDate.total,
      total_return: totalReturn,
      total_return_pct: costBasis !== 0 ? totalReturn / Math.abs(costBasis) : 0,
    };
  });

  res.json({
    fund,
    transactions,
    distributions,
    timeline,
  });
});

router.get('/rebalance', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profileId = req.query.profile_id;
  const newCapital = parseFloat(req.query.new_capital as string) || 0;

  const profile = profileId
    ? db.prepare('SELECT * FROM profiles WHERE user_id = ? AND id = ?').get(userId, profileId) as any
    : db.prepare('SELECT * FROM profiles WHERE user_id = ? AND is_active = 1').get(userId) as any;

  if (!profile) {
    return res.status(400).json({ error: 'No profile selected or active' });
  }

  const allocations = db.prepare(`
    SELECT pa.*, b.name as bucket_name
    FROM profile_allocations pa
    JOIN buckets b ON pa.bucket_id = b.id AND b.user_id = pa.user_id
    WHERE pa.user_id = ? AND pa.profile_id = ?
  `).all(userId, profile.id) as any[];

  const funds = db.prepare('SELECT * FROM funds WHERE user_id = ?').all(userId) as any[];
  const bucketValues: Record<number, number> = {};

  for (const f of funds) {
    const buyQty = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'buy'
    `).get(userId, f.id) as any;
    const sellQty = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE user_id = ? AND fund_id = ? AND type = 'sell'
    `).get(userId, f.id) as any;
    const qty = buyQty.total - sellQty.total;
    if (qty <= 0) continue;

    const price = db.prepare(`
      SELECT price FROM price_history WHERE user_id = ? AND fund_id = ? ORDER BY date DESC LIMIT 1
    `).get(userId, f.id) as any;
    if (!price) continue;

    const value = qty * price.price;
    bucketValues[f.bucket_id] = (bucketValues[f.bucket_id] ?? 0) + value;
  }

  const totalCurrentValue = Object.values(bucketValues).reduce((a, b) => a + b, 0);
  const targetTotal = totalCurrentValue + newCapital;

  const actions: RebalanceAction[] = [];

  for (const alloc of allocations) {
    const currentValue = bucketValues[alloc.bucket_id] ?? 0;
    const targetValue = targetTotal * alloc.target_pct;
    const diff = targetValue - currentValue;

    if (Math.abs(diff) < 100) continue;

    const bucketFunds = funds.filter((f: any) => f.bucket_id === alloc.bucket_id);
    const tickerSuggestion = bucketFunds.map((f: any) => f.ticker).join('/') || 'N/A';

    actions.push({
      bucket_name: alloc.bucket_name,
      ticker_suggestion: tickerSuggestion,
      action: diff > 0 ? 'buy' : 'sell',
      amount: Math.abs(Math.round(diff)),
      reason: `Current: $${Math.round(currentValue)} (${((currentValue / totalCurrentValue) * 100).toFixed(1)}%) → Target: $${Math.round(targetValue)} (${(alloc.target_pct * 100).toFixed(1)}%)`,
    });
  }

  actions.sort((a, b) => b.amount - a.amount);

  res.json({ profile: profile.name, target_total: targetTotal, actions });
});

export default router;
