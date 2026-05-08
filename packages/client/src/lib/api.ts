import type {
  PortfolioSummary,
  PerformanceMetrics,
  FundPerformanceResponse,
  RebalanceResult,
  Fund,
  Transaction,
  Distribution,
  Snapshot,
  SnapshotDetail,
  TaxReport,
  PriceRecord,
  TransactionInput,
  ImportResult,
  CashSummary,
  CashMovementType,
} from '@portfolio/shared';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

function downloadUrl(path: string): string {
  return `${BASE}${path}`;
}

export const api = {
  portfolio: {
    summary: () => get<PortfolioSummary>('/portfolio/summary'),
    history: () => get<{ date: string; total_value: number; total_invested: number; gain_loss: number }[]>('/portfolio/history'),
    fundPerformance: (id: number) => get<FundPerformanceResponse>(`/portfolio/fund/${id}/performance`),
    rebalance: (profileId?: number, newCapital?: number) => {
      const params = new URLSearchParams();
      if (profileId) params.set('profile_id', String(profileId));
      if (newCapital) params.set('new_capital', String(newCapital));
      return get<RebalanceResult>(`/portfolio/rebalance?${params}`);
    },
  },
  performance: {
    metrics: () => get<PerformanceMetrics>('/performance'),
  },
  prices: {
    refresh: () => get<{ updated: string[]; errors: string[] }>('/prices/refresh'),
    refreshHistorical: () => get<{ updated: { ticker: string; months_added: number }[]; errors: string[] }>('/prices/refresh/historical'),
    latest: () => get<PriceRecord[]>('/prices/latest'),
    coverage: () => get<{ ticker: string; first_date: string; last_date: string; total_records: number; month_end_records: number }[]>('/prices/coverage'),
  },
  profiles: {
    list: () => get<any[]>('/profiles'),
  },
  funds: {
    list: () => get<(Fund & { bucket_name: string | null })[]>('/funds'),
  },
  transactions: {
    list: (fundId?: number) => get<(Transaction & { ticker: string })[]>(`/transactions${fundId ? `?fund_id=${fundId}` : ''}`),
    create: (input: TransactionInput) => post<Transaction>('/transactions', input),
    delete: (id: number) => del(`/transactions/${id}`),
  },
  distributions: {
    list: (fundId?: number) => get<Distribution[]>(`/distributions${fundId ? `?fund_id=${fundId}` : ''}`),
  },
  cash: {
    summary: (type?: CashMovementType, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return get<CashSummary>(`/cash?${params}`);
    },
    create: (date: string, amount: number, type?: string, notes?: string) =>
      post<any>('/cash', { date, amount, type, notes }),
    delete: (id: number) => del(`/cash/${id}`),
  },
  snapshots: {
    list: () => get<Snapshot[]>('/snapshots'),
    get: (id: number) => get<SnapshotDetail>(`/snapshots/${id}`),
    take: () => post<Snapshot>('/snapshots/take', {}),
    delete: (id: number) => del(`/snapshots/${id}`),
  },
  export: {
    transactionsUrl: (format: 'csv' | 'json', from?: string, to?: string, fundId?: number) => {
      const params = new URLSearchParams({ format });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (fundId) params.set('fund_id', String(fundId));
      return downloadUrl(`/export/transactions?${params}`);
    },
    holdingsUrl: (format: 'csv' | 'json') => downloadUrl(`/export/holdings?format=${format}`),
    taxReport: (year?: number) => {
      const params = new URLSearchParams();
      if (year) params.set('year', String(year));
      return get<TaxReport>(`/export/tax?${params}`);
    },
    taxReportUrl: (year: number) => downloadUrl(`/export/tax?year=${year}&format=csv`),
  },
  import: {
    fromPath: (path: string) => post<ImportResult>('/import/excel/path', { path }),
  },
};
