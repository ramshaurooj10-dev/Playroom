import { BasePaymentProvider, ProviderPaymentResult } from './BasePaymentProvider';
import {
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  PremiumOrder,
} from '../../../types/payment';

/**
 * Bank Transfer Payment Provider
 * Direct online banking, ATM, or IBAN wire transfer.
 * Explicitly does not simulate automated verification; payments remain PENDING until audited by Admin.
 */
export class BankTransferProvider extends BasePaymentProvider {
  readonly method: PaymentMethod = 'bank_transfer';
  readonly provider: PaymentProvider = 'bank_transfer';
  readonly displayName: string = 'Commercial Bank Transfer (IBAN)';
  readonly supportedCurrencies: ('PKR' | 'USD')[] = ['PKR', 'USD'];

  isAutomatedVerificationSupported(): boolean {
    return false; // Strictly manual admin audit / statement reconciliation
  }

  async processPayment(
    order: PremiumOrder,
    transactionReference: string,
    proofName?: string,
    proofUrl?: string,
    extraMetadata?: Record<string, any>
  ): Promise<ProviderPaymentResult> {
    const paymentRecord: PaymentRecord = {
      id: 'pay_bank_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      orderId: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      productId: order.productId,
      selectedLevel: order.selectedLevel,
      amount: order.totalAmount,
      currency: order.currency,
      paymentMethod: 'bank_transfer',
      provider: 'bank_transfer',
      providerTransactionId: transactionReference.trim(),
      paymentStatus: 'PENDING', // NEVER automatically marked as paid
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
        'Bank transfer reference submitted. Status remains PENDING and access is LOCKED until the payment is audited against bank records.',
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
      error: 'Bank transfer does not support automated webhooks. Manual verification required.',
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
      rawResponse: { message: 'Bank transfer requires manual review in Admin Panel.' },
    };
  }
}
