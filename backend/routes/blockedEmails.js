'use strict';

const { supabaseAdmin } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { createBlockedEmailsRouter } = require('./blockedEmailsFactory');

const ADMIN_EMAILS = new Set(
  String(process.env.OMNISCALE_BLOCKLIST_ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
);

module.exports = createBlockedEmailsRouter({
  supabaseAdmin,
  requireAuth,
  adminEmails: ADMIN_EMAILS
});
