import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await updateProfile(name);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Member since</span>
            <span className="text-gray-900">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Last login</span>
            <span className="text-gray-900">{user.last_login ? new Date(user.last_login).toLocaleString() : '-'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Display Name</h2>
        <form onSubmit={handleSave} className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your name"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
        {saved && <p className="text-sm text-green-600 mt-2">Profile updated</p>}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Session</h2>
        <p className="text-sm text-gray-500 mb-4">Your session will remain active for 30 days on this device.</p>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default Profile;
