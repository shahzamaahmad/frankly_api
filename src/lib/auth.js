const { fetchOne, hasColumn, insertRow, updateRow } = require('./db');
const { getSupabaseAdmin, getSupabaseAuth } = require('./supabase');
const { buildFullName, mergePermissions, sanitizeUser } = require('./users');

const AUTH_LINK_COLUMNS = ['authUserId', 'auth_user_id', 'supabaseAuthId', 'supabase_auth_id'];

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSupabaseFallbackEmailDomain() {
  const domain = process.env.SUPABASE_AUTH_FALLBACK_EMAIL_DOMAIN;
  return typeof domain === 'string' ? domain.trim().toLowerCase() : '';
}

function buildAuthEmail(userData = {}) {
  const directEmail = normalizeEmail(userData.email);
  if (directEmail) {
    return directEmail;
  }

  const username = normalizeUsername(userData.username);
  const domain = getSupabaseFallbackEmailDomain();
  if (!username || !domain) {
    return '';
  }

  const safeLocalPart = username
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^\.+|\.+$/g, '');

  return safeLocalPart ? `${safeLocalPart}@${domain}` : '';
}

async function findUserByColumn(column, value) {
  if (!value || !await hasColumn('users', column)) {
    return null;
  }

  return fetchOne('users', {
    filters: [{ column, operator: 'eq', value }],
  });
}

async function getAuthLinkColumn() {
  for (const column of AUTH_LINK_COLUMNS) {
    if (await hasColumn('users', column)) {
      return column;
    }
  }

  return null;
}

async function listAuthUsers() {
  const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw error;
  }

  return data?.users || [];
}

async function findAuthUserIdForLocalUser(localUser) {
  const linkedUserId = localUser?.authUserId || localUser?.auth_user_id || localUser?.supabaseAuthId || localUser?.supabase_auth_id;
  if (linkedUserId) {
    return linkedUserId;
  }

  const candidateEmails = uniqueValues([
    normalizeEmail(localUser?.email),
    buildAuthEmail(localUser),
  ]);

  if (!candidateEmails.length && !localUser?.username) {
    return '';
  }

  const users = await listAuthUsers();
  const matched = users.find((authUser) => {
    const authEmail = normalizeEmail(authUser.email);
    const metadataUsername = normalizeUsername(authUser.user_metadata?.username);
    return candidateEmails.includes(authEmail)
      || (localUser?.username && metadataUsername === normalizeUsername(localUser.username));
  });

  return matched?.id || '';
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

async function syncAuthLink(user, authUser) {
  if (!user || !authUser) {
    return user;
  }

  const updates = {};
  const authLinkColumn = await getAuthLinkColumn();

  if (authLinkColumn && user[authLinkColumn] !== authUser.id) {
    updates[authLinkColumn] = authUser.id;
  }

  if (authUser.email && await hasColumn('users', 'email') && !user.email) {
    updates.email = authUser.email;
  }

  if (
    authUser.user_metadata?.username &&
    await hasColumn('users', 'username') &&
    !user.username
  ) {
    updates.username = authUser.user_metadata.username;
  }

  if (!Object.keys(updates).length) {
    return user;
  }

  return updateRow('users', user._id || user.id, updates);
}

async function findUserForAuthUser(authUser) {
  if (!authUser) {
    return null;
  }

  const authLinkColumn = await getAuthLinkColumn();
  let user = null;

  if (authLinkColumn) {
    user = await findUserByColumn(authLinkColumn, authUser.id);
  }

  if (!user && authUser.email) {
    user = await findUserByColumn('email', authUser.email);
  }

  if (!user && authUser.user_metadata?.username) {
    user = await findUserByColumn('username', authUser.user_metadata.username);
  }

  if (!user && authUser.phone) {
    user = await findUserByColumn('phone', authUser.phone)
      || await findUserByColumn('mobile', authUser.phone);
  }

  return syncAuthLink(user, authUser);
}

async function ensureUserDoesNotExist(username, email) {
  const existingByUsername = username ? await findUserByColumn('username', username) : null;
  if (existingByUsername) {
    return { exists: true, message: 'Username already exists' };
  }

  const existingByEmail = email ? await findUserByColumn('email', email) : null;
  if (existingByEmail) {
    return { exists: true, message: 'Email already exists' };
  }

  return { exists: false };
}

async function createLinkedUserProfile(profile, authUser) {
  const authEmail = normalizeEmail(authUser?.email || profile.email);
  const fullName = profile.fullName || profile.name || buildFullName(profile);
  const authLinkColumn = await getAuthLinkColumn();
  const payload = {
    ...profile,
    email: authEmail || profile.email,
    phone: profile.phone || profile.mobile,
    fullName,
    role: profile.role || 'emp',
    isActive: profile.isActive !== false,
    permissions: mergePermissions(profile.permissions),
    assets: Array.isArray(profile.assets) ? profile.assets : [],
    salaryCurrency: profile.salaryCurrency || 'AED',
  };

  delete payload.name;
  delete payload.mobile;
  delete payload.password;
  delete payload.id;
  delete payload._id;

  if (authLinkColumn && authUser?.id) {
    payload[authLinkColumn] = authUser.id;
  }

  return insertRow('users', payload);
}

function formatSessionPayload(session, user) {
  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: sanitizeUser(user),
  };
}

