'use strict';

const MAX_MESSAGE_CHARS = 6000;

function validConversationId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeConversationTitle(message) {
  const title = String(message || '').trim().replace(/\s+/g, ' ');
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function validateUserMessage(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, error: 'Enter a message first.' };
  }
  if (value.trim().length > MAX_MESSAGE_CHARS) {
    return { valid: false, error: `Messages must be ${MAX_MESSAGE_CHARS} characters or fewer.` };
  }
  return { valid: true, value: value.trim() };
}

module.exports = {
  MAX_MESSAGE_CHARS,
  validConversationId,
  safeConversationTitle,
  validateUserMessage
};
