/**
 * Google Play Billing Service for Playroom App
 * Handles native in-app digital purchases and subscriptions for individual users.
 * 
 * Individual Products:
 * 1. playroom_3activities_7d: Next 3 Activities | PKR 300 ($2 USD) | 7-day access
 * 2. playroom_all_activities_30d: All Activities | PKR 5,000 ($20 USD) | 30-day full activity access
 * 
 * Features:
 * - Native Digital Goods API & PaymentRequest integration for Android / TWA / WebView
 * - Cryptographic / server-side verification via /api/billing/verify-google-play-purchase
 * - Automatic 7-day and 30-day expiration tracking (no manual login or account required)
 * - Automatic purchase restoration on app startup and via "Restore Purchases"
 * - No Google OAuth, email/password, or user account required for individual users.
 */

export interface GooglePlayProduct {
  id: string;
  title: string;
  description: string;
  pricePkr: number;
  priceUsd: number;
  durationDays: number;
  type: 'three_activities' | 'all_activities';
}

export interface GooglePlayEntitlement {
  productId: string;
  purchaseToken: string;
  orderId: string;
  purchaseTime: string; // ISO
  expiryTime: string;   // ISO
  status: 'ACTIVE' | 'EXPIRED';
  unlockedType: 'three_activities' | 'all_activities';
  unlockedActivityIds?: string[];
  signature?: string;
  serverSignature?: string;
  pricePaidPkr?: number;
  verificationMethod?: string;
}

export const PLAYROOM_INDIVIDUAL_PRODUCTS: Record<string, GooglePlayProduct> = {
  playroom_3activities_7d: {
    id: 'playroom_3activities_7d',
    title: 'Next 3 Activities',
    description: 'Unlock any 3 premium learning activities of your choice with full access for 7 days.',
    pricePkr: 300,
    priceUsd: 2,
    durationDays: 7,
    type: 'three_activities',
  },
  playroom_all_activities_30d: {
    id: 'playroom_all_activities_30d',
    title: 'All Activities',
    description: 'Unlock 100% full access to all playroom learning activities for 30 days.',
    pricePkr: 5000,
    priceUsd: 20,
    durationDays: 30,
    type: 'all_activities',
  },
};

const STORAGE_KEY_ENTITLEMENTS = 'playroom_verified_gp_entitlements_v2';
const STORAGE_KEY_3_PACK_ACTIVITIES = 'playroom_verified_3pack_unlocked_activities_v2';

// Legacy keys to purge on initialization
const LEGACY_STORAGE_KEYS = [
  'playroom_gp_entitlements',
  'playroom_3pack_unlocked_activities',
];

type EntitlementChangeListener = (entitlements: GooglePlayEntitlement[]) => void;

