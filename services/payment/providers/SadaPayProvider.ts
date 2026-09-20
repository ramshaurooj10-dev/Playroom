import { BasePaymentProvider, ProviderPaymentResult } from './BasePaymentProvider';
import {
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  PremiumOrder,
} from '../../../types/payment';

/**
 * SadaPay Payment Provider
 * Dedicated payment provider for Pakistan (PKR).
 * Status: NOT CONFIGURED (Awaiting official SadaPay merchant/API integration credentials).
 * Payments submitted through SadaPay remain strictly PENDING until verified.
 */
export class SadaPayProvider extends BasePaymentProvider {
  readonly method: PaymentMethod = 'sadapay';
  readonly provider: PaymentProvider = 'sadapay';
  readonly displayName: string = 'SadaPay';
  readonly supportedCurrencies: ('PKR' | 'USD')[] = ['PKR'];

  /**
   * SadaPay automated API verification is currently NOT CONFIGURED.
   * Returns false to ensure no fake verifications occur.
   */
  isAutomatedVerificationSupported(): boolean {
    return false;
  }

  async processPayment(
    order: PremiumOrder,
    transactionReference: string,
    proofName?: string,
    proofUrl?: string,
    extraMetadata?: Record<string, any>
  ): Promise<ProviderPaymentResult> {
    const paymentRecord: PaymentRecord = {
      id: 'pay_sada_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      orderId: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      productId: order.productId,
      selectedLevel: order.selectedLevel,
      amount: order.totalAmount,
      currency: 'PKR',
      paymentMethod: 'sadapay',
      provider: 'sadapay',
      providerTransactionId: transactionReference.trim(),
      paymentStatus: 'PENDING', // Strictly PENDING until genuine verification
      paymentProofName: proofName,
      paymentProofUrl: proofUrl,
      paymentMetadata: {
        ...extraMetadata,
        providerChannel: 'SadaPay Wallet / Transfer',
        verificationMode: 'manual_admin_audit_required',
        gatewayStatus: 'NOT_CONFIGURED',
      },
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      status: 'PENDING',
      paymentRecord,
      isAutomatedVerified: false,
      message:
        'SadaPay payment reference submitted. Status remains PENDING and access is LOCKED until officially verified.',
    };
  }

  async verifyWebhook(): Promise<{
    verified: boolean;
    transactionId?: string;
    status?: PaymentStatus;
    error?: string;
  }> {
    return {
      verified: false,
      error: 'SadaPay gateway integration is not configured yet. Awaiting official credentials.',
    };
  }

  async checkTransactionStatus(): Promise<{
    status: PaymentStatus;
    verified: boolean;
    rawResponse?: any;
  }> {
    return {
      status: 'PENDING',
      verified: false,
      rawResponse: { message: 'SadaPay status: NOT CONFIGURED. Pending official integration.' },
    };
  }
}
