import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import db from '../db/connection.js';
import type { ImportResult } from '@portfolio/shared';

const SKIP_SHEETS = ['Summary', 'Trend', 'Help', '©'];
const TRANSACTION_DATA_START = 21;

const FUND_NAMES: Record<string, string> = {
  VAF: 'Australian Fixed Interest Index ETF',
  VAP: 'Australian Property Securities Index ETF',
  VHY: 'Australian Shares High Yield ETF',
  VAS: 'Australian Shares Index ETF',
  VESG: 'Ethically Conscious International Shares ETF',
  VBND: 'Global Aggregate Bond Index ETF',
  VGS: 'MSCI Index International Shares ETF',
  VISM: 'MSCI International Small Companies ETF',
  VDHG: 'Diversified High Growth Index ETF',
  VAE: 'FTSE Asia ex Japan Shares Index ETF',
  V500: 'S&P 500 ETF',
  'Cash Fund': 'Vanguard Cash Plus Fund',
};

export function importExcelFile(userId: number, filePath: string): ImportResult {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const result: ImportResult = {
    transactions_added: 0,
    distributions_added: 0,
    cash_movements_added: 0,
    duplicates_skipped: 0,
    errors: [],
  };

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.includes(sheetName)) continue;

    const fundId = getOrCreateFund(userId, sheetName);
    if (!fundId) {
      result.errors.push(`Could not resolve fund for sheet "${sheetName}"`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

    importTransactions(userId, data, fundId, sheetName, result);
    importDistributions(userId, data, fundId, sheetName, result);
  }

  if (workbook.SheetNames.includes('Summary')) {
    const summarySheet = workbook.Sheets['Summary'];
    const summaryData = XLSX.utils.sheet_to_json(summarySheet, { header: 1, defval: null }) as any[][];
    importCashMovements(userId, summaryData, result);
  }

  return result;
}

function getOrCreateFund(userId: number, sheetName: string): number | null {
  const ticker = sheetName.toUpperCase().replace(/\s+/g, '');

  const existing = db.prepare('SELECT id FROM funds WHERE ticker = ? AND user_id = ?').get(ticker, userId) as any;
  if (existing) return existing.id;

  const name = FUND_NAMES[sheetName] || FUND_NAMES[ticker] || `Vanguard ${sheetName}`;

  try {
    const result = db.prepare(`
      INSERT INTO funds (user_id, ticker, name, expense_ratio, bucket_id)
      VALUES (?, ?, ?, NULL, NULL)
    `).run(userId, ticker, name);
    return result.lastInsertRowid as number;
  } catch {
    const retry = db.prepare('SELECT id FROM funds WHERE ticker = ? AND user_id = ?').get(ticker, userId) as any;
    return retry?.id ?? null;
  }
}

