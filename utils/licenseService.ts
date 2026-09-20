import { getSupabaseClient } from './supabaseClient';
import { googlePlayBilling } from '../services/billing/GooglePlayBillingService';

export interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  region: 'pakistan' | 'international';
  purchaseType: 'three_activities' | 'all_activities' | 'one_level';
  targetLevel?: number; // 1 to 6
  unlockedActivityIds?: string[];
  amount: number; // e.g. 300 or 5000, or 2 or 20
  currency: 'PKR' | 'USD';
  paymentMethod: 'sadapay' | 'jazzcash' | 'bank_transfer' | 'payoneer';
  transactionId: string;
  paymentProofName?: string;
  paymentProofUrl?: string; // Data URL or storage link
  submittedAt: string; // ISO
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  verificationType?: 'PROVIDER_VERIFIED' | 'ADMIN_VERIFIED' | 'UNVERIFIED_MANUAL';
  isVerified?: boolean;
  adminNotes?: string;
  verifiedBy?: string;
  reviewedAt?: string;
}

export interface UserLicense {
  id: string;
  userId: string;
  userEmail: string;
  licenseType: 'three_activities' | 'all_activities' | 'one_level';
  unlockedLevels: number[]; // e.g. [2] or [1,2,3,4,5,6]
  unlockedActivityIds?: string[];
  allActivitiesUnlocked: boolean;
  purchaseDate: string; // ISO
  expiryDate: string; // ISO (7 days for 3-activities, 30 days for all activities)
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  verificationType?: 'PROVIDER_VERIFIED' | 'ADMIN_VERIFIED';
  verifiedBy?: string;
  pricePaid: number;
  currency: 'PKR' | 'USD';
  paymentRequestId?: string;
}

export interface PaymentSettingsConfig {
  pakistan: {
    sadapay: {
      enabled: boolean;
      title: string;
      accountTitle: string;
      accountNumber: string;
      instructions: string;
    };
    jazzcash?: {
      enabled: boolean;
      title: string;
      accountTitle: string;
      accountNumber: string;
      instructions: string;
    };
    bankTransfer: {
      enabled: boolean;
      title: string;
      bankName: string;
      accountTitle: string;
      accountNumber: string;
      iban: string;
      instructions: string;
    };
  };
  international: {
    payoneer: {
      enabled: boolean;
      title: string;
      payoneerEmail: string;
      instructions: string;
    };
  };
}

const STORAGE_KEY_REQUESTS = 'playroom_payment_requests';
const STORAGE_KEY_LICENSES = 'playroom_user_licenses';
const STORAGE_KEY_SETTINGS = 'playroom_payment_settings';

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettingsConfig = {
  pakistan: {
    sadapay: {
      enabled: true,
      title: 'SadaPay',
      accountTitle: 'Playroom Official Administration',
      accountNumber: 'Available via Admin Verification',
      instructions: 'Please transfer the exact fee via SadaPay to the official account. Enter the transaction/reference ID below for verification.',
    },
    jazzcash: {
      enabled: true,
      title: 'JazzCash',
      accountTitle: 'Playroom Education Services',
      accountNumber: '03009876543',
      instructions: 'Transfer fee via JazzCash app to 03009876543. Enter transaction ID (TID) and upload screenshot receipt.',
    },
    bankTransfer: {
      enabled: true,
      title: 'Bank Transfer',
      bankName: 'Official Commercial Bank',
      accountTitle: 'Playroom Education Services',
      accountNumber: 'Available via Admin Verification',
      iban: 'PK00XXXX0000000000000000',
      instructions: 'Transfer the exact amount via online banking or ATM transfer. Enter your payment reference number / transaction ID for swift verification.',
    },
  },
  international: {
    payoneer: {
      enabled: true,
      title: 'Payoneer',
      payoneerEmail: 'billing@playroom-learning.edu',
      instructions: 'Send the designated USD payment to the official Payoneer account. Enter your Payoneer transaction ID or payment proof below.',
    },
  },
};

/**
 * Get Payment Settings (from cache / Supabase)
 */
export const getPaymentSettings = (): PaymentSettingsConfig => {
  if (typeof window === 'undefined') return DEFAULT_PAYMENT_SETTINGS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      return { ...DEFAULT_PAYMENT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Could not parse payment settings:', e);
  }
  return DEFAULT_PAYMENT_SETTINGS;
};

/**
 * Save Payment Settings (Admin only)
 */
