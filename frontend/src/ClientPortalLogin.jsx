import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Shown when a client visits their unique URL (e.g., ?org=acme-corporation)
export default function ClientPortalLogin({ client, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check credentials against saved client data
    const storedEmail = client.email || '';
    const storedPassword = client.password || '';

    if (email.trim().toLowerCase() === storedEmail.trim().toLowerCase() && password === storedPassword) {
      onLoginSuccess({
        role: 'client',
        email,
        id: client.id,
        name: client.name,
        whitelabel: client.whitelabel,
        clientCode: client.clientCode,
        agentEnabled: client.agentEnabled,
        slug: client.slug
      });
    } else {
      setError('Invalid email or password. Please contact your administrator.');
    }
    setLoading(false);
  };

  const brandName = client.whitelabel || client.name || 'Your AI Platform';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eff4ff] via-[#f5f7fb] to-[#f0f3f9] flex items-center justify-center p-4 font-sans text-[#0f172a]">
      <div className="bg-white border border-[#e4e9f2] rounded-2xl p-10 w-full max-w-[420px] shadow-[0_4px_24px_rgba(15,23,42,0.12)]">
        
        {/* Brand */}
        <div className="flex items-center gap-2.5 justify-center mb-7">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <div className="text-xl font-bold tracking-tight">{brandName}</div>
        </div>

        <h2 className="text-[15px] font-bold text-center mb-1">Sign in to your account</h2>
        <p className="text-[13px] text-[#94a3b8] text-center mb-6">AI Voice Agent Platform</p>

        {error && (
          <div className="bg-[#fef2f2] border border-red-500/20 rounded-lg p-2.5 text-xs text-red-600 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-3.5">
            <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-blue-600 transition-all"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="mb-5">
            <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] pl-3 pr-10 py-2.5 text-[13px] outline-none focus:border-blue-600 transition-all"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#94a3b8] hover:text-[#475569]">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-[#1e40af] text-white py-2.5 rounded-[10px] text-[13px] font-semibold transition-all">
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#94a3b8] mt-5">
          Powered by <span className="font-semibold text-blue-600">Azlon AI</span>
        </p>
      </div>
    </div>
  );
}
