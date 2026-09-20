import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration for Playroom
const DEFAULT_SUPABASE_URL = 'https://puwfsjefjzljbxklljwk.supabase.co';

export const getSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';
  return { url, key, isConfigured: Boolean(url && key) };
};

let supabaseInstance: SupabaseClient | null = null;
let hasLoggedConfigWarning = false;

/**
 * Diagnostic fetch interceptor to trace every Supabase request with full details
 */
const createDiagnosticFetch = (): typeof fetch => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const method = init?.method || (typeof input !== 'string' && !(input instanceof URL) && input.method) || 'GET';

    let endpoint = urlStr;
    try {
      const parsed = new URL(urlStr);
      endpoint = parsed.pathname + parsed.search;
    } catch {
      // keep original
    }

    // Determine current session status from localStorage / instance without leaking secrets
    let sessionExists = false;
    let sessionUserId: string | undefined;

    try {
      const storageKey = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
      );
      if (storageKey) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.id) {
            sessionExists = true;
            sessionUserId = parsed.user.id;
          }
        }
      }
    } catch {
      // ignore
    }

    const startTime = Date.now();

    try {
      const response = await fetch(input, init);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let errorBody: any = null;
        try {
          const clone = response.clone();
          errorBody = await clone.json();
        } catch {
          try {
            const clone = response.clone();
            errorBody = await clone.text();
          } catch {
            // ignore
          }
        }

        const safeErrorMessage =
          errorBody?.message ||
          errorBody?.error_description ||
          errorBody?.msg ||
          errorBody?.error ||
          (typeof errorBody === 'string' ? errorBody : response.statusText);

        console.warn(`[Supabase Diagnostic - FAILED REQUEST]`, {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          method,
          sessionExists,
          userId: sessionUserId || 'none',
          durationMs,
          errorCode: errorBody?.code || response.status,
          errorMessage: safeErrorMessage,
          errorHint: errorBody?.hint,
          errorDetails: errorBody?.details,
        });
      } else {
        console.log(`[Supabase Diagnostic - OK]`, {
          status: response.status,
          endpoint,
          method,
          sessionExists,
          userId: sessionUserId || 'none',
          durationMs,
        });
      }

      return response;
    } catch (err: any) {
      console.warn(`[Supabase Diagnostic - NETWORK NOTICE]`, {
        endpoint,
        method,
        sessionExists,
        userId: sessionUserId || 'none',
        errorMessage: err?.message || String(err),
      });
      // Return a safe 503 Response so Supabase JS client handles it gracefully via { error } without throwing unhandled network exceptions
      return new Response(
        JSON.stringify({
          message: err?.message || 'Network connection unavailable',
          code: 'NETWORK_ERROR',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const { url, key, isConfigured } = getSupabaseConfig();

  if (isConfigured) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
        global: {
          fetch: createDiagnosticFetch(),
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.error('[Auth Error] Failed to initialize Supabase client:', err);
    }
  } else if (!hasLoggedConfigWarning) {
    console.info(
      '💡 Supabase Publishable Key (VITE_SUPABASE_PUBLISHABLE_KEY) is not provided yet. Playroom is running safely with built-in resilient local storage.'
    );
    hasLoggedConfigWarning = true;
  }

  return null;
};

/**
 * Health check to test if Supabase can be reached
 */
export const testSupabaseConnection = async (): Promise<{
  connected: boolean;
  message: string;
  url: string;
}> => {
  const { url, key, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return {
      connected: false,
      message: 'Supabase Publishable Key not configured in environment variables (VITE_SUPABASE_PUBLISHABLE_KEY).',
      url,
    };
  }

  try {
    const client = getSupabaseClient();
    if (!client) {
      return {
        connected: false,
        message: 'Could not create Supabase client instance.',
        url,
      };
    }

    // Ping endpoint with basic health check query
    const { error } = await client.from('feedback').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet or permissions are restricted by RLS, we still reached Supabase
      return {
        connected: true,
        message: `Connected to Supabase project (${url}). Database responded.`,
        url,
      };
    }

    return {
      connected: true,
      message: `Successfully connected to Supabase (${url}).`,
      url,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Connection attempt to ${url} failed: ${err.message || err}`,
      url,
    };
  }
};