export const savePaymentSettings = async (settings: PaymentSettingsConfig): Promise<boolean> => {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('payment_settings').upsert({
        id: 'global_settings',
        settings_json: settings,
        updated_at: new Date().toISOString(),
      });
    }
    return true;
  } catch (e) {
    console.warn('Error saving payment settings:', e);
    return false;
  }
};

/**
 * Submit a manual payment request.
 * CRITICAL: Manual payments (SadaPay, Bank Transfer, Payoneer offline) are UNVERIFIED and STRICTLY PENDING.
 * They do NOT automatically unlock access. Access remains locked until verified by an Administrator or Provider.
 */
export const submitPaymentRequest = async (
  requestData: Omit<PaymentRequest, 'id' | 'submittedAt' | 'status'>
): Promise<{ success: boolean; request: PaymentRequest; error?: string }> => {
  const newRequest: PaymentRequest = {
    ...requestData,
    id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    submittedAt: new Date().toISOString(),
    status: 'PENDING',
    verificationType: 'UNVERIFIED_MANUAL',
    isVerified: false,
  };

  // 1. Submit to Backend Verification API
  try {
    const res = await fetch('/api/payment/submit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRequest),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.request) {
        newRequest.id = data.request.id;
      }
    }
  } catch (err) {
    console.warn('Backend payment submit fallback to local/supabase:', err);
  }

  // 2. Save locally
  try {
    const existing = getAllPaymentRequestsLocal();
    existing.unshift(newRequest);
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(existing));
  } catch (e) {
    console.warn('Could not save payment request locally:', e);
  }

  // 3. Sync to Supabase if configured
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('payment_requests').insert([
        {
          id: newRequest.id,
          user_id: newRequest.userId,
          user_email: newRequest.userEmail,
          region: newRequest.region,
          purchase_type: newRequest.purchaseType,
          target_level: newRequest.targetLevel || null,
          amount: newRequest.amount,
          currency: newRequest.currency,
          payment_method: newRequest.paymentMethod,
          transaction_id: newRequest.transactionId,
          payment_proof_name: newRequest.paymentProofName || null,
          payment_proof_url: newRequest.paymentProofUrl || null,
          submitted_at: newRequest.submittedAt,
          status: 'PENDING',
          verification_type: 'UNVERIFIED_MANUAL',
          is_verified: false,
        },
      ]);
    } catch (err) {
      console.warn('Supabase payment_requests insert error (stored locally):', err);
    }
  }

  return { success: true, request: newRequest };
};

/**
 * Get all payment requests (Local + Supabase fallback)
 */
export const getAllPaymentRequestsLocal = (): PaymentRequest[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse payment requests:', e);
  }
  return [];
};

/**
 * Fetch all payment requests for Admin Panel (sorted newest first)
 */
export const fetchAllPaymentRequests = async (): Promise<PaymentRequest[]> => {
  const localList = getAllPaymentRequestsLocal();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: PaymentRequest[] = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          userEmail: d.user_email,
          region: d.region,
          purchaseType: d.purchase_type,
          targetLevel: d.target_level,
          amount: d.amount,
          currency: d.currency,
          paymentMethod: d.payment_method,
          transactionId: d.transaction_id,
          paymentProofName: d.payment_proof_name,
          paymentProofUrl: d.payment_proof_url,
          submittedAt: d.submitted_at,
          status: d.status,
          adminNotes: d.admin_notes,
          reviewedAt: d.reviewed_at,
        }));
        // Merge and update local cache
        localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Error fetching Supabase payment requests:', err);
    }
  }

  return localList.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
};

/**
 * Get payment requests for a specific user email
 */
export const getUserPaymentRequests = (userEmail: string): PaymentRequest[] => {
  const all = getAllPaymentRequestsLocal();
  return all.filter((r) => r.userEmail.toLowerCase() === userEmail.toLowerCase());
};

/**
 * Get user licenses
 */
export const getAllLicensesLocal = (): UserLicense[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LICENSES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse licenses:', e);
  }
  return [];
};

/**
 * Get active licenses for a user
 */
export const getUserLicenses = (userEmail: string): UserLicense[] => {
  const all = getAllLicensesLocal();
  const now = Date.now();

  return all
    .filter((l) => l.userEmail.toLowerCase() === userEmail.toLowerCase())
    .map((lic) => {
      // Check 1-month expiry dynamically
      const expiryTime = new Date(lic.expiryDate).getTime();
      if (lic.status === 'ACTIVE' && now > expiryTime) {
        return { ...lic, status: 'EXPIRED' as const };
      }
      return lic;
    });
};

