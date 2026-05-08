# Excel → Database Data Mapping

## Source File Structure
File: `vanguard-investment-tracker-2025-08-24.xlsx` (Vertex42 template)

## Per-Fund Sheets (VAF, VAP, VHY, VAS, VESG, VBND, VGS, VISM)

### Header Section (rows 1-20)
| Cell/Row | Content | Maps to |
|----------|---------|---------|
| Row 0, Col 0 | `Investment Tracker - [TICKER, FEE%] - NAME` | `funds.ticker`, `funds.expense_ratio`, `funds.name` |
| Row 2, Col 3-4 | "Total Invested: {value}" | Validation check |
| Row 2, Col 7-8 | "Gain (Loss): {value}" | Validation check |
| Row 2, Col 10-11 | "Annualized Return: {value}" | Validation (XIRR) |
| Row 3, Col 3-4 | "Total Value: {value}" | Validation check |

### Transaction Table (row 21 = header, row 22+ = data)
| Excel Column | Header | Maps to |
|--------------|--------|---------|
| Col 0 (A) | Date | `transactions.date` |
| Col 1 (B) | Market Price | `transactions.price` |
| Col 2 (C) | Invested QTY | `transactions.quantity` (positive=buy, negative=sell) |
| Col 3 (D) | Amount Invested | `transactions.amount` |
| Col 4 (E) | Market Value | Derived (skip) |
| Col 5 (F) | Total QTY | Derived — use for validation |
| Col 6 (G) | Total Invested | Derived — use for validation |
| Col 7 (H) | Total Gain (Loss) | Derived |
| Col 8 (I) | Total % Gain(Loss) | Derived |
| Col 9 (J) | Change in Gain(Loss) | Derived |
| Col 10 (K) | % Gain(Loss) This Period | Derived |
| Col 11 (L) | XIRR To-Date | Derived |
| Col 12 (M) | 6-Period XIRR | Derived |
| Col 13 (N) | Comments | `transactions.notes` |

### Distribution Table (right side, cols 17-19)
| Excel Column | Header | Maps to |
|--------------|--------|---------|
| Col 17 (R) | Date | `distributions.date` |
| Col 18 (S) | Amount | `distributions.amount` |
| Col 19 (T) | [label] | `distributions.label` |

### Import Logic for Transactions
```
For each data row (index 22+):
  - Skip if Date is NaN/empty
  - Skip if Invested QTY is NaN/0 (price-only observation row)
  - If QTY > 0 → type = 'buy'
  - If QTY < 0 → type = 'sell', amount is negative
  - Dedup key: (date, fund_ticker, quantity)
```

### Import Logic for Distributions
```
For each row in distribution section:
  - Skip if Date or Amount is NaN
  - If Amount < 0 or label = 'Sell' → skip (these are sale proceeds, not dividends)
  - Dedup key: (date, fund_ticker, amount)
```

## Summary Sheet

### Fund Summary Table (rows 3-13)
| Column | Content | Purpose |
|--------|---------|---------|
| Col 0 | Tab Name (ticker) | Link to fund |
| Col 1 | Total Invested | Validation |
| Col 2 | Total Value | Validation |
| Col 3 | Dividend | Total distributions received |
| Col 4 | Gain (Loss) | Validation |
| Col 5 | % Gain (Loss) | Validation |
| Col 6 | XIRR | Validation |

### Cash/Deposit History (cols 8-9, rows 3+)
| Column | Content | Maps to |
|--------|---------|---------|
| Col 8 (I) | Date | `cash_movements.date` |
| Col 9 (J) | Deposit amount | `cash_movements.amount` |

Negative values = withdrawals from brokerage account.

### Derived Summary Values (row 14-17)
| Row | Content | Purpose |
|-----|---------|---------|
| Row 14 | TOTAL (invested funds) | Portfolio invested total |
| Row 15 | Current Cash | Cash balance |
| Row 16 | Pending Dividends | Unreceived distributions |
| Row 17 | TOTAL (all-in) | Grand total including cash |

## Fund → Bucket Mapping

| Ticker | Full Name | Bucket |
|--------|-----------|--------|
| VAF | Australian Fixed Interest Index ETF | Australian Fixed Income |
| VAP | Australian Property Securities Index ETF | Australian Property |
| VHY | Australian Shares High Yield ETF | Australian Equities |
| VAS | Australian Shares Index ETF | Australian Equities |
| VESG | Ethically Conscious International Shares | International Equities |
| VBND | Global Aggregate Bond Index | Global Bonds |
| VGS | MSCI Index International Shares | International Equities |
| VISM | MSCI International Small Companies | International Small Cap |

## Validation Strategy
After import, verify:
1. Sum of transaction amounts per fund ≈ "Total Invested" from sheet header
2. Latest running total QTY matches current holdings
3. Cash movements sum ≈ "Current Cash" from Summary
4. Total distributions match Summary "Dividend" column
