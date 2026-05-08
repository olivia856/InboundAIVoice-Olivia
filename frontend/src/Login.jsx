import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@azlonai.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Hardcoded logic for now as a stepping stone, or try Supabase auth
    if (email === 'admin@azlonai.com' && password === 'admin123') {
      // Simulate successful superadmin login
      onLoginSuccess({ role: 'superadmin', email });
      setLoading(false);
      return;
    }

    // Actual Supabase Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Determine role (e.g. from user metadata or table)
    // For now, if logged in, treat as 'client' or fetch role.
    const role = data.user?.user_metadata?.role || 'client';
    onLoginSuccess({ role, email: data.user.email });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eff4ff] via-[#f5f7fb] to-[#f0f3f9] flex items-center justify-center p-4 font-sans text-[#0f172a]">
      <div className="bg-white border border-[#e4e9f2] rounded-2xl p-10 w-full max-w-[400px] shadow-[0_4px_16px_rgba(15,23,42,0.1)]">
        
        <div className="flex items-center gap-2.5 justify-center mb-7">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <div className="text-xl font-bold tracking-tight">Azlon<span className="text-blue-600"> AI</span></div>
        </div>
        
        <h2 className="text-[15px] font-bold text-center mb-1">Sign in to your account</h2>
        <p className="text-[13px] text-[#94a3b8] text-center mb-5">AI Voice Agent Platform</p>

        <div className="bg-[#eff4ff] border border-[#bfcfff] rounded-lg p-3 mb-5 text-[12px] text-[#1e40af]">
          <strong className="block text-[11px] text-blue-600 mb-1.5 uppercase tracking-wide">Demo credentials — Azlon AI</strong>
          <div><code className="font-mono text-[11px]">admin@azlonai.com / admin123</code> — Super Admin</div>
        </div>

        {error && (
          <div className="bg-[#fef2f2] border border-red-500/20 rounded-lg p-2.5 text-xs text-red-600 mb-3">
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
              className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] pl-3 pr-10 py-2.5 text-[13px] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                placeholder="••••••••"
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#94a3b8] hover:text-[#475569]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-[#1e40af] text-white py-2.5 rounded-[10px] text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  );
}
