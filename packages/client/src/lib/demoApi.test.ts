import { describe, expect, it } from 'vitest';
import { createDemoApiFromData } from './demoApi';

const baseData = {
  buckets: [{ id: 1, name: 'Growth', color: '#2563eb' }],
  funds: [{ id: 1, ticker: 'VAS', name: 'Vanguard Australian Shares', expense_ratio: 0.0007, bucket_id: 1, created_at: '2026-01-01' }],
  transactions: [
    { id: 1, fund_id: 1, date: '2026-01-01', type: 'buy', quantity: 10, price: 100, amount: 1000, notes: null, created_at: '2026-01-01' },
  ],
  distributions: [{ id: 1, fund_id: 1, date: '2026-02-01', amount: 25, label: 'Dividend', created_at: '2026-02-01' }],
  cash_movements: [{ id: 1, date: '2026-01-01', type: 'deposit', amount: 500, notes: null, related_fund_id: null, created_at: '2026-01-01' }],
  price_history: [{ id: 1, fund_id: 1, date: '2026-03-01', price: 120, source: 'demo' }],
  profiles: [{ id: 1, name: 'Balanced', description: null, is_active: 1, created_at: '2026-01-01' }],
  profile_allocations: [{ id: 1, profile_id: 1, bucket_id: 1, target_pct: 1 }],
  snapshots: [],
  users: [{ id: 1, email: 'demo@portfolio.local', name: 'Demo User' }],
  auth_tokens: [],
  sessions: [],
};

describe('createDemoApiFromData', () => {
  it('builds a portfolio summary from local JSON demo data', async () => {
    const demo = createDemoApiFromData(baseData as any);

    const summary = await demo.portfolio.summary();

    expect(summary.total_invested).toBe(1000);
    expect(summary.total_value).toBe(1200);
    expect(summary.total_gain_loss).toBe(200);
    expect(summary.total_distributions).toBe(25);
    expect(summary.cash_balance).toBe(500);
    expect(summary.buckets[0].funds[0].ticker).toBe('VAS');
  });

  it('never exposes auth tokens from the local JSON demo data', async () => {
    const demo = createDemoApiFromData({ ...baseData, auth_tokens: [{ token: '123456' }] } as any);

    const user = await demo.auth.me();

    expect(user.user.email).toBe('demo@portfolio.local');
    expect(JSON.stringify(user)).not.toContain('123456');
  });
});
