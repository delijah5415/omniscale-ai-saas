'use strict';

const express = require('express');

function createBlockedEmailsRouter({
  supabaseAdmin,
  requireAuth,
  adminEmails
}) {
  if (!supabaseAdmin?.auth?.admin || typeof supabaseAdmin.from !== 'function') {
    throw new Error('A valid Supabase admin client is required.');
  }

  if (typeof requireAuth !== 'function') {
    throw new Error('An authentication middleware is required.');
  }

  const allowedEmails = adminEmails instanceof Set
    ? adminEmails
    : new Set(
        (adminEmails || [])
          .map(email => String(email).trim().toLowerCase())
          .filter(Boolean)
      );

  const router = express.Router();

  // Expose a minimal server-verified admin capability check for the UI.
  // Never trust a client-side role flag or email allowlist.
  router.get('/status', requireAuth, (req, res) => {
    const requesterEmail = String(req.user?.email || '')
      .trim()
      .toLowerCase();

    if (!requesterEmail || !allowedEmails.has(requesterEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Administrative permission required.'
      });
    }

    return res.json({
      success: true,
      admin: true,
      capabilities: ['blocked-emails']
    });
  });

  router.post('/blocked-emails', requireAuth, async (req, res) => {
    try {
      const requesterEmail = String(req.user?.email || '')
        .trim()
        .toLowerCase();

      if (!requesterEmail || !allowedEmails.has(requesterEmail)) {
        return res.status(403).json({
          success: false,
          error: 'Administrative permission required.'
        });
      }

      const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();

      const reason = String(req.body?.reason || '')
        .trim()
        .slice(0, 500);

      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({
          success: false,
          error: 'A valid email address is required.'
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from('blocked_emails')
        .upsert(
          {
            email,
            reason: reason || null,
            is_active: true
          },
          { onConflict: 'email' }
        );

      if (insertError) {
        console.error(
          'Blocked-email database operation failed:',
          insertError.message
        );

        return res.status(500).json({
          success: false,
          error: 'Unable to save the email block.'
        });
      }

      let page = 1;
      const perPage = 1000;
      let matchedUsers = 0;
      const banFailures = [];

      while (true) {
        const { data, error: listError } =
          await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage
          });

        if (listError) {
          console.error(
            'Supabase user lookup failed:',
            listError.message
          );

          return res.status(500).json({
            success: false,
            blocked: true,
            error: 'Email is blocked, but existing accounts could not all be checked.'
          });
        }

        const users = data?.users || [];

        for (const user of users) {
          const existingEmail = String(user.email || '')
            .trim()
            .toLowerCase();

          if (existingEmail !== email) continue;

          matchedUsers++;

          const { error: banError } =
            await supabaseAdmin.auth.admin.updateUserById(
              user.id,
              { ban_duration: '876000h' }
            );

          if (banError) {
            console.error(
              'Existing account ban failed:',
              user.id,
              banError.message
            );

            banFailures.push(user.id);
          }
        }

        if (users.length < perPage) break;
        page++;
      }

      return res.status(banFailures.length ? 207 : 200).json({
        success: banFailures.length === 0,
        blocked: true,
        email,
        matchedAccounts: matchedUsers,
        bannedAccounts: matchedUsers - banFailures.length,
        failedAccountBans: banFailures.length,
        message: banFailures.length
          ? 'The email is blocked by the API, but some existing accounts still need an Auth ban.'
          : 'Email successfully blocked.'
      });
    } catch (error) {
      console.error('Blocked-email operation failed:', error);

      return res.status(500).json({
        success: false,
        error: 'Unable to complete the email blocking operation.'
      });
    }
  });

  return router;
}

module.exports = { createBlockedEmailsRouter };
