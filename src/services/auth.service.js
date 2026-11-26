import { createUserClient, supabase } from '../config/supabase.js';
import { createError } from '../utils/httpError.js';

const requireClient = () => {
  if (!supabase) throw createError(503, 'Authentication service is not configured');
  return supabase;
};

const mapAuthError = (error) => {
  const status = error?.status;
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    return createError(503, 'Authentication service is unavailable');
  }
  return createError(status, error?.message || 'Authentication failed');
};

export async function registerUser({ email, password, fullName }) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) throw mapAuthError(error);

  return {
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    session: data.session,
    needsConfirmation: !data.session,
  };
}

export async function loginUser({ email, password }) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) throw mapAuthError(error);

  return {
    user: { id: data.user.id, email: data.user.email },
    session: data.session,
  };
}

export async function logoutUser(token) {
  const { error } = await createUserClient(token).auth.signOut();
  if (error) throw mapAuthError(error);
}

export async function verifyToken(token) {
  const client = requireClient();
  const { data, error } = await client.auth.getUser(token);

  if (error && (!Number.isInteger(error.status) || error.status < 400 || error.status > 599)) {
    throw createError(503, 'Authentication service is unavailable');
  }
  if (error || !data.user) throw createError(401, 'Invalid or expired session');
  return data.user;
}

export async function fetchProfile(token, userId) {
  const { data, error } = await createUserClient(token)
    .from('profiles')
    .select('id, email, full_name, avatar_url, username, bio, location, date_of_birth, visibility, notification_preferences, favourite_badge_ids, role, is_active, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw createError(500, 'Could not load user profile');
  return data;
}

export async function requestPasswordReset(email, redirectTo) {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );

  if (error) throw mapAuthError(error);
}

export async function updatePassword(token, password) {
  const { error } = await createUserClient(token).auth.updateUser({ password });
  if (error) throw mapAuthError(error);
}
