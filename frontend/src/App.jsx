import React, { useEffect, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const [activeTab, setActiveTab] = useState('builder');
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('bulk-seo');
  const [language, setLanguage] = useState('English');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');

  const [platformPrompt, setPlatformPrompt] = useState('');
  const [buildOutput, setBuildOutput] = useState('');

  const [paymentEmail, setPaymentEmail] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/ai/services`)
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Unable to load AI services.');
        }

        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setServices(Array.isArray(data) ? data : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setServices([]);
          setPaymentError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePayPalCheckout = async () => {
    setPaymentError('');

    if (!paymentEmail.trim()) {
      setPaymentError('Enter your email address before starting checkout.');
      return;
    }

    setPaymentLoading(true);

    try {
      const res = await fetch(`${API_URL}/builder/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: paymentEmail.trim()
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to create the PayPal order.');
      }

      if (!data.approvalUrl) {
        throw new Error('PayPal did not return an approval URL.');
      }

      window.location.href = data.approvalUrl;
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Unable to start PayPal checkout.'
      );
      setPaymentLoading(false);
    }
  };

  const handleBuildPlatform = async (event) => {
    event.preventDefault();

    if (!accessToken) {
      setBuildOutput('Payment access is required before using the builder.');
      return;
    }

    setLoading(true);
    setBuildOutput('');

    try {
      const res = await fetch(`${API_URL}/builder/build-platform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken,
          platformPrompt
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Platform generation failed.');
      }

      setBuildOutput(data.result || 'Platform specification generated successfully.');
    } catch (error) {
      setBuildOutput(
        error instanceof Error
          ? error.message
          : 'Platform generation failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiService = async (event) => {
    event.preventDefault();

    if (!prompt.trim()) {
      setOutput('Enter a prompt first.');
      return;
    }

    setLoading(true);
    setOutput('');

    try {
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service: selectedService,
          prompt,
          language
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI generation failed.');
      }

      setOutput(data.result || 'AI generation completed successfully.');
    } catch (error) {
      setOutput(
        error instanceof Error
          ? error.message
          : 'AI generation failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePayPalOrder = async () => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('token');

    if (!orderId) {
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const res = await fetch(`${API_URL}/builder/capture-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId,
          userEmail: paymentEmail.trim()
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'PayPal payment could not be verified.');
      }

      setAccessToken(data.accessToken);
      setIsAuthenticated(true);

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'PayPal payment verification failed.'
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has('token') && params.has('PayerID')) {
      handleCapturePayPalOrder();
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center justify-between">
      <div className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl my-auto">

        <header className="text-center mb-8">
          <h1 className="text-3xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            🌐 OmniScale AI Platform
          </h1>

          <p className="text-slate-400 text-sm mt-2">
            Global AI Automation & No-Code Platform Builder
          </p>
        </header>

        {!isAuthenticated ? (
          <div className="text-center bg-slate-950 border border-slate-800 rounded-xl p-8 space-y-6">

            <div className="inline-block bg-sky-500/10 text-sky-400 font-semibold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider border border-sky-500/20">
              One-Time All-Access License — $49 USD
            </div>

            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Unlock access to the No-Code Platform Builder and AI automation
              services after successful PayPal payment verification.
            </p>

            <input
              type="email"
              value={paymentEmail}
              onChange={(event) => setPaymentEmail(event.target.value)}
              placeholder="Your email address"
              autoComplete="email"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
            />

            <button
              type="button"
              onClick={handlePayPalCheckout}
              disabled={paymentLoading}
              className="w-full bg-[#0070ba] hover:bg-[#005ea6] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition shadow-lg"
            >
              {paymentLoading
                ? 'Starting PayPal Checkout...'
                : 'Pay with PayPal & Unlock Access 🔒'}
            </button>

            {paymentError && (
              <div className="text-left bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 text-sm">
                {paymentError}
              </div>
            )}

            <p className="text-xs text-slate-500">
              Payment is processed through PayPal. Access is granted only
              after the server verifies a completed payment.
            </p>
          </div>
        ) : (
          <div>

            <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4 flex-wrap">
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'builder'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ⚡ No-Code Platform Builder
              </button>

              <button
                onClick={() => setActiveTab('ai-tools')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'ai-tools'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🚀 AI Engines
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-xs flex justify-between items-center mb-6">
              <span>✓ Payment Verified & Authenticated</span>
              <span className="font-mono text-[10px] text-emerald-500">
                Token: {accessToken.substring(0, 12)}...
              </span>
            </div>

            {activeTab === 'builder' && (
              <form onSubmit={handleBuildPlatform} className="space-y-6">

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    What platform do you want to build?
                  </label>

                  <textarea
                    rows="5"
                    value={platformPrompt}
                    onChange={(event) => setPlatformPrompt(event.target.value)}
                    placeholder="Example: Build an online booking platform for pet groomers with Stripe payments..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-sky-500 resize-none text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-extrabold py-3.5 rounded-xl transition text-sm tracking-wide"
                >
                  {loading
                    ? 'Generating Platform Architecture...'
                    : 'Generate Platform Architecture ⚡'}
                </button>

                {buildOutput && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-2">
                      Build Output
                    </h3>

                    <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                      {buildOutput}
                    </pre>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'ai-tools' && (
              <div className="space-y-6">

                <form onSubmit={handleRunAiService} className="space-y-5">

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      AI Service
                    </label>

                    <select
                      value={selectedService}
                      onChange={(event) => setSelectedService(event.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                    >
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Language
                    </label>

                    <input
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Prompt
                    </label>

                    <textarea
                      rows="6"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Describe what you want the AI service to generate..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl transition"
                  >
                    {loading ? 'Running AI Service...' : 'Run AI Service 🚀'}
                  </button>
                </form>

                {output && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                      AI Output
                    </h3>

                    <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {output}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="max-w-4xl w-full mt-10 border-t border-slate-800 pt-4 text-center">

        <button
          onClick={() => setShowLegal(!showLegal)}
          className="text-xs text-slate-400 hover:text-sky-400 font-medium transition underline focus:outline-none"
        >
          {showLegal
            ? 'Hide Terms, Disclaimers & Legal Rights ▲'
            : 'View Terms & Conditions, Disclaimers & Legal Rights ▼'}
        </button>

        {showLegal && (
          <div className="mt-4 p-6 bg-slate-900 border border-slate-800 rounded-xl text-left text-xs text-slate-400 space-y-4 shadow-xl">

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">
                1. AI Output Disclaimer
              </h4>
              <p>
                AI-generated content may be inaccurate, incomplete, or
                unsuitable for a particular purpose. Users are responsible
                for reviewing and verifying important outputs before relying
                on them.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">
                2. Software Disclaimer
              </h4>
              <p>
                Generated architecture, code specifications, and other
                technical outputs must be independently reviewed, tested,
                secured, and validated before production use.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1">
                3. Professional Advice
              </h4>
              <p>
                OmniScale AI does not provide legal, financial, medical, or
                other regulated professional advice. Consult an appropriately
                qualified professional when required.
              </p>
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
