import { describe, it, expect } from 'vitest';

describe('CSV Export', () => {
  it('generates valid CSV from rows', () => {
    const rows = [
      { date: '2024-01-15', ticker: 'VAS', type: 'buy', quantity: 100, price: 90.0, amount: 9000 },
      { date: '2024-03-10', ticker: 'VGS', type: 'buy', quantity: 50, price: 100.0, amount: 5000 },
    ];
    const columns = ['date', 'ticker', 'type', 'quantity', 'price', 'amount'];
    const csv = toCsv(rows, columns);

    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,ticker,type,quantity,price,amount');
    expect(lines[1]).toBe('2024-01-15,VAS,buy,100,90,9000');
    expect(lines[2]).toBe('2024-03-10,VGS,buy,50,100,5000');
  });

  it('escapes commas in values', () => {
    const rows = [{ note: 'Buy order, regular' }];
    const csv = toCsv(rows, ['note']);
    expect(csv).toBe('note\n"Buy order, regular"');
  });

  it('escapes double quotes in values', () => {
    const rows = [{ note: 'The "best" fund' }];
    const csv = toCsv(rows, ['note']);
    expect(csv).toBe('note\n"The ""best"" fund"');
  });

  it('handles null values', () => {
    const rows = [{ a: 'hello', b: null, c: 42 }];
    const csv = toCsv(rows, ['a', 'b', 'c']);
    expect(csv).toBe('a,b,c\nhello,,42');
  });

  it('handles empty rows', () => {
    const csv = toCsv([], ['a', 'b']);
    expect(csv).toBe('a,b');
  });
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
