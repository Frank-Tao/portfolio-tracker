import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type GainLossColor = 'green-red' | 'red-green';
export type Currency = 'AUD' | 'USD';
export type DateFormat = 'DD/MM/YY' | 'MM/DD/YY' | 'YYYY-MM-DD';
export type NumberFormat = 'comma-dot' | 'dot-comma';

export interface Settings {
  theme: Theme;
  gainLossColor: GainLossColor;
  currency: Currency;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  defaultPage: string;
  compactTables: boolean;
  showCents: boolean;
  refreshOnLoad: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  gainLossColor: 'red-green',
  currency: 'AUD',
  dateFormat: 'DD/MM/YY',
  numberFormat: 'comma-dot',
  defaultPage: '/',
  compactTables: false,
  showCents: false,
  refreshOnLoad: false,
};

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  gainColor: string;
  lossColor: string;
  gainBg: string;
  lossBg: string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = 'portfolio-tracker-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  const isGreenGain = settings.gainLossColor === 'green-red';
  const gainColor = isGreenGain ? 'text-green-600' : 'text-red-600';
  const lossColor = isGreenGain ? 'text-red-600' : 'text-green-600';
  const gainBg = isGreenGain ? 'bg-green-50' : 'bg-red-50';
  const lossBg = isGreenGain ? 'bg-red-50' : 'bg-green-50';

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, gainColor, lossColor, gainBg, lossBg }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
