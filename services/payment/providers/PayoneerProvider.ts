import { BasePaymentProvider, ProviderPaymentResult } from './BasePaymentProvider';
import {
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  PremiumOrder,
} from '../../../types/payment';

/**
 * Payoneer Payment Provider
 * Dedicated to International USD transactions.
 * Prepares real Payoneer Checkout API / IPN Webhook hooks.
 * Manual payments remain PENDING until verified.
 */
export class PayoneerProvider extends BasePaymentProvider {
  readonly method: PaymentMethod = 'payoneer';
  readonly provider: PaymentProvider = 'payoneer';
  readonly displayName: string = 'Payoneer (International USD)';
  readonly supportedCurrencies: ('PKR' | 'USD')[] = ['USD'];

  isAutomatedVerificationSupported(): boolean {
    return false; // Returns true when PAYONEER_API_SECRET is configured
  }

  async processPayment(
    order: PremiumOrder,
    transactionReference: string,
    proofName?: string,
    proofUrl?: string,
    extraMetadata?: Record<string, any>
  ): Promise<ProviderPaymentResult> {
    const paymentRecord: PaymentRecord = {
      id: 'pay_payo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      orderId: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      productId: order.productId,
      selectedLevel: order.selectedLevel,
      amount: order.totalAmount,
      currency: 'USD',
      paymentMethod: 'payoneer',
      provider: 'payoneer',
      providerTransactionId: transactionReference.trim(),
      paymentStatus: 'PENDING', // STRICTLY PENDING
      paymentProofName: proofName,
      paymentProofUrl: proofUrl,
      paymentMetadata: {
        ...extraMetadata,
        verificationMode: 'manual_admin_audit_required',
      },
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      status: 'PENDING',
      paymentRecord,
      isAutomatedVerified: false,
      message:
        'Payoneer payment reference submitted. Status remains PENDING until verified by School Administration or official Payoneer IPN.',
    };
  }

  async verifyWebhook(
    payload: any,
    signatureHeader?: string
  ): Promise<{ verified: boolean; transactionId?: string; status?: PaymentStatus; error?: string }> {
    if (!payload || !signatureHeader) {
      return { verified: false, error: 'Missing Payoneer webhook signature or body.' };
    }
    return { verified: false, error: 'Real Payoneer API credentials not yet activated.' };
  }

  async checkTransactionStatus(
    transactionId: string
  ): Promise<{ status: PaymentStatus; verified: boolean; rawResponse?: any }> {
    return {
      status: 'PENDING',
      verified: false,
      rawResponse: { message: 'Pending official Payoneer API configuration' },
    };
  }
}
