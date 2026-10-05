import React, { useEffect, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'omniscale_access_token';
const PAYMENT_EMAIL_KEY = 'omniscale_payment_email';
const SERVICE_PAGES = {
  '/seo': {
    id: 'seo',
    title: 'Global SEO Blog Generator',
    description: 'Generate search-optimized blog content, titles, meta descriptions, outlines and keyword-focused copy with OmniScale AI.',
    useCases: ['SEO blog articles', 'SEO titles and meta descriptions', 'Keyword-focused content', 'Content refresh and expansion']
  },
  '/bulk-seo': {
    id: 'bulk-seo',
    title: 'Bulk SEO Programmatic Engine',
    description: 'Create scalable SEO content workflows for large keyword sets, locations, products, categories and programmatic landing pages.',
    useCases: ['Large-scale SEO generation', 'Programmatic landing pages', 'Keyword-to-content workflows', 'Location and product SEO']
  },
  '/viral-video': {
    id: 'viral-video',
    title: 'Viral Video Repurposer & Script Engine',
    description: 'Turn ideas and source material into engaging video concepts, scripts, hooks, captions and repurposing strategies.',
    useCases: ['Short-form video scripts', 'Attention-grabbing hooks', 'Content repurposing', 'Social video concepts']
  },
  '/translation': {
    id: 'translation',
    title: 'Multi-Language Ad Copy',
    description: 'Create localized advertising and marketing copy across multiple languages while preserving the intended message and conversion goal.',
    useCases: ['Multilingual advertising', 'Localized campaigns', 'International messaging', 'Cross-market variations']
  },
  '/leads': {
    id: 'leads',
    title: 'AI Lead Qualification Bot',
    description: 'Analyze incoming leads, identify buying intent, classify prospects and produce structured qualification recommendations.',
    useCases: ['Lead qualification', 'Buying-intent analysis', 'Sales prioritization', 'Lead-response workflows']
  },
  '/contracts': {
    id: 'contracts',
    title: 'AI Contract Risk Analyzer',
    description: 'Review contract text for potential risks, obligations, unusual clauses and commercial concerns requiring professional review.',
    useCases: ['Contract clause review', 'Risk identification', 'Obligation summaries', 'Commercial issue detection']
  }
};

const SERVICE_PATHS = Object.keys(SERVICE_PAGES);


export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const [activeTab, setActiveTab] = useState('builder');
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
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
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const savedEmail = window.localStorage.getItem(PAYMENT_EMAIL_KEY);

    if (savedToken) {
      setAccessToken(savedToken);
      setIsAuthenticated(true);
    }

    if (savedEmail) {
      setPaymentEmail(savedEmail);
    }
  }, []);

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
      .catch(() => {
        if (!cancelled) {
          setServices([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);


  const navigateTo = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const currentServicePage = SERVICE_PAGES[currentPath.replace(/\/+$/, '') || '/'];
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  const openCheckout = () => {
    setPaymentError('');
    setShowCheckout(true);

    setTimeout(() => {
      document.getElementById('checkout')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 50);
  };

  const handlePayPalCheckout = async () => {
    setPaymentError('');

    const email = paymentEmail.trim();

    if (!email) {
      setPaymentError('Enter your email address before starting checkout.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPaymentError('Enter a valid email address.');
      return;
    }

    window.localStorage.setItem(PAYMENT_EMAIL_KEY, email);

    setPaymentLoading(true);

    try {
      const res = await fetch(`${API_URL}/builder/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: email
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

  const handleCapturePayPalOrder = async () => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('token');

    if (!orderId) {
      return;
    }

    const storedEmail =
      window.localStorage.getItem(PAYMENT_EMAIL_KEY) ||
      paymentEmail.trim();

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
          userEmail: storedEmail
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || 'PayPal payment could not be verified.'
        );
      }

      if (!data.accessToken) {
        throw new Error(
          'Payment was verified, but no access token was returned.'
        );
      }

      window.localStorage.setItem(
        ACCESS_TOKEN_KEY,
        data.accessToken
      );

      setAccessToken(data.accessToken);
      setIsAuthenticated(true);
      setShowCheckout(false);

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
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
      setShowCheckout(true);
      handleCapturePayPalOrder();
    }
  }, []);

  const handleBuildPlatform = async (event) => {
    event.preventDefault();

    if (!accessToken) {
      setBuildOutput(
        'Payment access is required before using the builder.'
      );
      return;
    }

    if (!platformPrompt.trim()) {
      setBuildOutput('Describe the platform you want to build first.');
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
        throw new Error(
          data.error || 'Platform generation failed.'
        );
      }

      setBuildOutput(
        data.result ||
          'Platform specification generated successfully.'
      );
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
        throw new Error(
          data.error || 'AI generation failed.'
        );
      }

      setOutput(
        data.result ||
          'AI generation completed successfully.'
      );
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

  const logout = () => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken('');
    setIsAuthenticated(false);
    setActiveTab('builder');
    setBuildOutput('');
    setOutput('');
  };


  if (currentServicePage && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => navigateTo('/')}
              className="text-xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent"
            >
              🌐 OmniScale AI
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateTo('/')}
                className="hidden sm:inline px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white"
              >
                Home
              </button>

              <button
                onClick={openCheckout}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold"
              >
                Get Started
              </button>
            </div>
          </div>
        </nav>

        <main>
          <section className="relative overflow-hidden border-b border-slate-800">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 pointer-events-none" />

            <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                  OmniScale AI Service
                </div>

                <h1 className="text-4xl md:text-6xl font-black mt-5 leading-tight">
                  {currentServicePage.title}
                </h1>

                <p className="text-lg text-slate-400 mt-5 max-w-3xl leading-8">
                  {currentServicePage.description}
                </p>

                <div className="grid sm:grid-cols-2 gap-3 mt-8 max-w-3xl">
                  {currentServicePage.useCases.map((item) => (
                    <div
                      key={item}
                      className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300"
                    >
                      <span className="text-emerald-400 mr-2">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-5xl mx-auto px-6 py-16">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold">
                Use this AI service
              </h2>

              <p className="text-slate-400 mt-2 mb-6">
                Describe exactly what you want OmniScale AI to create or analyze.
              </p>

              <form onSubmit={handleRunAiService}>
                <div className="grid md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      AI Service
                    </label>

                    <select
                      value={selectedService}
                      onChange={(event) => {
                        const nextService = event.target.value;
                        const targetPath = SERVICE_PATHS.find(
                          (path) => SERVICE_PAGES[path].id === nextService
                        );

                        if (targetPath) {
                          navigateTo(targetPath);
                        } else {
                          setSelectedService(nextService);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                    >
                      {SERVICE_PATHS.map((path) => (
                        <option key={SERVICE_PAGES[path].id} value={SERVICE_PAGES[path].id}>
                          {SERVICE_PAGES[path].title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Language
                    </label>

                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Portuguese</option>
                      <option>Italian</option>
                    </select>
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={9}
                  placeholder="Describe what you want the AI to create..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 resize-y"
                />

                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 font-bold disabled:opacity-50"
                  >
                    {loading ? 'Running AI...' : 'Run AI Service'}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('/')}
                    className="px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 font-semibold text-slate-300 hover:text-white"
                  >
                    Back to OmniScale
                  </button>
                </div>
              </form>

              {output && (
                <div className="mt-7 bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <h3 className="font-bold mb-3">AI Output</h3>
                  <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-7">
                    {output}
                  </pre>
                </div>
              )}
            </div>
          </section>

          <section className="max-w-5xl mx-auto px-6 pb-20">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-6 md:p-8 text-center">
              <h2 className="text-2xl font-bold">Ready to scale your workflow?</h2>
              <p className="text-slate-400 mt-2 max-w-2xl mx-auto">
                Access the full OmniScale platform, including AI automation and the no-code platform builder.
              </p>
              <button
                onClick={openCheckout}
                className="mt-6 px-7 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 font-bold"
              >
                Get Started with OmniScale
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <nav className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setActiveTab('builder')}
              className="text-xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent"
            >
              🌐 OmniScale
            </button>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-xs text-emerald-400">
                ✓ Access Verified
              </span>

              <button
                onClick={logout}
                className="text-xs px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-10">
          <section className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              ✓ Payment Verified & Authenticated
            </div>

            <h1 className="text-4xl md:text-5xl font-black mt-4">
              Welcome to OmniScale AI
            </h1>

            <p className="text-slate-400 mt-3 max-w-2xl">
              Build digital platforms and run AI-powered automation
              workflows from one workspace.
            </p>
          </section>

          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-5 py-3 rounded-xl font-semibold transition ${
                activeTab === 'builder'
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}
            >
              Platform Builder
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-5 py-3 rounded-xl font-semibold transition ${
                activeTab === 'ai'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}
            >
              AI Automation
            </button>
          </div>

          {activeTab === 'builder' && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold">
                No-Code Platform Builder
              </h2>

              <p className="text-slate-400 mt-2 mb-6">
                Describe the digital platform you want OmniScale to
                architect.
              </p>

              <form onSubmit={handleBuildPlatform}>
                <textarea
                  value={platformPrompt}
                  onChange={(event) =>
                    setPlatformPrompt(event.target.value)
                  }
                  rows={8}
                  placeholder="Example: Build an online booking platform for pet groomers with customer accounts, appointments, payments, notifications and an admin dashboard."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-sky-500 resize-y"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 font-bold disabled:opacity-50"
                >
                  {loading
                    ? 'Generating Platform...'
                    : 'Generate Platform Specification'}
                </button>
              </form>

              {buildOutput && (
                <div className="mt-6 bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <h3 className="font-bold mb-3">
                    Generated Result
                  </h3>

                  <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-7">
                    {buildOutput}
                  </pre>
                </div>
              )}
            </section>
          )}

          {activeTab === 'ai' && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold">
                AI Automation Services
              </h2>

              <p className="text-slate-400 mt-2 mb-6">
                Select an AI service and provide your instructions.
              </p>

              <form onSubmit={handleRunAiService}>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      AI Service
                    </label>

                    <select
                      value={selectedService}
                      onChange={(event) =>
                        setSelectedService(event.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                    >
                      {services.length > 0 ? (
                        services.map((service) => {
                          const value =
                            typeof service === 'string'
                              ? service
                              : service.id ||
                                service.slug ||
                                service.name;

                          const label =
                            typeof service === 'string'
                              ? service
                              : service.name ||
                                service.title ||
                                service.id;

                          return (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="bulk-seo">
                            Bulk SEO
                          </option>
                          <option value="content">
                            AI Content
                          </option>
                          <option value="marketing">
                            Marketing Automation
                          </option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Language
                    </label>

                    <select
                      value={language}
                      onChange={(event) =>
                        setLanguage(event.target.value)
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Portuguese</option>
                      <option>Italian</option>
                    </select>
                  </div>
                </div>

                <textarea
                  value={prompt}
                  onChange={(event) =>
                    setPrompt(event.target.value)
                  }
                  rows={7}
                  placeholder="Describe what you want the AI to create..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 resize-y"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 font-bold disabled:opacity-50"
                >
                  {loading
                    ? 'Running AI...'
                    : 'Run AI Service'}
                </button>
              </form>

              {output && (
                <div className="mt-6 bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <h3 className="font-bold mb-3">
                    AI Output
                  </h3>

                  <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-7">
                    {output}
                  </pre>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-xl font-black bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent"
          >
            🌐 OmniScale AI
          </button>

          <div className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-white"
            >
              Features
            </button>

            <button
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-white"
            >
              How It Works
            </button>

            <button
              onClick={() => scrollToSection('pricing')}
              className="hover:text-white"
            >
              Pricing
            </button>

            <button
              onClick={openCheckout}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-bold"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-400 text-xs font-bold uppercase tracking-wider">
                AI Automation • No-Code Development • Digital Platforms
              </div>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight mt-7 leading-tight">
                Build, automate and
                <span className="block bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  scale with AI.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mt-7 leading-8">
                OmniScale brings AI automation and no-code platform
                generation into one workspace, helping you turn ideas
                into structured digital products faster.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mt-9">
                <button
                  onClick={openCheckout}
                  className="px-7 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-90 font-bold shadow-xl shadow-sky-500/10"
                >
                  Get Started — $49
                </button>

                <button
                  onClick={() => scrollToSection('features')}
                  className="px-7 py-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 font-semibold"
                >
                  Explore Platform
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mt-12 max-w-3xl">
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                  <div className="text-2xl font-black text-sky-400">
                    AI
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    Automation workflows
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                  <div className="text-2xl font-black text-indigo-400">
                    No-Code
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    Platform architecture
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                  <div className="text-2xl font-black text-purple-400">
                    One-Time
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    $49 access license
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-2xl mb-10">
            <p className="text-sky-400 text-sm font-bold uppercase tracking-wider">
              Platform Capabilities
            </p>

            <h2 className="text-3xl md:text-4xl font-black mt-3">
              One workspace for your AI-powered digital workflow.
            </h2>

            <p className="text-slate-400 mt-4">
              OmniScale combines platform planning with AI-powered
              automation tools.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <article className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
              <div className="text-3xl">🏗️</div>
              <h3 className="text-xl font-bold mt-5">
                Platform Builder
              </h3>
              <p className="text-slate-400 mt-3 leading-7">
                Describe the product you want to create and generate
                a structured platform specification.
              </p>
            </article>

            <article className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
              <div className="text-3xl">🤖</div>
              <h3 className="text-xl font-bold mt-5">
                AI Automation
              </h3>
              <p className="text-slate-400 mt-3 leading-7">
                Use AI-powered services for content, SEO, marketing
                and other digital workflows.
              </p>
            </article>

            <article className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
              <div className="text-3xl">⚡</div>
              <h3 className="text-xl font-bold mt-5">
                Rapid Execution
              </h3>
              <p className="text-slate-400 mt-3 leading-7">
                Move from an initial idea to an actionable technical
                specification without unnecessary complexity.
              </p>
            </article>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-slate-800 bg-slate-900/40"
        >
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="max-w-2xl mb-10">
              <p className="text-indigo-400 text-sm font-bold uppercase tracking-wider">
                How It Works
              </p>

              <h2 className="text-3xl md:text-4xl font-black mt-3">
                From idea to AI workspace.
              </h2>
            </div>

            <div className="grid md:grid-cols-4 gap-5">
              {[
                ['01', 'Choose Access', 'Select the one-time OmniScale license.'],
                ['02', 'Secure Checkout', 'Complete payment through PayPal.'],
                ['03', 'Describe Your Idea', 'Tell OmniScale what you want to build.'],
                ['04', 'Create & Automate', 'Use the builder and AI automation tools.']
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-6"
                >
                  <div className="text-sky-400 font-black">
                    {number}
                  </div>

                  <h3 className="font-bold text-lg mt-4">
                    {title}
                  </h3>

                  <p className="text-sm text-slate-400 mt-2 leading-6">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center">
            <p className="text-purple-400 text-sm font-bold uppercase tracking-wider">
              Simple Access
            </p>

            <h2 className="text-4xl md:text-5xl font-black mt-3">
              One-Time All-Access License
            </h2>

            <p className="text-slate-400 mt-4">
              Get access to the OmniScale platform after successful
              payment verification.
            </p>
          </div>

          <div className="max-w-md mx-auto mt-10 bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="text-sm text-slate-400">
                OmniScale AI Platform
              </div>

              <div className="text-6xl font-black mt-3">
                $49
              </div>

              <div className="text-slate-500 text-sm mt-2">
                USD • One-time payment
              </div>
            </div>

            <ul className="space-y-3 mt-8 text-sm text-slate-300">
              <li>✓ No-Code Platform Builder</li>
              <li>✓ AI Automation Services</li>
              <li>✓ Platform Specification Generation</li>
              <li>✓ AI-powered workflows</li>
              <li>✓ Access after payment verification</li>
            </ul>

            <button
              onClick={openCheckout}
              className="w-full mt-8 py-4 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] font-bold"
            >
              Get Started with PayPal
            </button>

            <p className="text-xs text-slate-500 text-center mt-4">
              Payment is processed securely through PayPal.
            </p>
          </div>
        </section>

        {showCheckout && (
          <section
            id="checkout"
            className="border-t border-slate-800 bg-slate-900/50"
          >
            <div className="max-w-2xl mx-auto px-6 py-20">
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-7 md:p-9 shadow-2xl">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  ← Back to OmniScale
                </button>

                <div className="mt-7">
                  <div className="inline-block bg-sky-500/10 text-sky-400 font-semibold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider border border-sky-500/20">
                    Secure Checkout
                  </div>

                  <h2 className="text-3xl font-black mt-5">
                    Unlock OmniScale
                  </h2>

                  <p className="text-slate-400 mt-3">
                    Enter your email and continue to PayPal to
                    purchase the $49 one-time access license.
                  </p>
                </div>

                <div className="mt-7">
                  <label className="block text-sm text-slate-400 mb-2">
                    Email address
                  </label>

                  <input
                    type="email"
                    value={paymentEmail}
                    onChange={(event) =>
                      setPaymentEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-sky-500"
                  />

                  {paymentError && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm p-4">
                      {paymentError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handlePayPalCheckout}
                    disabled={paymentLoading}
                    className="w-full mt-5 bg-[#0070ba] hover:bg-[#005ea6] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition shadow-lg"
                  >
                    {paymentLoading
                      ? 'Starting PayPal Checkout...'
                      : 'Pay $49 with PayPal 🔒'}
                  </button>

                  <p className="text-xs text-slate-500 text-center mt-4 leading-5">
                    Payment is processed through PayPal. Access is
                    granted only after the server verifies a completed
                    payment.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="max-w-5xl mx-auto px-6 pb-20">
          <button
            onClick={() => setShowLegal(!showLegal)}
            className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 text-left"
          >
            <span className="font-bold">
              Terms & Conditions
            </span>

            <span className="text-slate-400">
              {showLegal ? '−' : '+'}
            </span>
          </button>

          {showLegal && (
            <div className="bg-slate-900 border-x border-b border-slate-800 rounded-b-xl p-6 text-sm text-slate-400 leading-7">
              <p>
                OmniScale provides AI-assisted digital tools and
                platform-generation functionality. Generated results
                should be reviewed before production use.
              </p>

              <p className="mt-4">
                Payment grants access according to the product
                configuration active at the time of purchase. Users
                remain responsible for reviewing, validating and
                appropriately using generated content and platform
                specifications.
              </p>

              <p className="mt-4">
                OmniScale does not guarantee that generated outputs
                will be suitable for every business, technical,
                regulatory or operational requirement.
              </p>

              <p className="mt-4">
                By purchasing access, the customer acknowledges that
                AI-generated results may require human review,
                modification, testing and additional implementation.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div>
              <div className="font-black text-xl">
                OmniScale AI
              </div>

              <p className="text-sm text-slate-500 mt-2">
                AI automation and no-code platform generation.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              © {new Date().getFullYear()} OmniScale AI. All rights
              reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
