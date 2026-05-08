import { Router } from 'express';
import db from '../db/connection.js';
import type { SnapshotDetail, SnapshotHolding } from '@portfolio/shared';

const router = Router();

router.get('/', (_req, res) => {
  const snapshots = db.prepare(`
    SELECT * FROM snapshots ORDER BY date DESC
  `).all();
  res.json(snapshots);
});

router.get('/:id', (req, res) => {
  const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(req.params.id) as any;
  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

  const holdings: SnapshotHolding[] = snapshot.snapshot_data
    ? JSON.parse(snapshot.snapshot_data)
    : [];

  const detail: SnapshotDetail = {
    id: snapshot.id,
    date: snapshot.date,
    total_value: snapshot.total_value,
    total_invested: snapshot.total_invested,
    cash_balance: snapshot.cash_balance,
    holdings,
    created_at: snapshot.created_at,
  };

  res.json(detail);
});

router.post('/take', (_req, res) => {
  const snapshot = takeSnapshot();
  res.status(201).json(snapshot);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM snapshots WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export function takeSnapshot() {
  const today = new Date().toISOString().split('T')[0];

  const funds = db.prepare('SELECT f.*, b.name as bucket_name FROM funds f LEFT JOIN buckets b ON f.bucket_id = b.id').all() as any[];
  const holdings: SnapshotHolding[] = [];
  let totalValue = 0;
  let totalInvested = 0;

  for (const f of funds) {
    const buyQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = ? AND type = 'buy'`).get(f.id) as any;
    const sellQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM transactions WHERE fund_id = ? AND type = 'sell'`).get(f.id) as any;
    const qty = buyQty.total - sellQty.total;
    if (qty <= 0) continue;

    const invested = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE fund_id = ?`).get(f.id) as any;
    const latestPrice = db.prepare(`SELECT price FROM price_history WHERE fund_id = ? ORDER BY date DESC LIMIT 1`).get(f.id) as any;
    const price = latestPrice?.price ?? 0;
    const value = qty * price;

    totalValue += value;
    totalInvested += invested.total;

    holdings.push({
      ticker: f.ticker,
      name: f.name,
      quantity: qty,
      price,
      value,
      bucket_name: f.bucket_name,
    });
  }

  const cashResult = db.prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM cash_movements').get() as any;

  const existing = db.prepare('SELECT id FROM snapshots WHERE date = ?').get(today) as any;
  if (existing) {
    db.prepare(`
      UPDATE snapshots SET total_value = ?, total_invested = ?, cash_balance = ?, snapshot_data = ?
      WHERE id = ?
    `).run(totalValue, totalInvested, cashResult.balance, JSON.stringify(holdings), existing.id);
    return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(existing.id);
  }

  const result = db.prepare(`
    INSERT INTO snapshots (date, total_value, total_invested, cash_balance, snapshot_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(today, totalValue, totalInvested, cashResult.balance, JSON.stringify(holdings));

  return db.prepare('SELECT * FROM snapshots WHERE id = ?').get(result.lastInsertRowid);
}

export default router;
