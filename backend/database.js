const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Database configuration missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getUserProfile(userId) {
  if (!userId) {
    throw new Error('A user ID is required to load a profile.');
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error.message);
    throw new Error('Unable to verify the account subscription status.');
  }

  return data;
}

async function updateUserSubscription(userId, subscriptionData) {
  if (!userId || !subscriptionData || typeof subscriptionData !== 'object') {
    return {
      data: null,
      error: new Error('A user ID and subscription data are required.')
    };
  }

  const payload = {
    updated_at: new Date().toISOString()
  };

  const fieldMap = {
    subscriptionId: 'subscription_id',
    plan: 'plan_type',
    status: 'status',
    entitlementEndsAt: 'entitlement_ends_at'
  };

  for (const [inputKey, column] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(subscriptionData, inputKey)) {
      payload[column] = subscriptionData[inputKey];
    }
  }

  const existing = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing.error) {
    console.error('Error checking subscription profile:', existing.error.message);
    return { data: null, error: existing.error };
  }

  let result;

  if (existing.data) {
    result = await supabaseAdmin
      .from('user_profiles')
      .update(payload)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
  } else {
    result = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: userId,
        plan_type: 'free',
        status: 'inactive',
        ...payload
      })
      .select('*')
      .maybeSingle();
  }

  if (result.error) {
    console.error('Error updating subscription profile:', result.error.message);
  }

  return result;
}

module.exports = { supabaseAdmin, getUserProfile, updateUserSubscription };
