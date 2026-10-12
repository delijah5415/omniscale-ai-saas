const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Database configuration missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getUserProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user profile:', error);
  }
  return data;
}

async function updateUserSubscription(userId, subscriptionData) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      user_id: userId,
      subscription_id: subscriptionData.subscriptionId,
      plan_type: subscriptionData.plan,
      status: subscriptionData.status,
      updated_at: new Date().toISOString()
    });

  if (error) console.error('Error updating subscription profile:', error);
  return { data, error };
}

module.exports = { supabaseAdmin, getUserProfile, updateUserSubscription };
