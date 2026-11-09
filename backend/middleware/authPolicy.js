'use strict';

function createRequireAuth(supabaseAdmin) {
  if (!supabaseAdmin?.auth || typeof supabaseAdmin.from !== 'function') {
    throw new Error('A valid Supabase admin client is required.');
  }

  return async function requireAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing token.'
        });
      }

      const token = authHeader.slice(7).trim();

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing token.'
        });
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      const user = data?.user;

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired session token.'
        });
      }

      const email = String(user.email || '').trim().toLowerCase();

      if (!email) {
        return res.status(403).json({
          success: false,
          error: 'This account cannot access the platform.'
        });
      }

      const { data: blockedEntry, error: blockCheckError } =
        await supabaseAdmin
          .from('blocked_emails')
          .select('id')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle();

      if (blockCheckError) {
        console.error(
          'Blocked-email security check failed:',
          blockCheckError.message
        );

        return res.status(503).json({
          success: false,
          error: 'Account security verification is temporarily unavailable.'
        });
      }

      if (blockedEntry) {
        return res.status(403).json({
          success: false,
          code: 'EMAIL_BLOCKED',
          error: 'This email address is not permitted to access OmniScale AI.'
        });
      }

      req.user = user;
      return next();
    } catch (err) {
      console.error('Auth middleware error:', err);

      return res.status(500).json({
        success: false,
        error: 'Internal security authentication failure.'
      });
    }
  };
}

module.exports = { createRequireAuth };
