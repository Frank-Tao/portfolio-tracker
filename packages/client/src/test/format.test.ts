import { describe, it, expect } from 'vitest';
import { currency, pct, signedCurrency, signedPct, shortDate } from '../lib/format';

describe('format utilities', () => {
  describe('currency', () => {
    it('formats positive values', () => {
      expect(currency(1234)).toBe('$1,234');
    });

    it('formats with decimals', () => {
      expect(currency(1234.56, 2)).toBe('$1,234.56');
    });

    it('formats negative values', () => {
      expect(currency(-500)).toBe('-$500');
    });

    it('formats zero', () => {
      expect(currency(0)).toBe('$0');
    });

    it('formats large numbers with commas', () => {
      expect(currency(1000000)).toBe('$1,000,000');
    });
  });

  describe('pct', () => {
    it('converts decimal to percentage string', () => {
      expect(pct(0.15)).toBe('15.0%');
    });

    it('handles custom decimals', () => {
      expect(pct(0.1567, 2)).toBe('15.67%');
    });

    it('handles zero', () => {
      expect(pct(0)).toBe('0.0%');
    });

    it('handles values over 100%', () => {
      expect(pct(1.5)).toBe('150.0%');
    });
  });

  describe('signedCurrency', () => {
    it('adds + prefix for positive values', () => {
      expect(signedCurrency(100)).toBe('+$100');
    });

    it('shows - for negative values', () => {
      expect(signedCurrency(-100)).toBe('-$100');
    });

    it('shows +$0 for zero', () => {
      expect(signedCurrency(0)).toBe('+$0');
    });
  });

  describe('signedPct', () => {
    it('adds + prefix for positive percentages', () => {
      expect(signedPct(0.05)).toBe('+5.0%');
    });

    it('shows - for negative percentages', () => {
      expect(signedPct(-0.05)).toBe('-5.0%');
    });
  });

  describe('shortDate', () => {
    it('formats ISO date string', () => {
      const result = shortDate('2024-06-15');
      expect(result).toMatch(/15/);
      expect(result).toMatch(/Jun/);
    });
  });
});
