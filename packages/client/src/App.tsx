import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import FundDetail from './pages/FundDetail';
import Allocation from './pages/Allocation';
import Transactions from './pages/Transactions';
import Cash from './pages/Cash';
import Performance from './pages/Performance';
import Export from './pages/Export';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Login from './pages/Login';
import { useSettings } from './context/SettingsContext';
import { useAuth } from './context/AuthContext';
import { updateFormatSettings } from './lib/format';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/holdings', label: 'Holdings' },
  { path: '/transactions', label: 'Transactions' },
  { path: '/cash', label: 'Cash' },
  { path: '/performance', label: 'Performance' },
  { path: '/allocation', label: 'Allocation' },
  { path: '/export', label: 'Export' },
  { path: '/settings', label: 'Settings' },
  { path: '/profile', label: 'Profile' },
];

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { settings } = useSettings();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    updateFormatSettings({
      currency: settings.currency,
      showCents: settings.showCents,
      dateFormat: settings.dateFormat,
    });
  }, [settings.currency, settings.showCents, settings.dateFormat]);

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className={`flex h-screen ${settings.theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Mobile header */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 lg:hidden">
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Portfolio Tracker</h1>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-20 w-52 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 flex-shrink-0
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0 pt-16' : '-translate-x-full'}
        `}>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 hidden lg:block">Portfolio Tracker</h1>
          <nav className="space-y-1">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 pt-18 lg:pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/holdings/:id" element={<FundDetail />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/cash" element={<Cash />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/allocation" element={<Allocation />} />
            <Route path="/export" element={<Export />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
