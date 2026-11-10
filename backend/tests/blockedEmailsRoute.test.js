'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { createBlockedEmailsRouter } =
  require('../routes/blockedEmailsFactory');

async function sendRequest(router, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);

  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/admin/blocked-emails`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Connection: 'close'
        },
        body: JSON.stringify(body)
      }
    );

    return {
      status: response.status,
      body: await response.json()
    };
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

function createAdminSupabase({
  users = [],
  upsertError = null,
  listError = null,
  banError = null
} = {}) {
  const calls = [];

  return {
    calls,

    from(table) {
      calls.push(['from', table]);

      return {
        async upsert(record, options) {
          calls.push(['upsert', record, options]);
          return { error: upsertError };
        }
      };
    },

    auth: {
      admin: {
        async listUsers(options) {
          calls.push(['listUsers', options]);

          return {
            data: { users },
            error: listError
          };
        },

        async updateUserById(id, attributes) {
          calls.push(['updateUserById', id, attributes]);
          return { error: banError };
        }
      }
    }
  };
}

function createRouter(supabaseAdmin, requesterEmail) {
  const requireAuth = (req, res, next) => {
    req.user = { email: requesterEmail };
    next();
  };

  return createBlockedEmailsRouter({
    supabaseAdmin,
    requireAuth,
    adminEmails: new Set(['admin@example.com'])
  });
}

test('rejects non-administrators without writing to the database', async () => {
  const supabase = createAdminSupabase();
  const router = createRouter(supabase, 'ordinary@example.com');

  const result = await sendRequest(router, {
    email: 'blocked@example.com'
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.success, false);
  assert.equal(
    supabase.calls.some(call => call[0] === 'upsert'),
    false
  );
});

test('rejects malformed email addresses', async () => {
  const supabase = createAdminSupabase();
  const router = createRouter(supabase, 'admin@example.com');

  const result = await sendRequest(router, {
    email: 'not-an-email'
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.equal(
    supabase.calls.some(call => call[0] === 'upsert'),
    false
  );
});

test('normalizes email and bans matching existing accounts', async () => {
  const supabase = createAdminSupabase({
    users: [
      { id: 'existing-user-1', email: 'blocked@example.com' },
      { id: 'other-user', email: 'other@example.com' }
    ]
  });

  const router = createRouter(supabase, 'ADMIN@EXAMPLE.COM');

  const result = await sendRequest(router, {
    email: '  BLOCKED@EXAMPLE.COM  ',
    reason: 'Abuse'
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.blocked, true);
  assert.equal(result.body.email, 'blocked@example.com');
  assert.equal(result.body.matchedAccounts, 1);
  assert.equal(result.body.bannedAccounts, 1);

  const upsert = supabase.calls.find(call => call[0] === 'upsert');

  assert.equal(upsert[1].email, 'blocked@example.com');
  assert.equal(upsert[1].reason, 'Abuse');
  assert.equal(upsert[1].is_active, true);

  const ban = supabase.calls.find(
    call => call[0] === 'updateUserById'
  );

  assert.equal(ban[1], 'existing-user-1');
  assert.equal(ban[2].ban_duration, '876000h');
});

test('reports a database write failure', async () => {
  const supabase = createAdminSupabase({
    upsertError: { message: 'Write failed' }
  });

  const router = createRouter(supabase, 'admin@example.com');

  const result = await sendRequest(router, {
    email: 'blocked@example.com'
  });

  assert.equal(result.status, 500);
  assert.equal(result.body.success, false);
});

test('reports an existing-account lookup failure after saving the block', async () => {
  const supabase = createAdminSupabase({
    listError: { message: 'Auth lookup failed' }
  });

  const router = createRouter(supabase, 'admin@example.com');

  const result = await sendRequest(router, {
    email: 'blocked@example.com'
  });

  assert.equal(result.status, 500);
  assert.equal(result.body.success, false);
  assert.equal(result.body.blocked, true);
});

test('reports partial account-ban failures', async () => {
  const supabase = createAdminSupabase({
    users: [
      { id: 'existing-user-1', email: 'blocked@example.com' }
    ],
    banError: { message: 'Ban failed' }
  });

  const router = createRouter(supabase, 'admin@example.com');

  const result = await sendRequest(router, {
    email: 'blocked@example.com'
  });

  assert.equal(result.status, 207);
  assert.equal(result.body.success, false);
  assert.equal(result.body.matchedAccounts, 1);
  assert.equal(result.body.bannedAccounts, 0);
  assert.equal(result.body.failedAccountBans, 1);
});

test('admin status endpoint denies non-administrators without database access', async () => {
  const supabase = createAdminSupabase();
  const router = createRouter(supabase, 'ordinary@example.com');
  const app = express();
  app.use('/api/admin', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/status`, {
      headers: { Connection: 'close' }
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(supabase.calls.length, 0);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('admin status endpoint exposes only supported capabilities to allowlisted administrators', async () => {
  const supabase = createAdminSupabase();
  const router = createRouter(supabase, 'admin@example.com');
  const app = express();
  app.use('/api/admin', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/status`, {
      headers: { Connection: 'close' }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.admin, true);
    assert.deepEqual(body.capabilities, ['blocked-emails']);
    assert.equal(supabase.calls.length, 0);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
