'use strict';

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');
const { generateText, model } = require('../services/openaiService');
const { requireAuth } = require('../middleware/auth');
const { getUserProfile } = require('../database');
const { getSubscriptionEntitlement } = require('../subscriptionEntitlement');
const { MAX_MESSAGE_CHARS, validConversationId, safeConversationTitle, validateUserMessage } = require('../aiWorkspacePolicy');

const MAX_CONTEXT_MESSAGES = 12;

async function requirePaidAccess(req, res, next) {
  try {
    const profile = await getUserProfile(req.user.id);
    if (!getSubscriptionEntitlement(profile).hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'An active subscription is required to use the AI Workspace.'
      });
    }
    return next();
  } catch (error) {
    console.error('AI Workspace entitlement check failed:', error.message);
    return res.status(503).json({
      success: false,
      error: 'Subscription status could not be verified. Please retry.'
    });
  }
}

router.use(requireAuth);
router.use(requirePaidAccess);

// List only the signed-in user's conversations.
router.get('/conversations', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_conversations')
      .select('id,title,created_at,updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ success: true, conversations: data || [] });
  } catch (error) {
    console.error('AI Workspace conversation list failed:', error.message);
    return res.status(503).json({ success: false, error: 'Conversation history is unavailable.' });
  }
});

// Load a conversation only when it belongs to the current user.
router.get('/conversations/:id', async (req, res) => {
  if (!validConversationId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid conversation ID.' });
  }

  try {
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('ai_conversations')
      .select('id,title,created_at,updated_at')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found.' });

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('ai_messages')
      .select('id,role,content,created_at')
      .eq('conversation_id', conversation.id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true })
      .limit(200);

    if (messagesError) throw messagesError;
    return res.json({ success: true, conversation, messages: messages || [] });
  } catch (error) {
    console.error('AI Workspace conversation load failed:', error.message);
    return res.status(503).json({ success: false, error: 'Conversation could not be loaded.' });
  }
});

// Delete only the signed-in user's conversation. Child messages cascade in SQL.
router.delete('/conversations/:id', async (req, res) => {
  if (!validConversationId(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid conversation ID.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_conversations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Conversation not found.' });
    return res.json({ success: true });
  } catch (error) {
    console.error('AI Workspace conversation deletion failed:', error.message);
    return res.status(503).json({ success: false, error: 'Conversation could not be deleted.' });
  }
});

// Synchronous chat request. The UI can accurately show "working" while this request runs;
// no background/agent execution is claimed after the request finishes.
router.post('/chat', async (req, res) => {
  const message = req.body?.message;
  const requestedConversationId = req.body?.conversationId;

  const validation = validateUserMessage(message);
  if (!validation.valid) {
    const status = typeof message === 'string' && message.trim().length > MAX_MESSAGE_CHARS ? 413 : 400;
    return res.status(status).json({ success: false, error: validation.error });
  }
  if (requestedConversationId != null && !validConversationId(requestedConversationId)) {
    return res.status(400).json({ success: false, error: 'Invalid conversation ID.' });
  }

  const userId = req.user.id;
  const trimmedMessage = validation.value;
  let conversationId = requestedConversationId || null;
  let createdConversation = false;

  try {
    if (conversationId) {
      const { data, error } = await supabaseAdmin
        .from('ai_conversations')
        .select('id,title')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Conversation not found.' });
    } else {
      const { data, error } = await supabaseAdmin
        .from('ai_conversations')
        .insert({ user_id: userId, title: safeConversationTitle(trimmedMessage) })
        .select('id,title,created_at,updated_at')
        .single();
      if (error) throw error;
      conversationId = data.id;
      createdConversation = true;
    }

    const { data: priorMessages, error: historyError } = await supabaseAdmin
      .from('ai_messages')
      .select('role,content')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);
    if (historyError) throw historyError;

    // Store the user turn before calling the model, so the prompt is not lost if generation fails.
    const { data: savedUserMessage, error: saveUserError } = await supabaseAdmin
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: trimmedMessage
      })
      .select('id,role,content,created_at')
      .single();
    if (saveUserError) throw saveUserError;

    const history = (priorMessages || []).reverse()
      .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .map(item => ({ role: item.role, content: item.content }));

    const instructions = [
      'You are OmniScale AI, an assistant inside a paid AI workspace.',
      'Be practical, clear, and transparent about uncertainty.',
      'Do not claim to have browsed the web, changed files, connected services, sent messages, made purchases, deployed code, or completed external actions unless a connected tool actually performed that action.',
      'You do not have arbitrary shell access or external tools in this chat endpoint. For tasks requiring external action, provide a plan and identify the permission or integration needed.',
      'For consequential actions such as purchases, publishing, account changes, or sending communications, explain the intended action and require explicit user confirmation before any future connected tool performs it.',
      'Do not fabricate facts, credentials, source citations, or task progress.'
    ].join('\n');

    const input = [
      ...history.map(item => `${item.role === 'assistant' ? 'Assistant' : 'User'}:\n${item.content}`),
      `User:\n${trimmedMessage}`,
      'Assistant:'
    ].join('\n\n');

    let result;
    try {
      result = await generateText({ instructions, input });
    } catch (modelError) {
      console.error('AI Workspace model request failed:', {
        name: modelError?.name,
        status: modelError?.status,
        code: modelError?.code
      });
      return res.status(502).json({
        success: false,
        conversationId,
        userMessage: savedUserMessage,
        error: 'The AI could not answer this message. Your message is saved; you can retry.'
      });
    }

    if (typeof result !== 'string' || !result.trim()) {
      return res.status(502).json({
        success: false,
        conversationId,
        userMessage: savedUserMessage,
        error: 'The AI returned an empty response. Your message is saved; you can retry.'
      });
    }

    const responseText = result.trim();
    if (responseText.length > 30000) {
      return res.status(502).json({
        success: false,
        conversationId,
        userMessage: savedUserMessage,
        error: 'The AI response exceeded the storage limit. Your message is saved; please retry with a shorter request.'
      });
    }

    const { data: assistantMessage, error: saveAssistantError } = await supabaseAdmin
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: responseText
      })
      .select('id,role,content,created_at')
      .single();
    if (saveAssistantError) throw saveAssistantError;

    const { error: updateConversationError } = await supabaseAdmin
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId);
    if (updateConversationError) throw updateConversationError;

    return res.json({
      success: true,
      conversationId,
      createdConversation,
      model,
      userMessage: savedUserMessage,
      assistantMessage,
      task: {
        status: 'completed',
        label: 'Response generated',
        completedAt: assistantMessage.created_at
      }
    });
  } catch (error) {
    console.error('AI Workspace chat failed:', error.message);
    return res.status(503).json({
      success: false,
      conversationId,
      error: 'The AI Workspace could not save or complete this request. Please retry.'
    });
  }
});

module.exports = router;