function importTransactions(userId: number, data: any[][], fundId: number, ticker: string, result: ImportResult): void {
  const checkDup = db.prepare(`
    SELECT id FROM transactions WHERE user_id = ? AND fund_id = ? AND date = ? AND quantity = ?
  `);
  const insert = db.prepare(`
    INSERT INTO transactions (user_id, fund_id, date, type, quantity, price, amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPrice = db.prepare(`
    INSERT OR IGNORE INTO price_history (user_id, fund_id, date, price, source)
    VALUES (?, ?, ?, ?, 'excel')
  `);
  const insertCash = db.prepare(`
    INSERT INTO cash_movements (user_id, date, type, amount, notes, related_fund_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const checkCashDup = db.prepare(`
    SELECT id FROM cash_movements WHERE user_id = ? AND date = ? AND amount = ? AND related_fund_id = ? AND type = ?
  `);

  for (let i = TRANSACTION_DATA_START; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const date = parseDate(row[0]);
    if (!date) continue;

    const price = parseFloat(row[1]);
    if (!isNaN(price) && price > 0) {
      insertPrice.run(userId, fundId, date, price);
    }

    const qty = parseFloat(row[2]);
    if (isNaN(qty) || qty === 0) continue;

    const amount = row[3] != null ? parseFloat(row[3]) : qty * price;
    if (isNaN(price) || isNaN(amount)) continue;

    const type = qty > 0 ? 'buy' : 'sell';
    const absQty = Math.abs(qty);

    const existing = checkDup.get(userId, fundId, date, absQty);
    if (existing) {
      result.duplicates_skipped++;
      continue;
    }

    try {
      insert.run(userId, fundId, date, type, absQty, price, amount, row[13] ?? null);
      result.transactions_added++;

      const cashType = type === 'buy' ? 'buy' : 'sell';
      const cashAmount = type === 'buy' ? -Math.abs(amount) : Math.abs(amount);
      const cashNote = `${type === 'buy' ? 'Buy' : 'Sell'} ${absQty} ${ticker} @ $${price.toFixed(2)}`;

      const existingCash = checkCashDup.get(userId, date, cashAmount, fundId, cashType);
      if (!existingCash) {
        insertCash.run(userId, date, cashType, cashAmount, cashNote, fundId);
      }
    } catch (err: any) {
      result.errors.push(`Transaction row ${i}: ${err.message}`);
    }
  }
}

function importDistributions(userId: number, data: any[][], fundId: number, ticker: string, result: ImportResult): void {
  const checkDup = db.prepare(`
    SELECT id FROM distributions WHERE user_id = ? AND fund_id = ? AND date = ? AND amount = ?
  `);
  const insert = db.prepare(`
    INSERT INTO distributions (user_id, fund_id, date, amount, label)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertCash = db.prepare(`
    INSERT INTO cash_movements (user_id, date, type, amount, notes, related_fund_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const checkCashDup = db.prepare(`
    SELECT id FROM cash_movements WHERE user_id = ? AND date = ? AND amount = ? AND related_fund_id = ? AND type = 'dividend'
  `);

  for (let i = TRANSACTION_DATA_START; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[17]) continue;

    const date = parseDate(row[17]);
    if (!date) continue;

    const amount = parseFloat(row[18]);
    if (isNaN(amount)) continue;

    const label = row[19] ?? null;

    if (amount < 0 || (label && label.toString().toLowerCase() === 'sell')) {
      continue;
    }

    const existing = checkDup.get(userId, fundId, date, amount);
    if (existing) {
      result.duplicates_skipped++;
      continue;
    }

    try {
      insert.run(userId, fundId, date, amount, label);
      result.distributions_added++;

      const cashNote = `Dividend from ${ticker}: $${amount.toFixed(2)}`;
      const existingCash = checkCashDup.get(userId, date, amount, fundId);
      if (!existingCash) {
        insertCash.run(userId, date, 'dividend', amount, cashNote, fundId);
      }
    } catch (err: any) {
      result.errors.push(`Distribution row ${i}: ${err.message}`);
    }
  }
}

function importCashMovements(userId: number, data: any[][], result: ImportResult): void {
  const checkDup = db.prepare(`
    SELECT id FROM cash_movements WHERE user_id = ? AND date = ? AND amount = ? AND type IN ('deposit', 'withdrawal')
  `);
  const insert = db.prepare(`
    INSERT INTO cash_movements (user_id, date, type, amount, notes, related_fund_id)
    VALUES (?, ?, ?, ?, ?, NULL)
  `);

  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[8] || row[9] == null) continue;

    const date = parseDate(row[8]);
    if (!date) continue;

    const amount = parseFloat(row[9]);
    if (isNaN(amount)) continue;

    const existing = checkDup.get(userId, date, amount);
    if (existing) {
      result.duplicates_skipped++;
      continue;
    }

    const type = amount >= 0 ? 'deposit' : 'withdrawal';

    try {
      insert.run(userId, date, type, amount, null);
      result.cash_movements_added++;
    } catch (err: any) {
      result.errors.push(`Cash movement row ${i}: ${err.message}`);
    }
  }
}

function parseDate(value: any): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'string') {
    const parts = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (parts) {
      return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  if (typeof value === 'number') {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + value * 86400000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}