/**
 * Admin Action: Approve Payment Request and Activate 1-Month License
 */
export const approvePaymentRequest = async (
  requestId: string,
  adminNotes?: string,
  adminEmail?: string
): Promise<{ success: boolean; license?: UserLicense; error?: string }> => {
  const requests = getAllPaymentRequestsLocal();
  const requestIndex = requests.findIndex((r) => r.id === requestId);
  if (requestIndex === -1) {
    return { success: false, error: 'Payment request not found' };
  }

  const req = requests[requestIndex];
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 Month Default Expiry

  // 1. Create License
  const newLicense: UserLicense = {
    id: 'lic_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    userId: req.userId,
    userEmail: req.userEmail,
    licenseType: req.purchaseType,
    unlockedLevels:
      req.purchaseType === 'all_activities'
        ? [1, 2, 3, 4, 5, 6]
        : req.targetLevel
        ? [req.targetLevel]
        : [],
    allActivitiesUnlocked: req.purchaseType === 'all_activities',
    purchaseDate: now.toISOString(),
    expiryDate: expiryDate.toISOString(),
    status: 'ACTIVE',
    verificationType: 'ADMIN_VERIFIED',
    verifiedBy: adminEmail || 'School Administrator',
    pricePaid: req.amount,
    currency: req.currency,
    paymentRequestId: req.id,
  };

  // 2. Call backend verification endpoint
  try {
    await fetch('/api/payment/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: req.id,
        decision: 'APPROVE',
        adminNotes,
        adminEmail: adminEmail || 'School Administrator',
        userEmail: req.userEmail,
        purchaseType: req.purchaseType,
        targetLevel: req.targetLevel,
        amount: req.amount,
        currency: req.currency,
      }),
    });
  } catch (err) {
    console.warn('Backend admin verify fallback to local/supabase:', err);
  }

  // 3. Update request status locally
  req.status = 'APPROVED';
  req.verificationType = 'ADMIN_VERIFIED';
  req.isVerified = true;
  req.verifiedBy = adminEmail || 'School Administrator';
  req.reviewedAt = now.toISOString();
  if (adminNotes) req.adminNotes = adminNotes;
  requests[requestIndex] = req;

  // 4. Save updated requests and licenses locally
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
  const allLicenses = getAllLicensesLocal();
  allLicenses.unshift(newLicense);
  localStorage.setItem(STORAGE_KEY_LICENSES, JSON.stringify(allLicenses));

  // 5. Sync with Supabase if available
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('payment_requests')
        .update({
          status: 'APPROVED',
          reviewed_at: req.reviewedAt,
          admin_notes: adminNotes || null,
          verified_by: adminEmail || 'School Administrator',
          verification_type: 'ADMIN_VERIFIED',
          is_verified: true,
        })
        .eq('id', req.id);

      await supabase.from('user_licenses').insert([
        {
          id: newLicense.id,
          user_id: newLicense.userId,
          user_email: newLicense.userEmail,
          license_type: newLicense.licenseType,
          unlocked_levels: newLicense.unlockedLevels,
          all_activities_unlocked: newLicense.allActivitiesUnlocked,
          purchase_date: newLicense.purchaseDate,
          expiry_date: newLicense.expiryDate,
          status: newLicense.status,
          verification_type: 'ADMIN_VERIFIED',
          verified_by: adminEmail || 'School Administrator',
          price_paid: newLicense.pricePaid,
          currency: newLicense.currency,
          payment_request_id: newLicense.paymentRequestId,
        },
      ]);
    } catch (err) {
      console.warn('Supabase license approval sync error (saved locally):', err);
    }
  }

  return { success: true, license: newLicense };
};

/**
 * Admin Action: Reject Payment Request
 */
