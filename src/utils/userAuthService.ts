import { getSupabaseClient } from './supabaseClient';
import { UserAccount } from '../components/PremiumAuthModal';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'parent' | 'school_admin' | 'user' | 'admin' | 'super_admin';
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_PROFILES = 'playroom_user_profiles';
const STORAGE_KEY_CURRENT_USER = 'playroom_user';

/**
 * Normalize an email address for unique indexing
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Trigger Supabase Google OAuth sign-in flow
 * Redirects to the production URL or active web origin
 */
export const signInWithGoogle = async (): Promise<{ error: Error | null; data?: any }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const error = new Error('Supabase client is not configured.');
    console.error('[Auth Error] OAuth initiation error: Supabase client is not initialized or missing configuration.');
    return { error };
  }
  try {
    // Standard OAuth redirect target for production (Vercel) and runtime origin
    let redirectUrl = 'https://playroom-app.vercel.app/';
    if (typeof window !== 'undefined' && window.location.origin) {
      const origin = window.location.origin;
      redirectUrl = origin.endsWith('/') ? origin : `${origin}/`;
    }

    console.log('[Supabase Diagnostic - signInWithOAuth START]', {
      endpoint: '/auth/v1/authorize?provider=google',
      method: 'GET/POST',
      provider: 'google',
      redirectTo: redirectUrl,
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      console.warn('[Supabase Diagnostic - signInWithOAuth ERROR]', {
        endpoint: '/auth/v1/authorize?provider=google',
        status: (error as any)?.status || 400,
        errorMessage: error.message || error,
      });
      return { error };
    }

    console.log('[Supabase Diagnostic - signInWithOAuth SUCCESS]');
    return { error: null, data };
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn('[Supabase Diagnostic - signInWithOAuth EXCEPTION]', {
      endpoint: '/auth/v1/authorize?provider=google',
      errorMessage: error.message || error,
    });
    return { error };
  }
};

/**
 * Securely authenticate an Administrator account via Supabase Auth (email + password).
 * Authenticates directly with the user's Supabase credentials.
 * Checks authorization from user app_metadata, user_metadata, and public.profiles table.
 * Grants admin authorization ONLY if role === 'admin' || role === 'super_admin'.
 * If not admin, immediately signs the user out and denies access.
 */
export const signInAdminWithSupabase = async (
  email: string,
  password: string
): Promise<{ success: boolean; account?: UserAccount; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase authentication service is unavailable. Please check your network connection.',
    };
  }

  const cleanEmail = normalizeEmail(email);

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message || 'Invalid email or password.',
      };
    }

    const userId = authData.user.id;

    // Fetch user profile from public.profiles
    let profile: any = null;
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, display_name, role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('[Admin Auth] Notice fetching profile by id:', profileError.message || profileError);
      } else if (data) {
        profile = data;
      }
    } catch (e) {
      console.warn('[Admin Auth] Exception querying profile by id:', e);
    }

    if (!profile) {
      try {
        const { data, error: emailError } = await supabase
          .from('profiles')
          .select('id, email, display_name, role')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (!emailError && data) {
          profile = data;
        }
      } catch (e) {
        console.warn('[Admin Auth] Exception querying profile by email:', e);
      }
    }

    // Role verification: Must be strictly 'admin' or 'super_admin'
    let role = (
      profile?.role ||
      authData.user.app_metadata?.role ||
      authData.user.user_metadata?.role ||
      ''
    )
      .toLowerCase()
      .trim();

    // The authorized primary administrator account
    if (!role && cleanEmail === 'ramshaurooj10@gmail.com') {
      role = 'admin';
    }

    const isAuthorized = role === 'admin' || role === 'super_admin' || role === 'superadmin';

    if (!isAuthorized) {
      // Non-admin user attempted admin login: immediately sign out and reject
      await supabase.auth.signOut();
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      sessionStorage.clear();
      return {
        success: false,
        error: 'This account does not have administrator access.',
      };
    }

    const adminRole: 'admin' | 'super_admin' =
      role === 'super_admin' || role === 'superadmin' ? 'super_admin' : 'admin';

    const account: UserAccount = {
      id: userId,
      email: profile?.email || authData.user.email || cleanEmail,
      isLoggedIn: true,
      role: adminRole,
      hasPage1Access: true,
      hasPage2SchoolAccess: true,
      schoolName: profile?.display_name || authData.user.user_metadata?.full_name || 'System Administrator',
    };

    saveUserProfileLocal({
      id: userId,
      email: cleanEmail,
      displayName: account.schoolName || 'System Administrator',
      role: adminRole,
      createdAt: profile?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(account));
    window.dispatchEvent(new CustomEvent('playroom_auth_change'));

    return {
      success: true,
      account,
    };
  } catch (err: any) {
    console.error('[Admin Auth] Exception during admin sign-in:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred during administrative login.',
    };
  }
};

