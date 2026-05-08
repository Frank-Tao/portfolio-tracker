import { useSettings, type Theme, type GainLossColor, type Currency, type DateFormat } from '../context/SettingsContext';

function Settings() {
  const { settings, updateSettings, gainColor, lossColor } = useSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <Section title="Appearance">
          <SettingRow label="Theme" description="Choose the color scheme for the app">
            <select
              value={settings.theme}
              onChange={e => updateSettings({ theme: e.target.value as Theme })}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </SettingRow>

          <SettingRow label="Compact Tables" description="Reduce spacing in data tables">
            <Toggle
              checked={settings.compactTables}
              onChange={v => updateSettings({ compactTables: v })}
            />
          </SettingRow>
        </Section>

        {/* Colors */}
        <Section title="Gain/Loss Colors">
          <SettingRow label="Color scheme" description="Which color represents gains vs losses">
            <select
              value={settings.gainLossColor}
              onChange={e => updateSettings({ gainLossColor: e.target.value as GainLossColor })}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="green-red">Green = Gain, Red = Loss (Western)</option>
              <option value="red-green">Red = Gain, Green = Loss (Asian)</option>
            </select>
          </SettingRow>

          <div className="flex gap-6 mt-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gain</p>
              <p className={`text-lg font-bold ${gainColor}`}>+$1,234.00</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loss</p>
              <p className={`text-lg font-bold ${lossColor}`}>-$567.00</p>
            </div>
          </div>
        </Section>

        {/* Number Formatting */}
        <Section title="Number Formatting">
          <SettingRow label="Currency" description="Display currency symbol">
            <select
              value={settings.currency}
              onChange={e => updateSettings({ currency: e.target.value as Currency })}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="AUD">AUD ($)</option>
              <option value="USD">USD ($)</option>
            </select>
          </SettingRow>

          <SettingRow label="Show Cents" description="Display decimal places in currency values">
            <Toggle
              checked={settings.showCents}
              onChange={v => updateSettings({ showCents: v })}
            />
          </SettingRow>

          <SettingRow label="Date Format" description="How dates are displayed">
            <select
              value={settings.dateFormat}
              onChange={e => updateSettings({ dateFormat: e.target.value as DateFormat })}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="DD/MM/YY">15 Jan 24 (DD/MM/YY)</option>
              <option value="MM/DD/YY">Jan 15, 24 (MM/DD/YY)</option>
              <option value="YYYY-MM-DD">2024-01-15 (ISO)</option>
            </select>
          </SettingRow>
        </Section>

        {/* Behavior */}
        <Section title="Behavior">
          <SettingRow label="Default Page" description="Page to show when the app starts">
            <select
              value={settings.defaultPage}
              onChange={e => updateSettings({ defaultPage: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="/">Dashboard</option>
              <option value="/holdings">Holdings</option>
              <option value="/transactions">Transactions</option>
              <option value="/cash">Cash</option>
              <option value="/performance">Performance</option>
            </select>
          </SettingRow>

          <SettingRow label="Auto-refresh prices on load" description="Fetch latest prices when opening the app">
            <Toggle
              checked={settings.refreshOnLoad}
              onChange={v => updateSettings({ refreshOnLoad: v })}
            />
          </SettingRow>
        </Section>

        {/* Reset */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              if (confirm('Reset all settings to defaults?')) {
                localStorage.removeItem('portfolio-tracker-settings');
                window.location.reload();
              }
            }}
            className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h2>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default Settings;
