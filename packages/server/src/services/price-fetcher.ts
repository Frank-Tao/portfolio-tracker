import db from '../db/connection.js';

async function fetchASXPrice(ticker: string): Promise<number | null> {
  const symbol = `${ticker}.AX`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json() as any;
  const meta = data?.chart?.result?.[0]?.meta;
  if (meta?.regularMarketPrice) {
    return meta.regularMarketPrice;
  }
  return null;
}

async function fetchASXHistoricalPrices(
  ticker: string,
  fromDate: Date,
  toDate: Date
): Promise<{ date: string; close: number }[]> {
  const symbol = `${ticker}.AX`;
  const period1 = Math.floor(fromDate.getTime() / 1000);
  const period2 = Math.floor(toDate.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json() as any;
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const prices: { date: string; close: number }[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    const d = new Date(timestamps[i] * 1000);
    const dateStr = d.toISOString().split('T')[0];
    prices.push({ date: dateStr, close });
  }

  return prices;
}

export async function refreshPrices(userId: number): Promise<{ updated: string[]; errors: string[] }> {
  const funds = db.prepare('SELECT * FROM funds WHERE user_id = ?').all(userId) as any[];
  const updated: string[] = [];
  const errors: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  const existing = db.prepare(
    'SELECT fund_id FROM price_history WHERE user_id = ? AND date = ?'
  ).all(userId, today) as any[];
  const alreadyFetched = new Set(existing.map((e: any) => e.fund_id));

  for (const fund of funds) {
    if (alreadyFetched.has(fund.id)) {
      updated.push(`${fund.ticker} (cached)`);
      continue;
    }

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const price = await fetchASXPrice(fund.ticker);
        if (price) {
          db.prepare(`
            INSERT OR REPLACE INTO price_history (user_id, fund_id, date, price, source)
            VALUES (?, ?, ?, ?, 'yahoo')
          `).run(userId, fund.id, today, price);
          updated.push(`${fund.ticker}: $${price.toFixed(2)}`);
          success = true;
        } else {
          errors.push(`${fund.ticker}: no price data`);
          break;
        }
      } catch (err: any) {
        retries--;
        if (retries > 0) {
          const delay = (4 - retries) * 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          errors.push(`${fund.ticker}: ${err.message}`);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return { updated, errors };
}

export async function refreshHistoricalMonthEnd(userId: number): Promise<{
  updated: { ticker: string; months_added: number }[];
  errors: string[];
}> {
  const funds = db.prepare('SELECT * FROM funds WHERE user_id = ?').all(userId) as any[];
  const updated: { ticker: string; months_added: number }[] = [];
  const errors: string[] = [];

  const firstTxn = db.prepare('SELECT MIN(date) as first_date FROM transactions WHERE user_id = ?').get(userId) as any;
  if (!firstTxn?.first_date) {
    return { updated, errors: ['No transactions found'] };
  }

  const today = new Date();

  for (const fund of funds) {
    const fundFirstTxn = db.prepare(
      'SELECT MIN(date) as first_date FROM transactions WHERE user_id = ? AND fund_id = ?'
    ).get(userId, fund.id) as any;
    if (!fundFirstTxn?.first_date) continue;

    const monthEnds = getMonthEnds(new Date(fundFirstTxn.first_date), today);

    const existingDates = new Set(
      (db.prepare('SELECT date FROM price_history WHERE user_id = ? AND fund_id = ?').all(userId, fund.id) as any[])
        .map((r: any) => r.date)
    );

    const missingMonthEnds = monthEnds.filter(d => !existingDates.has(d));
    if (missingMonthEnds.length === 0) {
      updated.push({ ticker: fund.ticker, months_added: 0 });
      continue;
    }

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const from = new Date(missingMonthEnds[0]);
        from.setDate(from.getDate() - 5);
        const to = new Date(missingMonthEnds[missingMonthEnds.length - 1]);
        to.setDate(to.getDate() + 5);

        const historicalPrices = await fetchASXHistoricalPrices(fund.ticker, from, to);

        if (historicalPrices.length === 0) {
          errors.push(`${fund.ticker}: no historical data returned`);
          break;
        }

        const insert = db.prepare(`
          INSERT OR IGNORE INTO price_history (user_id, fund_id, date, price, source)
          VALUES (?, ?, ?, ?, 'yahoo-historical')
        `);

        let added = 0;
        for (const monthEnd of missingMonthEnds) {
          const price = findClosestPrice(historicalPrices, monthEnd);
          if (price) {
            insert.run(userId, fund.id, monthEnd, price);
            added++;
          }
        }

        updated.push({ ticker: fund.ticker, months_added: added });
        success = true;
      } catch (err: any) {
        retries--;
        if (retries > 0) {
          const delay = (4 - retries) * 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          errors.push(`${fund.ticker}: ${err.message}`);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return { updated, errors };
}

function getMonthEnds(from: Date, to: Date): string[] {
  const ends: string[] = [];
  const current = new Date(from.getFullYear(), from.getMonth() + 1, 0);

  while (current < to) {
    const day = current.getDay();
    const lastBusinessDay = new Date(current);
    if (day === 0) lastBusinessDay.setDate(lastBusinessDay.getDate() - 2);
    else if (day === 6) lastBusinessDay.setDate(lastBusinessDay.getDate() - 1);

    ends.push(lastBusinessDay.toISOString().split('T')[0]);
    current.setMonth(current.getMonth() + 1);
    current.setDate(0);
    current.setMonth(current.getMonth() + 1);
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    current.setTime(nextMonth.getTime());
  }

  return ends;
}

function findClosestPrice(
  prices: { date: string; close: number }[],
  targetDate: string
): number | null {
  const target = new Date(targetDate).getTime();
  let closest: { date: string; close: number } | null = null;
  let minDiff = Infinity;

  for (const p of prices) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < minDiff && diff <= 5 * 86400000) {
      minDiff = diff;
      closest = p;
    }
  }

  return closest?.close ?? null;
}

export async function manualPriceUpdate(userId: number, ticker: string, price: number, date?: string): Promise<void> {
  const fund = db.prepare('SELECT id FROM funds WHERE ticker = ? AND user_id = ?').get(ticker.toUpperCase(), userId) as any;
  if (!fund) throw new Error(`Fund ${ticker} not found`);

  const priceDate = date || new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT OR REPLACE INTO price_history (user_id, fund_id, date, price, source)
    VALUES (?, ?, ?, ?, 'manual')
  `).run(userId, fund.id, priceDate, price);
}
