'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  MAX_MESSAGE_CHARS,
  validConversationId,
  safeConversationTitle,
  validateUserMessage
} = require('../aiWorkspacePolicy');

test('accepts UUID-shaped conversation identifiers and rejects malformed values', () => {
  assert.equal(validConversationId('2a2d0f20-ef9b-4e67-8b13-37c2b12c4d2a'), true);
  assert.equal(validConversationId('../other-user'), false);
  assert.equal(validConversationId(null), false);
  assert.equal(validConversationId(''), false);
});

test('conversation title is compacted and capped', () => {
  assert.equal(safeConversationTitle('  Help   me with SEO  '), 'Help me with SEO');
  assert.equal(safeConversationTitle('x'.repeat(100)).length, 72);
  assert.equal(safeConversationTitle('x'.repeat(100)).endsWith('...'), true);
});

test('message validation rejects empty and oversized content, and trims accepted content', () => {
  assert.deepEqual(validateUserMessage('   '), { valid: false, error: 'Enter a message first.' });
  assert.equal(validateUserMessage('  Help me  ').value, 'Help me');
  assert.equal(validateUserMessage('x'.repeat(MAX_MESSAGE_CHARS)).valid, true);
  assert.equal(validateUserMessage('x'.repeat(MAX_MESSAGE_CHARS + 1)).valid, false);
});
