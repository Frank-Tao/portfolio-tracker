import { useEffect, useState } from 'react';
import type { ActivityLogItem, AdminUserSummary } from '@portfolio/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRows, activityRows] = await Promise.all([
          api.admin.users(),
          api.admin.activities(200),
        ]);
        setUsers(userRows);
        setActivities(activityRows);
      } catch (err: any) {
        setError(err?.message || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!user?.is_admin) {
    return <div className="text-center py-20 text-red-500">Admin access required.</div>;
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Accounts and activity across the system</p>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium text-right">Funds</th>
                <th className="pb-2 font-medium text-right">Transactions</th>
                <th className="pb-2 font-medium text-right">Cash</th>
                <th className="pb-2 font-medium">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="py-2.5">{row.email}</td>
                  <td className="py-2.5">{row.is_admin ? 'Admin' : 'User'}</td>
                  <td className="py-2.5 text-right">{row.funds_count}</td>
                  <td className="py-2.5 text-right">{row.transactions_count}</td>
                  <td className="py-2.5 text-right">{row.cash_movements_count}</td>
                  <td className="py-2.5">{row.last_login ? new Date(row.last_login).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Actor</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Path</th>
                <th className="pb-2 font-medium text-right">Status</th>
                <th className="pb-2 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-2.5 whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="py-2.5">{item.actor_email || '-'}</td>
                  <td className="py-2.5">{item.method}</td>
                  <td className="py-2.5 font-mono text-xs">{item.path}</td>
                  <td className="py-2.5 text-right">{item.status_code}</td>
                  <td className="py-2.5 text-right">{item.duration_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Admin;
