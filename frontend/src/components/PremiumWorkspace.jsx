import React, { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_URL}/ai-workspace${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function PremiumWorkspace({ accessToken, isAuthenticated }) {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [task, setTask] = useState({ status: 'idle', label: 'Ready for your request' });
  const bottomRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    if (!accessToken || !isAuthenticated) return;
    setLoadingHistory(true);
    try {
      const data = await apiRequest('/conversations', accessToken);
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setConversations([]);
    setError('');
    setTask({ status: 'idle', label: 'Ready for your request' });
    if (isAuthenticated && accessToken) refreshConversations();
  }, [accessToken, isAuthenticated, refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setDraft('');
    setError('');
    setTask({ status: 'idle', label: 'Ready for your request' });
  };

  const openConversation = async (id) => {
    if (!id || sending) return;
    setError('');
    setLoadingHistory(true);
    try {
      const data = await apiRequest(`/conversations/${encodeURIComponent(id)}`, accessToken);
      setConversationId(data.conversation.id);
      setMessages(data.messages || []);
      setTask({ status: 'idle', label: 'Conversation loaded' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteConversation = async (id) => {
    if (!window.confirm('Delete this conversation and its saved messages? This cannot be undone.')) return;
    setError('');
    try {
      await apiRequest(`/conversations/${encodeURIComponent(id)}`, accessToken, { method: 'DELETE' });
      setConversations(items => items.filter(item => item.id !== id));
      if (conversationId === id) startNewChat();
    } catch (err) {
      setError(err.message);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    if (message.length > 6000) {
      setError('Keep each message to 6,000 characters or fewer.');
      return;
    }

    setError('');
    setSending(true);
    setTask({ status: 'running', label: 'Generating a response…' });
    const optimisticUserMessage = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    };
    setMessages(items => [...items, optimisticUserMessage]);
    setDraft('');

    try {
      const data = await apiRequest('/chat', accessToken, {
        method: 'POST',
        body: JSON.stringify({ message, conversationId })
      });
      setConversationId(data.conversationId);
      setMessages(items => [
        ...items.filter(item => item.id !== optimisticUserMessage.id),
        data.userMessage,
        data.assistantMessage
      ]);
      setTask(data.task || { status: 'completed', label: 'Response generated' });
      await refreshConversations();
    } catch (err) {
      const savedMessage = err.data?.userMessage;
      if (savedMessage?.id) {
        setConversationId(err.data.conversationId || conversationId);
        setMessages(items => [
          ...items.filter(item => item.id !== optimisticUserMessage.id),
          savedMessage
        ]);
        await refreshConversations();
      } else {
        setMessages(items => items.filter(item => item.id !== optimisticUserMessage.id));
      }
      setDraft(message);
      setTask({ status: 'failed', label: 'Request did not complete' });
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated || !accessToken) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100">
        <h2 className="text-xl font-bold">Sign in required</h2>
        <p className="mt-2 text-slate-400">Sign in to use the OmniScale AI Workspace.</p>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-5 text-slate-100 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <button type="button" onClick={startNewChat}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-left font-semibold hover:bg-indigo-500">
          + New conversation
        </button>
        <div className="mt-5 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">Saved conversations</h3>
          <button type="button" onClick={refreshConversations}
            className="text-xs text-sky-300 hover:text-sky-200" disabled={loadingHistory}>
            Refresh
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {conversations.map(item => (
            <div key={item.id} className={`rounded-xl border p-2 ${conversationId === item.id ? 'border-indigo-500 bg-slate-800' : 'border-slate-800'}`}>
              <button type="button" onClick={() => openConversation(item.id)}
                className="w-full break-words text-left text-sm text-slate-200 hover:text-white">
                {item.title || 'Conversation'}
                <span className="mt-1 block text-xs text-slate-500">
                  {item.updated_at ? new Date(item.updated_at).toLocaleString() : ''}
                </span>
              </button>
              <button type="button" onClick={() => deleteConversation(item.id)}
                className="mt-2 text-xs text-rose-300 hover:text-rose-200">
                Delete
              </button>
            </div>
          ))}
          {!loadingHistory && conversations.length === 0 && (
            <p className="text-sm text-slate-500">Your saved conversations will appear here.</p>
          )}
        </div>
      </aside>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
          <div>
            <h2 className="text-xl font-bold">OmniScale AI Workspace</h2>
            <p className="mt-1 text-sm text-slate-400">Chat, plan work, and track the current request.</p>
          </div>
          <div className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300" aria-live="polite">
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${task.status === 'running' ? 'animate-pulse bg-amber-400' : task.status === 'failed' ? 'bg-rose-400' : task.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {task.label}
          </div>
        </header>

        <div className="min-h-[360px] max-h-[58vh] space-y-4 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl py-10 text-center">
              <p className="text-lg font-semibold">What would you like to work on?</p>
              <p className="mt-2 text-sm text-slate-400">Ask for a plan, code review, SEO strategy, business analysis, or help with an approved integration.</p>
              <p className="mt-3 text-xs text-slate-500">External actions and connected-app changes are not performed by this chat endpoint.</p>
            </div>
          )}
          {messages.map(item => (
            <article key={item.id} className={`max-w-4xl rounded-2xl p-4 ${item.role === 'user' ? 'ml-auto bg-indigo-600/20 ring-1 ring-indigo-500/40' : 'mr-auto bg-slate-950 ring-1 ring-slate-800'}`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {item.role === 'user' ? 'You' : 'OmniScale AI'}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{item.content}</p>
            </article>
          ))}
          {sending && (
            <div className="mr-auto rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-amber-200" role="status">
              Working on your request…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div role="alert" className="mx-5 rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={sendMessage} className="border-t border-slate-800 p-4">
          <label htmlFor="omniscale-workspace-prompt" className="mb-2 block text-sm font-medium text-slate-300">Message OmniScale AI</label>
          <textarea id="omniscale-workspace-prompt" value={draft} onChange={event => setDraft(event.target.value)}
            maxLength={6000} rows={4} disabled={sending}
            placeholder="Describe the outcome you need…"
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{draft.length}/6000 characters · responses may need verification</span>
            <button type="submit" disabled={sending || !draft.trim()}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? 'Working…' : 'Send message'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
