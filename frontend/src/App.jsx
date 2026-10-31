import TermsAndConditionsModal from "./components/TermsAndConditionsModal.jsx";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AuthPanel from './components/AuthPanel.jsx';
import PremiumWorkspace from './components/PremiumWorkspace.jsx';
import AccountDashboard from './components/AccountDashboard';
import VideoAdBanner from './components/VideoAdBanner'; // Added local video advertisement component
import { supabase } from './lib/supabase.js';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'omniscale_access_token';
const PAYMENT_EMAIL_KEY = 'omniscale_payment_email';
const SUBSCRIPTION_ID_KEY = 'omniscale_subscription_id';

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
  const [subscriptionStatus, setSubscriptionStatus] = useState('unknown');
  const [termsAccepted, setTermsAccepted] = useState(() => window.localStorage.getItem('omniscale_terms_accepted_2026') === 'true');

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
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [loading, setLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const verificationInProgress = useRef(false);

  const handleSupabaseAuthChange = useCallback(async (user, session) => {
    const token = session?.access_token || '';

    setAccessToken(token);
    setIsAuthenticated(Boolean(user && token));

    if (user?.email) {
      setPaymentEmail(user.email);
    }

    if (user && token) {
      try {
        const res = await fetch(`${API_URL}/builder/subscription-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Subscription status could not be verified.');
        }

        setSubscriptionStatus(
          data.hasAccess === true
            ? 'active'
            : 'inactive'
        );
      } catch (err) {
        console.error('Subscription verification failed:', err);
        setSubscriptionStatus('unknown');
      }
    } else {
      setSubscriptionStatus('unknown');
    }
  }, []);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(PAYMENT_EMAIL_KEY);
    if (savedEmail) {
      setPaymentEmail(savedEmail);
    }
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

    if (selectedPlan !== 'monthly' && selectedPlan !== 'yearly') {
      setPaymentError('Please select a subscription plan.');
      return;
    }

    window.localStorage.setItem(PAYMENT_EMAIL_KEY, email);
    setPaymentLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Please sign in again before continuing.');
      }

      const res = await fetch(`${API_URL}/builder/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userEmail: email,
          plan: selectedPlan
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to create the PayPal subscription.');
      }

      if (!data.approvalUrl) {
        throw new Error('PayPal did not return a subscription approval URL.');
      }

      if (data.subscriptionId) {
        window.localStorage.setItem(SUBSCRIPTION_ID_KEY, data.subscriptionId);
      }

      window.location.href = data.approvalUrl;
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : 'Unable to start PayPal subscription checkout.'
      );
      setPaymentLoading(false);
    }
  };

  const handleVerifyPayPalSubscription = async (forcedSubscriptionId) => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionId =
      forcedSubscriptionId ||
      params.get('subscription_id') ||
      window.localStorage.getItem(SUBSCRIPTION_ID_KEY);

    if (!subscriptionId) {
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Please sign in again before continuing.');
      }

      const res = await fetch(`${API_URL}/builder/verify-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'PayPal subscription could not be verified.');
      }

      window.localStorage.setItem(SUBSCRIPTION_ID_KEY, subscriptionId);
      setSubscriptionStatus('active');
      setShowCheckout(false);

      window.history.replaceState({}, document.title, window.location.pathname);
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : 'PayPal subscription verification failed.'
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSubscriptionId = params.get('subscription_id');

    if (
      urlSubscriptionId &&
      accessToken &&
      !verificationInProgress.current
    ) {
      verificationInProgress.current = true;
      setShowCheckout(true);
      handleVerifyPayPalSubscription(urlSubscriptionId).finally(() => {
        verificationInProgress.current = false;
      });
    }
  }, [accessToken]);

  const handleBuildPlatform = async (event) => {
    event.preventDefault();

    if (!accessToken || subscriptionStatus !== 'active') {
      setBuildOutput('Active subscription and payment verification are required before using the builder.');
      return;
    }

    if (!platformPrompt.trim()) {
      setBuildOutput('Describe the platform you want to build first.');
      return;
    }

    setLoading(true);
    setBuildOutput('');

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Please sign in again before continuing.');
      }

      const res = await fetch(`${API_URL}/builder/build-platform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ platformPrompt })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Platform generation failed.');
      }

      setBuildOutput(data.result || 'Platform specification generated successfully.');
    } catch (error) {
      setBuildOutput(error instanceof Error ? error.message : 'Platform generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiService = async (event) => {
    event.preventDefault();

    if (!accessToken || subscriptionStatus !== 'active') {
      setOutput('Active subscription and payment verification are required before running AI services.');
      return;
    }

    if (!prompt.trim()) {
      setOutput('Enter a prompt first.');
      return;
    }

    setLoading(true);
    setOutput('');

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error('Please sign in again before continuing.');
      }

      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ service: selectedService, prompt, language })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI generation failed.');
      }

      setOutput(data.result || 'AI generation completed successfully.');
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase sign-out failed:', error.message);
      return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken('');
    setIsAuthenticated(false);
    setSubscriptionStatus('unknown');
    setActiveTab('builder');
    setBuildOutput('');
    setOutput('');
  };

  if (currentServicePage && (!isAuthenticated || subscriptionStatus !== 'active')) {
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
        </main>
      </div>
    );
  }

  if (isAuthenticated && subscriptionStatus === 'active') {
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
          {/* Embedded Video Advertisement with Local Storage tracking */}
          <VideoAdBanner />

          <section className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              ✓ Payment Verified & Authenticated
            </div>
            <h1 className="text-4xl md:text-5xl font-black mt-4">
              Welcome to OmniScale AI
            </h1>
            <p className="text-slate-400 mt-3 max-w-2xl">
              Build digital platforms and run AI-powered automation workflows from one workspace.
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
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-5 py-3 rounded-xl font-semibold transition ${
                activeTab === 'workspace'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}
            >
              AI Workspace
            </button>
          </div>
          {activeTab === 'builder' && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold">No-Code Platform Builder</h2>
              <p className="text-slate-400 mt-2 mb-6">
                Describe the digital platform you want OmniScale to architect.
              </p>
              <form onSubmit={handleBuildPlatform}>
                <textarea
                  value={platformPrompt}
                  onChange={(event) => setPlatformPrompt(event.target.value)}
                  rows={8}
                  placeholder="Example: Build an online booking platform for pet groomers with customer accounts, appointments, payments, notifications and an admin dashboard."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-sky-500 resize-y"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 font-bold disabled:opacity-50"
                >
                  {loading ? 'Generating Platform...' : 'Generate Platform Specification'}
                </button>
              </form>
              {buildOutput && (
                <div className="mt-6 bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <h3 className="font-bold mb-3">Generated Result</h3>
                  <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-7">
                    {buildOutput}
                  </pre>
                </div>
              )}
            </section>
          )}
          {activeTab === 'ai' && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold">AI Automation Services</h2>
              <p className="text-slate-400 mt-2 mb-6">
                Select an AI service and provide your instructions.
              </p>
              <form onSubmit={handleRunAiService}>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">AI Service</label>
                    <select
                      value={selectedService}
                      onChange={(event) => setSelectedService(event.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="seo">Global SEO Blog Generator</option>
                      <option value="bulk-seo">Bulk SEO Programmatic Engine</option>
                      <option value="viral-video">Viral Video Repurposer &amp; Script Engine</option>
                      <option value="translation">Multi-Language Ad Copy</option>
                      <option value="leads">AI Lead Qualification Bot</option>
                      <option value="contracts">AI Contract Risk Analyzer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Language</label>
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
                  rows={7}
                  placeholder="Describe what you want the AI to create..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 resize-y"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 font-bold disabled:opacity-50"
                >
                  {loading ? 'Running AI...' : 'Run AI Service'}
                </button>
              </form>
              {output && (
                <div className="mt-6 bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <h3 className="font-bold mb-3">AI Output</h3>
                  <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-7">
                    {output}
                  </pre>
                </div>
              )}
            </section>
          )}
          {activeTab === 'workspace' && (
            <PremiumWorkspace
              accessToken={accessToken}
              isAuthenticated={isAuthenticated}
            />
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
            <button onClick={() => scrollToSection('features')} className="hover:text-white">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white">
              How It Works
            </button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-white">
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
              {/* Embedded Video Advertisement Banner on Landing Page */}
              <div className="mb-10">
                <VideoAdBanner />
              </div>

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
                OmniScale brings AI automation and no-code platform generation into one workspace, helping you turn ideas into structured digital products faster.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-9">
                <button
                  onClick={openCheckout}
                  className="px-7 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:opacity-90 font-bold shadow-xl shadow-sky-500/10"
                >
                  Get Started — From $25/month
                </button>
                <button
                  onClick={() => scrollToSection('features')}
                  className="px-7 py-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 font-semibold"
                >
                  Explore Platform
                </button>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-indigo-400 font-semibold mb-2">PLATFORM FEATURES</p>
              <h2 className="text-3xl md:text-4xl font-bold">AI tools built to scale your work</h2>
              <p className="text-slate-400 mt-4 max-w-2xl mx-auto">
                Explore the six AI services configured for OmniScale.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold mb-3">Global SEO Blog Generator</h3>
                <p className="text-slate-400">Create SEO-focused blog content for your audience.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold mb-3">Bulk SEO Programmatic Engine</h3>
                <p className="text-slate-400">Support scalable, repeatable SEO content workflows.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold mb-3">Viral Video Repurposer</h3>
                <p className="text-slate-400">Develop video repurposing ideas and scripts.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold mb-3">Multi-Language Ad Copy</h3>
                <p className="text-slate-400">Prepare ad copy for different language audiences.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold mb-3">AI Lead Qualification Bot</h3>
                <p className="text-slate-400">Assist with lead qualification and prioritization.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold mb-3">AI Contract Risk Analyzer</h3>
                <p className="text-slate-400">Flag potential contract risks for human review. Not legal advice.</p>
              </article>
            </div>
            <div className="text-center mt-8">
              <button type="button" onClick={() => scrollToSection('account')}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3">
                Get Started
              </button>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="px-6 py-16 bg-slate-950">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-indigo-400 font-semibold mb-2">HOW IT WORKS</p>
              <h2 className="text-3xl md:text-4xl font-bold">From signup to AI workflow</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <article className="rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold mb-2">1. Create an account</h3>
                <p className="text-slate-400">Register or sign in using the configured authentication flow.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold mb-2">2. Choose a subscription</h3>
                <p className="text-slate-400">Review a plan and complete the payment provider checkout.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold mb-2">3. Verify access</h3>
                <p className="text-slate-400">Paid features should be enabled only after subscription verification.</p>
              </article>
              <article className="rounded-2xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold mb-2">4. Run an AI workflow</h3>
                <p className="text-slate-400">Choose a supported service, enter a prompt, and review the output.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="account" className="max-w-3xl mx-auto px-6 pt-12">
          <div className="text-center mb-5">
            <p className="text-sky-400 text-sm font-bold uppercase tracking-wider">Your Account</p>
            <h2 className="text-3xl font-black mt-2">Sign up or sign in</h2>
            <p className="text-slate-400 mt-3">
              Create an account or sign in before subscribing. A paid subscription is required to unlock workspace features.
            </p>
          </div>
          <AuthPanel onAuthChange={handleSupabaseAuthChange} />
          {isAuthenticated && accessToken && (
            <AccountDashboard accessToken={accessToken} />
          )}
        </section>
        <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center">
            <p className="text-purple-400 text-sm font-bold uppercase tracking-wider">Simple Subscription</p>
            <h2 className="text-4xl md:text-5xl font-black mt-3">Choose Your OmniScale Plan</h2>
            <p className="text-slate-400 mt-4">
              Get continued access to the OmniScale AI platform with a monthly or yearly subscription.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mt-10">
            <button
              type="button"
              onClick={() => setSelectedPlan('monthly')}
              className={`text-left rounded-3xl p-8 border transition ${
                selectedPlan === 'monthly'
                  ? 'border-sky-400 bg-sky-500/10 shadow-xl shadow-sky-500/10'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <div className="text-sm text-sky-400 font-bold uppercase tracking-wider">Monthly</div>
              <div className="text-5xl font-black mt-3">$25</div>
              <div className="text-slate-500 text-sm mt-2">USD / month</div>
              <p className="text-slate-400 mt-5">Flexible monthly access to the OmniScale AI platform.</p>
              {selectedPlan === 'monthly' && (
                <div className="mt-5 text-sm text-sky-400 font-bold">✓ Selected</div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan('yearly')}
              className={`text-left rounded-3xl p-8 border transition ${
                selectedPlan === 'yearly'
                  ? 'border-purple-400 bg-purple-500/10 shadow-xl shadow-purple-500/10'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <div className="text-sm text-purple-400 font-bold uppercase tracking-wider">Yearly</div>
              <div className="text-5xl font-black mt-3">$296.40</div>
              <div className="text-slate-500 text-sm mt-2">USD / year</div>
              <p className="text-slate-400 mt-5">Annual access with one subscription payment per year.</p>
              {selectedPlan === 'yearly' && (
                <div className="mt-5 text-sm text-purple-400 font-bold">✓ Selected</div>
              )}
            </button>
          </div>
          <div className="max-w-md mx-auto mt-8 bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl">
            <ul className="space-y-3 text-sm text-slate-300">
              <li>✓ No-Code Platform Builder</li>
              <li>✓ AI Automation Services</li>
              <li>✓ Platform Specification Generation</li>
              <li>✓ AI-powered workflows</li>
              <li>✓ Access after subscription verification</li>
            </ul>
            <button
              onClick={openCheckout}
              className="w-full mt-8 py-4 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] font-bold"
            >
              Continue with PayPal
            </button>
          </div>
        </section>
        {showCheckout && (
          <section id="checkout" className="border-t border-slate-800 bg-slate-900/50">
            <div className="max-w-2xl mx-auto px-6 py-20">
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-7 md:p-9 shadow-2xl">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  ← Back to OmniScale
                </button>
                <div className="mt-7">
                  <h2 className="text-3xl font-black mt-5">Unlock OmniScale</h2>
                  <p className="text-slate-400 mt-3">
                    Enter your email and continue to PayPal to start your selected OmniScale subscription.
                  </p>
                </div>
                <div className="mt-7">
                  <label className="block text-sm text-slate-400 mb-2">Email address</label>
                  <input
                    type="email"
                    value={paymentEmail}
                    onChange={(event) => setPaymentEmail(event.target.value)}
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
                    className="w-full mt-6 py-4 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold disabled:opacity-50"
                  >
                    {paymentLoading ? 'Redirecting to PayPal...' : 'Proceed to PayPal Checkout'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}