/**
 * Check if the current client has an active Supabase session for an administrator.
 */
export const checkCurrentAdminSession = async (): Promise<{
  isAdmin: boolean;
  user?: any;
  account?: UserAccount;
}> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { isAdmin: false };

  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData?.session?.user) {
      return { isAdmin: false };
    }

    const sessionUser = sessionData.session.user;

    // Check role in metadata
    let role = (
      sessionUser.app_metadata?.role ||
      sessionUser.user_metadata?.role ||
      ''
    )
      .toLowerCase()
      .trim();

    // Check profiles table if not directly found in metadata
    if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
      const cleanEmail = normalizeEmail(sessionUser.email || '');
      if (cleanEmail === 'ramshaurooj10@gmail.com') {
        role = 'admin';
      } else {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, display_name')
            .eq('id', sessionUser.id)
            .maybeSingle();

          if (profile?.role) {
            role = profile.role.toLowerCase().trim();
          }
        } catch {
          // ignore
        }
      }
    }

    if (role === 'admin' || role === 'super_admin' || role === 'superadmin') {
      const adminRole: 'admin' | 'super_admin' =
        role === 'super_admin' || role === 'superadmin' ? 'super_admin' : 'admin';

      const account: UserAccount = {
        id: sessionUser.id,
        email: sessionUser.email || '',
        isLoggedIn: true,
        role: adminRole,
        hasPage1Access: true,
        hasPage2SchoolAccess: true,
        schoolName: sessionUser.user_metadata?.full_name || 'System Administrator',
      };

      return {
        isAdmin: true,
        user: sessionUser,
        account,
      };
    }
  } catch (e) {
    console.warn('[Admin Auth] Error checking active session:', e);
  }

  return { isAdmin: false };
};

/**
 * Sign out of current user session and wipe all access/license cached states
 */
export const signOutUser = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.removeItem('playroom_active_school_license');
      localStorage.removeItem('playroom_current_user');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Error clearing storage on logout:', e);
    }
    window.dispatchEvent(new CustomEvent('playroom_license_update'));
    window.dispatchEvent(new CustomEvent('playroom_auth_change'));
  }
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
};

/**
 * Check whether a user account has active Administrator privileges (internal/external check only)
 * Authorized admin roles are strictly: 'admin' and 'super_admin'
 */
export const isAdminAccount = (account: UserAccount | null | undefined): boolean => {
  if (!account || !account.isLoggedIn) return false;
  const role = String(account.role || '').toLowerCase().trim();
  return role === 'admin' || role === 'super_admin' || role === 'superadmin';
};

/**
 * Get current logged in user account from local storage
 */
export const getCurrentUserAccountLocal = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (raw) {
      const parsed: UserAccount = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not parse user account:', e);
  }
  return null;
};

/**
 * Get all existing local user profiles
 */
export const getAllUserProfilesLocal = (): UserProfile[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not parse user profiles:', e);
  }
  return [];
};

/**
 * Find existing profile by email (case-insensitive)
 */
export const findProfileByEmail = (email: string): UserProfile | undefined => {
  const normalized = normalizeEmail(email);
  const profiles = getAllUserProfilesLocal();
  return profiles.find((p) => normalizeEmail(p.email) === normalized);
};

/**
 * Save / update user profile locally with email uniqueness guarantee
 */
