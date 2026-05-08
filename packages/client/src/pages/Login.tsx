import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login, verifyToken } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const result = await login(email);
      if (result.success) {
        setStep('token');
        if (result.dev_token) {
          setDevToken(result.dev_token);
        }
      } else {
        setError(result.message || 'Failed to send code');
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const result = await verifyToken(email, token);
      if (!result.success) {
        setError(result.error || 'Invalid code');
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setToken('');
    setSending(true);
    try {
      const result = await login(email);
      if (result.dev_token) {
        setDevToken(result.dev_token);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Portfolio Tracker</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Sign in to manage your portfolio</p>

        {step === 'email' ? (
          <form onSubmit={handleRequestToken}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              required
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Login Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyToken}>
            <p className="text-sm text-gray-600 mb-4">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login code</label>
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center text-lg tracking-widest font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="000000"
              maxLength={6}
              required
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            {devToken && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-xs text-amber-800">
                <strong>Dev mode:</strong> Your code is <span className="font-mono font-bold">{devToken}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={sending || token.length !== 6}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 mb-3"
            >
              {sending ? 'Verifying...' : 'Verify Code'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setStep('email'); setToken(''); setError(''); setDevToken(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
