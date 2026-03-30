const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;
let supabaseAuth = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Supabase integration`);
  }
  return value;
}

function getPublicKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || null;
}

function createSupabaseClient(key, clientInfo) {
  const supabaseUrl = requireEnv('SUPABASE_URL');

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': clientInfo,
      },
    },
  });
}

function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  supabaseAdmin = createSupabaseClient(serviceRoleKey, 'warehouse-manager-api');

  return supabaseAdmin;
}

function getSupabaseAuth() {
  if (supabaseAuth) {
    return supabaseAuth;
  }

  const publicKey = getPublicKey();
  if (!publicKey) {
    throw new Error('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is required for Supabase Auth');
  }

  supabaseAuth = createSupabaseClient(publicKey, 'warehouse-manager-auth');
  return supabaseAuth;
}

module.exports = {
  getSupabaseAdmin,
  getSupabaseAuth,
};
