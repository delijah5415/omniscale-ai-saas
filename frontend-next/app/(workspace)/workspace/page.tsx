'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  Activity,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Code2,
  Command,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/shell/AuthProvider';
import { apiRequest } from '@/lib/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

type Mode = 'build' | 'deploy' | 'automate' | 'test' | 'optimize' | 'insights';

const MODES: {
  id: Mode;
  label: string;
  description: string;
  instruction: string;
  icon: typeof Code2;
}[] = [
  {
    id: 'build',
    label: 'Build',
    description: 'Plan architecture, features and implementation',
    instruction:
      'Help me plan and build this solution. Explain the architecture, files, implementation steps and relevant code. Do not claim to have edited files or executed anything.',
    icon: Code2,
  },
  {
    id: 'deploy',
    label: 'Deploy',
    description: 'Prepare a safe deployment plan',
    instruction:
      'Help me prepare a deployment plan. Check prerequisites, environment variables, build steps, release checks and rollback strategy. Provide copyable commands where useful. Do not claim to have deployed anything.',
    icon: Rocket,
  },
  {
    id: 'automate',
    label: 'Automate',
    description: 'Design workflows, triggers and integrations',
    instruction:
      'Help me design an automation workflow. Identify triggers, actions, conditions, integrations, error handling and implementation steps. Do not claim to have connected services or triggered an automation.',
    icon: Workflow,
  },
  {
    id: 'test',
    label: 'Test',
    description: 'Create test plans and troubleshoot issues',
    instruction:
      'Help me test and troubleshoot this. Propose relevant test cases, expected results, debugging steps and copyable test code or commands. Do not claim to have run tests.',
    icon: ShieldCheck,
  },
  {
    id: 'optimize',
    label: 'Optimize',
    description: 'Improve performance, security and cost',
    instruction:
      'Analyze the described solution and recommend improvements for performance, reliability, security, maintainability and cost. Explain trade-offs. Do not claim to have changed files or settings.',
    icon: Wrench,
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'Analyze information and identify opportunities',
    instruction:
      'Analyze the information I provide. Identify patterns, risks, opportunities and actionable recommendations. Clearly distinguish known facts from assumptions.',
    icon: Lightbulb,
  },
];

