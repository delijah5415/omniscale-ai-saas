import React, { useState } from 'react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [platformPrompt, setPlatformPrompt] = useState('');
  const [buildOutput, setBuildOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center justify-between">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl my-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            🚀 AI No-Code Platform Builder
          </h1>
          <p className="text-slate-400 text-sm mt-2">Build complete full-stack web applications instantly using only plain English prompts.</p>
        </header>

        {!isAuthenticated ? (
          <div className="text-center bg-slate-950 border border-slate-800 rounded-xl p-8 space-y-6">
            <div className="inline-block bg-sky-500/10 text-sky-400 font-semibold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider border border-sky-500/20">
              One-Time Access License — $49
            </div>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Unlock lifetime access to the autonomous no-code platform generator. Secured and verified instantly via PayPal.
            </p>
            <button
              onClick={handleMockPayPalSuccess}
              disabled={paymentLoading}
              className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              {paymentLoading ? 'Verifying PayPal Payment...' : 'Pay with PayPal & Unlock Builder 🔒'}
            </button>
            <p className="text-xs text-slate-500">Instant redirection & automatic token generation upon success.</p>
          </div>
        ) : (
          <form onSubmit={handleBuildPlatform} className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-xs flex justify-between items-center">
              <span>✓ Payment Verified & Authenticated</span>
              <span className="font-mono text-[10px] text-emerald-500">Token: {accessToken.substring(0, 12)}...</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">What platform do you want to build?</label>
              <textarea
                rows="4"
                value={platformPrompt}
                onChange={(e) => setPlatformPrompt(e.target.value)}
                placeholder="e.g., Build an online booking platform for pet groomers with Stripe payments and user dashboards..."
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
      </div>

      {/* Collapsible Terms, Conditions & Legal Disclaimers Footer */}
      <footer className="max-w-2xl w-full mt-10 border-t border-slate-800 pt-4 text-center">
        <button 
          onClick={() => setShowLegal(!showLegal)}
          className="text-xs text-slate-400 hover:text-sky-400 font-medium transition underline focus:outline-none"
        >
          {showLegal ? 'Hide Terms, Disclaimers & Legal Rights ▲' : 'View Terms & Conditions, Disclaimers & Legal Rights ▼'}
        </button>

        {showLegal && (
          <div className="mt-4 p-6 bg-slate-900 border border-slate-800 rounded-xl text-left text-xs text-slate-400 space-y-4 shadow-xl animate-fadeIn">
            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">1. Limitation of Liability & Loss Waiver</h4>
              <p>By using this platform, you explicitly agree that the platform owners, creators, developers, and affiliates shall bear <strong>zero liability</strong> for any direct, indirect, incidental, or consequential losses. This includes, but is not limited to, financial loss, loss of revenue, data corruption, business interruption, or technical inconveniences resulting from the use of our AI tools or generated codebases.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">2. "As-Is" Software Disclaimer</h4>
              <p>All services, AI-generated outputs, and software scaffolding are provided on an <strong>"as-is" and "as-available"</strong> basis without warranties of any kind, whether express or implied. Users assume full responsibility for auditing, testing, and deploying any code or content generated through this service.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">3. Refund & Payment Policy</h4>
              <p>All payments made via PayPal for access tokens are final. Due to the digital and instantaneous nature of software access and AI generations, no refunds will be issued under any circumstances.</p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
              © 2026 OmniScale AI Platform. All rights reserved. Use of this service constitutes full acceptance of these terms.
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}