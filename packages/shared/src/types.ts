export interface Fund {
  id: number;
  ticker: string;
  name: string;
  expense_ratio: number | null;
  bucket_id: number | null;
  created_at: string;
}

export interface Bucket {
  id: number;
  name: string;
  color: string | null;
}

export interface Transaction {
  id: number;
  fund_id: number;
  date: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface Distribution {
  id: number;
  fund_id: number;
  date: string;
  amount: number;
  label: string | null;
  created_at: string;
}

export type CashMovementType = 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend' | 'fee' | 'other';

export interface CashMovement {
  id: number;
  date: string;
  type: CashMovementType;
  amount: number;
  notes: string | null;
  related_fund_id: number | null;
  created_at: string;
}

export interface CashSummary {
  balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_dividends: number;
  total_buys: number;
  total_sells: number;
  movements: (CashMovement & { ticker?: string })[];
}

export interface PriceRecord {
  id: number;
  fund_id: number;
  date: string;
  price: number;
  source: string;
}

export interface Profile {
  id: number;
  name: string;
  description: string | null;
  is_active: number;
  created_at: string;
}

export interface ProfileAllocation {
  id: number;
  profile_id: number;
  bucket_id: number;
  target_pct: number;
}

export interface Snapshot {
  id: number;
  date: string;
  total_value: number;
  total_invested: number;
  cash_balance: number;
  snapshot_data: string | null;
  created_at: string;
}

// API response types
export interface FundHolding extends Fund {
  bucket_name: string | null;
  bucket_color?: string | null;
  current_qty: number;
  avg_cost: number;
  total_invested: number;
  total_distributions?: number;
  current_price: number | null;
  current_value: number | null;
  gain_loss: number | null;
  gain_loss_pct: number | null;
}

export interface BucketSummary extends Bucket {
  total_value: number;
  actual_pct: number;
  target_pct: number | null;
  drift: number | null;
  funds: FundHolding[];
}

export interface PortfolioSummary {
  total_invested: number;
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
  cash_balance: number;
  total_distributions: number;
  grand_total: number;
  buckets: BucketSummary[];
  last_price_update: string | null;
}

export interface RebalanceAction {
  bucket_name: string;
  ticker_suggestion: string;
  action: 'buy' | 'sell';
  amount: number;
  reason: string;
}

export interface RebalanceResult {
  profile: string;
  target_total: number;
  actions: RebalanceAction[];
}

export interface ImportResult {
  transactions_added: number;
  distributions_added: number;
  cash_movements_added: number;
  duplicates_skipped: number;
  errors: string[];
}

// Performance types
export interface PerformancePoint {
  date: string;
  total_value: number;
  total_invested: number;
  gain_loss: number;
}

export interface FundPerformancePoint {
  date: string;
  price: number;
  quantity: number;
  market_value: number;
  cost_basis: number;
  gain_loss: number;
  distributions_to_date: number;
  total_return: number;
  total_return_pct: number;
}

export interface FundPerformanceResponse {
  fund: Fund;
  transactions: Transaction[];
  distributions: Distribution[];
  timeline: FundPerformancePoint[];
}

// Performance metrics
export interface PerformanceMetrics {
  time_weighted_return: number;
  money_weighted_return: number;
  annualized_return: number;
  sharpe_ratio: number | null;
  max_drawdown: number;
  best_month: { date: string; return_pct: number } | null;
  worst_month: { date: string; return_pct: number } | null;
  monthly_returns: MonthlyReturn[];
}

export interface MonthlyReturn {
  month: string;
  start_value: number;
  end_value: number;
  net_flows: number;
  return_pct: number;
}

// Snapshot types
export interface SnapshotDetail {
  id: number;
  date: string;
  total_value: number;
  total_invested: number;
  cash_balance: number;
  holdings: SnapshotHolding[];
  created_at: string;
}

export interface SnapshotHolding {
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  bucket_name: string | null;
}

// Export types
export interface ExportOptions {
  format: 'csv' | 'json';
  type: 'transactions' | 'holdings' | 'performance' | 'tax';
  from?: string;
  to?: string;
  fund_id?: number;
}

export interface TaxReport {
  financial_year: string;
  total_distributions: number;
  realized_gains: number;
  realized_losses: number;
  net_capital_gain: number;
  distributions_by_fund: { ticker: string; name: string; total: number }[];
}

// Transaction form
export interface TransactionInput {
  fund_id: number;
  date: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount?: number;
  notes?: string;
}

// Auth types
export interface User {
  id: number;
  email: string;
  name: string | null;
  is_admin: number;
  created_at?: string;
  last_login?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  dev_token?: string;
}

export interface AdminUserSummary {
  id: number;
  email: string;
  name: string | null;
  is_admin: number;
  created_at: string;
  last_login: string | null;
  funds_count: number;
  transactions_count: number;
  distributions_count: number;
  cash_movements_count: number;
  snapshots_count: number;
  last_activity_at: string | null;
}

export interface ActivityLogItem {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_is_admin: number | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}