export const rejectPaymentRequest = async (
  requestId: string,
  adminNotes?: string,
  adminEmail?: string
): Promise<{ success: boolean; error?: string }> => {
  const requests = getAllPaymentRequestsLocal();
  const requestIndex = requests.findIndex((r) => r.id === requestId);
  if (requestIndex === -1) {
    return { success: false, error: 'Payment request not found' };
  }

  const req = requests[requestIndex];
  req.status = 'REJECTED';
  req.reviewedAt = new Date().toISOString();
  if (adminNotes) req.adminNotes = adminNotes;
  requests[requestIndex] = req;

  // Call backend verification endpoint
  try {
    await fetch('/api/payment/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: req.id,
        decision: 'REJECT',
        adminNotes,
        adminEmail: adminEmail || 'School Administrator',
      }),
    });
  } catch (err) {
    console.warn('Backend admin reject fallback to local/supabase:', err);
  }

  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('payment_requests')
        .update({
          status: 'REJECTED',
          reviewed_at: req.reviewedAt,
          admin_notes: adminNotes || null,
          is_verified: false,
        })
        .eq('id', req.id);
    } catch (err) {
      console.warn('Supabase reject request sync error (saved locally):', err);
    }
  }

  return { success: true };
};

// =========================================================================
// DEMO TOGGLE: Strict security enforcement (Bypass disabled)
// =========================================================================
export const TEMPORARY_DEMO_UNLOCK_ALL = false;

export const STORAGE_KEY_AD_UNLOCKED = 'playroom_ad_unlocked_activities';
export const STORAGE_KEY_3_ACTIVITIES = 'playroom_3pack_unlocked_activities';

export const emitLicenseStateChange = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('playroom_license_update'));
  }
};

/**
 * Get list of activity IDs unlocked by watching video ads
 */
export const getAdUnlockedActivities = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AD_UNLOCKED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Check if a specific activity ID was unlocked via watching an ad
 */
export const isActivityAdUnlocked = (activityId: string): boolean => {
  if (!activityId || typeof activityId !== 'string') return false;
  const list = getAdUnlockedActivities();
  return list.includes(activityId.trim());
};

/**
 * Unlock 1 specific activity by watching a quick sponsor ad
 */
export const unlockActivityViaAd = (activityId: string): void => {
  try {
    if (!activityId || typeof activityId !== 'string') return;
    const cleanId = activityId.trim();
    const list = getAdUnlockedActivities();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      localStorage.setItem(STORAGE_KEY_AD_UNLOCKED, JSON.stringify(list));
      emitLicenseStateChange();
    }
  } catch (err) {
    console.warn('Failed to save ad unlock:', err);
  }
};

/**
 * Get list of activities unlocked under 3 Activities Pass
 */
export const getUnlocked3Activities = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_3_ACTIVITIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Unlock an activity into the user's 3-activities pack (limit 3)
 */
export const unlockActivityIn3Pack = (activityId: string): { success: boolean; message: string } => {
  try {
    const list = getUnlocked3Activities();
    if (list.includes(activityId)) {
      return { success: true, message: 'Activity already unlocked in your 3-pack.' };
    }
    if (list.length >= 3) {
      return {
        success: false,
        message: 'You have already unlocked 3 activities with this pass. Choose one of your 3 unlocked activities or upgrade to Full App.',
      };
    }
    list.push(activityId);
    localStorage.setItem(STORAGE_KEY_3_ACTIVITIES, JSON.stringify(list));
    return { success: true, message: `Unlocked activity ${activityId} in your 3-pack (${list.length}/3)!` };
  } catch (err) {
    return { success: false, message: 'Could not unlock activity.' };
  }
};

/**
 * Check if the app is currently running under a valid, active School License.
 * Institutional access grants full access to both Playroom Activities (Page 1) and Education Hub (Page 2)
 * without requiring individual user purchases, payment records, or device limits.
 * 
 * Rules:
 * - status = ACTIVE
 * - valid_until / expiry_date > NOW()
 * - valid_from / start_date <= NOW() (with small skew allowance)
 * => schoolAccess = true (Full access to all activities and Education Hub)
 */
