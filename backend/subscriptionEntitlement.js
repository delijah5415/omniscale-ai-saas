'use strict';

function getSubscriptionEntitlement(profile, now = new Date()) {
  const status = String(profile?.status || 'inactive').toLowerCase();
  const rawEnd = profile?.entitlement_ends_at || null;
  const parsedEnd = rawEnd ? Date.parse(rawEnd) : NaN;
  const hasValidEnd = Number.isFinite(parsedEnd);
  const entitlementEndsAt = hasValidEnd
    ? new Date(parsedEnd).toISOString()
    : null;

  // A known expiry date always takes precedence over a stale "active" status.
  if (hasValidEnd && parsedEnd <= now.getTime()) {
    return {
      hasAccess: false,
      status: 'expired',
      entitlementEndsAt,
      requiresReview: false
    };
  }

  if (status === 'active') {
    return {
      hasAccess: true,
      status,
      entitlementEndsAt,
      // Active subscriptions without a verified end date need reconciliation.
      requiresReview: !hasValidEnd
    };
  }

  if (status === 'cancelled_pending_review') {
    return {
      // Conservative policy: retain existing access while the paid-through date is unknown.
      hasAccess: !hasValidEnd || parsedEnd > now.getTime(),
      status,
      entitlementEndsAt,
      requiresReview: !hasValidEnd
    };
  }

  if (status === 'cancelled' || status === 'canceled') {
    return {
      hasAccess: hasValidEnd && parsedEnd > now.getTime(),
      status: 'cancelled',
      entitlementEndsAt,
      requiresReview: !hasValidEnd
    };
  }

  if (status === 'expired') {
    return {
      hasAccess: false,
      status,
      entitlementEndsAt,
      requiresReview: !hasValidEnd
    };
  }

  return {
    hasAccess: false,
    status,
    entitlementEndsAt,
    requiresReview: false
  };
}

module.exports = { getSubscriptionEntitlement };
