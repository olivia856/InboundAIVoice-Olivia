import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Activity, LogOut, Copy, Check, Eye, Settings, ToggleLeft, ToggleRight, CheckCircle, Zap, RefreshCw, Phone } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://saas-backend.xqnsvk.easypanel.host';

function genClientCode(existing) {
  const nums = existing.map(c => parseInt((c.clientCode || 'AZL-0000').split('-')[1] || '0'));
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, '0');
  return `AZL-${next}`;
}

export default function SuperAdminDashboard({ user, onLogout, onViewClient }) {
  const [activeTab, setActiveTab] = useState('clients');
  const [copied, setCopied] = useState(false);
  const [slugPreview, setSlugPreview] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [clients, setClients] = useState([]);

  const [newClient, setNewClient] = useState({ name: '', industry: 'SaaS / Technology', adminName: '', email: '', password: '', phone: '', whitelabel: '', plan: 'Starter (500 mins)', customPlan: '' });

  const [platformStats, setPlatformStats] = useState({ totalCalls: 0, totalMins: 0, activeClients: 0, activeAgents: 0 });

  const fetchPlatformStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`);
      const data = await res.json();
      if (data.success) {
        setPlatformStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch platform stats");
    }
  };

  const copyClientUrl = (slug) => {
    const url = `https://livekit-ai-azlon-olivia-va-dashboard.xqnsvk.easypanel.host/?org=${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast(`URL copied to clipboard!`);
    }).catch(() => {
      showToast('Copy failed. Please copy manually.', 'error');
    });
  };

  const toggleAgent = (clientId) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const next = !c.agentEnabled;
        showToast(`AI Agent ${next ? 'ENABLED' : 'DISABLED'} for ${c.name}`);
        return { ...c, agentEnabled: next };
      }
      return c;
    }));
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/clients`);
        const data = await res.json();
        if (data.success) {
          setClients(data.clients);
        }
      } catch (err) {
        console.error("Failed to fetch clients from backend.");
      }
    };
    
    fetchClients();
    fetchPlatformStats();
    const interval = setInterval(fetchPlatformStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('azlon_clients', JSON.stringify(clients));
    localStorage.setItem('azlon_clients_version', 'v3');
  }, [clients]);

  const handleSlugPreview = (name) => {
    setNewClient(prev => ({ ...prev, name }));
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setSlugPreview(slug ? `https://livekit-ai-azlon-olivia-va-dashboard.xqnsvk.easypanel.host/?org=${slug}` : '');
  };

  const handleCreateClient = async () => {
    const slug = newClient.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const clientCode = genClientCode(clients);
    
    const clientData = {
      name: newClient.name || 'New Client',
      industry: newClient.industry,
      plan: newClient.plan === 'Custom' ? newClient.customPlan : newClient.plan.split(' ')[0],
      slug: slug,
      whitelabel: newClient.whitelabel || newClient.name || 'Azlon AI',
      clientCode,
      email: newClient.email,
      password: newClient.password,
      phone: newClient.phone,
      initials: newClient.name ? newClient.name.substring(0, 2).toUpperCase() : 'NC',
      status: 'Active',
      agentEnabled: true
    };

    try {
      const res = await fetch(`${API_BASE}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      const data = await res.json();
      if (data.success) {
        setClients(prev => [...prev, data.client]);
        showToast(`Client "${clientData.name}" created! Code: ${clientCode}`);
      } else {
        showToast(data.error || "Failed to create client", "error");
      }
    } catch (err) {
      showToast("Network error creating client", "error");
    }

    setNewClient({ name: '', industry: 'SaaS / Technology', adminName: '', email: '', password: '', phone: '', whitelabel: '', plan: 'Starter (500 mins)', customPlan: '' });
    setSlugPreview('');
    setActiveTab('clients');
  };

  const [editingClient, setEditingClient] = useState(null);

  const handleUpdateClient = async (updatedClient) => {
    try {
      const res = await fetch(`${API_BASE}/api/clients/${updatedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedClient)
      });
      const data = await res.json();
      if (data.success) {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));
        setEditingClient(null);
        showToast(`Changes saved for "${updatedClient.name}"!`);
      }
    } catch (err) {
      showToast("Update failed", "error");
    }
  };

  const copySlug = () => {
    if (!slugPreview) return;
    navigator.clipboard.writeText(slugPreview).then(() => showToast('URL copied!')).catch(() => {});
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
    <div className="flex flex-col h-screen bg-[#f5f7fb] text-[#0f172a] font-sans overflow-hidden">
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
        }`}>
          <CheckCircle size={16} />
          {toast.msg}
        </div>
      )}
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

      <div className="flex flex-1 overflow-hidden">
        {/* Admin Sidebar */}
        <div className="w-[220px] bg-white border-r border-[#e4e9f2] p-4 flex-shrink-0">
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
        <div className="flex-1 p-7 overflow-y-auto h-full">
          
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                {clients.map(client => (
                  <div key={client.id} className="bg-white border border-[#e4e9f2] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-[#bfcfff] hover:shadow-[0_4px_16px_rgba(15,23,42,0.1)] transition-all">
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center text-[15px] font-bold">
                          {client.initials}
                        </div>
                        <div>
                          <div className="text-[15px] font-bold tracking-tight">{client.name}</div>
                          <div className="text-[11px] text-[#94a3b8] mt-0.5">{client.plan} · {client.industry}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1 ${
                          client.agentEnabled ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-red-50 text-red-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${client.agentEnabled ? 'bg-[#059669]' : 'bg-red-400'}`}></span>
                          {client.agentEnabled ? 'AI Active' : 'AI Off'}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{client.clientCode}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e4e9f2]">
                        <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Calls</div>
                        <div className="text-[15px] font-bold text-blue-600">{client.calls_count || 0}</div>
                      </div>
                      <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e4e9f2]">
                        <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Minutes</div>
                        <div className="text-[15px] font-bold text-[#0f172a]">{client.mins_used || 0}</div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-[0.5px] mb-1.5 block">Client login URL</label>
                      <div className="bg-[#eff4ff] border border-[#bfcfff] rounded-lg p-2 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#1e40af] flex-1 truncate">
                          {`https://livekit-ai-azlon-olivia-va-dashboard.xqnsvk.easypanel.host/?org=${client.slug}`}
                        </span>
                        <button 
                          onClick={() => copyClientUrl(client.slug)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-semibold hover:bg-[#1e40af] flex items-center gap-1"
                        >
                          <Copy size={10} /> Copy
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button 
                        onClick={() => setEditingClient(client)}
                        className="py-1.5 border border-[#e4e9f2] bg-white hover:bg-[#f0f3f9] rounded-lg text-xs font-semibold text-[#475569] transition-all"
                      >
                        Settings
                      </button>
                      <button 
                        onClick={() => onViewClient({ id: client.id, name: client.name, whitelabel: client.whitelabel, agentEnabled: client.agentEnabled, clientCode: client.clientCode })}
                        className="py-1.5 border border-[#e4e9f2] bg-[#f0f3f9] hover:bg-[#e4e9f2] rounded-lg text-xs font-semibold text-blue-600 transition-all flex items-center justify-center gap-1"
                      >
                        <Eye size={12} /> Login as
                      </button>
                    </div>
                    <button 
                      onClick={() => toggleAgent(client.id)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        client.agentEnabled 
                          ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                      }`}
                    >
                      {client.agentEnabled ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                      {client.agentEnabled ? 'Disable AI Agent' : 'Enable AI Agent'}
                    </button>
                  </div>
                ))}
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
                      <select 
                        value={newClient.industry}
                        onChange={(e) => setNewClient({...newClient, industry: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none"
                      >
                        <option>SaaS / Technology</option>
                        <option>Dental / Healthcare</option>
                        <option>Real Estate</option>
                        <option>Ecommerce / Retail</option>
                        <option>Legal / Finance</option>
                        <option>Restaurant / Food</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Admin full name</label>
                      <input 
                        value={newClient.adminName}
                        onChange={(e) => setNewClient({...newClient, adminName: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="John Smith" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Admin email</label>
                      <input 
                        type="email" 
                        value={newClient.email}
                        onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="john@company.com" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Login password</label>
                      <input 
                        type="password" 
                        value={newClient.password}
                        onChange={(e) => setNewClient({...newClient, password: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="Set a secure password" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Plan</label>
                      <div className="flex gap-2">
                        <select 
                          value={newClient.plan}
                          onChange={(e) => setNewClient({...newClient, plan: e.target.value})}
                          className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none"
                        >
                          <option>Starter (500 mins)</option>
                          <option>Pro (2,000 mins)</option>
                          <option>Business (5,000 mins)</option>
                          <option>Enterprise (Unlimited)</option>
                          <option>Custom</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {newClient.plan === 'Custom' && (
                    <div className="mb-3.5">
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Custom Plan Details</label>
                      <input 
                        type="text" 
                        value={newClient.customPlan}
                        onChange={(e) => setNewClient({...newClient, customPlan: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="e.g. 10,000 mins / month" 
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Phone Number Assigned</label>
                      <input 
                        type="text" 
                        value={newClient.phone}
                        onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="+1 415 555 0200" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-[0.4px] mb-1.5 block">Whitelabel (Company Brand)</label>
                      <input 
                        type="text" 
                        value={newClient.whitelabel}
                        onChange={(e) => setNewClient({...newClient, whitelabel: e.target.value})}
                        className="w-full bg-[#f0f3f9] border border-[#e4e9f2] rounded-[10px] px-3 py-2.5 text-[13px] outline-none" placeholder="e.g. Acme AI" 
                      />
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

                  <button 
                    onClick={handleCreateClient}
                    className="bg-blue-600 hover:bg-[#1e40af] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all w-full mt-2"
                  >
                    Create client account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PLATFORM STATS VIEW */}
          {activeTab === 'platform-stats' && (
            <div className="fade-in">
              <h2 className="text-xl font-bold mb-6">Platform Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[
                  { label: 'Total Clients', value: platformStats.activeClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Active Agents', value: platformStats.activeAgents, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Platform Calls', value: platformStats.totalCalls, icon: Phone, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Total Minutes', value: platformStats.totalMins, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white border border-[#e4e9f2] rounded-2xl p-6 shadow-sm">
                    <div className={`${stat.bg} ${stat.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
                      <stat.icon size={20} />
                    </div>
                    <div className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-1">{stat.label}</div>
                    <div className="text-3xl font-black">{stat.value}</div>
                  </div>
                ))}
              </div>
              
              <div className="bg-white border border-[#e4e9f2] rounded-[14px] shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#e4e9f2] flex justify-between items-center bg-[#f8fafc]">
                  <h3 className="text-sm font-semibold">Live Client Usage</h3>
                  <button onClick={fetchPlatformStats} className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                    <RefreshCw size={12} /> Sync All
                  </button>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-white border-b border-[#e4e9f2]">
                      <th className="py-3 px-5 text-[#94a3b8] font-bold uppercase tracking-wider">Client Name</th>
                      <th className="py-3 px-5 text-[#94a3b8] font-bold uppercase tracking-wider">Total Calls</th>
                      <th className="py-3 px-5 text-[#94a3b8] font-bold uppercase tracking-wider">Minutes Used</th>
                      <th className="py-3 px-5 text-[#94a3b8] font-bold uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id} className="border-b border-[#e4e9f2] hover:bg-[#f8fafc]">
                        <td className="py-3 px-5 font-bold">{c.name}</td>
                        <td className="py-3 px-5 font-medium text-blue-600">{c.calls_count || 0}</td>
                        <td className="py-3 px-5 font-medium">{c.mins_used || 0} mins</td>
                        <td className="py-3 px-5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

        {/* CLIENT SETTINGS MODAL */}
        {editingClient && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[550px] overflow-hidden border border-[#e4e9f2]">
              <div className="px-6 py-4 border-b border-[#e4e9f2] flex items-center justify-between bg-[#f8fafc]">
                <h3 className="font-bold text-slate-800">Edit Client: {editingClient.name}</h3>
                <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-slate-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Company Name</label>
                    <input 
                      type="text" 
                      defaultValue={editingClient.name}
                      onChange={(e) => setEditingClient({...editingClient, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Industry</label>
                    <select 
                      defaultValue={editingClient.industry}
                      onChange={(e) => setEditingClient({...editingClient, industry: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 transition-all"
                    >
                      <option>SaaS / Technology</option>
                      <option>Dental / Healthcare</option>
                      <option>Real Estate</option>
                      <option>Ecommerce / Retail</option>
                      <option>Legal / Finance</option>
                      <option>Restaurant / Food</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Plan</label>
                    <select 
                      defaultValue={editingClient.plan}
                      onChange={(e) => setEditingClient({...editingClient, plan: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 transition-all"
                    >
                      <option>Starter</option>
                      <option>Pro</option>
                      <option>Business</option>
                      <option>Enterprise</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                    <input 
                      type="text" 
                      defaultValue={editingClient.phone}
                      onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 transition-all" 
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Whitelabel (Logo Name)</label>
                  <input 
                    type="text" 
                    defaultValue={editingClient.whitelabel}
                    onChange={(e) => setEditingClient({...editingClient, whitelabel: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-blue-500 transition-all" 
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200/50 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-blue-800 font-bold text-[12px] mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Client Login Credentials
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 block">Current Email</label>
                    <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-[12px] font-mono text-slate-700">
                      {editingClient.email || <span className="text-slate-400 italic">Not set</span>}
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 block">Current Password</label>
                    <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-[12px] font-mono text-slate-700">
                      {editingClient.password || <span className="text-slate-400 italic">Not set</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-4 mb-2">
                   <div className="flex items-center gap-2 text-amber-800 font-bold text-[12px] mb-3">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                     Update / Reset Credentials
                   </div>
                   <div className="space-y-2">
                     <input
                       type="text"
                       placeholder="New Email"
                       defaultValue={editingClient.email}
                       onChange={(e) => setEditingClient({...editingClient, email: e.target.value})}
                       className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-amber-400"
                     />
                     <input
                       type="text"
                       placeholder="New Password (leave blank to keep)"
                       onChange={(e) => setEditingClient({...editingClient, password: e.target.value || editingClient.password})}
                       className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-amber-400"
                     />
                   </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-[#e4e9f2] flex items-center justify-end gap-3">
                <button onClick={() => setEditingClient(null)} className="px-4 py-2 text-slate-600 font-semibold text-[13px]">Cancel</button>
                <button 
                  onClick={() => handleUpdateClient(editingClient)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-[13px] font-bold shadow-lg shadow-blue-500/20 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
