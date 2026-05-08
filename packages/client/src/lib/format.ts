import type { Settings } from '../context/SettingsContext';

let currentSettings: Pick<Settings, 'currency' | 'showCents' | 'dateFormat'> = {
  currency: 'AUD',
  showCents: false,
  dateFormat: 'DD/MM/YY',
};

export function updateFormatSettings(settings: Pick<Settings, 'currency' | 'showCents' | 'dateFormat'>) {
  currentSettings = settings;
}

export function currency(val: number, forceDecimals?: number): string {
  const decimals = forceDecimals ?? (currentSettings.showCents ? 2 : 0);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currentSettings.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function pct(val: number, decimals = 1): string {
  return `${(val * 100).toFixed(decimals)}%`;
}

export function signedCurrency(val: number): string {
  const prefix = val >= 0 ? '+' : '';
  return `${prefix}${currency(val)}`;
}

export function signedPct(val: number): string {
  const prefix = val >= 0 ? '+' : '';
  return `${prefix}${pct(val)}`;
}

export function shortDate(dateStr: string): string {
  const d = new Date(dateStr);

  switch (currentSettings.dateFormat) {
    case 'YYYY-MM-DD':
      return dateStr.slice(0, 10);
    case 'MM/DD/YY':
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
    case 'DD/MM/YY':
    default:
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
