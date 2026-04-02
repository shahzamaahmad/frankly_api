const { getSupabaseAdmin, getSupabaseAuth } = require('./src/lib/supabase');
const app = require('./src/app');

getSupabaseAdmin();
getSupabaseAuth();

module.exports = app;