export const checkActiveSchoolAccess = (
  userEmailOrKey?: string | null
): { hasAccess: boolean; schoolName?: string; licenseKey?: string; isExpired?: boolean } => {
  if (typeof window === 'undefined') return { hasAccess: false };

  const now = Date.now();

  // Helper to extract timestamp from various date field formats
  const extractExpiryTime = (lic: any): number => {
    if (!lic || typeof lic !== 'object') return NaN;
    const field = lic.validUntil || lic.valid_until || lic.expiryDate || lic.expiry_date || lic.valid_to || lic.validTo;
    if (!field) return NaN;
    const t = new Date(field).getTime();
    return isNaN(t) ? NaN : t;
  };

  const isLicActive = (lic: any): boolean => {
    if (!lic || typeof lic !== 'object') return false;
    const status = String(lic.status || '').trim().toUpperCase();
    return status === 'ACTIVE';
  };

  // 1. Check direct active school session from localStorage
  try {
    const rawActive = localStorage.getItem('playroom_active_school_license');
    if (rawActive) {
      const lic = JSON.parse(rawActive);
      const expiryTime = extractExpiryTime(lic);
      const active = isLicActive(lic);
      const isTimeValid = !isNaN(expiryTime) && expiryTime > now;

      if (active && isTimeValid) {
        return {
          hasAccess: true,
          schoolName: lic.schoolName || lic.school_name || 'Partner School',
          licenseKey: lic.licenseKey || lic.license_key,
          isExpired: false,
        };
      } else if (active && !isTimeValid) {
        return {
          hasAccess: false,
          schoolName: lic.schoolName || lic.school_name,
          licenseKey: lic.licenseKey || lic.license_key,
          isExpired: true,
        };
      }
    }
  } catch (e) {
    console.warn('Error reading active school license:', e);
  }

  // 2. Check logged-in school user in playroom_user
  try {
    const rawUser = localStorage.getItem('playroom_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user && user.isLoggedIn) {
        // If user session has active school flags
        if (user.role === 'school_admin' || user.hasPage2SchoolAccess || user.hasPage1Access || user.licenseKey) {
          // Check if there is a matching license in database or if active license matches
          const rawList = localStorage.getItem('playroom_db_school_licenses');
          if (rawList) {
            const list = JSON.parse(rawList);
            const keyOrEmail = (user.licenseKey || user.email || user.id || '').toLowerCase();
            const found = list.find(
              (l: any) =>
                (l.licenseKey && l.licenseKey.toLowerCase() === keyOrEmail) ||
                (l.license_key && l.license_key.toLowerCase() === keyOrEmail) ||
                (l.contactEmail && l.contactEmail.toLowerCase() === keyOrEmail) ||
                (l.contact_email && l.contact_email.toLowerCase() === keyOrEmail) ||
                (l.id && String(l.id).toLowerCase() === keyOrEmail) ||
                (l.schoolId && String(l.schoolId).toLowerCase() === keyOrEmail) ||
                (l.school_id && String(l.school_id).toLowerCase() === keyOrEmail)
            );
            if (found) {
              const exp = extractExpiryTime(found);
              if (isLicActive(found) && !isNaN(exp) && exp > now) {
                return {
                  hasAccess: true,
                  schoolName: found.schoolName || found.school_name || user.schoolName,
                  licenseKey: found.licenseKey || found.license_key || user.licenseKey,
                  isExpired: false,
                };
              }
            }
          }

          // If session is marked with school access and has a licenseKey
          if ((user.hasPage1Access && user.hasPage2SchoolAccess) || user.licenseKey) {
            return {
              hasAccess: true,
              schoolName: user.schoolName || 'Partner School',
              licenseKey: user.licenseKey,
              isExpired: false,
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error checking logged in school account:', e);
  }

  // 3. Query school licenses list if email/key provided
  if (userEmailOrKey) {
    try {
      const q = userEmailOrKey.trim().toLowerCase();
      const rawList = localStorage.getItem('playroom_db_school_licenses');
      if (rawList) {
        const list = JSON.parse(rawList);
        const found = list.find(
          (l: any) =>
            (l.licenseKey && l.licenseKey.toLowerCase() === q) ||
            (l.license_key && l.license_key.toLowerCase() === q) ||
            (l.contactEmail && l.contactEmail.toLowerCase() === q) ||
            (l.contact_email && l.contact_email.toLowerCase() === q) ||
            (l.id && String(l.id).toLowerCase() === q) ||
            (l.schoolId && String(l.schoolId).toLowerCase() === q) ||
            (l.school_id && String(l.school_id).toLowerCase() === q)
        );
        if (found) {
          const exp = extractExpiryTime(found);
          if (isLicActive(found) && !isNaN(exp) && exp > now) {
            return {
              hasAccess: true,
              schoolName: found.schoolName || found.school_name,
              licenseKey: found.licenseKey || found.license_key,
              isExpired: false,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Error checking school licenses list:', e);
    }
  }

  return { hasAccess: false };
};

/**
 * Check if a user has access to a specific Level (Level 1 is free, 2-6 require active Google Play Billing pass, school license, ad unlock, or Dev Mode)
 */
export const checkLevelAccess = (
  userEmail: string | undefined | null,
  level: number,
  isDeveloperMode: boolean = false
): { hasAccess: boolean; license?: UserLicense; isExpired?: boolean } => {
  // Level 1 is always 100% free starter for everyone
  if (level === 1) {
    return { hasAccess: true };
  }

  // Developer Mode allows full test access
  if (isDeveloperMode) {
    return { hasAccess: true };
  }

  // Check Active School License (Institutional Access - Unlocks All Playroom Activities + Education Hub)
  const schoolAccess = checkActiveSchoolAccess(userEmail);
  if (schoolAccess.hasAccess) {
    return { hasAccess: true };
  }

  // Check Google Play Billing: All Activities Pass (30 Days)
  const gpAllPass = googlePlayBilling.hasAllActivitiesPass();
  if (gpAllPass.active) {
    return { hasAccess: true };
  }

  if (!userEmail) {
    return { hasAccess: false };
  }

  const licenses = getUserLicenses(userEmail);
  const now = Date.now();

  for (const lic of licenses) {
    const isTimeValid = new Date(lic.expiryDate).getTime() > now;
    if (lic.status === 'ACTIVE' && isTimeValid) {
      if (lic.allActivitiesUnlocked || lic.licenseType === 'all_activities') {
        return { hasAccess: true, license: lic };
      }
      if (lic.unlockedLevels && lic.unlockedLevels.includes(level)) {
        return { hasAccess: true, license: lic };
      }
      if (lic.licenseType === 'three_activities') {
        return { hasAccess: true, license: lic };
      }
    } else if (lic.allActivitiesUnlocked || lic.licenseType === 'all_activities' || (lic.unlockedLevels && lic.unlockedLevels.includes(level))) {
      return { hasAccess: false, license: lic, isExpired: true };
    }
  }

  return { hasAccess: false };
};

/**
 * Check granular access for an individual activity
 */
export const checkActivityAccess = (
  activityId: string,
  levelNumber: number,
  userEmail?: string | null,
  isDeveloperMode: boolean = false
): { hasAccess: boolean; reason: string } => {
  if (levelNumber === 1) {
    return { hasAccess: true, reason: 'Level 1 Free Starter' };
  }

  if (isDeveloperMode) {
    return { hasAccess: true, reason: 'Developer Mode' };
  }

  // Check Active School License (Institutional License grants full Activity & Education Hub access)
  const schoolAccess = checkActiveSchoolAccess(userEmail);
  if (schoolAccess.hasAccess) {
    return {
      hasAccess: true,
      reason: `Active School License (${schoolAccess.schoolName || 'Institutional'})`,
    };
  }

  // Check Ad Unlocked
  if (isActivityAdUnlocked(activityId)) {
    return { hasAccess: true, reason: 'Ad Unlocked' };
  }

  // Check Google Play Billing: All Activities Pass (30 Days full access)
  const gpAllPass = googlePlayBilling.hasAllActivitiesPass();
  if (gpAllPass.active) {
    return { hasAccess: true, reason: 'Google Play All Activities Pass (Active)' };
  }

  // Check Google Play Billing: 3-Pack selection (7 Days)
  const gp3Pass = googlePlayBilling.has3ActivitiesPass();
  if (gp3Pass.active) {
    if (gp3Pass.unlockedActivities.includes(activityId)) {
      return { hasAccess: true, reason: 'Google Play 3-Activities Pass (Selected)' };
    }
  }

  // Check legacy 3-Pack storage
  const pack3 = getUnlocked3Activities();
  if (pack3.includes(activityId)) {
    return { hasAccess: true, reason: '3-Activities Pass' };
  }

  if (userEmail) {
    const lvlCheck = checkLevelAccess(userEmail, levelNumber, isDeveloperMode);
    if (lvlCheck.hasAccess) {
      return { hasAccess: true, reason: 'Active Subscription License' };
    }
  }

  return { hasAccess: false, reason: 'Locked - Premium' };
};

/**
 * Format Date helper (e.g. "19 August 2026")
 */
export const formatExpiryDate = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '1 Month from activation';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '1 Month from activation';
  }
};

/**
 * Calculate dynamic days remaining from now until expiry
 */
export const getDaysRemaining = (expiryDateIso: string): number => {
  try {
    const expiry = new Date(expiryDateIso).getTime();
    const now = Date.now();
    const diffMs = expiry - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};
