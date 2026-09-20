// Google Analytics 4 (GA4) Helper

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = 'G-KDXRSKL29M';

/**
 * Check if a value looks like an email address or contains an '@' sign
 */
function isPII(value: string): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('@') || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(value);
}

/**
 * Sanitize parameters to ensure NO email addresses or PII are sent to Analytics
 */
function sanitizeParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) return undefined;
  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    // Skip key if key itself contains email or PII
    if (isPII(key)) continue;

    if (typeof value === 'string') {
      if (isPII(value)) {
        // Redact PII
        clean[key] = '[REDACTED_PII]';
      } else {
        clean[key] = value;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeParams(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Safely set user_id in GA4 using ONLY a non-identifying internal account ID.
 * Rejects any email or PII.
 */
export function setAnalyticsUserId(internalAccountId?: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  if (!internalAccountId) {
    window.gtag('config', GA_MEASUREMENT_ID, { user_id: undefined });
    return;
  }

  // STRICT PRIVACY GUARD: Reject any ID that contains '@' or looks like an email
  if (isPII(internalAccountId)) {
    console.warn('[Analytics Privacy Guard] Blocked attempt to send PII (email) as GA4 User ID.');
    return;
  }

  window.gtag('config', GA_MEASUREMENT_ID, {
    user_id: internalAccountId,
  });
}

/**
 * Safely send a custom GA4 event with PII sanitization
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    if (isPII(eventName)) return;
    const cleanParams = sanitizeParams(params);
    window.gtag('event', eventName, cleanParams);
  }
}

/**
 * Track virtual page views with PII sanitization
 */
export function trackPageView(pagePath: string, pageTitle?: string) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    const cleanPath = isPII(pagePath) ? '/[redacted]' : pagePath;
    const cleanTitle = pageTitle && isPII(pageTitle) ? '[redacted]' : pageTitle;

    window.gtag('event', 'page_view', {
      page_path: cleanPath,
      page_title: cleanTitle || cleanPath,
    });
  }
}

/**
 * Track app_open event (fires once per session)
 */
let appOpenedFired = false;
export function trackAppOpen() {
  if (!appOpenedFired) {
    appOpenedFired = true;
    trackEvent('app_open');
  }
}

/**
 * Map internal activity IDs to formal user-facing activity names
 */
export function getActivityName(activityId: string): string {
  switch (activityId) {
    case 'abc':
      return 'ABC Phonics';
    case 'color':
      return 'Colors';
    case 'find_object':
      return 'Find the Object';
    case 'counting':
      return 'Counting';
    case 'shape_match':
      return 'Shape Match';
    case 'rhyme_time':
    case 'animal_food_match':
      return 'Animal Food Fun';
    case 'big_small_sort':
      return 'Big & Small Sort';
    case 'more_less':
      return 'More or Less';
    case 'pattern_fun':
      return 'Pattern Fun';
    case 'memory_match':
      return 'Memory Match';
    case 'fruit_veg_sort':
      return 'Fruit & Vegetable Sort';
    case 'odd_one_out':
      return 'Odd One Out';
    case 'count_tap':
      return 'Count & Tap';
    case 'shape_builder':
      return 'Shape Builder';
    default:
      return activityId;
  }
}

/**
 * Track activity_open event
 */
export function trackActivityOpen(activityId: string) {
  const activityName = getActivityName(activityId);
  trackEvent('activity_open', {
    activity_name: activityName,
    activity_id: activityId,
  });
}

/**
 * Track activity_complete event
 */
export function trackActivityComplete(activityId: string) {
  const activityName = getActivityName(activityId);
  trackEvent('activity_complete', {
    activity_name: activityName,
    activity_id: activityId,
  });
}

/**
 * Track star_earned event
 */
export function trackStarEarned(activityId?: string) {
  const params: Record<string, any> = {};
  if (activityId) {
    params.activity_name = getActivityName(activityId);
    params.activity_id = activityId;
  }
  trackEvent('star_earned', params);
}

/**
 * Track rhyme_play event for Animal Food Fun
 */
export function trackRhymePlay() {
  trackEvent('rhyme_play', {
    activity_name: 'Animal Food Fun',
  });
}

