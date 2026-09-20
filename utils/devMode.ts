import { useState, useEffect } from 'react';

/**
 * DEVELOPER MODE VS USER / PUBLIC MODE CONTROLLER
 *
 * 1. DEVELOPER MODE:
 *    - Full access for development and testing.
 *    - All levels (1–6) and activities are unlocked.
 *    - Educator hub and tools are fully accessible.
 *    - No premium subscription barriers or upgrade modals block the developer.
 *    - Zero changes to children's saved data, stars, or progress.
 *
 * 2. USER / PUBLIC MODE:
 *    - Normal public mode with the exact original Free / Premium restrictions.
 *    - Level 1 is Free Starter.
 *    - Levels 2–6 are Premium, prompting the Upgrade modal for non-subscribed users.
 */

const STORAGE_KEY = 'playroom_developer_mode_active';
const EVENT_NAME = 'playroom_dev_mode_change';

// Safe check that avoids legacy auto-enabled keys
export const isDeveloperMode = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. URL Query Param Override (?dev=true or ?dev=false / ?mode=dev or ?mode=user)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const devParam = urlParams.get('dev') || urlParams.get('mode');
    if (devParam === 'true' || devParam === 'dev' || devParam === 'developer') {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      return true;
    }
    if (devParam === 'false' || devParam === 'user' || devParam === 'public') {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  } catch {
    // Ignore URL parsing errors
  }

  // 2. Explicit session/local state check (defaults strictly to false)
  try {
    const sessionSaved = sessionStorage.getItem(STORAGE_KEY);
    if (sessionSaved === 'true') return true;
    if (sessionSaved === 'false') return false;

    const localSaved = localStorage.getItem(STORAGE_KEY);
    if (localSaved === 'true') return true;
  } catch {
    // Fallback
  }

  // Strict default: standard public/user mode with normal lock restrictions
  return false;
};

export const isDevPreviewEnvironment = (): boolean => {
  return isDeveloperMode();
};

export const setDeveloperMode = (enabled: boolean): void => {
  if (typeof window !== 'undefined') {
    try {
      if (enabled) {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        localStorage.setItem(STORAGE_KEY, 'true');
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled } }));
  }
};

export const toggleDeveloperMode = (): boolean => {
  const current = isDeveloperMode();
  const next = !current;
  setDeveloperMode(next);
  return next;
};

/**
 * React Hook for reactive Developer Mode state
 */
export const useDeveloperMode = () => {
  const [isDev, setIsDev] = useState<boolean>(() => isDeveloperMode());

  useEffect(() => {
    const handleModeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setIsDev(customEvent.detail.enabled);
      } else {
        setIsDev(isDeveloperMode());
      }
    };

    window.addEventListener(EVENT_NAME, handleModeChange);
    window.addEventListener('storage', handleModeChange);

    // Keyboard shortcut: Ctrl+Shift+D or Alt+Shift+D
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) ||
          (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd'))) {
        e.preventDefault();
        toggleDeveloperMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener(EVENT_NAME, handleModeChange);
      window.removeEventListener('storage', handleModeChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return {
    isDeveloperMode: isDev,
    setDeveloperMode,
    toggleDeveloperMode,
  };
};