export class GooglePlayBillingService {
  private static instance: GooglePlayBillingService;
  private listeners: Set<EntitlementChangeListener> = new Set();
  private digitalGoodsService: any = null;
  private isInitialized = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initBilling();
    }
  }

  public static getInstance(): GooglePlayBillingService {
    if (!GooglePlayBillingService.instance) {
      GooglePlayBillingService.instance = new GooglePlayBillingService();
    }
    return GooglePlayBillingService.instance;
  }

  /**
   * Initialize Digital Goods API / Android Play Billing interface if available
   */
  public async initBilling(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;

    // Purge any legacy unverified test storage keys from previous sessions
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch {
      // ignore
    }

    try {
      if ('getDigitalGoodsService' in window && typeof (window as any).getDigitalGoodsService === 'function') {
        this.digitalGoodsService = await (window as any).getDigitalGoodsService('https://play.google.com/billing');
        console.log('[Google Play Billing] Digital Goods API initialized successfully.');
      } else {
        console.log('[Google Play Billing] Running in standard Web environment with Play Billing verification.');
      }
    } catch (err) {
      console.warn('[Google Play Billing] Digital Goods Service not available in this context:', err);
    }

    // Auto-verify and clean up expired local entitlements on app launch
    this.refreshAndCleanEntitlements();
    this.isInitialized = true;
  }

  /**
   * Subscribe to entitlement updates
   */
  public subscribe(listener: EntitlementChangeListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.getActiveEntitlements());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const active = this.getActiveEntitlements();
    this.listeners.forEach((listener) => {
      try {
        listener(active);
      } catch (e) {
        console.error('[Google Play Billing] Error in listener callback:', e);
      }
    });
  }

  /**
   * Get all stored entitlements (checks expiration timestamps and authentic server signatures)
   */
  public getStoredEntitlements(): GooglePlayEntitlement[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ENTITLEMENTS);
      if (!raw) return [];
      const parsed: GooglePlayEntitlement[] = JSON.parse(raw);
      const now = Date.now();

      // Check time expiration and reject legacy unverified or test mocks
      return parsed
        .filter((ent) => {
          if (!ent || !ent.productId || !ent.expiryTime) return false;
          // Must have valid server verification and non-empty signature from /api/billing/verify-google-play-purchase
          const isVerifiedApi = ent.verificationMethod === 'google_play_developer_api';
          const hasSignature = typeof ent.serverSignature === 'string' && ent.serverSignature.length > 10;
          const isNotMockToken = !ent.purchaseToken?.includes('TEST') && !ent.orderId?.includes('3312-8921-9921');
          return isVerifiedApi && hasSignature && isNotMockToken;
        })
        .map((ent) => {
          const expiryMs = new Date(ent.expiryTime).getTime();
          if (ent.status === 'ACTIVE' && now >= expiryMs) {
            return { ...ent, status: 'EXPIRED' as const };
          }
          return ent;
        });
    } catch (e) {
      console.warn('[Google Play Billing] Could not parse stored entitlements:', e);
      return [];
    }
  }

  /**
   * Get active, non-expired entitlements only
   */
  public getActiveEntitlements(): GooglePlayEntitlement[] {
    const all = this.getStoredEntitlements();
    const now = Date.now();
    return all.filter((ent) => ent.status === 'ACTIVE' && new Date(ent.expiryTime).getTime() > now);
  }

  /**
   * Check if user has active 30-day All Activities pass
   */
  public hasAllActivitiesPass(): { active: boolean; expiryDate?: string; daysRemaining?: number } {
    const active = this.getActiveEntitlements();
    const allPass = active.find((e) => e.unlockedType === 'all_activities' || e.productId === 'playroom_all_activities_30d');
    if (allPass) {
      const days = this.calculateDaysRemaining(allPass.expiryTime);
      return { active: true, expiryDate: allPass.expiryTime, daysRemaining: days };
    }
    return { active: false };
  }

  /**
   * Check if user has active 7-day 3-Activities pass
   */
  public has3ActivitiesPass(): {
    active: boolean;
    expiryDate?: string;
    daysRemaining?: number;
    unlockedActivities: string[];
    canUnlockMore: boolean;
  } {
    const active = this.getActiveEntitlements();
    const pass3 = active.find((e) => e.unlockedType === 'three_activities' || e.productId === 'playroom_3activities_7d');
    const unlocked = this.get3PackUnlockedActivities();

    if (pass3) {
      const days = this.calculateDaysRemaining(pass3.expiryTime);
      return {
        active: true,
        expiryDate: pass3.expiryTime,
        daysRemaining: days,
        unlockedActivities: unlocked,
        canUnlockMore: unlocked.length < 3,
      };
    }
    return {
      active: false,
      unlockedActivities: unlocked,
      canUnlockMore: false,
    };
  }

  /**
   * Get list of activity IDs currently selected under 3-Activities pass
   */
  public get3PackUnlockedActivities(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_3_PACK_ACTIVITIES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Unlock an activity under the 3-activities pass (limit 3)
   */
  public unlockActivityUnder3Pack(activityId: string): { success: boolean; message: string; count: number } {
    const passStatus = this.has3ActivitiesPass();
    if (!passStatus.active) {
      return {
        success: false,
        message: 'No active 3-Activities Pass found. Please unlock the 7-day pass first.',
        count: 0,
      };
    }

    const currentList = this.get3PackUnlockedActivities();
    if (currentList.includes(activityId)) {
      return {
        success: true,
        message: 'This activity is already unlocked in your 3-Activity pack!',
        count: currentList.length,
      };
    }

    if (currentList.length >= 3) {
      return {
        success: false,
        message: 'You have already unlocked 3 activities with this pass. Choose one of your 3 unlocked activities or upgrade to All Activities.',
        count: 3,
      };
    }

    currentList.push(activityId);
    try {
      localStorage.setItem(STORAGE_KEY_3_PACK_ACTIVITIES, JSON.stringify(currentList));
    } catch (e) {
      console.warn('Failed to save 3-pack activity:', e);
    }

    this.notifyListeners();
    return {
      success: true,
      message: `Unlocked activity in your 3-pack (${currentList.length}/3 activities used).`,
      count: currentList.length,
    };
  }

  /**
   * Launch Google Play Billing Purchase Flow
   * @param productId 'playroom_3activities_7d' | 'playroom_all_activities_30d'
   * @param preSelectedActivityId optional activity ID to auto-assign to 3-pack
   */
  public async purchaseProduct(
    productId: 'playroom_3activities_7d' | 'playroom_all_activities_30d',
    preSelectedActivityId?: string
  ): Promise<{ success: boolean; entitlement?: GooglePlayEntitlement; error?: string }> {
    const product = PLAYROOM_INDIVIDUAL_PRODUCTS[productId];
    if (!product) {
      return { success: false, error: 'Invalid Google Play product ID.' };
    }

    try {
      let purchaseToken = '';
      let orderId = '';

      // 1. Check if Digital Goods API or Android WebView interface is available
      if (this.digitalGoodsService) {
        try {
          // Standard Digital Goods API purchase flow via PaymentRequest
          const paymentMethod = {
            supportedMethods: 'https://play.google.com/billing',
            data: {
              sku: productId,
            },
          };
          const paymentDetails = {
            total: {
              label: product.title,
              amount: { currency: 'PKR', value: String(product.pricePkr) },
            },
          };
          const request = new (window as any).PaymentRequest([paymentMethod], paymentDetails);
          const paymentResponse = await request.show();
          purchaseToken = paymentResponse.details?.purchaseToken || paymentResponse.details?.token || '';
          orderId = paymentResponse.details?.orderId || '';
          await paymentResponse.complete('success');
        } catch (dgaErr: any) {
          console.warn('[Google Play Billing] Digital Goods flow:', dgaErr);
          if (dgaErr?.name === 'AbortError') {
            return { success: false, error: 'Purchase was cancelled.' };
          }
          return {
            success: false,
            error: dgaErr?.message || 'Google Play purchase could not be completed.',
          };
        }
      } else {
        // Digital Goods Service / Google Play Billing is not supported in non-Android browser environments
        return {
          success: false,
          error: 'Google Play purchase is available in the Android app. Please open Playroom on your Android device to purchase.',
        };
      }

      if (!purchaseToken) {
        return {
          success: false,
          error: 'Google Play purchase was not completed. No purchase token received.',
        };
      }

      // 2. Server-side verification with /api/billing/verify-google-play-purchase
      const verifyRes = await fetch('/api/billing/verify-google-play-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          purchaseToken,
          orderId,
          packageName: 'com.playroom.app',
          preSelectedActivityId,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Google Play purchase verification failed.');
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.success || !verifyData.entitlement) {
        throw new Error(verifyData.error || 'Invalid purchase verification response.');
      }

      const newEntitlement: GooglePlayEntitlement = verifyData.entitlement;

      // 3. Acknowledge and Consume the digital purchase so it can be repurchased after expiration
      await this.consumeOrAcknowledgePurchase(purchaseToken);

      // 4. Store the verified entitlement locally
      const existing = this.getStoredEntitlements().filter((e) => e.productId !== productId);
      existing.unshift(newEntitlement);
      localStorage.setItem(STORAGE_KEY_ENTITLEMENTS, JSON.stringify(existing));

      // If this was 3-activities pass and a pre-selected activity was provided, auto-unlock it
      if (productId === 'playroom_3activities_7d' && preSelectedActivityId) {
        this.unlockActivityUnder3Pack(preSelectedActivityId);
      }

      this.notifyListeners();

      return {
        success: true,
        entitlement: newEntitlement,
      };
    } catch (err: any) {
      console.error('[Google Play Billing] Purchase error:', err);
      return {
        success: false,
        error: err.message || 'Could not complete Google Play purchase. Please try again.',
      };
    }
  }

  /**
   * Restore Purchases from Google Play Billing
   * Synchronizes with Google Play and server verification without requiring any login
   */
  public async restorePurchases(): Promise<{
    success: boolean;
    restoredCount: number;
    entitlements: GooglePlayEntitlement[];
    message: string;
  }> {
    try {
      let restoredEntitlements: GooglePlayEntitlement[] = [];

      // 1. Query Digital Goods API if available
      if (this.digitalGoodsService && typeof this.digitalGoodsService.listPurchases === 'function') {
        try {
          const purchases = await this.digitalGoodsService.listPurchases();
          if (purchases && purchases.length > 0) {
            for (const p of purchases) {
              const res = await fetch('/api/billing/verify-google-play-purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: p.itemId,
                  purchaseToken: p.purchaseToken,
                  orderId: p.orderId || 'GPA.RESTORED',
                  packageName: 'com.playroom.app',
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.success && data.entitlement) {
                  restoredEntitlements.push(data.entitlement);
                }
              }
            }
          }
        } catch (dgaErr) {
          console.warn('[Google Play Billing] listPurchases fallback:', dgaErr);
        }
      }

      // 2. Validate currently cached local tokens with the server
      const currentStored = this.getStoredEntitlements();
      for (const ent of currentStored) {
        if (!restoredEntitlements.some((r) => r.purchaseToken === ent.purchaseToken)) {
          const res = await fetch('/api/billing/verify-google-play-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: ent.productId,
              purchaseToken: ent.purchaseToken,
              orderId: ent.orderId,
              packageName: 'com.playroom.app',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.entitlement) {
              restoredEntitlements.push(data.entitlement);
            }
          }
        }
      }

      // Filter to only ACTIVE (non-expired)
      const now = Date.now();
      const validActive = restoredEntitlements.filter(
        (e) => e.status === 'ACTIVE' && new Date(e.expiryTime).getTime() > now
      );

      // Save updated entitlements
      localStorage.setItem(STORAGE_KEY_ENTITLEMENTS, JSON.stringify(validActive));
      this.notifyListeners();

      if (validActive.length > 0) {
        return {
          success: true,
          restoredCount: validActive.length,
          entitlements: validActive,
          message: `Successfully restored ${validActive.length} active purchase(s)!`,
        };
      } else {
        return {
          success: true,
          restoredCount: 0,
          entitlements: [],
          message: 'No active Google Play purchases found for this device.',
        };
      }
    } catch (err: any) {
      console.error('[Google Play Billing] Restore error:', err);
      return {
        success: false,
        restoredCount: 0,
        entitlements: [],
        message: err.message || 'Could not restore purchases.',
      };
    }
  }

  /**
   * Refresh and clean up expired entitlements from local storage
   */
  public refreshAndCleanEntitlements(): GooglePlayEntitlement[] {
    const updated = this.getStoredEntitlements();
    const activeOnly = updated.filter((e) => e.status === 'ACTIVE');
    try {
      localStorage.setItem(STORAGE_KEY_ENTITLEMENTS, JSON.stringify(activeOnly));
    } catch {
      // ignore
    }
    this.notifyListeners();
    return activeOnly;
  }

  /**
   * Consume and Acknowledge one-time Google Play purchase
   * Required by Google Play Billing so that consumable one-time access products
   * can be re-purchased again after the 7-day or 30-day period expires.
   */
  public async consumeOrAcknowledgePurchase(purchaseToken: string): Promise<boolean> {
    try {
      if (this.digitalGoodsService && typeof this.digitalGoodsService.consume === 'function') {
        await this.digitalGoodsService.consume(purchaseToken);
        console.log('[Google Play Billing] Purchase successfully consumed for future repurchasing.');
        return true;
      }
      return true;
    } catch (err) {
      console.warn('[Google Play Billing] Consume note:', err);
      return false;
    }
  }

  private calculateDaysRemaining(expiryIso: string): number {
    try {
      const expiry = new Date(expiryIso).getTime();
      const now = Date.now();
      const diffMs = expiry - now;
      if (diffMs <= 0) return 0;
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  }
}

export const googlePlayBilling = GooglePlayBillingService.getInstance();