export const saveUserProfileLocal = (profile: UserProfile): void => {
  const normalized = normalizeEmail(profile.email);
  const profiles = getAllUserProfilesLocal();
  const index = profiles.findIndex((p) => normalizeEmail(p.email) === normalized);

  if (index >= 0) {
    // Update existing profile (do not create duplicate)
    profiles[index] = {
      ...profiles[index],
      ...profile,
      email: normalized,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Add single new profile
    profiles.push({
      ...profile,
      email: normalized,
    });
  }

  localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
};

/**
 * Verify if the authenticated session or user is a School Administrator
 * Checks public.is_school_admin() RPC function and profiles table safely with active session
 */
export const verifySchoolAdminStatus = async (
  userId?: string,
  email?: string
): Promise<boolean> => {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    // 1. Check for active Supabase Auth session first
    let activeUserId = userId;
    let activeUserEmail = email;

    console.log('[Supabase Diagnostic - getSession START (verifySchoolAdmin)]');
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr) {
      console.warn('[Supabase Diagnostic - getSession ERROR]', {
        endpoint: '/auth/v1/token',
        status: (sessionErr as any)?.status || 400,
        errorMessage: sessionErr.message || sessionErr,
      });
    } else {
      console.log('[Supabase Diagnostic - getSession RESULT]', {
        hasSession: Boolean(session?.user),
        userId: session?.user?.id || 'none',
      });
    }

    if (session?.user) {
      activeUserId = activeUserId || session.user.id;
      activeUserEmail = activeUserEmail || session.user.email;
    }

    // If no authenticated session and no identifiers provided, fallback to local profiles
    if (!session?.user && !activeUserId && !activeUserEmail) {
      if (email) {
        const local = findProfileByEmail(email);
        return local?.role === 'school_admin';
      }
      return false;
    }

    // 2. Query profiles table by authenticated userId
    if (activeUserId) {
      console.log('[Supabase Diagnostic - profiles SELECT START]', {
        endpoint: `/rest/v1/profiles?select=role&id=eq.${activeUserId}`,
        method: 'GET',
        sessionExists: Boolean(session?.user),
        userId: activeUserId,
      });

      const { data: profileById, error: errId } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', activeUserId)
        .maybeSingle();

      if (errId) {
        console.warn('[Supabase Diagnostic - profiles SELECT ERROR]', {
          endpoint: `/rest/v1/profiles?id=eq.${activeUserId}`,
          status: (errId as any)?.status || (errId as any)?.code || 400,
          errorMessage: errId.message || errId,
        });
      } else {
        console.log('[Supabase Diagnostic - profiles SELECT SUCCESS]', {
          role: profileById?.role,
        });
      }

      if (!errId && profileById?.role === 'school_admin') {
        return true;
      }
    }

    // 3. Call public.is_school_admin() SECURITY DEFINER function in Supabase if session exists
    if (session?.user) {
      console.log('[Supabase Diagnostic - is_school_admin RPC START]', {
        endpoint: '/rest/v1/rpc/is_school_admin',
        method: 'POST',
        sessionExists: true,
        userId: session.user.id,
      });

      const { data: isSchoolAdminRpc, error: rpcError } = await supabase.rpc('is_school_admin');
      if (rpcError) {
        console.warn('[Supabase Diagnostic - is_school_admin RPC ERROR]', {
          endpoint: '/rest/v1/rpc/is_school_admin',
          status: (rpcError as any)?.status || (rpcError as any)?.code || 403,
          errorMessage: rpcError.message || rpcError,
        });
      } else {
        console.log('[Supabase Diagnostic - is_school_admin RPC SUCCESS]', {
          result: isSchoolAdminRpc,
        });
        if (isSchoolAdminRpc === true) {
          return true;
        }
      }
    }

    // 4. Query profiles table by email as fallback
    if (activeUserEmail) {
      const normalized = normalizeEmail(activeUserEmail);
      console.log('[Supabase Diagnostic - profiles SELECT by email START]', {
        endpoint: `/rest/v1/profiles?select=role&email=eq.${normalized}`,
        method: 'GET',
        sessionExists: Boolean(session?.user),
      });

      const { data: profileByEmail, error: errEmail } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', normalized)
        .maybeSingle();

      if (errEmail) {
        console.warn('[Supabase Diagnostic - profiles SELECT by email ERROR]', {
          status: (errEmail as any)?.status || (errEmail as any)?.code || 400,
          errorMessage: errEmail.message || errEmail,
        });
      }

      if (!errEmail && profileByEmail?.role === 'school_admin') {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Auth] verifySchoolAdminStatus error:', err);
  }

  // Fallback to local profile check
  if (email) {
    const local = findProfileByEmail(email);
    if (local?.role === 'school_admin') return true;
  }

  return false;
};

/**
 * Handle Login / Signup for a single Google / Gmail account.
 * Ensures: ONE GOOGLE ACCOUNT = ONE PLAYROOM ACCOUNT.
 * If account exists, retrieves existing profile and preserves assigned role (e.g. 'school_admin').
 * Authenticated user's profile role from Supabase and public.is_school_admin() RPC are respected.
 */
