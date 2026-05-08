import React, { useState } from 'react';
import { Users, UserPlus, Activity, LogOut, Copy, Check, Eye, Settings } from 'lucide-react';

export default function SuperAdminDashboard({ user, onLogout, onViewClient }) {
  const [activeTab, setActiveTab] = useState('clients');
  const [copied, setCopied] = useState(false);
  const [slugPreview, setSlugPreview] = useState('');

  const handleSlugPreview = (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setSlugPreview(slug ? `https://azlonai.com/login?org=${slug}` : '');
  };

  const copySlug = () => {
    if (!slugPreview) return;
    navigator.clipboard.writeText(slugPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'clients', label: 'All Clients', icon: Users },
    { id: 'add-client', label: 'Add Client', icon: UserPlus },
    { id: 'platform-stats', label: 'Platform Stats', icon: Activity },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7fb] text-[#0f172a] font-sans">
      {/* Admin Topbar */}
      <div className="h-14 bg-white border-b border-[#e4e9f2] flex items-center px-7 gap-4">
        <div className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
          <div className="w-[30px] h-[30px] rounded-lg bg-blue-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span>Azlon<span className="text-blue-600"> AI</span></span>
        </div>
        <span className="text-[10px] bg-[#fef2f2] text-red-600 border border-red-600/20 rounded-full px-2 py-0.5 font-bold tracking-[0.3px]">
          SUPER ADMIN
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold">
            SA
          </div>
          <span className="text-[13px] font-semibold">Platform Admin</span>
          <button 
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e4e9f2] text-[#475569] hover:bg-[#f0f3f9] hover:text-[#0f172a] rounded-[10px] text-xs font-semibold transition-all ml-2"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Admin Sidebar */}
        <div className="w-[220px] bg-white border-r border-[#e4e9f2] p-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-medium transition-all mb-1 outline-none border border-transparent ${
                  active 
                    ? 'bg-[#eff4ff] text-blue-600 border-blue-600/10' 
                    : 'text-[#475569] hover:bg-[#f0f3f9] hover:text-[#0f172a]'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Admin Content */}
        <div className="flex-1 p-7 overflow-y-auto">
          
          {/* ALL CLIENTS VIEW */}
          {activeTab === 'clients' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold tracking-tight">Client Accounts</h2>
                <button 
                  onClick={() => setActiveTab('add-client')}
                  className="bg-blue-600 hover:bg-[#1e40af] text-white px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all"
                >
                  + Add new client
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Dummy Client Card */}
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-[#bfcfff] hover:shadow-[0_4px_16px_rgba(15,23,42,0.1)] transition-all">
                  <div className="flex items-center gap-3 mb-3.5">
                    <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center text-[15px] font-bold">
                      AC
                    </div>
                    <div>
                      <div className="text-[15px] font-bold tracking-tight">Acme Corporation</div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">Business Plan</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-[#f0f3f9] rounded-lg p-2 text-center">
                      <div className="text-base font-bold">1.2k</div>
                      <div className="text-[10px] text-[#94a3b8] mt-[1px]">Mins</div>
                    </div>
                    <div className="bg-[#f0f3f9] rounded-lg p-2 text-center">
                      <div className="text-base font-bold">342</div>
                      <div className="text-[10px] text-[#94a3b8] mt-[1px]">Calls</div>
                    </div>
                    <div className="bg-[#f0f3f9] rounded-lg p-2 text-center">
                      <div className="text-base font-bold text-green-600">82%</div>
                      <div className="text-[10px] text-[#94a3b8] mt-[1px]">Res</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onViewClient({ id: 'acme', name: 'Acme Corporation' })}
                      className="flex-1 py-1.5 border border-[#e4e9f2] bg-white hover:bg-[#f0f3f9] rounded-lg text-xs font-semibold text-[#475569] transition-all"
                    >
                      View dashboard
                    </button>
                    <button 
                      onClick={() => onViewClient({ id: 'acme', name: 'Acme Corporation' })}
                      className="flex-1 py-1.5 border border-[#e4e9f2] bg-[#f0f3f9] hover:bg-[#e4e9f2] rounded-lg text-xs font-semibold text-blue-600 transition-all flex items-center justify-center gap-1"
                    >
                      <Eye size={12} /> Login as
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADD CLIENT VIEW */}
          {activeTab === 'add-client' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold tracking-tight">Add New Client</h2>
              </div>
              <div className="bg-white border border-[#e4e9f2] rounded-[14px] shadow-[0_1px_3px_rgba(15,23,42,0.06)] max-w-[600px]">
                <div className="px-5 py-3.5 border-b border-[#e4e9f2]">
                  <h3 className="text-sm font-semibold">Client details</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Company name</label>
                      <input 
                        type="text" 
                        onChange={(e) => handleSlugPreview(e.target.value)}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-blue-600" 
                        placeholder="Acme Corporation" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Industry</label>
                      <select className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none">
                        <option>SaaS / Technology</option>
                        <option>Dental / Healthcare</option>
                        <option>Real Estate</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Admin full name</label>
                      <input className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="John Smith" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Admin email</label>
                      <input type="email" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="john@company.com" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Login password</label>
                      <input type="password" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="Set a secure password" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Plan</label>
                      <select className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none">
                        <option>Starter (500 mins)</option>
                        <option>Pro (2,000 mins)</option>
                        <option>Business (5,000 mins)</option>
                      </select>
                    </div>
                  </div>

                  {slugPreview && (
                    <div className="mb-4">
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Their unique login URL (auto-generated)</label>
                      <div className="bg-[#eff4ff] border border-[#bfcfff] rounded-[10px] p-2 flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#1e40af] flex-1 truncate px-1">
                          {slugPreview}
                        </span>
                        <button 
                          onClick={copySlug}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            copied ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-[#1e40af] text-white'
                          }`}
                        >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-1.5 px-1">Share this URL with your client — they'll only see their own portal.</div>
                    </div>
                  )}

                  <button className="bg-blue-600 hover:bg-[#1e40af] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all w-full mt-2">
                    Create client account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PLATFORM STATS VIEW */}
          {activeTab === 'platform-stats' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold tracking-tight">Platform Overview</h2>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-5">
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] relative overflow-hidden">
                  <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full bg-blue-600/5"></div>
                  <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Total clients</div>
                  <div className="text-[26px] font-bold tracking-tight leading-none mb-1.5">3</div>
                  <div className="text-xs font-medium text-green-600">↑ 1 this month</div>
                </div>
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] relative overflow-hidden">
                  <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full bg-green-600/5"></div>
                  <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Total calls (all)</div>
                  <div className="text-[26px] font-bold tracking-tight leading-none mb-1.5">4,821</div>
                  <div className="text-xs font-medium text-green-600">↑ 18% MTD</div>
                </div>
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] relative overflow-hidden">
                  <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full bg-amber-600/5"></div>
                  <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Platform revenue</div>
                  <div className="text-[26px] font-bold tracking-tight leading-none mb-1.5">$1,247</div>
                  <div className="text-xs font-medium text-green-600">↑ $210 vs last month</div>
                </div>
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] relative overflow-hidden">
                  <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full bg-purple-600/5"></div>
                  <div className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Active agents</div>
                  <div className="text-[26px] font-bold tracking-tight leading-none mb-1.5">7</div>
                  <div className="text-xs font-medium text-green-600">All healthy</div>
                </div>
              </div>

              <div className="bg-white border border-[#e4e9f2] rounded-[14px] shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="px-5 py-3.5 border-b border-[#e4e9f2]">
                  <h3 className="text-sm font-semibold">All clients usage</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] border-b border-[#e4e9f2]">Client</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] border-b border-[#e4e9f2]">Plan</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] border-b border-[#e4e9f2]">Minutes used</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] border-b border-[#e4e9f2]">Calls</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] border-b border-[#e4e9f2]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-[#f0f3f9]">
                        <td className="px-4 py-3 text-[13px] font-semibold border-b border-[#e4e9f2]">Acme Corporation</td>
                        <td className="px-4 py-3 text-[13px] border-b border-[#e4e9f2]">Business (5k)</td>
                        <td className="px-4 py-3 text-[13px] border-b border-[#e4e9f2]">1,204 / 5,000</td>
                        <td className="px-4 py-3 text-[13px] border-b border-[#e4e9f2]">342</td>
                        <td className="px-4 py-3 border-b border-[#e4e9f2]">
                          <span className="bg-[#ecfdf5] text-[#059669] px-2 py-0.5 rounded-full text-[11px] font-bold">Active</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-[#f0f3f9]">
                        <td className="px-4 py-3 text-[13px] font-semibold">Dental Smile</td>
                        <td className="px-4 py-3 text-[13px]">Starter (500)</td>
                        <td className="px-4 py-3 text-[13px]">412 / 500</td>
                        <td className="px-4 py-3 text-[13px]">98</td>
                        <td className="px-4 py-3">
                          <span className="bg-[#ecfdf5] text-[#059669] px-2 py-0.5 rounded-full text-[11px] font-bold">Active</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PLATFORM SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold tracking-tight">Platform Engine Settings</h2>
              </div>
              <p className="text-[13px] text-[#475569] mb-6 max-w-2xl">
                These are your master credentials. The credentials entered here will power all the features inside your clients' dashboards. If a client creates an agent, it will use these API keys behind the scenes.
              </p>
              
              <div className="space-y-4 max-w-[600px]">
                {/* Supabase */}
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center">
                      <img src="https://supabase.com/favicon/favicon-32x32.png" alt="Supabase" className="w-4 h-4 opacity-70 grayscale" onError={(e) => e.target.style.display='none'} />
                    </div>
                    <h3 className="text-sm font-bold">Supabase (Database)</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Project URL</label>
                      <input type="text" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none font-mono" placeholder="https://xxxx.supabase.co" defaultValue="https://qhqmljwexivhvxzfklum.supabase.co" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Anon / Public Key</label>
                      <input type="password" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none font-mono" placeholder="eyJ..." defaultValue="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
                    </div>
                  </div>
                </div>

                {/* Ultravox */}
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center">
                      <span className="text-purple-600 font-bold font-serif">U</span>
                    </div>
                    <h3 className="text-sm font-bold">Ultravox (AI Voice)</h3>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">API Key</label>
                    <input type="password" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none font-mono" placeholder="OuX6..." />
                  </div>
                </div>

                {/* Twilio */}
                <div className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 font-bold font-serif">T</span>
                    </div>
                    <h3 className="text-sm font-bold">Twilio (Telephony)</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Account SID</label>
                      <input type="text" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none font-mono" placeholder="AC..." />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Auth Token</label>
                      <input type="password" className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none font-mono" placeholder="••••••••••••" />
                    </div>
                  </div>
                </div>

                <button className="bg-blue-600 hover:bg-[#1e40af] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all w-full mt-2">
                  Save Platform Settings
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