const SUGGESTIONS: { mode: Mode; title: string; prompt: string }[] = [
  {
    mode: 'build',
    title: 'Plan a new feature',
    prompt: 'Help me plan a new feature for my application. Start with the architecture and implementation steps.',
  },
  {
    mode: 'automate',
    title: 'Design a workflow',
    prompt: 'Help me design an automation workflow that reduces repetitive work.',
  },
  {
    mode: 'test',
    title: 'Troubleshoot an issue',
    prompt: 'Help me diagnose an application issue. Give me a systematic debugging plan.',
  },
  {
    mode: 'optimize',
    title: 'Review performance',
    prompt: 'Help me identify performance bottlenecks and prioritize improvements.',
  },
];

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function WorkspacePage() {
  const { session, subscription } = useAuth();
  const token = session?.access_token;
  const hasAccess = Boolean(subscription?.hasAccess);

  const [items, setItems] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<Mode>('build');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');
  const [showModes, setShowModes] = useState(false);

  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<any>(
        '/ai-workspace/conversations',
        token,
      );
      setItems(Array.isArray(data?.conversations) ? data.conversations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const open = useCallback(async (id: string) => {
    if (!token || busy) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<any>(
        `/ai-workspace/conversations/${encodeURIComponent(id)}`,
        token,
      );

      setActive(id);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this conversation.');
    } finally {
      setLoading(false);
    }
  }, [token, busy]);

  function fresh() {
    if (busy) return;
    setActive(null);
    setMessages([]);
    setDraft('');
    setError('');
    setMode('build');
    setShowModes(false);
    textarea.current?.focus();
  }

  async function remove(id: string) {
    if (!token || busy) return;
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;

    setError('');

    try {
      await apiRequest(
        `/ai-workspace/conversations/${encodeURIComponent(id)}`,
        token,
        { method: 'DELETE' },
      );

      setItems((current) => current.filter((item) => item.id !== id));

      if (active === id) {
        setActive(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this conversation.');
    }
  }

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const prompt = draft.trim();
    if (!prompt || !token || busy || !hasAccess) return;

    const selectedMode = MODES.find((item) => item.id === mode) ?? MODES[0];
    const composedMessage =
      `[OmniScaleAI workflow: ${selectedMode.label.toUpperCase()}]\n` +
      `${selectedMode.instruction}\n\n` +
      `User request:\n${prompt}`;

    if (composedMessage.length > 6000) {
      setError('This prompt is too long for the current workspace limit. Shorten it and try again.');
      return;
    }

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage: Message = {
      id: localId,
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);
    setDraft('');
    setBusy(true);
    setError('');

    try {
      const data = await apiRequest<any>(
        '/ai-workspace/chat',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            message: composedMessage,
            conversationId: active,
          }),
        },
      );

      setActive(data.conversationId ?? active);

      setMessages((current) => [
        ...current.filter((message) => message.id !== localId),
        ...(data.userMessage ? [data.userMessage as Message] : [optimisticMessage]),
        ...(data.assistantMessage ? [data.assistantMessage as Message] : []),
      ]);

      await refresh();
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== localId));
      setDraft(prompt);
      setError(err instanceof Error ? err.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
      textarea.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const selectedMode = MODES.find((item) => item.id === mode) ?? MODES[0];
  const filteredItems = items.filter((item) =>
    (item.title || 'Untitled conversation')
      .toLowerCase()
      .includes(historyFilter.toLowerCase()),
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1600px] flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            OmniScale AI workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ask OmniScaleAI
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Your AI command center for planning builds, workflows, testing and product improvements.
          </p>
        </div>

        <button
          type="button"
          onClick={fresh}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} />
          New session
        </button>
      </header>

      <div className="grid min-h-[680px] flex-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#101116] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
              <Command size={16} className="text-blue-400" />
              Sessions
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Refresh sessions"
              className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3">
            <Search size={14} className="shrink-0 text-white/35" />
            <input
              value={historyFilter}
              onChange={(event) => setHistoryFilter(event.target.value)}
              placeholder="Search sessions"
              className="h-10 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
            />
          </label>

          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
            Recent conversations
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-4 text-xs text-white/40">
                <Loader2 size={14} className="animate-spin" />
                Loading sessions
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="px-2 py-4 text-xs leading-5 text-white/35">
                {historyFilter ? 'No matching sessions.' : 'Your conversations will appear here.'}
              </p>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-1 rounded-xl border px-2 py-2 transition ${
                    active === item.id
                      ? 'border-blue-400/20 bg-blue-500/[0.09]'
                      : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void open(item.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-xs font-medium text-white/75">
                      {item.title || 'Untitled conversation'}
                    </span>
                    <span className="mt-1 block text-[10px] text-white/30">
                      {formatDate(item.updated_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    aria-label={`Delete ${item.title || 'conversation'}`}
                    className="rounded-lg p-2 text-white/25 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white/65">
              <ShieldCheck size={14} className="text-blue-400" />
              Private workspace
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-white/35">
              Conversations are associated with your authenticated account.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101116]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                <Bot size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white/90">OmniScaleAI Terminal</div>
                <div className="mt-0.5 text-[10px] text-white/35">
                  Natural-language command interface
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] text-white/45">
              <Activity size={12} className="text-blue-400" />
              AI guidance mode
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
            {MODES.map((item) => {
              const Icon = item.icon;
              const selected = mode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  title={item.description}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    selected
                      ? 'border-blue-400/35 bg-blue-500/15 text-blue-200'
                      : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:border-white/15 hover:text-white/80'
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-[440px] max-w-3xl flex-col justify-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-blue-300 shadow-lg shadow-blue-950/20">
                    <Sparkles size={25} />
                  </div>

                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                    Your next move starts here
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    What do you want to accomplish?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                    Describe the outcome you want in plain language. OmniScaleAI can help you
                    break it down into an actionable plan, technical guidance and next steps.
                  </p>

                  <div className="mt-8 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion.title}
                        type="button"
                        onClick={() => {
                          setMode(suggestion.mode);
                          setDraft(suggestion.prompt);
                          textarea.current?.focus();
                        }}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-left transition hover:border-blue-400/25 hover:bg-blue-500/[0.06]"
                      >
                        <span>
                          <span className="block text-sm font-medium text-white/75 group-hover:text-white">
                            {suggestion.title}
                          </span>
                          <span className="mt-1 block text-xs text-white/35">
                            {MODES.find((item) => item.id === suggestion.mode)?.description}
                          </span>
                        </span>
                        <ArrowUp
                          size={15}
                          className="shrink-0 rotate-45 text-white/25 transition group-hover:text-blue-300"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-3xl space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          message.role === 'assistant'
                            ? 'border border-blue-400/20 bg-blue-500/10 text-blue-300'
                            : 'border border-white/10 bg-white/[0.06] text-white/65'
                        }`}
                      >
                        {message.role === 'assistant' ? <Bot size={16} /> : <Command size={15} />}
                      </div>

                      <div
                        className={`min-w-0 max-w-[88%] rounded-2xl px-4 py-3 ${
                          message.role === 'assistant'
                            ? 'border border-white/[0.07] bg-white/[0.035]'
                            : 'border border-blue-400/15 bg-blue-500/[0.09]'
                        }`}
                      >
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                          {message.role === 'assistant' ? 'OmniScaleAI' : 'You'}
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-white/80">
                          {message.content}
                        </div>
                        {message.created_at && (
                          <div className="mt-2 text-right text-[10px] text-white/25">
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {busy && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                        <Bot size={16} />
                      </div>
                      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-white/45">
                          <Loader2 size={14} className="animate-spin text-blue-300" />
                          Preparing your response
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottom} />
                </div>
              )}
            </div>

            {error && (
              <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2.5 text-xs text-red-200 sm:mx-5">
                <CircleHelp size={15} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                  className="text-red-200/60 hover:text-red-100"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {!hasAccess ? (
              <div className="border-t border-white/[0.07] p-5">
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <ShieldCheck size={16} />
                    Subscription access required
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    An active subscription is required to send prompts to the AI workspace.
                    Your existing conversations remain visible when available.
                  </p>
                  <a
                    href="/subscribe"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-400"
                  >
                    View subscription options
                    <ArrowUp size={13} className="rotate-45" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="border-t border-white/[0.07] bg-black/10 p-4 sm:p-5">
                <form onSubmit={(event) => void send(event)} className="mx-auto max-w-3xl">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowModes((value) => !value)}
                      className="inline-flex items-center gap-2 text-xs text-white/50 transition hover:text-white/80"
                    >
                      <Settings2 size={13} className="text-blue-300" />
                      Mode: <span className="font-semibold text-blue-200">{selectedMode.label}</span>
                      <ChevronDown size={13} className={showModes ? 'rotate-180' : ''} />
                    </button>
                    <span className="text-[10px] text-white/30">
                      {draft.length}/5600 characters
                    </span>
                  </div>

                  {showModes && (
                    <div className="mb-3 grid gap-2 rounded-xl border border-white/[0.08] bg-[#15161d] p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {MODES.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setMode(item.id);
                              setShowModes(false);
                            }}
                            className={`rounded-lg border p-3 text-left transition ${
                              mode === item.id
                                ? 'border-blue-400/30 bg-blue-500/10'
                                : 'border-white/[0.06] hover:bg-white/[0.04]'
                            }`}
                          >
                            <span className="flex items-center gap-2 text-xs font-semibold text-white/80">
                              <Icon size={14} className="text-blue-300" />
                              {item.label}
                            </span>
                            <span className="mt-1 block text-[10px] leading-4 text-white/35">
                              {item.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/[0.12] bg-[#090a0f] p-3 shadow-inner shadow-black/30 transition focus-within:border-blue-400/35 focus-within:ring-2 focus-within:ring-blue-500/10">
                    <textarea
                      ref={textarea}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleKeyDown}
                      maxLength={5600}
                      rows={3}
                      placeholder={`Ask OmniScaleAI to ${selectedMode.label.toLowerCase()}...`}
                      disabled={busy}
                      className="max-h-48 min-h-[76px] w-full resize-y bg-transparent px-1 py-1 text-sm leading-6 text-white outline-none placeholder:text-white/25 disabled:opacity-50"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                      <div className="flex items-center gap-2 text-[10px] text-white/30">
                        <span className="rounded-md border border-white/10 px-1.5 py-1 font-mono">
                          Enter
                        </span>
                        to send
                        <span className="hidden sm:inline">·</span>
                        <span className="hidden sm:inline">Shift + Enter for a new line</span>
                      </div>
                      <button
                        type="submit"
                        disabled={!draft.trim() || busy || draft.length > 5600}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {busy ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Thinking
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            Send prompt
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-white/30">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-blue-400/70" />
                    <span>
                      AI guidance only. This chat does not execute terminal commands, modify your
                      project files, deploy applications or trigger external integrations.
                      Review and run any suggested commands yourself.
                    </span>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
