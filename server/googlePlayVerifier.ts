import { google } from 'googleapis';
import crypto from 'crypto';

export const APP_PACKAGE_NAME = 'com.playroom.app';

export const ALLOWED_PRODUCT_IDS = [
  'playroom_3activities_7d',
  'playroom_all_activities_30d',
] as const;

export type AllowedProductId = typeof ALLOWED_PRODUCT_IDS[number];

export interface GooglePlayVerificationResult {
  verified: boolean;
  error?: string;
  orderId?: string;
  purchaseTimeMillis?: string | number;
  purchaseState?: number; // 0 = Purchased, 1 = Canceled, 2 = Pending
  consumptionState?: number; // 0 = Yet to be consumed, 1 = Consumed
  acknowledgementState?: number; // 0 = Yet to be acknowledged, 1 = Acknowledged
  developerPayload?: string;
  kind?: string;
  verificationMethod: 'google_play_developer_api' | 'development_mock_mode';
}

export interface VerifiedEntitlementPayload {
  productId: AllowedProductId;
  orderId: string;
  purchaseToken: string;
  packageName: string;
  purchaseTime: string;
  expiryTime: string;
  durationDays: number;
  unlockedType: 'three_activities' | 'all_activities';
  pricePaidPkr: number;
  status: 'ACTIVE' | 'EXPIRED';
  verificationSource: string;
  serverSignature: string;
}

// Internal server signing key (stays in server memory only, never sent to client)
const SERVER_HMAC_SECRET = process.env.PLAYROOM_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Parses and loads the Google Play Developer Service Account credentials from environment.
 * Supports:
 * - Direct JSON string
 * - Base64 encoded JSON string
 * NEVER exposed to client or frontend bundles.
 */
function getGooglePlayServiceAccountCredentials(): any | null {
  const rawEnv = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!rawEnv || !rawEnv.trim()) {
    return null;
  }

  try {
    const trimmed = rawEnv.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return JSON.parse(trimmed);
    }
    // Try base64 decoding
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (decoded.startsWith('{') && decoded.endsWith('}')) {
      return JSON.parse(decoded);
    }
  } catch (err) {
    console.error('[Google Play Verifier] Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:', err);
  }
  return null;
}

/**
 * Creates an authenticated Google Android Publisher API client using the service account.
 */
function getAndroidPublisherClient() {
  const credentials = getGooglePlayServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  try {
    const auth = google.auth.fromJSON(credentials);
    if ('scopes' in auth || typeof (auth as any).setScopes === 'function') {
      (auth as any).scopes = ['https://www.googleapis.com/auth/androidpublisher'];
    }

    return google.androidpublisher({
      version: 'v3',
      auth: auth as any,
    });
  } catch (err) {
    console.error('[Google Play Verifier] Could not initialize Android Publisher client:', err);
    return null;
  }
}

/**
 * Verifies a purchase token with the Google Play Developer API (androidpublisher v3).
 */
