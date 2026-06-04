import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Calendar, Bot, Mic, Key, Phone, Users, PhoneOutgoing, Globe, Sparkles, Trash2, RefreshCw, CheckCircle, XCircle, Target, BookOpen, Megaphone, Bell, Sun, Moon, Wrench, TrendingUp, Clock, Activity, Edit2, Send, Filter, Download, ToggleLeft, ToggleRight, Link, FileText, Database } from 'lucide-react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import Login from './Login';
import SuperAdminDashboard from './SuperAdminDashboard';
import ClientPortalLogin from './ClientPortalLogin';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://livekit-ai-azlon-olivia-va-backend.xqnsvk.easypanel.host';

// Robust local date formatting (YYYY-MM-DD) to avoid timezone/browser discrepancies
const toYYYYMMDD = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Inbound Webhook URL Card Component
function InboundWebhookCard({ clientId, apiBase }) {
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!clientId) return;
    fetch(`${apiBase}/api/inbound-webhook-url?client_id=${clientId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setWebhookUrl(d.webhook_url); })
      .catch(() => {});
  }, [clientId, apiBase]);
  const copy = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-2xl p-8 shadow-premium-lg mb-8">
      <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
        <span className="text-primary">📞</span> Inbound Call Webhook URL
      </h3>
      <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
        Copy this URL and paste it as the <strong>Voice Webhook URL</strong> in your Twilio phone number settings. Anyone who calls your Twilio number will be connected to your AI agent.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-xs font-mono text-primary break-all select-all">
          {webhookUrl || 'Loading...'}
        </code>
        <button onClick={copy} className={`shrink-0 px-4 py-3 rounded-xl text-xs font-bold border transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-3 italic">
        In Twilio Console → Phone Numbers → Your Number → Voice Configuration → set webhook to: POST
      </p>
    </div>
  );
}

