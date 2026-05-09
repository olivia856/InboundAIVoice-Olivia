
$filePath = "c:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

$kbIdx = $content.IndexOf('KNOWLEDGE BASE')
$commentStart = $content.LastIndexOf('{/*', $kbIdx)
$outboundIdx = $content.IndexOf('OUTBOUND CAMPAIGNS')
$kbEnd = $content.LastIndexOf(')}', $outboundIdx) + 2

Write-Host "Replacing chars $commentStart to $kbEnd"

$newSection = @'
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
                    const res = await fetch(`${API_BASE}/api/knowledge_base`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: e.target.kbtitle.value, content: e.target.kbcontent.value }) });
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
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Upload a PDF or Word file. Requires a <strong>Corpus API Key</strong> in API Credentials.</p>
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
                        const res = await fetch(`${API_BASE}/api/corpora/upload`, { method: 'POST', body: formData });
                        const d = await res.json();
                        if (d.success) { showToast('File uploaded to Ultravox Corpus!', 'success'); setCorpusFile(null); }
                        else showToast(d.error || 'Upload failed', 'error');
                      } catch(ex) { showToast('Upload failed', 'error'); }
                    }} className="bg-primary text-white font-semibold rounded-lg px-6 py-2.5 text-sm">Upload to Agent</button>
                  </div>
                )}
              </div>
            )}
            {kbTab === 'url' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Paste a website URL. Ultravox will scrape and index it. Requires a <strong>Corpus API Key</strong> in API Credentials.</p>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Website URL</label>
                <div className="flex gap-3">
                  <input value={corpusUrl} onChange={e => setCorpusUrl(e.target.value)} placeholder="https://yourwebsite.com/faq"
                    className="flex-1 bg-background border border-border p-3 rounded-lg text-sm outline-none focus:border-primary transition" />
                  <button onClick={async () => {
                    if (!corpusUrl || !corpusUrl.startsWith('http')) { showToast('Enter a valid https:// URL', 'error'); return; }
                    try {
                      const res = await fetch(`${API_BASE}/api/corpora/add-url`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url: corpusUrl }) });
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

        {/* COMMUNICATIONS SECTION */}
        {activePage === 'communications' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Communications</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Track every email and SMS notification sent by the AI</p>
              </div>
              <button onClick={() => {
                const rows = appointments.map(a => [a.name||'', a.phone||'', a.email||'', a.sms_status||'Pending', a.email_status||'Pending', new Date(a.created_at||a.start_time).toLocaleString()].map(v => '"' + v + '"').join(','));
                const csv = ['Name,Phone,Email,SMS Status,Email Status,Booked At', ...rows].join('\n');
                const anchor = document.createElement('a');
                anchor.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                anchor.download = 'communications_' + new Date().toISOString().slice(0,10) + '.csv';
                anchor.click();
              }} className="flex items-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition">
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Bookings', value: appointments.length, color: 'text-primary', bg: 'from-primary/5 to-purple-500/5' },
                { label: 'SMS Delivered', value: appointments.filter(a => a.sms_status === 'Sent').length, color: 'text-emerald-400', bg: 'from-emerald-500/5 to-teal-500/5' },
                { label: 'Email Delivered', value: appointments.filter(a => a.email_status === 'Sent').length, color: 'text-blue-400', bg: 'from-blue-500/5 to-cyan-500/5' },
                { label: 'Delivery Issues', value: appointments.filter(a => a.sms_status === 'Failed' || a.email_status === 'Failed').length, color: 'text-amber-400', bg: 'from-amber-500/5 to-orange-500/5' },
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

'@

$newContent = $content.Substring(0, $commentStart) + $newSection + $content.Substring($kbEnd)
[System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
$lineCount = ([System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)).Count
Write-Host "SUCCESS. File now has $lineCount lines."
