import {
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  PremiumOrder,
} from '../../../types/payment';

export interface ProviderPaymentResult {
  success: boolean;
  status: PaymentStatus;
  paymentRecord: PaymentRecord;
  requiresRedirect?: boolean;
  redirectUrl?: string;
  isAutomatedVerified: boolean;
  message: string;
  error?: string;
}

export abstract class BasePaymentProvider {
  abstract readonly method: PaymentMethod;
  abstract readonly provider: PaymentProvider;
  abstract readonly displayName: string;
  abstract readonly supportedCurrencies: ('PKR' | 'USD')[];

  /**
   * Check if automated gateway API / webhook verification is currently active
   */
  abstract isAutomatedVerificationSupported(): boolean;

  /**
   * Process a payment submission or checkout initiation
   */
  abstract processPayment(
    order: PremiumOrder,
    transactionReference: string,
    proofName?: string,
    proofUrl?: string,
    extraMetadata?: Record<string, any>
  ): Promise<ProviderPaymentResult>;

  /**
   * Verify an incoming webhook from the payment provider (Server-side)
   */
  abstract verifyWebhook(
    payload: any,
    signatureHeader?: string
  ): Promise<{ verified: boolean; transactionId?: string; status?: PaymentStatus; error?: string }>;

  /**
   * Query status directly from payment provider API (Server-side)
   */
  abstract checkTransactionStatus(
    transactionId: string
  ): Promise<{ status: PaymentStatus; verified: boolean; rawResponse?: any }>;
}