export async function verifyPurchaseTokenWithGoogle(
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<GooglePlayVerificationResult> {
  // 1. Validate Package Name
  if (packageName !== APP_PACKAGE_NAME) {
    return {
      verified: false,
      error: `Invalid package name '${packageName}'. Expected '${APP_PACKAGE_NAME}'.`,
      verificationMethod: 'google_play_developer_api',
    };
  }

  // 2. Validate Product ID
  if (!ALLOWED_PRODUCT_IDS.includes(productId as any)) {
    return {
      verified: false,
      error: `Invalid product ID '${productId}'. Expected one of: ${ALLOWED_PRODUCT_IDS.join(', ')}.`,
      verificationMethod: 'google_play_developer_api',
    };
  }

  // 3. Check for Service Account Client
  const publisher = getAndroidPublisherClient();

  if (!publisher) {
    return {
      verified: false,
      error: 'Google Play Developer Service Account credentials (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) are not configured on the backend. Purchases cannot be verified without Google Play API credentials.',
      verificationMethod: 'google_play_developer_api',
    };
  }

  try {
    console.log(`[Google Play Verifier] Contacting Google Play Developer API for product ${productId}...`);
    
    const response = await publisher.purchases.products.get({
      packageName: APP_PACKAGE_NAME,
      productId,
      token: purchaseToken,
    });

    const data = response.data;
    console.log('[Google Play Verifier] Google Play API Response received:', {
      purchaseState: data.purchaseState,
      consumptionState: data.consumptionState,
      acknowledgementState: data.acknowledgementState,
      orderId: data.orderId,
    });

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (data.purchaseState !== 0) {
      const stateLabels = ['Purchased', 'Canceled', 'Pending'];
      const stateStr = stateLabels[data.purchaseState ?? -1] || `Unknown (${data.purchaseState})`;
      return {
        verified: false,
        error: `Purchase is not in a completed state (Google Play Status: ${stateStr}).`,
        purchaseState: data.purchaseState ?? undefined,
        orderId: data.orderId ?? undefined,
        verificationMethod: 'google_play_developer_api',
      };
    }

    return {
      verified: true,
      orderId: data.orderId || `GPA.${Date.now()}`,
      purchaseTimeMillis: data.purchaseTimeMillis || Date.now(),
      purchaseState: data.purchaseState ?? 0,
      consumptionState: data.consumptionState ?? 0,
      acknowledgementState: data.acknowledgementState ?? 0,
      developerPayload: data.developerPayload ?? undefined,
      kind: data.kind ?? undefined,
      verificationMethod: 'google_play_developer_api',
    };
  } catch (apiError: any) {
    console.error('[Google Play Verifier] Google Play Developer API error:', apiError?.message || apiError);
    
    // Detailed error response from Google API
    const errMsg = apiError?.response?.data?.error?.message || apiError?.message || 'Google Play purchase verification failed.';
    return {
      verified: false,
      error: `Google Play Developer API verification failed: ${errMsg}`,
      verificationMethod: 'google_play_developer_api',
    };
  }
}

/**
 * Calculates entitlement duration and signs the entitlement payload cryptographically.
 */
export function generateVerifiedEntitlement(
  productId: AllowedProductId,
  purchaseToken: string,
  googleResult: GooglePlayVerificationResult
): VerifiedEntitlementPayload {
  const is3Activities = productId === 'playroom_3activities_7d';
  const durationDays = is3Activities ? 7 : 30;
  const pricePaidPkr = is3Activities ? 300 : 5000;
  const unlockedType: 'three_activities' | 'all_activities' = is3Activities ? 'three_activities' : 'all_activities';

  const purchaseDate = googleResult.purchaseTimeMillis
    ? new Date(Number(googleResult.purchaseTimeMillis))
    : new Date();

  const purchaseTime = purchaseDate.toISOString();
  const expiryDate = new Date(purchaseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const expiryTime = expiryDate.toISOString();
  const orderId = googleResult.orderId || `GPA.${Date.now()}`;

  // Generate server HMAC signature over the exact entitlement fields
  const signaturePayload = `${APP_PACKAGE_NAME}:${productId}:${orderId}:${purchaseToken}:${expiryTime}`;
  const serverSignature = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(signaturePayload)
    .digest('hex');

  return {
    productId,
    orderId,
    purchaseToken,
    packageName: APP_PACKAGE_NAME,
    purchaseTime,
    expiryTime,
    durationDays,
    unlockedType,
    pricePaidPkr,
    status: 'ACTIVE',
    verificationSource: googleResult.verificationMethod,
    serverSignature,
  };
}

/**
 * Validates a server-generated entitlement signature to ensure client has not tampered with expiry or product.
 */
export function verifyEntitlementSignature(entitlement: VerifiedEntitlementPayload): boolean {
  try {
    const signaturePayload = `${APP_PACKAGE_NAME}:${entitlement.productId}:${entitlement.orderId}:${entitlement.purchaseToken}:${entitlement.expiryTime}`;
    const expectedSignature = crypto
      .createHmac('sha256', SERVER_HMAC_SECRET)
      .update(signaturePayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(entitlement.serverSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}