function ClientDashboard({ user, onLogout, onBackToAdmin, onAgentToggle }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [agentEnabled, setAgentEnabled] = useState(user?.agentEnabled !== false);
  const [twilioConfig, setTwilioConfig] = useState({ sid: '', api_key: '', phone: '', transfer_number: '' });
  const [uvConfig, setUVConfig] = useState({ api_key: '' });
  const [elevenLabsConfig, setElevenLabsConfig] = useState({ api_key: '', voice_id: '' });
  const [corpusConfig, setCorpusConfig] = useState({ api_key: '' });
  const [resendConfig, setResendConfig] = useState({ api_key: '' });
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isSavingUV, setIsSavingUV] = useState(false);
  const [isSavingElevenLabs, setIsSavingElevenLabs] = useState(false);
  const [isSavingCorpus, setIsSavingCorpus] = useState(false);
  const [isSavingResend, setIsSavingResend] = useState(false);

  const fetchTwilioConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/twilio?client_id=${(user?.client_code || user?.clientCode)}`);
      const data = await res.json();
      if (data.success && data.integration) setTwilioConfig(data.integration);
    } catch (e) { }
  };

  const fetchUVConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/ultravox?client_id=${(user?.client_code || user?.clientCode)}`);
      const data = await res.json();
      if (data.success && data.integration) setUVConfig(data.integration);
    } catch (e) { }
  };

  const fetchResendConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/resend?client_id=${(user?.client_code || user?.clientCode)}`);
      const data = await res.json();
      if (data.success && data.integration) setResendConfig(data.integration);
    } catch (e) { }
  };

  const fetchElevenLabsConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations?client_id=${user?.client_code || user?.clientCode}`);
      const data = await res.json();
      if (data.success && data.integrations) {
        const elevenlabs = data.integrations.find(i => i.provider === 'elevenlabs');
        if (elevenlabs) {
          setElevenLabsConfig({ api_key: elevenlabs.api_key, voice_id: elevenlabs.meta_data?.voice_id || '' });
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchCorpusConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations?client_id=${user?.client_code || user?.clientCode}`);
      const data = await res.json();
      if (data.success && data.integrations) {
        const corpus = data.integrations.find(i => i.provider === 'ultravox_corpus');
        if (corpus) {
          setCorpusConfig({ api_key: corpus.api_key });
        }
      }
    } catch (e) { console.error(e); }
  };


  useEffect(() => {
    if (activePage === 'credentials') {
      fetchTwilioConfig();
      fetchUVConfig();
      fetchResendConfig();
      fetchElevenLabsConfig();
      fetchCorpusConfig();
    }
  }, [activePage]);

  const fetchWAStatus = async () => {
    setWaStatus(p => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      const data = await res.json();
      setWaStatus({ loading: false, connected: data.connected, qrCode: data.qrCode || null, error: data.error || null });
    } catch (e) {
      setWaStatus({ loading: false, connected: false, qrCode: null, error: 'Backend unreachable' });
    }
  };

  const reconnectWA = async () => {
    setWaStatus(p => ({ ...p, loading: true, qrCode: null, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/connect`, { method: 'POST' });
      const data = await res.json();
      setWaStatus({ loading: false, connected: false, qrCode: data.qrCode || null, error: data.error || null });
    } catch (e) {
      setWaStatus({ loading: false, connected: false, qrCode: null, error: 'Failed to connect' });
    }
  };


  const saveTwilioConfig = async (e) => {
    e.preventDefault();
    setIsSavingCreds(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/twilio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...twilioConfig, client_id: (user?.client_code || user?.clientCode)})
      });
      const data = await res.json();
      if (data.success) {
        showToast('Twilio integration updated.', 'success');
        fetchTwilioConfig();
      } else { showToast(data.error || 'Failed.', 'error'); }
    } catch (e) { showToast('Update failed.', 'error'); }
    setIsSavingCreds(false);
  };

  const saveUVConfig = async (e) => {
    e.preventDefault();
    setIsSavingUV(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/ultravox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...uvConfig, client_id: (user?.client_code || user?.clientCode)})
      });
      const data = await res.json();
      if (data.success) {
        showToast('Ultravox settings updated.', 'success');
        fetchUVConfig();
      } else { showToast(data.error || 'Failed.', 'error'); }
    } catch (e) { showToast('Update failed.', 'error'); }
    setIsSavingUV(false);
  };

  const saveResendConfig = async (e) => {
    e.preventDefault();
    setIsSavingResend(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...resendConfig, client_id: (user?.client_code || user?.clientCode)})
      });
      const data = await res.json();
      if (data.success) {
        showToast('Resend email API saved.', 'success');
        fetchResendConfig();
      } else { showToast(data.error || 'Failed.', 'error'); }
    } catch (e) { showToast('Update failed.', 'error'); }
    setIsSavingResend(false);
  };

  const saveElevenLabsConfig = async (e) => {
    e.preventDefault();
    setIsSavingElevenLabs(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/elevenlabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          api_key: elevenLabsConfig.api_key, 
          meta_data: { voice_id: elevenLabsConfig.voice_id },
          client_id: (user?.client_code || user?.clientCode) 
        })
      });
      const data = await res.json();
      if (data.success) { showToast('ElevenLabs integration saved!', 'success'); } else { showToast('Failed to save ElevenLabs.', 'error'); }
    } catch (e) { showToast('Error saving ElevenLabs.', 'error'); }
    setIsSavingElevenLabs(false);
  };

  const saveCorpusConfig = async (e) => {
    e.preventDefault();
    setIsSavingCorpus(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: 'ultravox_corpus',
          api_key: corpusConfig.api_key, 
          client_id: (user?.client_code || user?.clientCode) 
        })
      });
      const data = await res.json();
      if (data.success) { showToast('Corpus API Key saved!', 'success'); } else { showToast('Failed to save Corpus Key.', 'error'); }
    } catch (e) { showToast('Error saving Corpus Key.', 'error'); }
    setIsSavingCorpus(false);
  };
  const [theme, setTheme] = useState('light');
  const [toast, setToast] = useState(null);

  const [callLogs, setCallLogs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reports, setReports] = useState(null);
  const [reportDateRange, setReportDateRange] = useState('this_month');
  
  const [agentSettings, setAgentSettings] = useState({ system_prompt: '', voice_preset: 'Mark', temperature: 0.3, greeting_message: '', personality: 'professional', ultravox_agent_id: '' });
  const [integrations, setIntegrations] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarModal, setCalendarModal] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState(null);
  const [viewSummaryModal, setViewSummaryModal] = useState(null);
  const [expandedSentiment, setExpandedSentiment] = useState({});
  const [expandedRecording, setExpandedRecording] = useState(null);
  const [manualLeadModal, setManualLeadModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', ai_context: '', segment: 'Warm' });
  const [campaignGoal, setCampaignGoal] = useState('');
  const [outboundAgentId, setOutboundAgentId] = useState('');
  const [logSentimentFilter, setLogSentimentFilter] = useState('All');
  const [logDateFilter, setLogDateFilter] = useState({ from: '', to: '' });
  const [kbTab, setKbTab] = useState('text'); // 'text' | 'file' | 'url'
  const [corpusUrl, setCorpusUrl] = useState('');
  const [corpusFile, setCorpusFile] = useState(null);
  const [agentTools, setAgentTools] = useState({ hangUp: true, transferCall: false, queryCorpus: false });
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
  const showConfirm = (message, onConfirm) => setConfirmModal({ message, onConfirm });
  const [calendarError, setCalendarError] = useState(''); // inline error inside booking modal

  // Auto-save Campaign Goal on change (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      const clientId = user?.client_code || user?.clientCode;
      if (clientId && campaignGoal && campaignGoal !== agentSettings?.campaign_goal) {
        fetch(`${API_BASE}/api/agent/campaign-goal`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ client_id: clientId, campaign_goal: campaignGoal }) });
        setAgentSettings(prev => prev ? { ...prev, campaign_goal: campaignGoal } : prev);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [campaignGoal]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const clientId = user?.client_code || user?.clientCode;
      if (clientId && outboundAgentId !== agentSettings?.outbound_agent_id) {
        fetch(`${API_BASE}/api/agent/outbound-id`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ client_id: clientId, outbound_agent_id: outboundAgentId }) });
        setAgentSettings(prev => prev ? { ...prev, outbound_agent_id: outboundAgentId } : prev);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [outboundAgentId]);

  const saveManualLead = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newLead, source: 'Manual Entry', client_id: (user?.client_code || user?.clientCode) })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Lead successfully added to CRM!', 'success');
        setManualLeadModal(false);
        setNewLead({ name: '', phone: '', email: '', ai_context: '', segment: 'Warm' });
        fetchAll(); // Refresh all data
      }
    } catch (e) { showToast('Failed to save lead', 'error'); }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isPortalClient = !!((user?.client_code || user?.clientCode)); // any client account (portal URL or Login as)

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      const clientId = user?.id || user?.client_code || user?.clientCode;
      try {
        const resp = await fetch(`${API_BASE}/api/clients/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: base64 })
        });
        const d = await resp.json();
        if (d.success) {
          showToast('Image uploaded successfully', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } else showToast('Failed to upload', 'error');
      } catch (err) { showToast('Upload error', 'error'); }
    };
    reader.readAsDataURL(file);
  };

  const handleForceResetPassword = async (userId) => {
    if (!window.confirm("Are you sure you want to force reset this user's password to 'default123'?")) return;
    try {
      const resp = await fetch(`${API_BASE}/api/clients/${userId || user?.id || user?.client_code || user?.clientCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'default123' })
      });
      const d = await resp.json();
      if (d.success) {
        showToast('Password reset to default123', 'success');
      } else showToast('Failed to reset', 'error');
    } catch (err) { showToast('Error resetting password', 'error'); }
  };

  const fetchAll = () => {
    const clientId = user?.client_code || user?.clientCode;
    if (!clientId) {
      console.warn('[fetchAll] No client_id found - refusing to fetch to prevent data leak');
      return;
    }
    const query = `?client_id=${clientId}`;
    
    fetch(`${API_BASE}/api/calls${query}`).then(r => r.json()).then(d => { if (d.success) setCallLogs(d.calls); }).catch(() => {});
    fetch(`${API_BASE}/api/contacts${query}`).then(r => r.json()).then(d => { if (d?.success) setContacts(d.contacts); }).catch(() => {});
    fetch(`${API_BASE}/api/leads${query}`).then(r => r.json()).then(d => { if (d?.success) setLeads(d.leads); }).catch(() => {});
    fetch(`${API_BASE}/api/knowledge_base${query}`).then(r => r.json()).then(d => { if (d?.success) setKnowledgeBase(d.docs); }).catch(() => {});
    fetch(`${API_BASE}/api/campaigns${query}`).then(r => r.json()).then(d => { if (d?.success) setCampaigns(d.campaigns); }).catch(() => {});
    fetch(`${API_BASE}/api/agent${query}`).then(r => r.json()).then(d => { 
      if (d.success && d.agent) { 
        setAgentSettings(d.agent); 
        if (d.agent.campaign_goal && !document.getElementById('campaign_goal')?.matches(':focus')) {
          setCampaignGoal(d.agent.campaign_goal);
        }
        if (d.agent.outbound_agent_id && !document.getElementById('outbound_agent_id')?.matches(':focus')) {
          setOutboundAgentId(d.agent.outbound_agent_id);
        }
      } 
    }).catch(() => {});
    fetch(`${API_BASE}/api/integrations${query}`).then(r => r.json()).then(d => { if (d.success) setIntegrations(d.integrations || []); }).catch(() => {});
    fetch(`${API_BASE}/api/appointments${query}`).then(r => r.json()).then(d => { if (d.success) setAppointments(d.appointments || []); }).catch(() => {});
    fetch(`${API_BASE}/api/reports${query}&date_filter=${reportDateRange}`).then(r => r.json()).then(d => { if (d.success) setReports(d.metrics); }).catch(() => {});
  };

  useEffect(() => {
    const clientId = user?.client_code || user?.clientCode;
    if (clientId) {
      fetch(`${API_BASE}/api/reports?client_id=${clientId}&date_filter=${reportDateRange}`).then(r => r.json()).then(d => { if (d.success) setReports(d.metrics); }).catch(() => {});
    }
  }, [reportDateRange, user]);

  useEffect(() => { 
    fetchAll(); 
    // Auto-refresh every 30 seconds
    const autoRefresh = setInterval(() => fetchAll(), 30000);
    return () => clearInterval(autoRefresh);
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isFixing, setIsFixing] = useState(false); 
  
  const handleFixSentiment = async () => {
    setIsFixing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/fix-sentiment`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: (user?.client_code || user?.clientCode) })
      });
      const data = await resp.json();
      if (data.success) {
        showToast(`Repaired ${data.fixed} calls!`);
        fetchAll();
      }
    } catch (err) {
      showToast("Repair failed.", "error");
    } finally {
      setIsFixing(false);
    }
  };

  const getIntegration = (provider) => integrations.find(i => i.provider === provider) || { api_key: '', meta_data: {} };

  const saveIntegration = async (provider, api_key, meta_data = {}) => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key, meta_data, client_id: (user?.client_code || user?.clientCode) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setIntegrations(prev => [...prev.filter(i => i.provider !== provider), { provider, api_key, meta_data }]);
      return true;
    } catch(e) {
      alert('Save failed: ' + e.message);
      return false;
    }
  };

  const fetchSlotsForDate = async (date) => {
    setLoadingSlots(true);
    // Local-safe date string (YYYY-MM-DD) avoids UTC day-shifting bug
    const dateStr = toYYYYMMDD(date); 
    setAvailableSlots([]);

    // PRE-CHECK: If it's a holiday, skip fetch and show closure message immediately
    if ((agentSettings?.non_working_dates || []).includes(dateStr)) {
      console.info(`[Calendar] Date ${dateStr} is mark as HOLIDAY. Masking slots.`);
      setAvailableSlots("Business is closed on this date (marked as holiday).");
      setLoadingSlots(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tools/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: dateStr, client_id: (user?.client_code || user?.clientCode) })
      });
      const data = await res.json();
      if (Array.isArray(data.available_slots)) {
        setAvailableSlots(data.available_slots);
      } else {
        setAvailableSlots(data.available_slots || []); // Could be a string reason
      }
    } catch(e) { setAvailableSlots([]); }
    setLoadingSlots(false);
  };

  // Get appointments for selected date
  const appointmentsForDate = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return appointments.filter(a => a.start_time && a.start_time.startsWith(dateStr));
  };

  // Calendar grid helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', svgPath: <><rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.4"/></> },
    { id: 'calendar', label: 'Calendar', svgPath: <><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5"/><line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/></> },
    { id: 'agent', label: 'Inbound Agent', svgPath: <><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/><circle cx="19" cy="8" r="1.5" fill="currentColor" opacity="0.6"/><line x1="19" y1="5" x2="19" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
    { id: 'campaigns', label: 'Outbound Campaigns', svgPath: <><path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></> },
    { id: 'logs', label: 'Call Logs', svgPath: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-1z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="18" cy="6" r="2.5" fill="currentColor" opacity="0.6"/></> },
    { id: 'knowledge_base', label: 'Knowledge Base', svgPath: <><rect x="4" y="3" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="7" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="14" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M16 6h2a2 2 0 012 2v11a2 2 0 01-2 2H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></> },
    { id: 'leads', label: 'Lead CRM', svgPath: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5.64 5.64l1.42 1.42M16.95 16.95l1.41 1.41M5.64 18.36l1.42-1.42M16.95 7.05l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
    { id: 'integrations_logs', label: 'Integrations', svgPath: <><circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="19" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="19" cy="19" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="7" y1="11" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="13" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
    { id: 'recordings', label: 'Voice Recordings', svgPath: <><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M19 10v1a7 7 0 01-14 0v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/><line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
    { id: 'reports', label: 'Analytics', svgPath: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></> },
    { id: 'tools', label: 'Tools', svgPath: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></> },
    { id: 'credentials', label: 'API Credentials', svgPath: <><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></> },
  ];

  const { firstDay, daysInMonth } = getDaysInMonth(calendarDate);
  const today = new Date();

  useEffect(() => {
    // FORCE reset to 'light' for this final calibration session to override cached dark settings
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, [theme]);

  // MOUNT RESET: Ensure we start clean in Light Mode
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (!saved) {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const [agentToggleModal, setAgentToggleModal] = useState(null); // { action: 'pause'|'enable' }

  // ── Plan Lockout Logic ──
  const planLimits = { Starter: 500, Pro: 2000, Business: 5000, Enterprise: null };
  const planKey = (user?.plan || 'Starter').split(' ')[0];
  const planLimit = planLimits[planKey] ?? null;
  const nowForLockout = new Date();
  const thisMonthCallsLockout = callLogs.filter(c => { const d = new Date(c.created_at); return d.getMonth() === nowForLockout.getMonth() && d.getFullYear() === nowForLockout.getFullYear(); });
  const minsUsed = Math.round(thisMonthCallsLockout.reduce((acc, c) => acc + (c.duration_seconds || c.duration || 0), 0) / 60);
  const isLockedOut = planLimit !== null && minsUsed >= planLimit;

  return (
    <div className={`flex h-screen bg-background text-foreground font-sans overflow-hidden ${theme}`}>
      

      
      {/* AI Agent Toggle Confirmation Modal */}
      {agentToggleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden">
            <div className={`px-6 py-4 border-b border-border ${agentToggleModal.action === 'pause' ? 'bg-red-500/5' : 'bg-emerald-500/5'}`}>
              <h3 className="font-bold text-sm">
                {agentToggleModal.action === 'pause' ? '⏸ Pause AI Agent?' : '▶ Enable AI Agent?'}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {agentToggleModal.action === 'pause'
                  ? 'Pausing the AI Agent will stop all inbound and outbound calls. Your callers will hear no response. You can enable it again at any time.'
                  : 'Enabling the AI Agent will allow it to handle inbound and outbound calls again using your configured settings.'}
              </p>
            </div>
            <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setAgentToggleModal(null)} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    const saved = localStorage.getItem('azlon_clients');
                    if (saved) {
                      const clients = JSON.parse(saved);
                      const idx = clients.findIndex(c => c.id === user.id);
                      if (idx >= 0) {
                        clients[idx].agentEnabled = agentToggleModal.action === 'enable';
                        localStorage.setItem('azlon_clients', JSON.stringify(clients));
                        localStorage.setItem('azlon_clients_version', 'v3');
                      }
                    }
                  } catch {}
                  const newValue = agentToggleModal.action === 'enable';
                  
                  // Update backend
                  if (user && user.id) {
                    fetch(`${API_BASE}/api/clients/${user.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agent_enabled: newValue })
                    }).catch(console.error);
                  }

                  setAgentEnabled(newValue);
                  if (onAgentToggle) onAgentToggle(newValue);
                  setAgentToggleModal(null);
                  showToast(agentToggleModal.action === 'pause' ? 'AI Agent paused.' : 'AI Agent enabled!');
                }}
                className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-all ${
                  agentToggleModal.action === 'pause' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {agentToggleModal.action === 'pause' ? 'Yes, Pause Agent' : 'Yes, Enable Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Global Toast — Premium */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 slide-up">
          <div className={cn("px-5 py-3.5 rounded-2xl shadow-premium-lg flex items-center gap-3 border backdrop-blur-xl", 
            toast.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}>
            {toast.type === 'error' ? <XCircle size={18} strokeWidth={2.5} /> : <CheckCircle size={18} strokeWidth={2.5} />}
            <span className="text-sm font-semibold tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar — Futuristic */}
      <aside className="w-[255px] min-w-[255px] bg-sidebar border-r border-border/60 flex flex-col relative z-10">
        {/* Brand Header */}
        <div 
          className="flex items-center justify-between px-5 py-5 border-b border-border/50 cursor-pointer hover:bg-white/5 transition"
          onClick={() => setShowProfileModal(true)}
        >
          <div className="flex items-center gap-3">
            {/* Futuristic Logo Mark */}
            <div className="relative w-9 h-9 flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl opacity-90 shadow-glow overflow-hidden">
                {user?.company_logo && <img src={user.company_logo} alt="Company Logo" className="w-full h-full object-cover" />}
              </div>
              {!user?.company_logo && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                    <polygon points="12,7 17,10 17,14 12,17 7,14 7,10" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="2" fill="white"/>
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-[14.5px] leading-tight tracking-tight">{user?.whitelabel || 'Azlon AI'}</h1>
              <p className="text-[10px] text-muted-foreground font-normal tracking-[0.08em] mt-0.5">Voice Intelligence</p>
              {(user?.client_code || user?.clientCode) && (
                <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5 tracking-widest">{user.clientCode}</p>
              )}
            </div>
          </div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground p-2 hover:bg-white/5 rounded-lg transition-all">
             {theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navigation.map((item, idx) => {
            const isActive = activePage === item.id;
            return (
              <button key={item.id} onClick={() => setActivePage(item.id)}
                className={cn(
                  "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all duration-200 outline-none relative overflow-hidden",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                )}>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  className={cn("flex-shrink-0 transition-all duration-200", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
                  {item.svgPath}
                </svg>
                <span className="tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Status Footer */}
        <div className="px-5 py-4 border-t border-border space-y-2">
          {/* AI Agent Toggle */}
          {(user?.client_code || user?.clientCode) && (
            <div className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLockedOut ? 'bg-red-500' : agentEnabled ? 'bg-emerald-500' : 'bg-red-400'}`} />
                <span className="text-xs text-muted-foreground font-medium">
                  {isLockedOut ? <span className="text-red-500">Limit Exhausted</span> : agentEnabled ? 'AI Agent Active' : 'AI Agent Paused'}
                </span>
              </div>
              <button
                onClick={() => {
                  if (isLockedOut) { showToast('Plan limit exhausted.', 'error'); return; }
                  setAgentToggleModal({ action: agentEnabled ? 'pause' : 'enable' });
                }}
                disabled={isLockedOut}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  isLockedOut ? 'bg-red-500/10 text-red-500 opacity-50 cursor-not-allowed' :
                  agentEnabled
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                }`}
              >
                {isLockedOut ? 'Locked' : agentEnabled ? 'Pause' : 'Enable'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 status-dot" />
              <span className="text-xs text-muted-foreground font-medium">Agent Online</span>
            </div>
          <div className="flex items-center gap-3">
            {onBackToAdmin && (
              <button onClick={onBackToAdmin} className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-semibold">« Admin Panel</button>
            )}
            <button onClick={onLogout} className="text-xs text-muted-foreground hover:text-red-500 transition-colors font-semibold">Sign Out</button>
          </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background p-8">
        {/* ── Plan Lockout Banner ── */}
        {isLockedOut && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-4">
            <div className="mt-0.5 text-red-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-500">Plan Limit Exhausted ({planLimit} mins)</h3>
              <p className="text-xs text-red-400 mt-1">Your AI agent has been paused because you have reached your plan limit for this month. All inbound and outbound calls are disabled. Your dashboard is still accessible.</p>
            </div>
            <button onClick={() => window.location.href='mailto:support@azlon.ai'} className="shrink-0 bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">Contact Support</button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {activePage === 'dashboard' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Dashboard</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Real-time overview of your AI voice agent</p>
              </div>
              <button onClick={fetchAll} className="btn-premium flex items-center gap-2 text-xs text-muted-foreground hover:text-primary border border-border px-4 py-2 rounded-xl font-semibold bg-card">
                <RefreshCw size={13} strokeWidth={2.5} /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-4 gap-5">
              {[
                { label: 'Total Calls', value: callLogs.filter(c => { const d = new Date(c.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length, sub: 'This month', color: 'from-violet-500/10 to-indigo-500/10', accent: 'text-violet-400' },
                { label: 'Appointments', value: appointments.filter(a => { const d = new Date(a.created_at || a.start_time); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length, sub: 'Booked by AI', color: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },
                { label: 'Active Contacts', value: new Set([...callLogs.filter(c => { const d = new Date(c.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).filter(c => c.from_phone || c.to_phone).map(c => c.direction === 'inbound' ? c.from_phone : c.to_phone), ...leads.filter(l => { const d = new Date(l.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).map(l => l.phone).filter(Boolean)]).size, sub: 'Unique Callers', color: 'from-blue-500/10 to-cyan-500/10', accent: 'text-blue-400' },
                { label: 'Completed', value: callLogs.filter(c => { const d = new Date(c.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && c.status === 'completed'; }).length, sub: 'Finished calls', color: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' }
              ].map((stat, i) => (
                <div key={i} className={`stat-card bg-gradient-to-br ${stat.color} border border-border rounded-2xl p-6`}>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-ultra">{stat.label}</div>
                  <div className={`text-4xl font-black mt-3 tracking-tight ${stat.accent}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-2 font-medium">{stat.sub}</div>
                </div>
              ))}
            </div>
            {/* ── Minutes Usage Widget ── */}
            {(() => {
              const { planKey, planLimit, nowForLockout, minsUsed } = (() => {
                const planLimits = { Starter: 500, Pro: 2000, Business: 5000, Enterprise: null };
                const planKey = (user?.plan || 'Starter').split(' ')[0];
                const planLimit = planLimits[planKey] ?? null;
                const now = new Date();
                const thisMonthCalls = callLogs.filter(c => { const d = new Date(c.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
                const minsUsed = Math.round(thisMonthCalls.reduce((acc, c) => acc + (c.duration_seconds || c.duration || 0), 0) / 60);
                return { planKey, planLimit, nowForLockout: now, minsUsed };
              })();
              const minsRemaining = planLimit !== null ? Math.max(0, planLimit - minsUsed) : null;
              const pct = planLimit ? Math.min(100, Math.round((minsUsed / planLimit) * 100)) : 0;
              const barColor = pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-primary';
              return (
                <div className="bg-card border border-border p-6 rounded-2xl shadow-premium relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <h3 className="font-bold text-foreground">Monthly Usage</h3>
                      <p className="text-xs text-muted-foreground font-medium mt-1">{nowForLockout.toLocaleString('default', { month: 'long', year: 'numeric' })} • {planKey} Plan</p>
                    </div>
                  </div>
                  <div className="mt-6 relative z-10">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">{minsUsed} <span className="text-muted-foreground font-normal">mins used</span></span>
                      <span>{planLimit !== null ? <><span className="text-foreground font-bold">{minsRemaining}</span> mins remaining</> : <span className="text-emerald-400 font-bold">Unlimited</span>}</span>
                    </div>
                    <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-3 gap-5">
              {/* Win Chart: Call Outcomes */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium flex flex-col h-[350px]">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Target size={14} className="text-primary" /> Call Outcomes</h3>
                <p className="text-2xs text-muted-foreground mb-4 uppercase tracking-wider font-bold">Conversion Breakdown</p>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reports?.outcomes || []}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(reports?.outcomes || []).map((entry, index) => {
                          const COLORS = {
                            'Positive': '#10b981', // Emerald
                            'Neutral': '#3b82f6', // Blue
                            'Negative': '#f43f5e', // Rose
                            'No Connection': '#64748b' // Slate
                          };
                          return <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#8b5cf6'} stroke="none" />;
                        })}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '12px', color: '#f8fafc' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Peak Operations: Hourly Volume */}
              <div className="col-span-2 bg-card border border-border rounded-2xl p-6 shadow-premium flex flex-col h-[350px]">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Clock size={14} className="text-primary" /> Peak Operations</h3>
                <p className="text-2xs text-muted-foreground mb-4 uppercase tracking-wider font-bold">Hourly Call Volume</p>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reports?.hourlyVolume || []}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="hour" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} 
                        tickFormatter={(value) => {
                          if (value === '12 AM' || value === '12 PM' || value === '11 PM') return value;
                          return value.replace(' AM', '').replace(' PM', '');
                        }}
                        interval={0}
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#8b5cf6' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Duration Trend: Last 10 Calls */}
              <div className="col-span-3 bg-card border border-border rounded-2xl p-6 shadow-premium flex flex-col h-[300px]">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Activity size={14} className="text-primary" /> Call Engagement</h3>
                <p className="text-2xs text-muted-foreground mb-4 uppercase tracking-wider font-bold">Duration of Recent Sessions (Seconds)</p>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports?.recentDurations || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Bar dataKey="duration" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Keep existing mini-tables below */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium">
                <h3 className="font-bold text-sm mb-5 pb-3 border-b border-border flex items-center gap-2"><Phone size={14} strokeWidth={2.5} className="text-primary" /> Recent Calls</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="border-b border-border"><th className="pb-3 text-muted-foreground font-semibold text-2xs uppercase tracking-ultra whitespace-nowrap">Number</th><th className="pb-3 text-muted-foreground font-semibold text-2xs uppercase tracking-ultra">Status</th><th className="pb-3 text-muted-foreground font-semibold text-2xs uppercase tracking-ultra">Date</th></tr></thead>
                    <tbody>
                      {callLogs.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-3 font-mono text-primary text-xs font-semibold">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                          <td className="py-3"><span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-2xs uppercase font-bold tracking-wide">{c.status}</span></td>
                          <td className="py-3 text-muted-foreground text-xs font-medium">{new Date(c.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium">
                <h3 className="font-bold text-sm mb-5 pb-3 border-b border-border flex items-center gap-2"><Calendar size={14} strokeWidth={2.5} className="text-primary" /> Upcoming Appointments</h3>
              <div className="space-y-1">
                  {appointments
                    .filter(a => new Date(a.start_time) > new Date())
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                    .slice(0, 5)
                    .map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-border/30 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                      <div>
                        <div className="text-sm font-semibold tracking-tight">{a.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.phone}</div>
                      </div>
                      <div className="text-xs text-primary text-right font-semibold">{new Date(a.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </div>
                  ))}
                  {appointments.filter(a => new Date(a.start_time) > new Date()).length === 0 && <div className="text-center py-8 text-muted-foreground text-xs font-medium">No upcoming appointments</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {activePage === 'reports' && (
          <div className="space-y-8 fade-in w-full">
             <div className="flex justify-between items-center">
               <div>
                 <h2 className="text-3xl font-extrabold tracking-tight">Analytics</h2>
                 <p className="text-sm text-muted-foreground mt-1.5 font-medium">Live business metrics and conversions.</p>
               </div>
               <select 
                 className="bg-card border border-border text-sm p-2 rounded-lg outline-none cursor-pointer"
                 value={reportDateRange} 
                 onChange={e => setReportDateRange(e.target.value)}
               >
                 <option value="all_time">All Time</option>
                 <option value="today">Today</option>
                 <option value="yesterday">Yesterday</option>
                 <option value="last_7_days">Last 7 Days</option>
                 <option value="this_month">This Month</option>
                 <option value="last_month">Last Month</option>
               </select>
             </div>
             {reports ? (
               <div className="grid grid-cols-3 gap-5">
                 <div className="stat-card bg-card border border-border rounded-2xl p-6 shadow-premium">
                   <div className="text-2xs text-muted-foreground uppercase tracking-ultra font-bold">Total Calls</div>
                   <div className="text-4xl font-black mt-3 tracking-tight">{reports.totalCalls}</div>
                   <div className="flex gap-3 mt-4 text-xs text-muted-foreground">
                     <span className="bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-lg font-semibold text-2xs">Inbound: {reports.inboundCalls}</span>
                     <span className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg font-semibold text-2xs">Outbound: {reports.outboundCalls}</span>
                   </div>
                 </div>
                 <div className="stat-card bg-card border border-border rounded-2xl p-6 shadow-premium">
                   <div className="text-2xs text-muted-foreground uppercase tracking-ultra font-bold">Call Duration</div>
                   <div className="text-4xl font-black mt-3 tracking-tight">{reports.totalMinutes} <span className="text-lg text-muted-foreground font-semibold">mins</span></div>
                 </div>
                 <div className="stat-card bg-gradient-to-br from-primary/5 to-purple-500/5 border border-border rounded-2xl p-6 shadow-premium relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><Target size={80} strokeWidth={1} /></div>
                   <div className="text-2xs text-muted-foreground uppercase tracking-ultra font-bold relative z-10">AI Bookings</div>
                   <div className="text-4xl font-black mt-3 text-primary relative z-10 tracking-tight">{reports.bookedAppointments}</div>
                 </div>
                 <div className="col-span-3 bg-card border border-border rounded-2xl p-6 shadow-premium">
                   <h3 className="font-bold text-sm tracking-tight">Call Sentiment Analysis</h3>
                   <div className="flex w-full h-10 rounded-xl overflow-hidden shrink-0 mt-6">
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.positive/reports.totalCalls)*100 : 0}%`}} className="bg-emerald-500 h-full flex items-center justify-center text-2xs font-bold text-white transition-all">{reports.sentiment.positive > 0 && reports.sentiment.positive}</div>
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.neutral/reports.totalCalls)*100 : 100}%`}} className="bg-muted h-full flex items-center justify-center text-2xs font-bold text-muted-foreground transition-all">{reports.sentiment.neutral > 0 && reports.sentiment.neutral}</div>
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.negative/reports.totalCalls)*100 : 0}%`}} className="bg-red-500 h-full flex items-center justify-center text-2xs font-bold text-white transition-all">{reports.sentiment.negative > 0 && reports.sentiment.negative}</div>
                   </div>
                   <div className="flex gap-6 mt-5 text-xs text-muted-foreground justify-center font-semibold">
                     <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span>Positive</span>
                     <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted"></span>Neutral</span>
                     <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span>Negative</span>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="text-center py-20 text-muted-foreground text-sm flex flex-col items-center gap-3">
                 <RefreshCw className="animate-spin text-primary" size={24} /> Loading reports...
               </div>
             )}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {activePage === 'calendar' && (
          <div className="space-y-6 fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Internal AI Calendar</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Live view of all AI-booked appointments</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => fetchSlotsForDate(calendarDate)} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition bg-card shadow-sm">
                  <RefreshCw size={12} /> Check Free Slots
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid */}
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); setAvailableSlots([]); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition text-lg">‹</button>
                  <h3 className="font-bold text-base">{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                  <button onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); setAvailableSlots([]); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition text-lg">›</button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array(daysInMonth).fill(null).map((_, i) => {
                    const day = i + 1;
                    const thisDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                    const appts = appointmentsForDate(thisDate);
                    const isToday = thisDate.toDateString() === today.toDateString();
                    const isSelected = thisDate.toDateString() === calendarDate.toDateString() && calendarDate.getDate() === day;
                    return (
                      <button key={day} onClick={() => { const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day); setCalendarDate(d); fetchSlotsForDate(d); }}
                        className={cn("relative h-10 w-full rounded-lg text-sm font-medium transition-all hover:bg-primary/20",
                          isToday && "ring-2 ring-primary",
                          isSelected && "bg-primary text-white",
                          !isSelected && "hover:bg-white/5"
                        )}>
                        {day}
                        {appts.length > 0 && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-400" />}
                      </button>
                    );
                  })}
                </div>
                {/* Available Slots */}
                {((availableSlots.length > 0 || loadingSlots) || (agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate))) && (
                  <div className="mt-6 border-t border-border pt-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Free Slots — {calendarDate.toLocaleDateString()}
                    </h4>
                    {loadingSlots ? (
                      <div className="text-xs text-muted-foreground italic">Fetching available time slots...</div>
                    ) : (agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate)) ? (
                      <div className="bg-amber-500/5 text-amber-500/60 border border-amber-500/10 p-3 rounded-lg text-xs font-medium italic">
                        Business is closed on this date (marked as holiday).
                      </div>
                    ) : Array.isArray(availableSlots) && availableSlots.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot, i) => (
                          <span key={i} className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-mono">
                            {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-amber-500/5 text-amber-500/60 border border-amber-500/10 p-3 rounded-lg text-xs font-medium">
                        {typeof availableSlots === 'string' ? availableSlots : "No free slots available for this date."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Panel: Appointments for selected date + Manual Controls */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                    <h3 className="font-semibold text-sm">
                      {calendarDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                         const dStr = toYYYYMMDD(calendarDate);
                         setAgentSettings(prev => {
                           const currArr = prev.non_working_dates || [];
                           const isHoliday = currArr.includes(dStr);
                           const nextArr = isHoliday ? currArr.filter(x => x !== dStr) : [...currArr, dStr];
                           const updated = { ...prev, non_working_dates: nextArr };
                           console.info(`[Holiday Toggle] date: ${dStr} | action: ${isHoliday ? 'REMOVE' : 'ADD'} | nextArr:`, nextArr);
                           // Background sync
                           fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({...updated, client_id: (user?.client_code || user?.clientCode)}) });
                           return updated;
                         });
                      }} className={cn("text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border transition-colors", (agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate)) ? "bg-red-500/20 text-red-500 border-red-500/20" : "bg-white/5 border-border hover:bg-white/10 text-muted-foreground")}>
                        {(agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate)) ? "Holiday" : "Mark Holiday"}
                      </button>
                      <button onClick={() => setCalendarModal({ date: calendarDate })} className="text-[9px] bg-primary text-white border border-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-bold hover:bg-primary/90 transition-colors shadow shadow-primary/20">+ Book</button>
                    </div>
                  </div>
                  {appointmentsForDate(calendarDate).length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">No appointments on this day</div>
                  ) : (
                    <div className="space-y-3">
                      {appointmentsForDate(calendarDate).map((a, i) => (
                        <div key={i} className="group relative bg-background rounded-lg p-3 border border-border transition hover:border-primary/50 relative">
                           <div className="absolute top-2 right-2">
                             <button onClick={() => setEditingAppt(editingAppt === a.id ? null : a.id)} className="text-muted-foreground hover:text-primary p-1.5 rounded-lg transition hover:bg-white/10" title="Edit appointment">
                               <Edit2 size={13} strokeWidth={2} />
                             </button>
                             {editingAppt === a.id && (
                                <div className="absolute top-8 right-0 bg-card border border-border rounded-xl shadow-xl w-48 py-1 z-50 animate-in slide-in-from-top-2">
                                   <button onClick={() => {
                                      setEditingAppt(null);
                                      setCalendarModal({ date: new Date(a.start_time), mode: 'reschedule', rescheduleId: a.id, prefill: a });
                                   }} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition">Allocate new time</button>
                                   <button onClick={() => {
                                       setEditingAppt(null);
                                       showConfirm('Mark this meeting as completed? It will be removed from the calendar.', async () => {
                                         await fetch(`${API_BASE}/api/appointments/manual/${a.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'completed' })});
                                         showToast('Meeting marked as completed!', 'success');
                                         fetchAll();
                                       });
                                    }} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-500/10 text-blue-400 transition">✓ Meeting Over</button>
                                    <button onClick={() => {
                                       setEditingAppt(null);
                                       showConfirm('Mark current meeting as done and book a follow-up appointment?', async () => {
                                         await fetch(`${API_BASE}/api/appointments/manual/${a.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'completed' })});
                                         showToast('Marked complete! Now select a new time for the follow-up.', 'success');
                                         fetchAll();
                                         setCalendarModal({ date: new Date(), mode: 'followup', prefill: a });
                                       });
                                    }} className="w-full text-left px-4 py-2 text-xs hover:bg-emerald-500/10 text-emerald-400 transition">📅 Follow-up appointment</button>
                                    <button onClick={() => {
                                       setEditingAppt(null);
                                       showConfirm('Are you sure you want to permanently delete this appointment?', async () => {
                                          await fetch(`${API_BASE}/api/appointments/manual/${a.id}`, { method: 'DELETE' });
                                          showToast('Appointment deleted', 'success');
                                          fetchAll();
                                       });
                                    }} className="w-full text-left px-4 py-2 text-xs hover:bg-red-500/10 text-red-500 transition">🗑 Delete appointment</button>
                                </div>
                             )}
                           </div>
                          <div className="font-semibold text-sm pr-8">{a.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.phone}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                             <span className="text-xs text-primary font-medium tracking-tight">
                               {new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             {a.status === 'completed' && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-bold">Done</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Business Hours UI */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
                  <h3 className="font-semibold text-sm mb-4 border-b border-border pb-3">Business hours</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">From</label>
                        <input type="time" value={agentSettings.open_time || '09:00'} onChange={e => setAgentSettings({...agentSettings, open_time: e.target.value})} className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Until</label>
                        <input type="time" value={agentSettings.close_time || '18:00'} onChange={e => setAgentSettings({...agentSettings, close_time: e.target.value})} className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-2">Active Days</label>
                      <div className="flex flex-wrap gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                          const isActive = Array.isArray(agentSettings.working_days) ? agentSettings.working_days.includes(day) : ['Mon','Tue','Wed','Thu','Fri'].includes(day);
                          return (
                            <button key={day} onClick={() => {
                              const curr = Array.isArray(agentSettings.working_days) ? agentSettings.working_days : ['Mon','Tue','Wed','Thu','Fri'];
                              const next = isActive ? curr.filter(d => d !== day) : [...curr, day];
                              setAgentSettings({...agentSettings, working_days: next});
                            }} className={cn("px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all", isActive ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-border")}>{day}</button>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={async (e) => {
                       const btn = e.target;
                       btn.innerText = 'Saving...';
                       try {
                         await fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({...agentSettings, client_id: (user?.client_code || user?.clientCode)}) });
                         btn.innerText = 'Saved!';
                         setTimeout(() => btn.innerText = 'Save Settings', 2000);
                       } catch(err) {} 
                    }} className="w-full bg-primary text-white text-xs font-semibold py-2 rounded-lg mt-2 shadow flex items-center justify-center">Save Settings</button>
                  </div>
                </div>
              </div>
            </div>

            {/* All Appointments Table */}
            <div className="bg-card border border-border rounded-xl shadow-xl">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">All AI-Booked Appointments</h3>
                <button onClick={() => fetchAll()} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"><RefreshCw size={11}/> Sync Live</button>
              </div>
              <div className="p-4">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-border"><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Name</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Phone</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Date & Time</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">SMS Status</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">WhatsApp Status</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Email Status</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Booking</th></tr></thead>
                  <tbody>
                    {appointments.map((a, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition">
                        <td className="py-3 px-2 font-medium">{a.name}</td>
                        <td className="py-3 px-2 font-mono text-primary text-xs">{a.phone || '-'}</td>
                        <td className="py-3 px-2 text-xs">{new Date(a.start_time).toLocaleString()}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            a.sms_status === 'Sent' ? 'bg-green-500/10 text-green-400' : 
                            a.sms_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {a.sms_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            a.whatsapp_status === 'Sent' ? 'bg-green-500/10 text-green-400' : 
                            a.whatsapp_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {a.whatsapp_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            a.email_status === 'Sent' ? 'bg-green-500/10 text-green-400' : 
                            a.email_status === 'Failed' ? 'bg-red-500/10 text-red-500' : 
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {a.email_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2"><span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">{a.status || 'confirmed'}</span></td>
                      </tr>
                    ))}
                    {appointments.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-muted-foreground text-xs">No appointments booked by AI yet. Test by calling your Twilio number!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── INBOUND AGENT ── */}
        {activePage === 'agent' && (
          <div className="space-y-8 fade-in w-full">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Inbound Agent</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">Configure your main AI voice agent that handles inbound calls</p></div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-agent-btn'); btn.innerText = 'Saving...';
                try {
                  const payload = {
                    system_prompt: e.target.prompt.value,
                    greeting_message: e.target.greeting.value,
                    personality: e.target.personality.value,
                    voice_preset: e.target.voice.value,
                    temperature: parseFloat(e.target.temp.value),
                    tools_config: agentSettings.tools_config || {
                      hangUp: true,
                      transferCall: false,
                      queryCorpus: false,
                      leaveVoicemail: false,
                      playDtmfSounds: false
                    },
                    record_calls: agentSettings.record_calls !== false,
                    ultravox_agent_id: e.target.ultravox_agent_id.value
                  };
                  const res = await fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, client_id: (user?.client_code || user?.clientCode) }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                  btn.innerText = 'Saved!';
                  showToast('Agent settings updated and live!', 'success');
                  setTimeout(() => btn.innerText = 'Save Configuration', 2000);
                } catch(err) {
                  btn.innerText = 'Save Configuration';
                  showToast('Save failed: ' + err.message, 'error');
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Agent Greeting Message</label>
                    <input name="greeting" defaultValue={agentSettings.greeting_message} placeholder="Hello, thanks for calling! How can I help you today?" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" required disabled={!onBackToAdmin} />
                    <p className="text-[10px] text-muted-foreground mt-1">The first thing the AI will say when answering.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Agent ID (Optional)</label>
                    <div className="flex gap-2">
                      <input id="inbound_agent_id_input" name="ultravox_agent_id" defaultValue={agentSettings.ultravox_agent_id} placeholder="e.g. 1a2b3c4d-5e6f..." className="flex-1 bg-background border border-border rounded-lg p-3 text-sm outline-none" disabled={!onBackToAdmin} />
                      {!!onBackToAdmin && (
                        <button type="button" onClick={async () => {
                          const val = document.getElementById('inbound_agent_id_input').value;
                          if(!val) return;
                          try {
                            showToast('Syncing config...', 'success');
                            const cid = user?.client_code || user?.clientCode || '';
                            const res = await fetch(`${API_BASE}/api/ultravox/proxy-agent/${val}?client_id=${cid}`);
                            const data = await res.json();
                            if(data.success) {
                              if(data.agent.systemPrompt) document.getElementsByName('prompt')[0].value = data.agent.systemPrompt;
                              if(data.agent.voice) document.getElementsByName('voice')[0].value = data.agent.voice;
                              if(data.agent.temperature !== undefined) document.getElementsByName('temp')[0].value = data.agent.temperature;
                              if(data.agent.firstSpeaker === 'AGENT') {
                                // Usually if firstSpeaker is AGENT, there's a greeting somewhere, though UV doesn't store greeting directly in agent.
                                // We just set tools
                              }
                              
                              if(data.agent.tools && Array.isArray(data.agent.tools)) {
                                 const toolNames = data.agent.tools.map(t => typeof t === 'string' ? t : t.toolName);
                                 setAgentSettings(prev => ({
                                   ...prev,
                                   tools_config: {
                                      ...prev.tools_config,
                                      hangUp: toolNames.includes('hangUp'),
                                      transferCall: toolNames.includes('transferCall'),
                                      queryCorpus: toolNames.includes('queryCorpus'),
                                      leaveVoicemail: toolNames.includes('leaveVoicemail'),
                                      playDtmfSounds: toolNames.includes('playDtmfSounds')
                                   }
                                 }));
                              }

                              showToast('Config synced!', 'success');
                            } else {
                              showToast(data.error || 'Failed to sync', 'error');
                            }
                          } catch(e) { showToast('Network Error', 'error'); }
                        }} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-xs font-bold transition">Sync</button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Auto-syncs prompt and voice from your cloud configuration.</p>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Personality & Tone</label>
                     <select name="personality" defaultValue={agentSettings.personality || 'professional'} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" disabled={!onBackToAdmin}>
                       <option value="professional">Professional & Helpful Support</option>
                       <option value="warm">Warm & Empathetic</option>
                       <option value="sales">Aggressive Sales Closer</option>
                       <option value="casual">Friendly & Casual Buddy</option>
                       <option value="technical">Strictly Technical / Direct</option>
                     </select>
                  </div>
                </div>

                <h3 className="font-semibold text-sm mb-3 border-b border-border pb-3">Advanced System Instructions</h3>
                <p className="text-xs text-muted-foreground mb-3">Defines the specific guardrails and logic of the agent. (Do not put Knowledge Base text here, use the Knowledge Base tab instead).</p>
                <textarea name="prompt" defaultValue={agentSettings.system_prompt} className="w-full bg-background border border-border rounded-lg p-4 font-mono text-[13px] outline-none resize-none h-[150px] mb-6 disabled:opacity-50" placeholder="You are the smart AI agent..." required disabled={!onBackToAdmin} />
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Voice Model</label>
                    <select name="voice" defaultValue={agentSettings.voice_preset} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" disabled={!onBackToAdmin}>
                      <optgroup label="AI Voices">
                        <option value="9ed99f35-ddd5-4efb-9c62-9ce9483bab61">🇺🇸 Mark (Male, Professional)</option>
                        <option value="79a125e8-cd45-4c13-8a67-188112f4dd22">🇺🇸 Terrence (Male, Deep)</option>
                        <option value="b28f7f08-685c-4219-a2a0-c539b985b9fd">🇺🇸 Alex (Male, Friendly)</option>
                        <option value="a88fb2af-16ec-41a2-b6e9-86ef2f5c9622">🇺🇸 Jessica (Female, Warm)</option>
                        <option value="f972fbf6-89f5-40a1-9ad7-ee0aa445e8c3">🇺🇸 Sarah (Female, Conversational)</option>
                        <option value="5f8e97b1-cd48-431a-b6a1-3b94306d8914">🇬🇧 David (Male, British)</option>
                        <option value="d20e12df-6fd9-428e-a81f-ba0090de13d9">🇬🇧 Emily (Female, British)</option>
                        <option value="bf3ee560-7c86-4d46-9f23-81b12dd6ba5f">🇺🇸 Ryan (Male, Energetic)</option>
                        <option value="280a8e4d-2974-4593-87eb-fb74f0278a2e">🇦🇺 Arlo (Male, Australian)</option>
                        <option value="8ff05d3d-d78d-40a6-88c1-dd1efcf571f0">🇦🇺 Hannah (Female, Australian)</option>
                      </optgroup>
                      <optgroup label="Custom Integration">
                        <option value="elevenlabs:custom">🎙️ My Custom ElevenLabs Voice</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Creativity (Temp)</label>
                    <input name="temp" type="number" step="0.1" max="1" min="0" defaultValue={agentSettings.temperature} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" disabled={!onBackToAdmin} />
                  </div>
                </div>
                <div className="mt-8 flex justify-end pt-4 border-t border-border">
                  <button id="save-agent-btn" type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-lg text-sm shadow-lg shadow-primary/20 transition">Save Configuration</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── TOOLS ── */}
        {activePage === 'tools' && (
          <div className="space-y-8 fade-in w-full">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Built-in Tools & Capabilities</h2>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">Configure advanced voice capabilities that apply dynamically to both inbound and outbound calls</p>
            </div>
            
            <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
              <form key={JSON.stringify(agentSettings.tools_config) + agentSettings.record_calls} onSubmit={async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-tools-btn');
                btn.innerText = 'Saving...';
                try {
                  const payload = {
                    ...agentSettings,
                    tools_config: {
                      hangUp: e.target.hangUp.checked,
                      transferCall: e.target.transferCall.checked,
                      queryCorpus: e.target.queryCorpus.checked,
                      leaveVoicemail: e.target.leaveVoicemail.checked,
                      playDtmfSounds: e.target.playDtmfSounds.checked
                    },
                    record_calls: e.target.record_calls.checked
                  };
                  const res = await fetch(`${API_BASE}/api/agent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, client_id: (user?.client_code || user?.clientCode) })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                  
                  setAgentSettings(prev => ({
                    ...prev,
                    tools_config: payload.tools_config,
                    record_calls: payload.record_calls
                  }));
                  
                  btn.innerText = 'Saved!';
                  showToast('Tools configuration updated and live!', 'success');
                  setTimeout(() => btn.innerText = 'Save Configuration', 2000);
                } catch(err) {
                  btn.innerText = 'Save Configuration';
                  showToast('Save failed: ' + err.message, 'error');
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Call Controls Group */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Telephony & Call Control</h3>
                    
                    <div className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">Call Termination</div>
                        <div className="text-[10px] text-muted-foreground">Allows AI to hang up automatically when caller says goodbye</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="hangUp" defaultChecked={agentSettings.tools_config?.hangUp ?? true} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">Human Transfer</div>
                        <div className="text-[10px] text-muted-foreground">Allows AI to transfer calls to a human agent when requested</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="transferCall" defaultChecked={agentSettings.tools_config?.transferCall ?? false} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">Play DTMF Tones</div>
                        <div className="text-[10px] text-muted-foreground">Allows AI to press keys to navigate IVR telephone systems</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="playDtmfSounds" defaultChecked={agentSettings.tools_config?.playDtmfSounds ?? false} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>

                  {/* AI & Automation Group */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">AI Intelligence & Recording</h3>

                    <div className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">Knowledge Base Search</div>
                        <div className="text-[10px] text-muted-foreground">Enables RAG searches on uploaded documents/website URLs</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="queryCorpus" defaultChecked={agentSettings.tools_config?.queryCorpus ?? false} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">Leave Voicemail</div>
                        <div className="text-[10px] text-muted-foreground">Allows AI to leave a voicemail and end call on answering machines</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="leaveVoicemail" defaultChecked={agentSettings.tools_config?.leaveVoicemail ?? false} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">Master Call Recording</div>
                        <div className="text-[10px] text-muted-foreground">Record all call audio and save transcripts</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="record_calls" defaultChecked={agentSettings.record_calls !== false} className="sr-only peer" />
                        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end pt-4 border-t border-border">
                  <button id="save-tools-btn" type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-lg text-sm shadow-lg shadow-primary/20 transition">Save Configuration</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── CALL LOGS (Redesigned) ── */}
        {activePage === 'logs' && (
          <div className="space-y-6 fade-in w-full">
            <div className="flex justify-between items-start">
              <h2 className="text-3xl font-extrabold tracking-tight">Call Logs & Telemetry</h2>
               <div className="flex items-center gap-3">
                 <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
                   {['All', 'Positive', 'Neutral', 'Negative'].map(f => (
                     <button key={f} onClick={() => setLogSentimentFilter(f)} className={cn("px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition", logSentimentFilter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-white/5")}>{f}</button>
                   ))}
                 </div>
                 <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5">
                    <Filter size={11} className="text-muted-foreground" />
                    <input type="date" value={logDateFilter.from} onChange={e => setLogDateFilter({...logDateFilter, from: e.target.value})} className="bg-transparent text-[11px] outline-none text-muted-foreground" title="From Date" />
                    <span className="text-muted-foreground/30 text-xs">-</span>
                    <input type="date" value={logDateFilter.to} onChange={e => setLogDateFilter({...logDateFilter, to: e.target.value})} className="bg-transparent text-[11px] outline-none text-muted-foreground" title="To Date" />
                 </div>
                 <button 
                   onClick={() => {
                     const rows = callLogs.map(c => [new Date(c.created_at).toLocaleString(), c.caller_name||'Unknown', c.direction==='inbound'?c.from_phone:c.to_phone, c.direction, c.duration_seconds+'s', c.ai_summary||'', c.sentiment_category||'Neutral'].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
                     const csv = ['Date,Name,Number,Direction,Duration,Summary,Sentiment', ...rows].join('\n');
                     const blob = new Blob([csv], { type: 'text/csv' });
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.setAttribute('hidden', '');
                     a.setAttribute('href', url);
                     a.setAttribute('download', `call_report_${new Date().toISOString().split('T')[0]}.csv`);
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                   }}
                   className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition"
                 >
                   <Download size={11}/> Export
                 </button>
                 <button 
                    onClick={() => {
                        const clientId = user?.client_code || user?.clientCode;
                        if (!clientId) { showToast("Client ID missing", "error"); return; }
                        fetch(`${API_BASE}/api/calls?client_id=${clientId}`).then(r=>r.json()).then(d=>{if(d.success)setCallLogs(d.calls)});
                    }}
                   className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition"
                 >
                   <RefreshCw size={11}/> Sync
                 </button>
               </div>
            </div>
            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border bg-sidebar/50">
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caller Name</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direction</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Summary</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Sentiment</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Recordings</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {callLogs.filter(c => {
                      if (logSentimentFilter !== 'All') {
                        const cat = (c.sentiment_category || 'Neutral').toLowerCase();
                        if (logSentimentFilter.toLowerCase() !== cat) return false;
                      }
                      if (logDateFilter.from) {
                        if (new Date(c.created_at) < new Date(logDateFilter.from)) return false;
                      }
                      if (logDateFilter.to) {
                        const toDate = new Date(logDateFilter.to);
                        toDate.setHours(23,59,59,999);
                        if (new Date(c.created_at) > toDate) return false;
                      }
                      return true;
                    }).map((c, i) => (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-5 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="py-4 px-5 text-xs font-medium">{c.caller_name || 'Unknown'}</td>
                          <td className="py-4 px-5 font-mono text-primary text-xs">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                          <td className="py-4 px-5 capitalize text-[11px] tracking-wide text-muted-foreground">{c.direction}</td>
                          <td className="py-4 px-5 text-xs font-mono">{c.duration_seconds ? `${c.duration_seconds}s` : '—'}</td>
                          <td className="py-4 px-5 text-center">
                            <button onClick={() => setViewSummaryModal(c)} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-full border border-border transition-colors">View Data</button>
                          </td>
                           <td className="py-4 px-5 text-center">
                              <div className={cn(
                                "px-4 py-1.5 rounded-full text-[10px] items-center justify-center flex transition-all border shadow-sm font-bold tracking-wide mx-auto w-max",
                                (!c.duration_seconds || c.duration_seconds === 0) ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                                (c.sentiment_category === 'Positive') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                (c.sentiment_category === 'Negative') ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                                "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              )}>
                                {(() => {
                                  if (!c.duration_seconds || c.duration_seconds === 0) return 'No Connection';
                                  const cat = (c.sentiment_category || 'Neutral');
                                  if (cat === 'Positive') return 'Positive';
                                  if (cat === 'Negative') return 'Negative';
                                  return 'Neutral';
                                })()}
                              </div>
                           </td>
                          <td className="py-4 px-5 text-center">
                            {c.recording_url ? (
                              <button 
                                onClick={() => setExpandedRecording(expandedRecording === c.id ? null : c.id)}
                                className={cn(
                                  "p-2 rounded-full transition-all",
                                  expandedRecording === c.id ? "bg-primary/20 text-primary shadow-inner" : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                                )}
                              >
                                <Mic size={16} />
                              </button>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <span className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider",
                              c.call_status === 'Booked' ? "bg-blue-500/10 text-blue-400" :
                              c.call_status === 'Missed' ? "bg-red-500/10 text-red-500" :
                              c.call_status === 'Follow Up' ? "bg-yellow-500/10 text-yellow-500" :
                              c.call_status === 'Resolved' ? "bg-green-500/10 text-green-500" :
                              "bg-primary/10 text-primary")}>
                              {c.call_status || c.status || 'Completed'}
                            </span>
                          </td>
                        </tr>
                        {c.recording_url && expandedRecording === c.id && (
                          <tr className="bg-sidebar/10 border-b border-border/30">
                            <td colSpan="9" className="py-2 px-5">
                               <div className="flex items-center justify-between gap-4 bg-background border border-border rounded-xl p-2 w-full max-w-4xl mx-auto shadow-sm animate-in slide-in-from-top-1 duration-200">
                                 <div className="flex items-center gap-2 px-2 flex-shrink-0">
                                   <Mic size={14} className="text-primary" />
                                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 border-l border-border ml-1">Recording</span>
                                 </div>
                                 <audio controls className="w-full h-8 outline-none grayscale opacity-90 hover:opacity-100 hover:grayscale-0 transition-all">
                                   <source src={c.recording_url && c.recording_url.includes('api.twilio.com') ? `${API_BASE}/api/recordings/${c.twilio_sid}` : c.recording_url} type="audio/mpeg" />
                                 </audio>
                               </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {callLogs.length === 0 && <tr><td colSpan="9" className="text-center py-12 text-muted-foreground text-xs">No calls logged yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CRM CONTACTS (Existing basic contacts) ── */}
        {activePage === 'crm' && (
           <div className="space-y-8 fade-in max-w-4xl mx-auto">
             <h2 className="text-3xl font-extrabold tracking-tight">Standard Contacts</h2>
             <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
               {/* Hidden for brevity, just keeping table alive */}
               <div className="text-sm text-muted-foreground mb-4">Please use the new "Lead CRM" sidebar for the upgraded experience.</div>
             </div>
           </div>
        )}

        {/* ── LEAD CRM ── */}
        {activePage === 'leads' && (
          <div className="space-y-6 fade-in w-full">
            <div className="flex justify-between">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Lead Management</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">AI-enriched CRM — agent reads call history before every conversation</p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[ {l: 'Hot Leads', v: leads.filter(x=>x.segment==='Hot').length, c: 'text-red-500'}, {l: 'Warm Pipelines', v: leads.filter(x=>x.segment==='Warm').length, c: 'text-orange-400'}, {l: 'Qualified', v: leads.filter(x=>x.segment==='Qualified').length, c: 'text-primary'}, {l: 'Auto-captured', v: leads.filter(x=>x.segment==='Auto-captured').length, c: 'text-blue-400'} ].map((m,i)=> (
                <div key={i} className="bg-card border border-border rounded-xl p-5 shadow flex flex-col items-center justify-center">
                  <div className={`text-3xl font-bold ${m.c}`}>{m.v}</div>
                  <div className="text-xs uppercase font-medium mt-1 text-muted-foreground tracking-wider">{m.l}</div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20 rounded-xl flex items-start gap-3">
              <span className="text-xl">🧠</span>
              <div>
                <p className="text-xs font-bold text-primary">Caller Memory System Active</p>
                <p className="text-xs text-muted-foreground mt-0.5">Every time a call completes, the AI summary is saved here. On the next call from the same number, the AI reads this history and greets them by name with context — no generic greetings.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="p-4 border-b border-border bg-sidebar/30 flex justify-between items-center">
                 <div>
                   <h3 className="font-semibold text-sm">Lead Database</h3>
                   <p className="text-xs text-muted-foreground mt-0.5">Auto-captured from calls. Click "View Memory" on any lead to see their full call history.</p>
                 </div>
                 <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm" onClick={()=>setManualLeadModal(true)}>+ Manual Lead</button>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-sidebar/20">
                    <th className="py-3 px-4 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="py-3 px-4 text-xs font-medium text-muted-foreground">Phone</th>
                    <th className="py-3 px-4 text-xs font-medium text-muted-foreground">AI Context & Memory</th>
                    <th className="py-3 px-4 text-xs font-medium text-muted-foreground">Segment</th>
                    <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => {
                    const historyLines = l.ai_context ? l.ai_context.trim().split('\n').filter(Boolean) : [];
                    const callCount = historyLines.length;
                    const isExpanded = expandedRecording === `lead-${l.id}`;
                    return (
                      <React.Fragment key={i}>
                        <tr className={`border-b border-border/40 hover:bg-white/5 transition ${isExpanded ? 'bg-primary/5' : ''}`}>
                          <td className="py-3 px-4 font-medium">
                            {l.name || <span className="text-muted-foreground/50 italic text-xs">No name yet</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-primary text-xs">{l.phone}</td>
                          <td className="py-3 px-4">
                            {callCount > 0 ? (
                              <button
                                onClick={() => setExpandedRecording(isExpanded ? null : `lead-${l.id}`)}
                                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-[11px] font-bold transition"
                              >
                                <span>🧠 {callCount} interaction{callCount !== 1 ? 's' : ''}</span>
                                <span className="text-[9px] opacity-60">{isExpanded ? '▲' : '▼'}</span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs italic">No history yet</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider",
                              l.segment === 'Hot' ? 'bg-red-500/15 text-red-400' :
                              l.segment === 'Warm' ? 'bg-orange-500/15 text-orange-400' :
                              l.segment === 'Auto-captured' ? 'bg-blue-500/15 text-blue-400' :
                              'bg-primary/20 text-primary'
                            )}>{l.segment || 'Unknown'}</span>
                          </td>
                          <td className="py-3 px-4 text-right flex justify-end items-center gap-2">
                            <button
                              onClick={() => setExpandedRecording(isExpanded ? null : `lead-${l.id}`)}
                              className="text-xs text-muted-foreground hover:text-primary transition px-2 py-1 rounded border border-border hover:border-primary/30 font-semibold"
                            >
                              {isExpanded ? 'Hide Memory' : 'View Memory'}
                            </button>
                            <button onClick={async () => {
                              if(!window.confirm('Delete this lead?')) return;
                              await fetch(`${API_BASE}/api/crm/lead/${l.id}`, { method: 'DELETE' });
                              fetchDashboardData();
                            }} className="text-red-500 bg-red-500/10 p-1.5 rounded hover:bg-red-500/20 transition">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-sidebar/5 border-b border-border/30">
                            <td colSpan="5" className="px-6 py-5 whitespace-normal">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-sm font-bold">🧠 Call Memory & AI Context</span>
                                  <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                                    The AI reads this before every call with {l.name || 'this caller'}
                                  </span>
                                </div>
                                {historyLines.length > 0 ? (
                                  <div className="space-y-2">
                                    {historyLines.map((line, li) => {
                                      const dateMatch = line.match(/^\[([^\]]+)\]/);
                                      const dateLabel = dateMatch ? dateMatch[1] : null;
                                      const content = dateLabel ? line.replace(`[${dateLabel}]`, '').replace(/^:\s*/, '').trim() : line;
                                      const isInbound = dateLabel?.toLowerCase().includes('inbound');
                                      const isOutbound = dateLabel?.toLowerCase().includes('outbound');
                                      return (
                                        <div key={li} className="flex gap-3 p-3 rounded-xl bg-background border border-border/50">
                                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isInbound ? 'bg-emerald-400' : isOutbound ? 'bg-blue-400' : 'bg-muted-foreground'}`} />
                                          <div className="flex-1 min-w-0">
                                            {dateLabel && (
                                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mr-2 ${isInbound ? 'bg-emerald-500/10 text-emerald-400' : isOutbound ? 'bg-blue-500/10 text-blue-400' : 'bg-muted/30 text-muted-foreground'}`}>
                                                {dateLabel}
                                              </span>
                                            )}
                                            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{content}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No call history recorded yet.</p>
                                )}
                                <div className="mt-4 pt-3 border-t border-border/50">
                                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">✏️ Add / Edit Agent Notes (AI will read this next call)</label>
                                  <div className="flex gap-3">
                                    <textarea
                                      defaultValue={l.ai_context || ''}
                                      id={`ctx-edit-${l.id}`}
                                      rows={3}
                                      placeholder="Add custom notes for the AI — e.g. 'Looking for 3 BHK in South Mumbai, budget 2Cr, prefers evening calls'"
                                      className="flex-1 bg-background border border-border rounded-xl p-3 text-xs font-mono outline-none focus:border-primary transition resize-none"
                                    />
                                    <button
                                      onClick={async () => {
                                        const newCtx = document.getElementById(`ctx-edit-${l.id}`)?.value || '';
                                        try {
                                          const res = await fetch(`${API_BASE}/api/leads/${l.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ ai_context: newCtx })
                                          });
                                          const d = await res.json();
                                          if (d.success) { showToast('AI notes updated!', 'success'); fetchAll(); }
                                          else showToast('Failed to save', 'error');
                                        } catch(e) { showToast('Save failed', 'error'); }
                                      }}
                                      className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition self-end whitespace-nowrap"
                                    >
                                      Save Notes
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {leads.length === 0 && <tr><td colSpan="5" className="text-center py-12 text-muted-foreground text-xs">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">🧠</span>
                      <p className="font-semibold">No leads yet</p>
                      <p>After your first AI call completes, callers will automatically appear here with their call history.</p>
                    </div>
                  </td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

                {/* KNOWLEDGE BASE SECTION */}
        {activePage === 'knowledge_base' && (
          <div className="space-y-8 fade-in w-full">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Knowledge Base &amp; RAG</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">Feed documents, websites, and text to your AI Agent for smarter answers</p></div>
            <div className="flex gap-1 border-b border-border">
              {[['text','Text / Manual', FileText], ['file','Upload PDF/Word', Download], ['url','Website URL', Link]].map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => setKbTab(tab)} className={cn('flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 -mb-px',
                  kbTab === tab ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
            {kbTab === 'text' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const btn = e.target.querySelector('button[type=submit]'); btn.innerText = 'Uploading...';
                  try {
                    const res = await fetch(`${API_BASE}/api/knowledge_base`, { 
                      method: 'POST', 
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        title: e.target.kbtitle.value, 
                        content: e.target.kbcontent.value,
                        client_id: (user?.client_code || user?.clientCode)
                      }) 
                    });
                    const d = await res.json();
                    if(d.success) { setKnowledgeBase([d.doc, ...knowledgeBase]); showToast('Document uploaded!', 'success'); e.target.reset(); }
                  } catch(err) { }
                  btn.innerText = 'Upload Document';
                }}>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Document Title</label>
                  <input name="kbtitle" className="w-full bg-background border border-border p-3 rounded-lg text-sm mb-4 outline-none" placeholder="e.g. Pricing FAQ 2026" required/>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Knowledge Content (RAG)</label>
                  <textarea name="kbcontent" className="w-full bg-background border border-border p-3 rounded-lg text-sm h-[150px] mb-4 outline-none resize-none font-mono text-[12px]" placeholder="Type or paste text here..." required/>
                  <div className="flex justify-end"><button type="submit" className="bg-primary text-white font-semibold rounded-lg px-6 py-2.5 text-sm">Upload Document</button></div>
                </form>
              </div>
            )}
            {kbTab === 'file' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Upload a PDF or Word file to your AI's Knowledge Base.</p>
                <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.02] transition relative">
                  <FileText size={32} className="text-muted-foreground mb-3" />
                  <h4 className="font-semibold text-sm mb-1">Drop PDF or Word file here</h4>
                  <p className="text-xs text-muted-foreground">.pdf, .doc, .docx supported</p>
                  <input type="file" accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setCorpusFile(e.target.files[0])} />
                  {corpusFile && <div className="mt-3 bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-full font-semibold">{corpusFile.name}</div>}
                </div>
                {corpusFile && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={async () => {
                      const formData = new FormData();
                      formData.append('file', corpusFile);
                      formData.append('title', corpusFile.name);
                      try {
                        const res = await fetch(`${API_BASE}/api/corpora/upload`, { 
                            method: 'POST', 
                            body: formData,
                            headers: { 'x-client-id': (user?.client_code || user?.clientCode || '') }
                        });
                        const d = await res.json();
                        if (d.success) { showToast('File added to AI Knowledge Base!', 'success'); setCorpusFile(null); }
                        else showToast(d.error || 'Upload failed', 'error');
                      } catch(ex) { showToast('Upload failed', 'error'); }
                    }} className="bg-primary text-white font-semibold rounded-lg px-6 py-2.5 text-sm">Upload to Agent</button>
                  </div>
                )}
              </div>
            )}
            {kbTab === 'url' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Paste a website URL. The AI will scrape and index it into the Knowledge Base.</p>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Website URL</label>
                <div className="flex gap-3">
                  <input value={corpusUrl} onChange={e => setCorpusUrl(e.target.value)} placeholder="https://yourwebsite.com/faq"
                    className="flex-1 bg-background border border-border p-3 rounded-lg text-sm outline-none focus:border-primary transition" />
                  <button onClick={async () => {
                    if (!corpusUrl || !corpusUrl.startsWith('http')) { showToast('Enter a valid https:// URL', 'error'); return; }
                    try {
                      const res = await fetch(`${API_BASE}/api/corpora/add-url`, { 
                          method: 'POST', 
                          headers: {
                              'Content-Type': 'application/json',
                              'x-client-id': (user?.client_code || user?.clientCode || '')
                          }, 
                          body: JSON.stringify({ url: corpusUrl }) 
                      });
                      const d = await res.json();
                      if (d.success) { showToast('URL added!', 'success'); setCorpusUrl(''); }
                      else showToast(d.error || 'Failed', 'error');
                    } catch(ex) { showToast('Failed to add URL', 'error'); }
                  }} className="bg-primary text-white font-semibold rounded-lg px-5 py-2.5 text-sm whitespace-nowrap">Add URL</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm px-1">Active Text Documents ({knowledgeBase.length})</h3>
              {knowledgeBase.map((k, i) => (
                <div key={i} className="flex justify-between items-center bg-card border border-border p-4 rounded-xl shadow-sm">
                  <div>
                    <h4 className="font-medium text-sm text-primary flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> {k.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[500px] truncate">{k.content}</p>
                  </div>
                  <button onClick={async () => {
                     await fetch(`${API_BASE}/api/knowledge_base/${k.id}`, { method: 'DELETE' });
                     setKnowledgeBase(knowledgeBase.filter(x => x.id !== k.id));
                     showToast('Knowledge removed.', 'success');
                  }} className="text-red-500 bg-red-500/10 p-2 rounded-lg hover:bg-red-500/20"><Trash2 size={16} /></button>
                </div>
              ))}
              {knowledgeBase.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 bg-card border border-border rounded-xl">No text documents yet. Use the tabs above to add knowledge.</div>}
            </div>
          </div>
        )}

        {/* ── INTEGRATIONS & COMMUNICATION LOGS ── */}
        {activePage === 'integrations_logs' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Integrations Hub</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Monitoring AI output across SMS, Email, and API integrations</p>
              </div>
              <button onClick={() => {
                const rows = appointments.map(a => [a.name||'', a.phone||'', a.email||'', a.sms_status||'Pending', a.whatsapp_status||'Pending', a.email_status||'Pending', new Date(a.created_at||a.start_time).toLocaleString()].map(v => '"' + v + '"').join(','));
                const csv = ['Name,Phone,Email,SMS Status,WhatsApp Status,Email Status,Booked At', ...rows].join('\n');
                const anchor = document.createElement('a');
                anchor.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                anchor.download = 'communications_' + new Date().toISOString().slice(0,10) + '.csv';
                anchor.click();
              }} className="flex items-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition">
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-6 gap-4">
              {[
                { label: 'Total Syncs', value: appointments.length, color: 'text-primary', bg: 'from-primary/5 to-purple-500/5' },
                { label: 'SMS Delivered', value: appointments.filter(a => a.sms_status === 'Sent').length, color: 'text-emerald-400', bg: 'from-emerald-500/5 to-teal-500/5' },
                { label: 'WA Delivered', value: appointments.filter(a => a.whatsapp_status === 'Sent').length, color: 'text-green-400', bg: 'from-green-500/5 to-emerald-500/5' },
                { label: 'Email Delivered', value: appointments.filter(a => a.email_status === 'Sent').length, color: 'text-blue-400', bg: 'from-blue-500/5 to-cyan-500/5' },
                { label: 'Engagement', value: appointments.filter(a => a.status === 'completed' || (a.email_status === 'Sent' && (a.sms_status === 'Sent' || a.whatsapp_status === 'Sent'))).length, color: 'text-purple-400', bg: 'from-indigo-500/5 to-fuchsia-500/5' },
                { label: 'Issues', value: appointments.filter(a => a.sms_status === 'Failed' || a.whatsapp_status === 'Failed' || a.email_status === 'Failed').length, color: 'text-amber-400', bg: 'from-amber-500/5 to-orange-500/5' },
              ].map((s, i) => (
                <div key={i} className={'bg-gradient-to-br ' + s.bg + ' border border-border rounded-2xl p-5'}>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-ultra mb-2">{s.label}</div>
                  <div className={'text-3xl font-black ' + s.color}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">Notification Log</h3>
                <button onClick={fetchAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"><RefreshCw size={11} /> Sync</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-sidebar/30">
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMS</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {appointments.map((a, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-5 font-medium text-sm">{a.name || '—'}</td>
                        <td className="py-3 px-5 font-mono text-primary text-xs">{a.phone || '—'}</td>
                        <td className="py-3 px-5 text-xs text-muted-foreground">{a.email || <span className="italic opacity-40">not captured</span>}</td>
                        <td className="py-3 px-5"><span className={cn('px-2.5 py-1 rounded-full text-[10px] uppercase font-bold',
                          a.sms_status === 'Sent' ? 'bg-emerald-500/10 text-emerald-400' : a.sms_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400')}>
                          {a.sms_status || 'Pending'}</span></td>
                        <td className="py-3 px-5"><span className={cn('px-2.5 py-1 rounded-full text-[10px] uppercase font-bold',
                          a.whatsapp_status === 'Sent' ? 'bg-emerald-500/10 text-emerald-400' : a.whatsapp_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400')}>
                          {a.whatsapp_status || 'Pending'}</span></td>
                        <td className="py-3 px-5"><span className={cn('px-2.5 py-1 rounded-full text-[10px] uppercase font-bold',
                          a.email_status === 'Sent' ? 'bg-emerald-500/10 text-emerald-400' : a.email_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400')}>
                          {a.email_status || 'Pending'}</span></td>
                        <td className="py-3 px-5 text-xs text-muted-foreground">{new Date(a.created_at || a.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      </tr>
                    ))}
                    {appointments.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-muted-foreground text-xs">No notifications sent yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* ── OUTBOUND CAMPAIGNS ── */}
        {activePage === 'campaigns' && (
          <div className="space-y-8 fade-in w-full">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
              <p className="text-xs text-blue-400 font-semibold">Pro Tip: Keep your Knowledge Base updated to improve AI performance during live campaigns.</p>
            </div>
            <div><h2 className="text-3xl font-extrabold tracking-tight">Outbound Voice Campaigns</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">Upload a CSV list to automatically dial contacts sequentially</p></div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg space-y-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Campaign Setup</label>
              
              <div className="grid grid-cols-2 gap-4">
                <input name="campaign_name" placeholder="Campaign Name (e.g. Past Clients Follow-up)" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none" required />
                <select name="campaign_voice" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none">
                  <optgroup label="Standard AI Voices">
                    <option value="9ed99f35-ddd5-4efb-9c62-9ce9483bab61">🇺🇸 Mark (Male, Professional)</option>
                    <option value="terrence">🇺🇸 Terrence (Male, Deep)</option>
                    <option value="b28f7f08-685c-4219-a2a0-c539b985b9fd">🇺🇸 Alex (Male, Friendly)</option>
                    <option value="a88fb2af-16ec-41a2-b6e9-86ef2f5c9622">🇺🇸 Jessica (Female, Warm)</option>
                    <option value="lily">🇺🇸 Lily (Female, Professional)</option>
                    <option value="f972fbf6-89f5-40a1-9ad7-ee0aa445e8c3">🇺🇸 Sarah (Female, Conversational)</option>
                    <option value="5f8e97b1-cd48-431a-b6a1-3b94306d8914">🇬🇧 David (Male, British)</option>
                    <option value="d20e12df-6fd9-428e-a81f-ba0090de13d9">🇬🇧 Emily (Female, British)</option>
                    <option value="bf3ee560-7c86-4d46-9f23-81b12dd6ba5f">🇺🇸 Ryan (Male, Energetic)</option>
                  </optgroup>
                  <optgroup label="Australian Voices">
                    <option value="280a8e4d-2974-4593-87eb-fb74f0278a2e">🇦🇺 Arlo (Male, Australian)</option>
                    <option value="8ff05d3d-d78d-40a6-88c1-dd1efcf571f0">🇦🇺 Hannah (Female, Australian)</option>
                  </optgroup>
                  <optgroup label="Custom Integration">
                    <option value="elevenlabs:custom">🎙️ My Custom ElevenLabs Voice</option>
                  </optgroup>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Primary Campaign Goal <span className="text-muted-foreground/50 normal-case font-normal">(auto-saved)</span></label>
                <textarea id="campaign_goal" value={campaignGoal} onChange={e => setCampaignGoal(e.target.value)}
                  onBlur={async (e) => {
                    const clientId = user?.client_code || user?.clientCode;
                    if (!clientId) return;
                    await fetch(`${API_BASE}/api/agent/campaign-goal`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ client_id: clientId, campaign_goal: e.target.value }) });
                    setAgentSettings(prev => prev ? { ...prev, campaign_goal: e.target.value } : prev);
                    showToast('Campaign goal saved!', 'success');
                  }}
                  placeholder="What is the objective of this outbound call? e.g. 'Get them to book a viewing for next week.'" 
                  className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none h-20 resize-none focus:border-primary transition-colors"></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Outbound Agent ID <span className="text-muted-foreground/50 normal-case font-normal">(Optional - auto-saved)</span></label>
                <input id="outbound_agent_id" value={outboundAgentId} onChange={e => setOutboundAgentId(e.target.value)}
                  onBlur={async (e) => {
                    const clientId = user?.client_code || user?.clientCode;
                    if (!clientId) return;
                    await fetch(`${API_BASE}/api/agent/outbound-id`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ client_id: clientId, outbound_agent_id: e.target.value }) });
                    setAgentSettings(prev => prev ? { ...prev, outbound_agent_id: e.target.value } : prev);
                    showToast('Outbound Agent ID saved!', 'success');
                  }}
                  placeholder="e.g. 1a2b3c4d-5e6f..."
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" 
                  disabled={!onBackToAdmin}
                />
                <p className="text-[10px] text-muted-foreground mt-1">If set, outbound calls will use this specific Ultravox agent.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-border rounded-xl p-6 flex flex-col justify-center gap-3 bg-sidebar/20">
                   <h4 className="font-semibold text-sm">Targeted Manual Dial</h4>
                   <p className="text-xs text-muted-foreground leading-relaxed">Call a single specific lead right now via Azlon AI.</p>
                   <input id="manual_dial_phone" placeholder="Enter Phone (+1...)" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none focus:border-primary transition" />
                   <button onClick={async () => {
                     const num = document.getElementById('manual_dial_phone').value;
                     const voice = document.querySelector('select[name="campaign_voice"]').value;
                     const goal = document.getElementById('campaign_goal').value;
                     if(!num) { showToast('Enter a phone number','error'); return; }
                     try {
                        showToast('Dispatching manual call...', 'success');
                        const res = await fetch(`${API_BASE}/api/calls/outbound`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ toPhone: num, voice, goal, client_id: (user?.client_code || user?.clientCode) }) });
                        const data = await res.json();
                        if(!data.success) { showToast(data.error || 'Dial failed.', 'error'); return; }
                        showToast('Call initiated successfully!', 'success');
                     } catch(e) { showToast('Call dispatch failed','error'); }
                   }} disabled={isLockedOut} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg p-2.5 text-sm shadow shadow-primary/20 mt-1 transition disabled:opacity-50">Dial Target</button>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.02] transition relative">
                   <Globe size={32} className="text-muted-foreground mb-3" />
                   <h4 className="font-semibold text-sm">Upload CSV or Excel File</h4>
                   <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
                   <input
                     type="file"
                     accept=".csv,.txt,.xlsx,.xls"
                     className="absolute inset-0 opacity-0 cursor-pointer"
                     onChange={async (e) => {
                       const file = e.target.files[0];
                       if (!file) return;
                       const campaignNameEl = document.querySelector('input[name="campaign_name"]');
                       const campaignName = campaignNameEl?.value;
                       if (!campaignName) {
                         showToast('Enter a Campaign Name first before uploading.', 'error');
                         e.target.value = '';
                         return;
                       }
                       const voice = document.querySelector('select[name="campaign_voice"]')?.value || 'Mark';
                       const goal = document.getElementById('campaign_goal')?.value || '';
                       
                       const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                       
                       const processCSV = async (csvText) => {
                         try {
                           showToast('Parsing file and launching campaign...', 'success');
                           const res = await fetch(`${API_BASE}/api/campaigns/csv-launch`, {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json', 'x-client-id': (user?.client_code || user?.clientCode) },
                             body: JSON.stringify({ csvText, campaignName, voice, goal, client_id: (user?.client_code || user?.clientCode) })
                           });
                           const data = await res.json();
                           if (data.success) {
                             showToast(data.message, 'success');
                             fetchAll();
                             if (campaignNameEl) campaignNameEl.value = '';
                           } else {
                             showToast(data.error || 'Failed to launch campaign.', 'error');
                           }
                         } catch(err) {
                           showToast('Upload failed. Check backend.', 'error');
                         }
                       };

                       if (isExcel) {
                         const reader = new FileReader();
                         reader.onload = async (evt) => {
                           try {
                             const workbook = XLSX.read(evt.target.result, { type: 'array' });
                             const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                             const csvText = XLSX.utils.sheet_to_csv(firstSheet);
                             await processCSV(csvText);
                           } catch(err) {
                             showToast('Failed to parse Excel file. Ensure it has phone numbers.', 'error');
                           }
                         };
                         reader.readAsArrayBuffer(file);
                       } else {
                         const reader = new FileReader();
                         reader.onload = async (evt) => {
                           await processCSV(evt.target.result);
                         };
                         reader.readAsText(file);
                       }
                       e.target.value = '';
                     }}
                   />
                   <div className="mt-4 bg-primary/20 text-primary px-4 py-1.5 rounded-full text-xs font-semibold">Bulk Connect</div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Accepted Formats — CSV, Excel, or Google Sheets</p>
                    <div className="font-mono text-[10px] text-muted-foreground leading-relaxed bg-sidebar/30 rounded-md p-2.5 border border-border/50">
                      <p className="text-foreground/70 mb-1">name, phone</p>
                      <p>John Doe, 14155551234</p>
                      <p>Jane Smith, 442071234567</p>
                      <p>Kumar R, 919876543210</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-2 leading-relaxed">Just type country code + number — <strong>no "+" needed</strong>. We auto-add it. Header row is optional. Name column is optional. Excel uses the first sheet.</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Or Import from Google Sheets</p>
                    <p className="text-[9px] text-muted-foreground mb-2 leading-relaxed">Paste a Google Sheet URL below. The sheet must be set to <strong>"Anyone with the link can view"</strong>.</p>
                    <div className="flex gap-2">
                      <input id="gsheet_url" placeholder="https://docs.google.com/spreadsheets/d/..." className="flex-1 bg-sidebar/30 border border-border/50 rounded-md px-3 py-2 text-[11px] outline-none focus:border-primary transition font-mono" />
                      <button onClick={async () => {
                        const url = document.getElementById('gsheet_url')?.value;
                        const campaignNameEl = document.querySelector('input[name="campaign_name"]');
                        const campaignName = campaignNameEl?.value;
                        if (!campaignName) { showToast('Enter a Campaign Name first.', 'error'); return; }
                        if (!url || !url.includes('docs.google.com/spreadsheets')) { showToast('Enter a valid Google Sheets URL.', 'error'); return; }

                        const voice = document.querySelector('select[name="campaign_voice"]')?.value || 'Mark';
                        const goal = document.getElementById('campaign_goal')?.value || '';

                        try {
                          showToast('Fetching Google Sheet and launching campaign...', 'success');
                          const res = await fetch(`${API_BASE}/api/campaigns/gsheet-launch`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sheetUrl: url, campaignName, voice, goal, client_id: (user?.client_code || user?.clientCode) })
                          });
                          const data = await res.json();
                          if (data.success) {
                            showToast(data.message, 'success');
                            fetchAll();
                          } else {
                            showToast(data.error || 'Google Sheet import failed.', 'error');
                          }
                        } catch(err) {
                          showToast('Google Sheet import failed.', 'error');
                        }
                      }} className="bg-primary/80 hover:bg-primary text-white text-[11px] font-semibold px-4 py-2 rounded-md transition whitespace-nowrap">Import & Launch</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Live Campaigns</h3>
                <button onClick={fetchAll} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"><RefreshCw size={12} /> Refresh</button>
              </div>
              <div className="space-y-4">
                 {campaigns.map((c, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
                       <div className="p-4 flex justify-between items-center border-b border-border bg-sidebar/30">
                          <div>
                            <h4 className="font-semibold text-sm">{c.name}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{c.goal ? `Goal: ${c.goal.substring(0,60)}...` : 'No goal set'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              c.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                              c.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                              c.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-yellow-500/10 text-yellow-400'
                            )}>{c.status === 'running' ? '● Live' : c.status}</span>
                            <button 
                               onClick={() => {
                                 if (window.confirm(`Are you sure you want to delete the campaign "${c.name}"? This cannot be undone.`)) {
                                   fetch(`${API_BASE}/api/campaigns/${c.id}`, { 
                                     method: 'DELETE', 
                                     headers: { 'x-client-id': user?.client_code || user?.clientCode } 
                                   })
                                     .then(r => r.json())
                                     .then(d => {
                                       if (d.success) { showToast('Campaign deleted successfully', 'success'); fetchAll(); }
                                       else showToast(d.error || 'Failed to delete campaign', 'error');
                                     })
                                     .catch(() => showToast('Failed to delete campaign', 'error'));
                                 }
                               }}
                               className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition"
                               title="Delete Campaign"
                            >
                              <Trash2 size={15} strokeWidth={2.5} />
                            </button>
                          </div>
                       </div>
                       <div className="grid grid-cols-3 sm:grid-cols-6 gap-0 text-center">
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-foreground">{c.total_calls || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-blue-400">{c.answered || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Dialed</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-yellow-400">{c.pending || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Pending</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-green-400">{c.positive || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Positive</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-red-400">{c.declined || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Declined</p>
                          </div>
                          <div className="p-3">
                            <p className="text-lg font-bold text-orange-400">{c.failed || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Failed</p>
                          </div>
                       </div>
                       {c.status === 'running' && (
                         <div className="px-4 pb-3">
                           <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                             <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${c.total_calls > 0 ? ((c.answered || 0) / c.total_calls * 100) : 0}%` }}></div>
                           </div>
                         </div>
                       )}
                    </div>
                 ))}
                 {campaigns.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 bg-card border border-border rounded-xl">No campaigns created yet. Upload a CSV or create one manually.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── VOICE RECORDINGS PAGE ── */}
        {activePage === 'recordings' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Voice Recordings</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Browse and listen to your AI agent's conversations</p>
              </div>
              <button onClick={fetchAll} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition bg-card shadow-sm">
                <RefreshCw size={11}/> Sync
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-sidebar/30">
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date/Time</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caller</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direction</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recording</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {callLogs.filter(c => c.recording_url).map((c, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition">
                        <td className="py-4 px-5">
                          <div className="text-sm font-medium">{new Date(c.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-sm font-bold">{c.caller_name || 'Anonymous'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</div>
                        </td>
                        <td className="py-4 px-5 px-5">
                          <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold ${c.direction === 'inbound' ? 'bg-primary/10 text-primary' : 'bg-purple-500/10 text-purple-400'}`}>
                            {c.direction}
                          </span>
                        </td>
                        <td className="py-4 px-5 min-w-[200px]">
                           <div className="bg-sidebar/30 rounded-lg px-2 py-1 border border-border/50 max-w-[200px]">
                              <audio controls className="w-full h-8 scale-90 origin-left">
                                <source src={c.recording_url.includes('api.twilio.com') ? `${API_BASE}/api/recordings/${c.twilio_sid}` : c.recording_url} type="audio/mpeg" />
                              </audio>
                           </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex justify-end gap-2">
                             <button onClick={() => setViewSummaryModal(c)} className="bg-white/5 hover:bg-white/10 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border transition-colors uppercase tracking-wider">Summary</button>
                             <a href={c.recording_url.includes('api.twilio.com') ? `${API_BASE}/api/recordings/${c.twilio_sid}` : c.recording_url} target="_blank" rel="noreferrer" className="p-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-all">
                               <Download size={14} />
                             </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {callLogs.filter(c => c.recording_url).length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-20 text-muted-foreground text-xs italic">
                          No voice recordings found in storage.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      {/* ── MODALS ── */}
        {activePage === 'credentials' && (
          <div className="space-y-8 fade-in w-full max-w-2xl mx-auto pb-12">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Integration Settings</h2>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">Configure your telephony and AI provider credentials</p>
            </div>

            {/* --- TWILIO CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Phone size={16} className="text-primary" /> Twilio Telephony
              </h3>
              <form onSubmit={saveTwilioConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Account SID</label>
                  <input type="text" value={twilioConfig.sid} onChange={(e) => setTwilioConfig({...twilioConfig, sid: e.target.value})} placeholder="ACxxxxxxxx" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Auth Token</label>
                  <input type="password" value={twilioConfig.api_key} onChange={(e) => setTwilioConfig({...twilioConfig, api_key: e.target.value})} placeholder="••••••••••••" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Outbound Number</label>
                  <input type="text" value={twilioConfig.phone} onChange={(e) => setTwilioConfig({...twilioConfig, phone: e.target.value})} placeholder="+1..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Transfer Call To (Human Handoff Number)</label>
                  <input type="text" value={twilioConfig.transfer_number || ''} onChange={(e) => setTwilioConfig({...twilioConfig, transfer_number: e.target.value})} placeholder="+91..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" />
                  <p className="text-[10px] text-muted-foreground mt-2 italic">When the AI transfers a caller to a human, it will dial this number.</p>
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={isSavingCreds} className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingCreds ? 'Saving...' : 'Update Twilio Keys'}
                  </button>
                </div>
              </form>
            </div>

            {/* --- INBOUND WEBHOOK URL --- */}
            <InboundWebhookCard clientId={user?.client_code || user?.clientCode} apiBase={API_BASE} />

            {/* --- AZLON AI ENGINE CONFIG (hidden branding) --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Sparkles size={16} className="text-primary" /> Azlon AI Engine
              </h3>
              <form onSubmit={saveUVConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Azlon Secret Key</label>
                  <input type="password" value={uvConfig.api_key} onChange={(e) => setUVConfig({...uvConfig, api_key: e.target.value})} placeholder="••••••••••••" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Your unique AI engine secret key provided by your administrator.</p>
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={isSavingUV} className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingUV ? 'Saving...' : 'Update AI Engine Key'}
                  </button>
                </div>
              </form>
            </div>

            {/* --- ELEVENLABS CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="text-xl leading-none font-black text-gray-800 dark:text-gray-200">II</span> ElevenLabs Custom Voice
              </h3>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                Connect your ElevenLabs account to use your own custom voice clones. Enter your API key and the Voice ID of your favorite voice.
              </p>
              <form onSubmit={saveElevenLabsConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">ElevenLabs API Key</label>
                  <input type="password" value={elevenLabsConfig.api_key} onChange={(e) => setElevenLabsConfig({...elevenLabsConfig, api_key: e.target.value})} placeholder="sk_..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">ElevenLabs Voice ID</label>
                  <input type="text" value={elevenLabsConfig.voice_id} onChange={(e) => setElevenLabsConfig({...elevenLabsConfig, voice_id: e.target.value})} placeholder="pNInz6obbf5AWCGqe..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" />
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={isSavingElevenLabs} className="w-full bg-gray-500/10 hover:bg-gray-500/20 text-gray-700 dark:text-gray-300 border border-gray-500/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingElevenLabs ? 'Saving...' : 'Update ElevenLabs Keys'}
                  </button>
                </div>
              </form>
            </div>

            {/* --- CORPUS CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Database size={16} className="text-primary" /> Knowledge Base & RAG Corpus
              </h3>
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                Enter your Ultravox Corpus API Key to allow file uploads (PDF, Word) and URLs into your AI Agent's Knowledge Base.
              </p>
              <form onSubmit={saveCorpusConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Ultravox Corpus API Key</label>
                  <input type="password" value={corpusConfig.api_key} onChange={(e) => setCorpusConfig({...corpusConfig, api_key: e.target.value})} placeholder="sk_..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" />
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={isSavingCorpus} className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingCorpus ? 'Saving...' : 'Update Corpus Key'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


      {viewSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-premium-lg border border-border flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-sidebar/50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg">Call Summary & Transcript</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1">{viewSummaryModal.from_phone || viewSummaryModal.to_phone}</p>
              </div>
              <button onClick={() => setViewSummaryModal(null)} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-lg transition-colors"><XCircle size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">AI Executed Summary</h4>
                <div className="bg-background rounded-xl p-5 border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap shadow-inner relative">
                  {viewSummaryModal.ai_summary || 'No summary was generated or the call failed.'}
                </div>
              </div>

              {viewSummaryModal.recording_url && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Mic size={14} className="text-primary" /> Call Recording
                  </h4>
                  <div className="bg-background/50 p-4 rounded-xl border border-border flex items-center gap-4">
                     <audio controls className="flex-1 h-10">
                        <source src={viewSummaryModal.recording_url && viewSummaryModal.recording_url.includes('api.twilio.com') ? `${API_BASE}/api/recordings/${viewSummaryModal.twilio_sid}` : viewSummaryModal.recording_url} type="audio/mpeg" />
                     </audio>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Stored securely in cloud storage.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {calendarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-premium-lg border border-border flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-sidebar/50 rounded-t-2xl">
              <div>
                 <h3 className="font-bold text-lg">{calendarModal.mode === 'reschedule' ? 'Reschedule Appointment' : calendarModal.mode === 'followup' ? '📅 Book Follow-Up' : 'Manual Booking'}</h3>
                 <p className="text-xs text-muted-foreground font-mono mt-1">Date: {calendarModal.date.toLocaleDateString()}</p>
              </div>
              <button onClick={() => { setCalendarModal(null); setCalendarError(''); }} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-lg transition-colors"><XCircle size={20}/></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const btn = e.target.querySelector('button[type=submit]');
              const prevText = btn.innerText;
              btn.innerText = 'Saving...';
              const dateStr = e.target.date.value;
              const timeStr = e.target.time.value;
              
              // Handle local timezone properly to prevent offset bugs
              const [year, month, day] = dateStr.split('-');
              const [hours, minutes] = timeStr.split(':');
              const d = new Date(year, month - 1, day, hours, minutes);
              const start_time = d.toISOString();
              
              // Conflict detection for follow-up and new bookings
              const isFollowup = calendarModal.mode === 'followup';
              const isNew = !calendarModal.mode || isFollowup;
              if (isNew) {
                const slotDt = new Date(start_time);
                const conflict = appointments.find(appt => {
                  if (appt.status === 'completed') return false;
                  const apptDt = new Date(appt.start_time);
                  return Math.abs(apptDt - slotDt) < 30 * 60 * 1000;
                });
                if (conflict) {
                  setCalendarError(`⚠️ That slot is already booked for ${conflict.name}. Please choose a different time.`);
                  btn.innerText = prevText;
                  return;
                }
              }
              setCalendarError('');
              try {
                let res;
                if (calendarModal.mode === 'reschedule') {
                  res = await fetch(`${API_BASE}/api/appointments/manual/${calendarModal.rescheduleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-client-id': (user?.client_code || user?.clientCode) },
                    body: JSON.stringify({ start_time })
                  });
                } else {
                  const clientId = user?.client_code || user?.clientCode;
                  res = await fetch(`${API_BASE}/api/appointments/manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-client-id': clientId },
                    body: JSON.stringify({ start_time, name: e.target.apptname?.value || calendarModal.prefill?.name, phone: e.target.apptphone?.value || calendarModal.prefill?.phone, client_id: clientId })
                  });
                }
                if(!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
                showToast(calendarModal.mode === 'reschedule' ? 'Appointment rescheduled!' : isFollowup ? 'Follow-up booked!' : 'Appointment booked!', 'success');
                setCalendarModal(null);
                fetchAll();
              } catch(err) { showToast(err.message || 'Failed. Check details.','error'); btn.innerText = prevText; }
            }} className="p-6 space-y-4">
               {/* Inline conflict error — shows INSIDE modal, never blurred */}
               {calendarError && (
                 <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-xl px-4 py-3">
                   <span className="mt-0.5 shrink-0">⚠️</span>
                   <span>{calendarError.replace('⚠️', '').trim()}</span>
                 </div>
               )}
               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Date</label>
                    <input name="date" type="date" defaultValue={toYYYYMMDD(calendarModal.date)} required className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Time</label>
                    <input name="time" type="time" defaultValue={calendarModal.date.getHours().toString().padStart(2, '0') + ':' + calendarModal.date.getMinutes().toString().padStart(2, '0')} required className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
                 </div>
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Client Name</label>
                  <input name="apptname" required={!calendarModal.prefill} placeholder="John Doe" defaultValue={calendarModal.prefill?.name || ''} disabled={calendarModal.mode === 'reschedule'} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 cursor-not-allowed" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Phone Number</label>
                  <input name="apptphone" required={!calendarModal.prefill} placeholder="+1234567890" defaultValue={calendarModal.prefill?.phone || ''} disabled={calendarModal.mode === 'reschedule'} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 cursor-not-allowed font-mono" />
               </div>
               <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 mt-4 transition-all">
                  {calendarModal.mode === 'reschedule' ? 'Save New Time' : calendarModal.mode === 'followup' ? 'Confirm Follow-Up' : 'Record Booking Internally'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Custom Confirm Modal (replaces window.confirm) ── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-premium-lg w-full max-w-sm p-7 scale-in">
            <div className="text-2xl mb-1">⚠️</div>
            <h3 className="font-bold text-base tracking-tight mb-2">Confirm Action</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
              <button onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {manualLeadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl shadow-premium-lg border border-border flex flex-col p-8 fade-in-up text-foreground">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-primary">Add CRM Target</h3>
                <p className="text-xs text-muted-foreground mt-1">Populate your lead database manually with a new prospect.</p>
              </div>
              <button onClick={() => setManualLeadModal(false)} className="text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 p-2 rounded-xl transition-all"><XCircle size={24}/></button>
            </div>
            <form onSubmit={saveManualLead} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Lead Name</label>
                  <input 
                    required 
                    value={newLead.name}
                    onChange={(e)=>setNewLead({...newLead, name: e.target.value})}
                    placeholder="Full legal name" 
                    className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-inner" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Phone Number</label>
                  <input 
                    required 
                    value={newLead.phone}
                    onChange={(e)=>setNewLead({...newLead, phone: e.target.value})}
                    placeholder="+91..." 
                    className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-inner font-mono" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Email Address (Optional)</label>
                <input 
                  value={newLead.email}
                  onChange={(e)=>setNewLead({...newLead, email: e.target.value})}
                  placeholder="client@company.com" 
                  className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-inner" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Target Segment</label>
                <select 
                  value={newLead.segment}
                  onChange={(e)=>setNewLead({...newLead, segment: e.target.value})}
                  className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm text-foreground outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Hot" className="text-foreground bg-card">🔥 Hot Lead</option>
                  <option value="Warm" className="text-foreground bg-card">⚡ Warm Pipeline</option>
                  <option value="Qualified" className="text-foreground bg-card">🎓 Qualified Pro</option>
                  <option value="Cold" className="text-foreground bg-card">❄️ Cold Outreach</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Initial AI Context</label>
                <textarea 
                  value={newLead.ai_context}
                  onChange={(e)=>setNewLead({...newLead, ai_context: e.target.value})}
                  placeholder="e.g. Previous client looking to buy in Mumbai West..." 
                  className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm text-foreground outline-none focus:border-primary h-24 resize-none transition-all shadow-inner"
                />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 mt-4 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm uppercase tracking-widest">Deploy Manual Target</button>
            </form>
          </div>
        </div>
      )}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Banner/Logo */}
            <div className="h-32 bg-gradient-to-r from-violet-600/50 to-indigo-600/50 relative">
              {user?.company_logo && <img src={user.company_logo} className="w-full h-full object-cover opacity-50" />}
              <div className="absolute top-2 right-2 flex gap-2">
                <label className="cursor-pointer bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-md transition">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'company_logo')} />
                </label>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            {/* Profile Info */}
            <div className="px-6 pb-6 relative">
              {/* Profile Picture */}
              <div className="relative w-20 h-20 -mt-10 mb-4 rounded-xl border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow-lg group">
                {user?.profile_picture ? (
                  <img src={user.profile_picture} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-2xl">
                    {(user?.name || user?.whitelabel || 'A')[0]}
                  </div>
                )}
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'profile_picture')} />
                </label>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{user?.name || 'Client User'}</h3>
                  <p className="text-sm text-muted-foreground">{user?.whitelabel || user?.business_name || 'Azlon AI Business'} {user?.business_type ? `• ${user.business_type}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
                  <span className={`w-2 h-2 rounded-full ${isLockedOut ? 'bg-red-500' : agentEnabled ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="text-xs font-semibold">{isLockedOut ? 'Exhausted' : agentEnabled ? 'Active' : 'Paused'}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-sidebar border border-border p-3 rounded-xl">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Email Address</div>
                    <div className="text-sm font-semibold truncate">{user?.email || 'N/A'}</div>
                  </div>
                  <div className="bg-sidebar border border-border p-3 rounded-xl">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Phone Number</div>
                    <div className="text-sm font-semibold">{user?.phone || 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-sidebar border border-border p-3 rounded-xl">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Active Agents</div>
                    <div className="text-lg font-black">{agentEnabled ? '1' : '0'} <span className="text-xs text-muted-foreground font-medium">Inbound</span></div>
                  </div>
                  <div className="bg-sidebar border border-border p-3 rounded-xl">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Current Plan</div>
                    <div className="text-sm font-black capitalize">{user?.plan || 'Free'}</div>
                  </div>
                  <div className="bg-sidebar border border-border p-3 rounded-xl">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Next Billing</div>
                    <div className="text-sm font-black">
                      {user?.billing_date ? new Date(user.billing_date).toLocaleDateString() : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toLocaleDateString(); })()}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <button 
                    onClick={() => handleForceResetPassword(user?.id)}
                    className="w-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition py-2.5 rounded-xl text-sm font-bold border border-red-500/20 hover:border-red-500"
                  >
                    Force Reset Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
       <div className="p-8 mt-auto text-center text-xs text-muted-foreground border-t border-border/30">
         © 2026 Azlon AI Platform • Dashboard Version V2.9
       </div>
      </main>
    </div>
  );
}

export default function App() {
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem('azlon_auth');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [viewingClient, setViewingClient] = useState(() => {
    try {
      const saved = sessionStorage.getItem('azlon_viewing_client');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const saveSession = (session) => {
    setAuthSession(session);
    if (session) sessionStorage.setItem('azlon_auth', JSON.stringify(session));
    else sessionStorage.removeItem('azlon_auth');
  };

  const saveViewingClient = (client) => {
    setViewingClient(client);
    if (client) sessionStorage.setItem('azlon_viewing_client', JSON.stringify(client));
    else sessionStorage.removeItem('azlon_viewing_client');
  };

  const handleAgentToggle = (newValue) => {
    if (viewingClient) {
      const updated = { ...viewingClient, agentEnabled: newValue };
      saveViewingClient(updated);
    } else if (authSession) {
      const updated = { ...authSession, agentEnabled: newValue };
      saveSession(updated);
    }
  };

  // Detect if this is a client portal URL (?org=slug)
  const urlParams = new URLSearchParams(window.location.search);
  const orgSlug = urlParams.get('org');

  const [portalClient, setPortalClient] = useState(null);
  const [isPortalLoading, setIsPortalLoading] = useState(!!orgSlug);

  useEffect(() => {
    if (orgSlug) {
      setIsPortalLoading(true);
      fetch(`${API_BASE}/api/clients/${orgSlug}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) setPortalClient(data.client);
          setIsPortalLoading(false);
        })
        .catch(() => setIsPortalLoading(false));
    }
  }, [orgSlug]);

  // If org slug in URL, handle portal login/dashboard
  if (orgSlug) {
    if (isPortalLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb]">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-blue-600" size={32} />
            <p className="text-sm font-bold text-muted-foreground">Initializing Secure Portal...</p>
          </div>
        </div>
      );
    }

    if (!portalClient) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] text-[#0f172a] font-sans">
          <div className="text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-bold mb-2">Portal not found</h2>
            <p className="text-sm text-[#94a3b8]">The URL <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-xs">{orgSlug}</code> doesn't match any client account.</p>
          </div>
        </div>
      );
    }

    if (!authSession) {
      return (
        <ClientPortalLogin
          client={portalClient}
          onLoginSuccess={(session) => saveSession(session)}
        />
      );
    }

    // Client is logged into their isolated dashboard
    return (
      <ClientDashboard
        user={authSession}
        onLogout={() => { saveSession(null); }}
        onBackToAdmin={undefined}
        onAgentToggle={handleAgentToggle}
      />
    );
  }

  // SUPER ADMIN MODE — normal login
  if (!authSession) {
    return <Login onLoginSuccess={(session) => saveSession(session)} />;
  }

  if (authSession.role === 'superadmin' && !viewingClient) {
    return (
      <SuperAdminDashboard
        user={authSession}
        onLogout={() => { saveSession(null); saveViewingClient(null); }}
        onViewClient={(client) => saveViewingClient({ ...client, role: 'client', client_code: client.client_code || client.clientCode, clientCode: client.client_code || client.clientCode })}
      />
    );
  }

  return (
    <ClientDashboard
      user={viewingClient || authSession}
      onLogout={() => { saveSession(null); saveViewingClient(null); }}
      onBackToAdmin={authSession.role === 'superadmin' ? () => saveViewingClient(null) : undefined}
      onAgentToggle={handleAgentToggle}
    />
  );
}