export const getOrCreateUserAccount = async (
  rawEmail: string,
  displayName?: string,
  userId?: string,
  roleOverride?: UserAccount['role']
): Promise<UserAccount> => {
  const email = normalizeEmail(rawEmail);
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  let existingProfile = findProfileByEmail(email);
  let isSchoolAdminRpc = false;
  let profileDataFromDb: any = null;
  let authenticatedSessionUserId: string | undefined = userId;

  // 1. Fetch profile & check is_school_admin RPC from Supabase if client is available
  if (supabase) {
    try {
      console.log('[Supabase Diagnostic - getSession START (getOrCreateUserAccount)]');
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr) {
        console.warn('[Supabase Diagnostic - getSession ERROR]', sessionErr.message || sessionErr);
      }

      if (session?.user) {
        authenticatedSessionUserId = authenticatedSessionUserId || session.user.id;
        if (!displayName) {
          displayName =
            session.user.user_metadata?.full_name || session.user.user_metadata?.name;
        }
      }

      // Query profiles by authenticated userId first (avoids RLS email query blocking)
      if (authenticatedSessionUserId) {
        console.log('[Supabase Diagnostic - profiles SELECT START (getOrCreateUserAccount)]', {
          endpoint: `/rest/v1/profiles?select=*&id=eq.${authenticatedSessionUserId}`,
          method: 'GET',
          sessionExists: Boolean(session?.user),
          userId: authenticatedSessionUserId,
        });

        const { data: byId, error: errId } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authenticatedSessionUserId)
          .maybeSingle();

        if (errId) {
          console.warn('[Supabase Diagnostic - profiles SELECT by ID ERROR]', {
            status: (errId as any)?.status || (errId as any)?.code || 400,
            errorMessage: errId.message || errId,
          });
        } else if (byId) {
          console.log('[Supabase Diagnostic - profiles SELECT by ID FOUND]', {
            id: byId.id,
            role: byId.role,
          });
          profileDataFromDb = byId;
        }
      }

      // If not found by userId, query by email
      if (!profileDataFromDb) {
        console.log('[Supabase Diagnostic - profiles SELECT by email START (getOrCreateUserAccount)]', {
          endpoint: `/rest/v1/profiles?select=*&email=eq.${email}`,
          method: 'GET',
        });

        const { data: byEmail, error: errEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (errEmail) {
          console.warn('[Supabase Diagnostic - profiles SELECT by email ERROR]', {
            status: (errEmail as any)?.status || (errEmail as any)?.code || 400,
            errorMessage: errEmail.message || errEmail,
          });
        } else if (byEmail) {
          console.log('[Supabase Diagnostic - profiles SELECT by email FOUND]', {
            id: byEmail.id,
            role: byEmail.role,
          });
          profileDataFromDb = byEmail;
        }
      }

      // Check RPC function only when needed (if role was not already confirmed as school_admin)
      if (session?.user && profileDataFromDb?.role !== 'school_admin') {
        console.log('[Supabase Diagnostic - is_school_admin RPC START (getOrCreateUserAccount)]');
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('is_school_admin');
        if (rpcErr) {
          console.warn('[Supabase Diagnostic - is_school_admin RPC ERROR]', {
            status: (rpcErr as any)?.status || (rpcErr as any)?.code || 403,
            errorMessage: rpcErr.message || rpcErr,
          });
        } else if (rpcRes === true) {
          console.log('[Supabase Diagnostic - is_school_admin RPC TRUE]');
          isSchoolAdminRpc = true;
        }
      }
    } catch (err) {
      console.error('[Auth Error] profile fetch error (exception):', err);
    }
  }

  // Helper to normalize and parse role
  const parseCandidateRole = (r: any): UserAccount['role'] | null => {
    if (!r || typeof r !== 'string') return null;
    const clean = r.trim().toLowerCase();
    if (clean === 'super_admin' || clean === 'superadmin') return 'super_admin';
    if (clean === 'admin') return 'admin';
    if (clean === 'school_admin' || clean === 'schooladmin' || clean === 'educator' || clean === 'teacher') return 'school_admin';
    if (clean === 'parent' || clean === 'user') return 'parent';
    return null;
  };

  // Check auth user metadata for admin role
  let sessionUserMetadataRole: string | undefined = undefined;
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (session.user.app_metadata?.role) sessionUserMetadataRole = session.user.app_metadata.role;
        else if (session.user.user_metadata?.role) sessionUserMetadataRole = session.user.user_metadata.role;
        else if (session.user.app_metadata?.is_admin || session.user.user_metadata?.is_admin) sessionUserMetadataRole = 'admin';
      }
    } catch {
      // ignore
    }
  }

  // Determine the verified role from Supabase DB / Metadata / RPC / Local Profiles
  let verifiedRole: UserAccount['role'] = 'parent';
  const roleOverrideParsed = parseCandidateRole(roleOverride);
  const dbRoleParsed = parseCandidateRole(profileDataFromDb?.role);
  const metaRoleParsed = parseCandidateRole(sessionUserMetadataRole);
  const existingRoleParsed = parseCandidateRole(existingProfile?.role);

    // 1. Admin / Super Admin always takes precedence (authenticated admin authorization)
    const cleanEmail = normalizeEmail(email);
    if (
      roleOverrideParsed === 'super_admin' ||
      dbRoleParsed === 'super_admin' ||
      metaRoleParsed === 'super_admin' ||
      existingRoleParsed === 'super_admin'
    ) {
      verifiedRole = 'super_admin';
    } else if (
      roleOverrideParsed === 'admin' ||
      dbRoleParsed === 'admin' ||
      metaRoleParsed === 'admin' ||
      existingRoleParsed === 'admin' ||
      cleanEmail === 'ramshaurooj10@gmail.com'
    ) {
      verifiedRole = 'admin';
    } else if (
    isSchoolAdminRpc ||
    roleOverrideParsed === 'school_admin' ||
    dbRoleParsed === 'school_admin' ||
    metaRoleParsed === 'school_admin' ||
    existingRoleParsed === 'school_admin'
  ) {
    verifiedRole = 'school_admin';
  } else {
    verifiedRole = dbRoleParsed || existingRoleParsed || roleOverrideParsed || metaRoleParsed || 'parent';
  }

  const isSchoolOrAdmin = verifiedRole === 'school_admin' || verifiedRole === 'admin' || verifiedRole === 'super_admin';

  // If profile exists in Supabase DB
  if (profileDataFromDb) {
    const verifiedProfile: UserProfile = {
      id: profileDataFromDb.id || authenticatedSessionUserId || existingProfile?.id || 'usr_' + Date.now(),
      email: profileDataFromDb.email || email,
      displayName: profileDataFromDb.display_name || displayName || email.split('@')[0],
      role: verifiedRole as any,
      avatarUrl: profileDataFromDb.avatar_url,
      createdAt: profileDataFromDb.created_at || now,
      updatedAt: profileDataFromDb.updated_at || now,
    };
    saveUserProfileLocal(verifiedProfile);

    const account: UserAccount = {
      id: verifiedProfile.id,
      email: verifiedProfile.email,
      isLoggedIn: true,
      role: verifiedRole,
      hasPage1Access: true,
      hasPage2SchoolAccess: isSchoolOrAdmin,
    };
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(account));
    return account;
  }

  // If local profile already exists
  if (existingProfile) {
    const updatedProfile: UserProfile = {
      ...existingProfile,
      displayName: displayName || existingProfile.displayName,
      role: verifiedRole as any,
      updatedAt: now,
    };
    saveUserProfileLocal(updatedProfile);

    const account: UserAccount = {
      id: authenticatedSessionUserId || existingProfile.id,
      email: existingProfile.email,
      isLoggedIn: true,
      role: verifiedRole,
      hasPage1Access: true,
      hasPage2SchoolAccess: isSchoolOrAdmin,
    };
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(account));
    return account;
  }

  // 2. New profile creation in local storage
  const newId = authenticatedSessionUserId || 'usr_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  const newProfile: UserProfile = {
    id: newId,
    email,
    displayName: displayName || email.split('@')[0],
    role: verifiedRole as any,
    createdAt: now,
    updatedAt: now,
  };

  saveUserProfileLocal(newProfile);

  // Sync new profile to Supabase database ONLY if authenticated with matching user ID
  if (supabase && authenticatedSessionUserId) {
    try {
      console.log('[Supabase Diagnostic - profiles INSERT START]', {
        endpoint: '/rest/v1/profiles',
        method: 'POST',
        id: authenticatedSessionUserId,
      });

      const { error: insertError } = await supabase.from('profiles').insert([
        {
          id: authenticatedSessionUserId,
          email: newProfile.email,
          display_name: newProfile.displayName,
          role: verifiedRole,
          created_at: newProfile.createdAt,
          updated_at: newProfile.updatedAt,
        },
      ]);
      if (insertError) {
        console.warn('[Supabase Diagnostic - profiles INSERT NOTE]', {
          status: (insertError as any)?.status || (insertError as any)?.code,
          errorMessage: insertError.message || insertError,
        });
      } else {
        console.log('[Supabase Diagnostic - profiles INSERT SUCCESS]');
      }
    } catch (err) {
      console.warn('[Auth] profile creation note:', err);
    }
  }

  const account: UserAccount = {
    id: newProfile.id,
    email: newProfile.email,
    isLoggedIn: true,
    role: verifiedRole,
    hasPage1Access: true,
    hasPage2SchoolAccess: isSchoolOrAdmin,
  };

  localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(account));
  return account;
};
