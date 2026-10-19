const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../database');
const { requireAuth } = require('../middleware/auth');

// Trigger / store welcome message upon user registration or login
router.post('/welcome', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    const { data, error } = await supabaseAdmin
      .from('user_notifications')
      .insert([{ 
        user_id: userId, 
        message: `Welcome to OmniScale AI, ${email || 'valued user'}!`, 
        type: 'welcome',
        created_at: new Date()
      }]);

    if (error) throw error;
    res.json({ success: true, message: 'Welcome notification recorded.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a specific message record
router.delete('/:messageId', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
