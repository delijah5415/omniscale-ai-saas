const { supabaseAdmin } = require('../database');

/**
 * Log account events into account_event_log table
 */
async function logAccountEvent(userId, eventType, metadata = {}) {
  try {
    const { error } = await supabaseAdmin
      .from('account_event_log')
      .insert([{ 
        user_id: userId, 
        event_type: eventType, 
        metadata, 
        created_at: new Date() 
      }]);
    if (error) console.error('Failed to log account event:', error.message);
  } catch (err) {
    console.error('Exception in logAccountEvent:', err.message);
  }
}

/**
 * Queue emails into email_outbox table for asynchronous dispatch
 */
async function queueEmailOutbox(recipientEmail, subject, body) {
  try {
    const { error } = await supabaseAdmin
      .from('email_outbox')
      .insert([{ 
        recipient: recipientEmail, 
        subject, 
        body, 
        status: 'pending', 
        created_at: new Date() 
      }]);
    if (error) console.error('Failed to queue email outbox:', error.message);
  } catch (err) {
    console.error('Exception in queueEmailOutbox:', err.message);
  }
}

module.exports = {
  logAccountEvent,
  queueEmailOutbox
};
