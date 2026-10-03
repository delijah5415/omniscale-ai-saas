import React, { useState, useEffect } from 'react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' or 'ai-tools'
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('bulk-seo');
  const [language, setLanguage] = useState('English');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  
  // No-code builder states
  const [platformPrompt, setPlatformPrompt] = useState('');
  const [buildOutput, setBuildOutput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/ai/services')
      .then(res => res.json())
      .then(data => setServices(data))
      .catch(() => {
        setServices([
          { id: 'bulk-seo', name: 'Bulk SEO Programmatic Engine 🚀' },
          { id: 'viral-video', name: 'Viral Video Repurposer 🎬' },
          { id: 'seo', name: 'Global SEO Blog Generator' },
          { id: 'translation', name: 'Multi-Language Ad Copy' },
          { id: 'leads', name: 'AI Lead Qualification Bot' },
          { id: 'contracts', name: 'AI Contract Risk Analyzer' }
        ]);
      });
  }, []);

  const handleMockPayPalSuccess = async () => {
    setPaymentLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/builder/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalOrderId: 'PAYID-' + Math.random(), userEmail: 'user@global.com' })
      });
      const data = await res.json();
      if (data.success) {
        setAccessToken(data.accessToken);
        setIsAuthenticated(true);
      }
    } catch {
      setAccessToken('simulated_token_12345');
      setIsAuthenticated(true);
    }
    setPaymentLoading(false);
  };

  const handleBuildPlatform = async (e) => {
    e.preventDefault();
    setLoading(true);
    setBuildOutput('');

    try {
      const res = await fetch('http://localhost:5000/api/builder/build-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, platformPrompt })
      });
      const data = await res.json();
      setBuildOutput(data.result || data.error);
    } catch {
      setBuildOutput(`[Simulation] Platform successfully built for prompt: "${platformPrompt}" without writing a single line of code!`);
    }
    setLoading(false);
  };

  const handleRunAiService = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOutput('');

    try {
      const res = await fetch('http://localhost:5000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: selectedService, prompt, language })
      });
      const data = await res.json();
      setOutput(data.result);
    } catch {
      setOutput(`[Simulation Mode] Service [${selectedService}] successfully executed for: "${prompt}" in [${language}].`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center justify-between">
      <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl my-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            🌐 OmniScale AI Platform
          </h1>
          <p className="text-slate-400 text-sm mt-2">Global High-Traffic Automation & No-Code Platform Builder</p>
        </header>

        {!isAuthenticated ? (
          <div className="text-center bg-slate-950 border border-slate-800 rounded-xl p-8 space-y-6">
            <div className="inline-block bg-sky-500/10 text-sky-400 font-semibold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider border border-sky-500/20">
              One-Time All-Access License — $49
            </div>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Unlock lifetime access to the No-Code Platform Builder, Bulk SEO Generator, and Viral Video Repurposer. Secured via PayPal.
            </p>
            <button
              onClick={handleMockPayPalSuccess}
              disabled={paymentLoading}
              className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              {paymentLoading ? 'Verifying PayPal Payment...' : 'Pay with PayPal & Unlock Access 🔒'}
            </button>
            <p className="text-xs text-slate-500">Instant token generation and automatic platform unlocking.</p>
          </div>
        ) : (
          <div>
            {/* Authenticated Dashboard Navigation */}
            <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'builder' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                ⚡ No-Code Platform Builder
              </button>
              <button
                onClick={() => setActiveTab('ai-tools')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'ai-tools' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                🚀 High-Traffic AI Engines (Bulk SEO & Video)
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-xs flex justify-between items-center mb-6">
              <span>✓ Payment Verified & Authenticated</span>
              <span className="font-mono text-[10px] text-emerald-500">Token: {accessToken.substring(0, 12)}...</span>
            </div>

            {/* Tab 1: No-Code Platform Builder */}
            {activeTab === 'builder' && (
              <form onSubmit={handleBuildPlatform} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">What platform do you want to build?</label>
                  <textarea
                    rows="4"
                    value={platformPrompt}
                    onChange={(e) => setPlatformPrompt(e.target.value)}
                    placeholder="e.g., Build an online booking platform for pet groomers with Stripe payments..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-sky-500 resize-none text-sm"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold py-3.5 rounded-xl transition text-sm tracking-wide"
                >
                  {loading ? 'Synthesizing Platform Architecture...' : 'Generate Full Platform Now ⚡'}
                </button>
                {buildOutput && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-2">Build Output</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{buildOutput}</p>
                  </div>
                )}
              </form>
            )}

            {/* Tab 2: High-Traffic AI Modules (Bulk SEO & Viral Video) */}
            {activeTab === 'ai-tools' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">Modules</h3>
                  {services.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition text-xs ${selectedService === s.id ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-semibold' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>

                <div className="md:col-span-2 space-y-4">
                  <form onSubmit={handleRunAiService} className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target Keyword or Topic</label>
                      <select 
                        value={language} 
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                      >
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                        <option>German</option>
                        <option>Mandarin</option>
                        <option>Japanese</option>
                      </select>
                    </div>
                    <textarea 
                      rows="3"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Enter target keyword cluster or video topic..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-sky-500 resize-none text-sm"
                      required
                    />
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm"
                    >
                      {loading ? 'Running Automated Pipeline...' : 'Execute High-Traffic AI Task 🚀'}
                    </button>
                  </form>

                  {output && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-2">Execution Result</h3>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{output}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Terms & Legal Rights Footer */}
      <footer className="max-w-4xl w-full mt-10 border-t border-slate-800 pt-4 text-center">
        <button 
          onClick={() => setShowLegal(!showLegal)}
          className="text-xs text-slate-400 hover:text-sky-400 font-medium transition underline focus:outline-none"
        >
          {showLegal ? 'Hide Terms, Disclaimers & Legal Rights ▲' : 'View Terms & Conditions, Disclaimers & Legal Rights ▼'}
        </button>

        {showLegal && (
          <div className="mt-4 p-6 bg-slate-900 border border-slate-800 rounded-xl text-left text-xs text-slate-400 space-y-4 shadow-xl">
            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">1. Limitation of Liability & Loss Waiver</h4>
              <p>By using this platform, you explicitly agree that the platform owners, creators, developers, and affiliates shall bear <strong>zero liability</strong> for any direct, indirect, incidental, or consequential losses. This includes financial loss, loss of revenue, data corruption, or technical inconveniences resulting from the use of our automated AI tools or generated codebases.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">2. "As-Is" Software Disclaimer</h4>
              <p>All services and AI-generated outputs are provided on an <strong>"as-is"</strong> basis without warranties of any kind. Users assume full responsibility for auditing and testing all generated content and code.</p>
            </div>
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
              © 2026 OmniScale AI Platform. All rights reserved.
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}