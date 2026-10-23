'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getSubscriptionEntitlement } = require('../subscriptionEntitlement');

const now = new Date('2026-10-23T09:00:00.000Z');

function entitlement(status, entitlement_ends_at) {
  return getSubscriptionEntitlement(
    { status, entitlement_ends_at },
    now
  );
}

assert.equal(entitlement('active', '2026-11-23T09:00:00.000Z').hasAccess, true);
assert.equal(entitlement('active', null).hasAccess, true);
assert.equal(entitlement('active', null).requiresReview, true);

assert.equal(entitlement('cancelled', '2026-11-23T09:00:00.000Z').hasAccess, true);
assert.equal(entitlement('cancelled', '2026-10-23T08:59:59.000Z').hasAccess, false);
assert.equal(entitlement('cancelled', null).hasAccess, false);
assert.equal(entitlement('cancelled', null).requiresReview, true);

assert.equal(entitlement('active', '2026-10-23T08:59:59.000Z').hasAccess, false);
assert.equal(entitlement('expired', '2026-11-23T09:00:00.000Z').hasAccess, false);
assert.equal(entitlement('inactive', null).hasAccess, false);
assert.equal(entitlement('unknown', null).hasAccess, false);

assert.equal(
  entitlement('cancelled', 'not-a-date').requiresReview,
  true
);

console.log('PASS: subscription entitlement tests');


test('cancelled pending review preserves access when paid-through date is unknown', () => {
  const result = getSubscriptionEntitlement({
    status: 'cancelled_pending_review',
    entitlement_ends_at: null
  });
  assert.equal(result.hasAccess, true);
  assert.equal(result.requiresReview, true);
});
