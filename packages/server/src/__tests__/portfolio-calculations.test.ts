import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf-8');
  db.exec(schema);
  return db;
}

function seedTestData(db: Database.Database) {
  db.exec(`
    INSERT INTO buckets (id, name, color) VALUES (1, 'Australian Equities', '#F59E0B');
    INSERT INTO funds (id, ticker, name, expense_ratio, bucket_id) VALUES (1, 'VAS', 'Vanguard Australian Shares', 0.0007, 1);
    INSERT INTO funds (id, ticker, name, expense_ratio, bucket_id) VALUES (2, 'VGS', 'Vanguard International Shares', 0.0018, 1);

    INSERT INTO transactions (fund_id, date, type, quantity, price, amount) VALUES (1, '2024-01-15', 'buy', 100, 90.00, 9000);
    INSERT INTO transactions (fund_id, date, type, quantity, price, amount) VALUES (1, '2024-03-10', 'buy', 50, 92.00, 4600);
    INSERT INTO transactions (fund_id, date, type, quantity, price, amount) VALUES (2, '2024-02-01', 'buy', 80, 100.00, 8000);

    INSERT INTO price_history (fund_id, date, price, source) VALUES (1, '2024-01-15', 90.00, 'test');
    INSERT INTO price_history (fund_id, date, price, source) VALUES (1, '2024-03-10', 92.00, 'test');
    INSERT INTO price_history (fund_id, date, price, source) VALUES (1, '2024-06-01', 95.00, 'test');
    INSERT INTO price_history (fund_id, date, price, source) VALUES (2, '2024-02-01', 100.00, 'test');
    INSERT INTO price_history (fund_id, date, price, source) VALUES (2, '2024-06-01', 108.00, 'test');

    INSERT INTO distributions (fund_id, date, amount, label) VALUES (1, '2024-03-30', 150.00, 'Q1 Distribution');
    INSERT INTO distributions (fund_id, date, amount, label) VALUES (2, '2024-03-30', 120.00, 'Q1 Distribution');

    INSERT INTO cash_movements (date, amount, notes) VALUES ('2024-01-01', 50000, 'Initial deposit');
  `);
}

describe('Portfolio Calculations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Holdings quantity', () => {
    it('calculates net quantity from buys and sells', () => {
      const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = 1 AND type = 'buy'`).get() as any;
      const sellQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = 1 AND type = 'sell'`).get() as any;
      expect(buyQty.total - sellQty.total).toBe(150);
    });

    it('handles sells correctly', () => {
      db.exec(`INSERT INTO transactions (fund_id, date, type, quantity, price, amount) VALUES (1, '2024-04-01', 'sell', 30, 94.00, 2820)`);

      const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = 1 AND type = 'buy'`).get() as any;
      const sellQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = 1 AND type = 'sell'`).get() as any;
      expect(buyQty.total - sellQty.total).toBe(120);
    });
  });

  describe('Average cost', () => {
    it('calculates weighted average cost', () => {
      const invested = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE fund_id = 1`).get() as any;
      const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = 1 AND type = 'buy'`).get() as any;

      const avgCost = invested.total / buyQty.total;
      expect(avgCost).toBeCloseTo(90.67, 1);
    });
  });

  describe('Gain/Loss', () => {
    it('calculates unrealised gain/loss correctly', () => {
      const invested = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE fund_id = 1`).get() as any;
      const qty = 150;
      const currentPrice = 95.0;
      const currentValue = qty * currentPrice;
      const gainLoss = currentValue - invested.total;

      expect(currentValue).toBe(14250);
      expect(invested.total).toBe(13600);
      expect(gainLoss).toBe(650);
    });

    it('calculates gain/loss percentage', () => {
      const invested = 13600;
      const currentValue = 14250;
      const gainLossPct = (currentValue - invested) / invested;
      expect(gainLossPct).toBeCloseTo(0.0478, 3);
    });
  });

  describe('Cash balance', () => {
    it('calculates total cash from movements', () => {
      const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM cash_movements').get() as any;
      expect(result.balance).toBe(50000);
    });

    it('handles deposits and withdrawals', () => {
      db.exec(`INSERT INTO cash_movements (date, amount, notes) VALUES ('2024-02-01', -9000, 'Buy VAS')`);
      const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM cash_movements').get() as any;
      expect(result.balance).toBe(41000);
    });
  });

  describe('Distributions', () => {
    it('calculates total distributions', () => {
      const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM distributions').get() as any;
      expect(result.total).toBe(270);
    });

    it('calculates per-fund distributions', () => {
      const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM distributions WHERE fund_id = 1').get() as any;
      expect(result.total).toBe(150);
    });
  });

  describe('Price history', () => {
    it('gets latest price for a fund', () => {
      const result = db.prepare('SELECT price FROM price_history WHERE fund_id = 1 ORDER BY date DESC LIMIT 1').get() as any;
      expect(result.price).toBe(95);
    });

    it('gets price at a specific date', () => {
      const result = db.prepare('SELECT price FROM price_history WHERE fund_id = 1 AND date <= ? ORDER BY date DESC LIMIT 1').get('2024-02-01') as any;
      expect(result.price).toBe(90);
    });
  });

  describe('Portfolio totals', () => {
    it('calculates total portfolio value', () => {
      const funds = db.prepare('SELECT id FROM funds').all() as any[];
      let totalValue = 0;

      for (const fund of funds) {
        const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = ? AND type = 'buy'`).get(fund.id) as any;
        const sellQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = ? AND type = 'sell'`).get(fund.id) as any;
        const qty = buyQty.total - sellQty.total;

        const price = db.prepare('SELECT price FROM price_history WHERE fund_id = ? ORDER BY date DESC LIMIT 1').get(fund.id) as any;
        totalValue += qty * (price?.price ?? 0);
      }

      // VAS: 150 * 95 = 14250, VGS: 80 * 108 = 8640
      expect(totalValue).toBe(22890);
    });

    it('calculates grand total (holdings + cash)', () => {
      const cash = db.prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM cash_movements').get() as any;
      const portfolioValue = 22890;
      expect(portfolioValue + cash.balance).toBe(72890);
    });
  });
});

describe('XIRR Calculation', () => {
  it('calculates basic IRR for simple cashflows', () => {
    const cashflows = [
      { date: new Date('2024-01-01'), amount: -10000 },
      { date: new Date('2025-01-01'), amount: 11000 },
    ];

    const result = xirr(cashflows);
    expect(result).toBeCloseTo(0.1, 1);
  });

  it('handles multiple cashflows', () => {
    const cashflows = [
      { date: new Date('2024-01-01'), amount: -5000 },
      { date: new Date('2024-06-01'), amount: -5000 },
      { date: new Date('2025-01-01'), amount: 11500 },
    ];

    const result = xirr(cashflows);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.5);
  });
});

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
