'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRequireAuth } = require('../middleware/authPolicy');

function createResponse() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createSupabase({
  user = { id: 'user-1', email: 'person@example.com' },
  authError = null,
  blockedEntry = null,
  blockError = null
} = {}) {
  const calls = [];

  return {
    calls,

    auth: {
      async getUser(token) {
        calls.push(['getUser', token]);

        return {
          data: { user },
          error: authError
        };
      }
    },

    from(table) {
      calls.push(['from', table]);

      const query = {
        select(column) {
          calls.push(['select', column]);
          return query;
        },

        eq(column, value) {
          calls.push(['eq', column, value]);
          return query;
        },

        async maybeSingle() {
          return {
            data: blockedEntry,
            error: blockError
          };
        }
      };

      return query;
    }
  };
}

async function invoke(supabaseAdmin, authorization) {
  if (arguments.length < 2) {
    authorization = 'Bearer test-token';
  }

  const middleware = createRequireAuth(supabaseAdmin);
  const req = {
    headers: { authorization }
  };
  const res = createResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
}

test('allows a valid authenticated user whose email is not blocked', async () => {
  const supabase = createSupabase();
  const result = await invoke(supabase);

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.email, 'person@example.com');
  assert.equal(result.res.statusCode, 200);
});

test('rejects a blocked email with EMAIL_BLOCKED', async () => {
  const supabase = createSupabase({
    blockedEntry: { id: 'block-1' }
  });

  const result = await invoke(supabase);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body.code, 'EMAIL_BLOCKED');
});

test('fails closed with 503 when the blocklist query fails', async () => {
  const supabase = createSupabase({
    blockError: { message: 'Database unavailable' }
  });

  const result = await invoke(supabase);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 503);
});

test('rejects missing authorization headers', async () => {
  const supabase = createSupabase();
  const result = await invoke(supabase, undefined);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
  assert.equal(supabase.calls.length, 0);
});

test('rejects an empty bearer token', async () => {
  const supabase = createSupabase();
  const result = await invoke(supabase, 'Bearer   ');

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
  assert.equal(supabase.calls.length, 0);
});

test('rejects invalid or expired tokens', async () => {
  const supabase = createSupabase({
    user: null,
    authError: { message: 'Invalid token' }
  });

  const result = await invoke(supabase);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});

test('rejects accounts without an email address', async () => {
  const supabase = createSupabase({
    user: { id: 'user-2', email: null }
  });

  const result = await invoke(supabase);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});
