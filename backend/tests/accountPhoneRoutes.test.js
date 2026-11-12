'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const express = require('express');

const databasePath = require.resolve('../database');
const authPath = require.resolve('../middleware/auth');
const accountPath = require.resolve('../routes/account');

const state = {
  calls: [],
  upsertResult: {
    data: { phone: '+254712345678', phone_verified_at: null },
    error: null
  },
  phoneLookupResult: {
    data: { phone: '+254712345678', phone_verified_at: null },
    error: null
  },
  profile: {
    user_id: 'test-user-123',
    status: 'inactive',
    plan_type: 'free'
  }
};

const fakeSupabaseAdmin = {
  from(table) {
    state.calls.push(['from', table]);

    const query = {
      upsert(record, options) {
        state.calls.push(['upsert', record, options]);
        return query;
      },

      select(columns) {
        state.calls.push(['select', columns]);
        return query;
      },

      eq(column, value) {
        state.calls.push(['eq', column, value]);
        return query;
      },

      async single() {
        state.calls.push(['single']);
        return state.upsertResult;
      },

      async maybeSingle() {
        state.calls.push(['maybeSingle']);
        return state.phoneLookupResult;
      }
    };

    return query;
  }
};

const fakeDatabase = {
  supabaseAdmin: fakeSupabaseAdmin,

  async getUserProfile(userId) {
    state.calls.push(['getUserProfile', userId]);
    return state.profile;
  },

  async updateUserSubscription() {
    throw new Error('Unexpected subscription update in phone route test.');
  }
};

const fakeAuth = {
  requireAuth(req, res, next) {
    req.user = {
      id: 'test-user-123',
      email: 'test@example.com',
      user_metadata: state.userMetadata
    };
    next();
  }
};

// Substitute dependencies only while loading the actual account router.
const originalDatabase = require.cache[databasePath];
const originalAuth = require.cache[authPath];

require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakeDatabase
};

require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: fakeAuth
};

delete require.cache[accountPath];

let accountRouter;

try {
  accountRouter = require('../routes/account');
} finally {
  if (originalDatabase) {
    require.cache[databasePath] = originalDatabase;
  } else {
    delete require.cache[databasePath];
  }

  if (originalAuth) {
    require.cache[authPath] = originalAuth;
  } else {
    delete require.cache[authPath];
  }
}

async function sendRequest(method, path) {
  const app = express();
  app.use(express.json());
  app.use('/api/account', accountRouter);

  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}${path}`,
      {
        method,
        headers: { Connection: 'close' }
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

beforeEach(() => {
  state.userMetadata = { phone: '+254712345678' };
  state.calls = [];

  state.upsertResult = {
    data: { phone: '+254712345678', phone_verified_at: null },
    error: null
  };

  state.phoneLookupResult = {
    data: { phone: '+254712345678', phone_verified_at: null },
    error: null
  };

  state.profile = {
    user_id: 'test-user-123',
    status: 'inactive',
    plan_type: 'free'
  };
});

test('sync-phone upserts the authenticated user phone into user_phone_numbers', async () => {
  const result = await sendRequest(
    'POST',
    '/api/account/sync-phone'
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.phone, '+254712345678');
  assert.equal(result.body.phoneVerifiedAt, null);

  const upsert = state.calls.find(call => call[0] === 'upsert');

  assert.ok(upsert, 'Expected a phone table upsert');
  assert.equal(upsert[1].user_id, 'test-user-123');
  assert.equal(upsert[1].phone, '+254712345678');
  assert.equal(upsert[2].onConflict, 'user_id');

  assert.ok(
    state.calls.some(call =>
      call[0] === 'from' && call[1] === 'user_phone_numbers'
    )
  );

  assert.equal(
    state.calls.some(call =>
      call[0] === 'from' && call[1] === 'user_profiles'
    ),
    false
  );
});

test('sync-phone rejects invalid metadata without writing to the database', async () => {
  state.userMetadata = { phone: 'not-a-phone-number' };

  const result = await sendRequest(
    'POST',
    '/api/account/sync-phone'
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);

  assert.equal(
    state.calls.some(call => call[0] === 'upsert'),
    false
  );


});

test('sync-phone reports a database upsert failure', async () => {
  state.upsertResult = {
    data: null,
    error: { message: 'Database write failed' }
  };

  const result = await sendRequest(
    'POST',
    '/api/account/sync-phone'
  );

  assert.equal(result.status, 500);
  assert.equal(result.body.success, false);
});

test('account /me returns the phone belonging to the authenticated user', async () => {
  const result = await sendRequest(
    'GET',
    '/api/account/me'
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.account.phone, '+254712345678');
  assert.equal(result.body.account.phoneVerifiedAt, null);

  assert.ok(
    state.calls.some(call =>
      call[0] === 'eq' &&
      call[1] === 'user_id' &&
      call[2] === 'test-user-123'
    )
  );

  assert.ok(
    state.calls.some(call =>
      call[0] === 'select' &&
      call[1] === 'phone, phone_verified_at'
    )
  );
});

test('account /me reports a phone table lookup failure', async () => {
  state.phoneLookupResult = {
    data: null,
    error: { message: 'Phone lookup failed' }
  };

  const result = await sendRequest(
    'GET',
    '/api/account/me'
  );

  assert.equal(result.status, 500);
  assert.equal(result.body.success, false);
});