async function verifyAccessToken(token) {
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data?.user) {
    throw error || new Error('Invalid Supabase access token');
  }

  const user = sanitizeUser(await findUserForAuthUser(data.user));
  if (!user) {
    throw new Error('User profile not found');
  }

  return { authUser: data.user, user };
}

async function resolveLoginEmail(identifier) {
  const input = typeof identifier === 'string' ? identifier.trim() : '';
  if (!input) {
    return '';
  }

  if (input.includes('@')) {
    return normalizeEmail(input);
  }

  const user = await findUserByColumn('username', input);
  if (user?.email) {
    return normalizeEmail(user.email);
  }

  const fallbackDomain = getSupabaseFallbackEmailDomain();
  return fallbackDomain ? buildAuthEmail({ username: input }) : '';
}

async function signInWithPassword(identifier, password) {
  const email = await resolveLoginEmail(identifier);
  if (!email) {
    return { error: { message: 'This account needs an email to use Supabase Auth' } };
  }

  const { data, error } = await getSupabaseAuth().auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session || !data.user) {
    return { error: error || new Error('Unable to sign in') };
  }

  const user = sanitizeUser(await findUserForAuthUser(data.user));
  if (!user) {
    return { error: new Error('User profile not found') };
  }

  return {
    session: data.session,
    authUser: data.user,
    user,
  };
}

async function refreshAccessToken(refreshToken) {
  const { data, error } = await getSupabaseAuth().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data?.session || !data.user) {
    throw error || new Error('Unable to refresh Supabase session');
  }

  const user = sanitizeUser(await findUserForAuthUser(data.user));
  if (!user) {
    throw new Error('User profile not found');
  }

  return {
    session: data.session,
    authUser: data.user,
    user,
  };
}

async function signOutSession(accessToken) {
  const { error } = await getSupabaseAdmin().auth.admin.signOut(accessToken);
  if (error) {
    throw error;
  }
}

async function createSupabaseAuthUser(profile) {
  const email = buildAuthEmail(profile);
  if (!email) {
    throw new Error('Email is required for Supabase Auth. Add email or configure SUPABASE_AUTH_FALLBACK_EMAIL_DOMAIN.');
  }

  const metadata = {
    username: normalizeUsername(profile.username),
    fullName: profile.fullName || profile.name || buildFullName(profile),
    role: profile.role || 'emp',
  };

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password: profile.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error || !data?.user) {
    throw error || new Error('Unable to create Supabase user');
  }

  return { authUser: data.user, email };
}

async function registerUser(profile) {
  const email = buildAuthEmail(profile);
  const username = normalizeUsername(profile.username);
  const duplicateCheck = await ensureUserDoesNotExist(username, email);
  if (duplicateCheck.exists) {
    throw new Error(duplicateCheck.message);
  }

  const { authUser } = await createSupabaseAuthUser(profile);
  await createLinkedUserProfile({ ...profile, email }, authUser);

  const signInResult = await signInWithPassword(email, profile.password);
  if (signInResult.error) {
    throw signInResult.error;
  }

  return signInResult;
}

async function updateSupabaseUser(localUser, updates = {}) {
  const authUserId = await findAuthUserIdForLocalUser(localUser);
  if (!authUserId) {
    if (updates.password || updates.email) {
      throw new Error('This user is not linked to a Supabase auth account yet');
    }
    return;
  }

  const nextEmail = normalizeEmail(updates.email || localUser.email);
  const nextUsername = normalizeUsername(updates.username || localUser.username);
  const nextFullName = updates.fullName || localUser.fullName || buildFullName({
    ...localUser,
    ...updates,
  });

  const payload = {};
  if (updates.email) {
    payload.email = nextEmail;
    payload.email_confirm = true;
  }
  if (updates.password) {
    payload.password = updates.password;
  }

  if (updates.username || updates.fullName || updates.role) {
    payload.user_metadata = {
      username: nextUsername,
      fullName: nextFullName,
      role: updates.role || localUser.role || 'emp',
    };
  }

  if (!Object.keys(payload).length) {
    return;
  }

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(authUserId, payload);
  if (error) {
    throw error;
  }
}

async function deleteSupabaseUser(localUser) {
  const authUserId = await findAuthUserIdForLocalUser(localUser);
  if (!authUserId) {
    return;
  }

  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(authUserId);
  if (error) {
    throw error;
  }
}

async function changePassword(accessToken, currentPassword, newPassword) {
  const { authUser, user } = await verifyAccessToken(accessToken);
  const email = normalizeEmail(authUser.email || user.email);
  if (!email) {
    throw new Error('This account does not have an email address configured');
  }

  const signInResult = await signInWithPassword(email, currentPassword);
  if (signInResult.error) {
    throw new Error('Current password is incorrect');
  }

  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(authUser.id, {
    password: newPassword,
  });
  if (error) {
    throw error;
  }
}

module.exports = {
  changePassword,
  deleteSupabaseUser,
  findUserForAuthUser,
  formatSessionPayload,
  refreshAccessToken,
  registerUser,
  resolveLoginEmail,
  signInWithPassword,
  signOutSession,
  updateSupabaseUser,
  verifyAccessToken,
};
