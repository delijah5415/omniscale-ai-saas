'use strict';

const { supabaseAdmin } = require('../database');
const { createRequireAuth } = require('./authPolicy');

const requireAuth = createRequireAuth(supabaseAdmin);

module.exports = { requireAuth };
