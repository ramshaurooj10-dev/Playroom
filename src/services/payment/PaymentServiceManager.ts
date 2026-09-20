import {
  Currency,
  DisputeStatus,
  NotificationRecord,
  PaymentIssue,
  PaymentMethod,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  PremiumOrder,
  ProductType,
  ProviderConfig,
  SchoolDeviceRecord,
  SchoolLicense,
  SchoolPaymentRequest,
  UserLicense,
} from '../../types/payment';
import { getProductById, PREMIUM_PRODUCTS, fetchProductsFromSupabase } from './products';
import { TEMPORARY_DEMO_UNLOCK_ALL } from '../../utils/licenseService';
import { generateSchoolLicenseKey } from '../../utils/licenseKeyGenerator';
import { BasePaymentProvider } from './providers/BasePaymentProvider';
import { SadaPayProvider } from './providers/SadaPayProvider';
import { BankTransferProvider } from './providers/BankTransferProvider';
import { PayoneerProvider } from './providers/PayoneerProvider';
import { getSupabaseClient } from '../../utils/supabaseClient';
import { googlePlayBilling } from '../billing/GooglePlayBillingService';
import { generateUUID, isValidUUID } from '../../utils/uuid';
import { validateSchoolInquiryField } from '../../utils/inquiryValidation';

const STORAGE_ORDERS_KEY = 'playroom_db_orders';
const STORAGE_PAYMENTS_KEY = 'playroom_db_payments';
const STORAGE_LICENSES_KEY = 'playroom_db_licenses';
const STORAGE_SCHOOL_LICENSES_KEY = 'playroom_db_school_licenses';
export const STORAGE_ACTIVE_SCHOOL_LICENSE_KEY = 'playroom_active_school_license';
const STORAGE_SCHOOL_REQUESTS_KEY = 'playroom_db_school_requests';
const STORAGE_SCHOOL_DEVICES_KEY = 'playroom_db_school_devices';
const STORAGE_DISPUTES_KEY = 'playroom_db_disputes';
const STORAGE_NOTIFICATIONS_KEY = 'playroom_db_notifications';

export class PaymentServiceManager {
  private static instance: PaymentServiceManager;
  private providers: Map<PaymentProvider, BasePaymentProvider> = new Map();

  private constructor() {
    this.registerProvider(new SadaPayProvider());
    this.registerProvider(new BankTransferProvider());
    this.registerProvider(new PayoneerProvider());
    // Load products from Supabase dynamically on boot
    fetchProductsFromSupabase().catch(() => {});
  }

  public static getInstance(): PaymentServiceManager {
    if (!PaymentServiceManager.instance) {
      PaymentServiceManager.instance = new PaymentServiceManager();
    }
    return PaymentServiceManager.instance;
  }

  public registerProvider(provider: BasePaymentProvider) {
    this.providers.set(provider.provider, provider);
  }

  public getProvider(provider: PaymentProvider): BasePaymentProvider | undefined {
    return this.providers.get(provider);
  }

  /**
   * Helper: Add user notification
   */
  public async addNotification(
    userId: string,
    userEmail: string,
    type: 'PAYMENT_PENDING' | 'PAYMENT_APPROVED' | 'PAYMENT_REJECTED' | 'LICENSE_EXPIRING' | 'LICENSE_EXPIRED' | 'GENERAL',
    title: string,
    message: string
  ): Promise<NotificationRecord> {
    const notif: NotificationRecord = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      userEmail,
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Save locally
    try {
      const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
      const list: NotificationRecord[] = raw ? JSON.parse(raw) : [];
      list.unshift(notif);
      localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Notification local store error:', e);
    }

    // Sync Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('notifications').insert([
          {
            id: notif.id,
            user_id: notif.userId,
            user_email: notif.userEmail,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            read: notif.read,
            created_at: notif.createdAt,
          },
        ]);
      } catch (e) {
        console.warn('Supabase notifications insert error:', e);
      }
    }

    return notif;
  }

  /**
   * 1. Create a Premium Order
   */
  public async createOrder(
    userId: string,
    userEmail: string,
    productId: string,
    currency: Currency,
    selectedLevel?: number
  ): Promise<PremiumOrder> {
    const product = getProductById(productId);
    const amount = currency === 'PKR' ? (product ? product.pricePkr : 800) : product ? product.priceUsd : 5;

    const order: PremiumOrder = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      userEmail: userEmail.toLowerCase().trim(),
      productId,
      productType: product ? product.type : 'one_level',
      selectedLevel: selectedLevel || undefined,
      totalAmount: amount,
      currency,
      region: currency === 'PKR' ? 'pakistan' : 'international',
      orderStatus: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    // Save locally
    const orders = this.getAllOrdersLocal();
    orders.unshift(order);
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders));

    // Sync to Supabase orders table
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('orders').insert([
          {
            id: order.id,
            user_id: order.userId,
            user_email: order.userEmail,
            product_id: order.productId,
            amount: order.totalAmount,
            currency: order.currency,
            region: order.region,
            payment_method: 'manual',
            status: order.orderStatus,
            created_at: order.createdAt,
          },
        ]);
      } catch (e) {
        console.warn('Supabase orders sync error:', e);
      }
    }

    return order;
  }

  /**
   * 2. Submit a Payment for an Order
   * CRITICAL: Always saves as PENDING unless verified by trusted server webhook.
   */
  public async submitPayment(
    order: PremiumOrder,
    method: PaymentMethod,
    transactionReference: string,
    proofName?: string,
    proofUrl?: string
  ): Promise<PaymentRecord> {
    const provider = this.providers.get(method as PaymentProvider);
    if (!provider) {
      throw new Error(`Unsupported payment method: ${method}`);
    }

    const result = await provider.processPayment(order, transactionReference, proofName, proofUrl);
    const payment = result.paymentRecord;

    // Save locally
    const payments = this.getAllPaymentsLocal();
    payments.unshift(payment);
    localStorage.setItem(STORAGE_PAYMENTS_KEY, JSON.stringify(payments));

    // Send to Backend API
    try {
      await fetch('/api/payment/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          userEmail: payment.userEmail,
          productId: payment.productId,
          selectedLevel: payment.selectedLevel,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          provider: payment.provider,
          transactionId: payment.providerTransactionId,
          paymentProofName: payment.paymentProofName,
          paymentProofUrl: payment.paymentProofUrl,
          paymentStatus: payment.paymentStatus,
        }),
      });
    } catch (e) {
      console.warn('Backend payment submit-request fallback:', e);
    }

    // Sync to Supabase payments table
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('payments').insert([
          {
            id: payment.id,
            order_id: payment.orderId || null,
            user_id: payment.userId,
            user_email: payment.userEmail,
            product_id: payment.productId,
            amount: payment.amount,
            currency: payment.currency,
            payment_method: payment.paymentMethod,
            provider_transaction_id: payment.providerTransactionId,
            payment_status: payment.paymentStatus,
            payment_proof_name: payment.paymentProofName || null,
            payment_proof_url: payment.paymentProofUrl || null,
            created_at: payment.createdAt,
          },
        ]);
      } catch (e) {
        console.warn('Supabase payments sync error:', e);
      }
    }

    // Create Notification: Payment Approval Pending
    await this.addNotification(
      payment.userId,
      payment.userEmail,
      'PAYMENT_PENDING',
      'Payment Approval Pending',
      'Your payment request has been received. Our team will verify and activate your 1-Month Premium access shortly.'
    );

    return payment;
  }

  /**
   * 3. Admin Verification: Audits payment & activates 1-Month License
   */
  public async adminVerifyPayment(
    paymentId: string,
    decision: 'VERIFY' | 'REJECT',
    adminNotes?: string,
    adminEmail: string = 'school-admin@playroom-learning.edu'
  ): Promise<{ success: boolean; license?: UserLicense; error?: string }> {
    const payments = this.getAllPaymentsLocal();
    const paymentIndex = payments.findIndex((p) => p.id === paymentId);
    if (paymentIndex === -1) {
      return { success: false, error: 'Payment not found' };
    }

    const payment = payments[paymentIndex];
    const now = new Date();

    if (decision === 'VERIFY') {
      payment.paymentStatus = 'VERIFIED';
      payment.verifiedAt = now.toISOString();
      payment.verifiedBy = adminEmail;
      payment.adminNotes = adminNotes;

      // Calculate strictly 1 Month Expiry
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + 1);
      payment.expiryDate = expiry.toISOString();

      // Create License
      const licenseType =
        payment.productId.includes('all') || !payment.selectedLevel
          ? 'all_activities'
          : 'one_level';

      const license: UserLicense = {
        id: 'lic_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        userId: payment.userId,
        userEmail: payment.userEmail,
        licenseType,
        unlockedLevels:
          licenseType === 'all_activities'
            ? [1, 2, 3, 4, 5, 6]
            : payment.selectedLevel
            ? [payment.selectedLevel]
            : [2],
        allActivitiesUnlocked: licenseType === 'all_activities',
        paymentId: payment.id,
        startDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
        status: 'ACTIVE',
        verificationType: 'ADMIN_VERIFIED',
        verifiedBy: adminEmail,
        pricePaid: payment.amount,
        currency: payment.currency,
        createdAt: now.toISOString(),
      };

      // Save updated payments and licenses locally
      payments[paymentIndex] = payment;
      localStorage.setItem(STORAGE_PAYMENTS_KEY, JSON.stringify(payments));

      // Also sync with playroom_payment_requests
      try {
        const rawReqs = localStorage.getItem('playroom_payment_requests');
        if (rawReqs) {
          const reqList = JSON.parse(rawReqs);
          const reqIdx = reqList.findIndex((r: any) => r.id === payment.id || r.transactionId === payment.providerTransactionId);
          if (reqIdx !== -1) {
            reqList[reqIdx].status = 'APPROVED';
            reqList[reqIdx].isVerified = true;
            reqList[reqIdx].reviewedAt = now.toISOString();
            reqList[reqIdx].verifiedBy = adminEmail;
            localStorage.setItem('playroom_payment_requests', JSON.stringify(reqList));
          }
        }
      } catch (e) {
        console.warn('Sync playroom_payment_requests error:', e);
      }

      const licenses = this.getAllLicensesLocal();
      licenses.unshift(license);
      localStorage.setItem(STORAGE_LICENSES_KEY, JSON.stringify(licenses));

      // Also sync to playroom_user_licenses
      try {
        const rawLic = localStorage.getItem('playroom_user_licenses');
        const licList = rawLic ? JSON.parse(rawLic) : [];
        licList.unshift({
          id: license.id,
          userId: license.userId,
          userEmail: license.userEmail,
          licenseType: license.licenseType,
          unlockedLevels: license.unlockedLevels,
          allActivitiesUnlocked: license.allActivitiesUnlocked,
          purchaseDate: license.startDate,
          expiryDate: license.expiryDate,
          status: 'ACTIVE',
          verificationType: 'ADMIN_VERIFIED',
          pricePaid: license.pricePaid,
          currency: license.currency,
          paymentRequestId: license.paymentId,
        });
        localStorage.setItem('playroom_user_licenses', JSON.stringify(licList));
      } catch (e) {
        console.warn('Sync playroom_user_licenses error:', e);
      }

      // Call backend API
      try {
        await fetch('/api/payment/admin-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: payment.id,
            decision: 'APPROVE',
            adminNotes,
            adminEmail,
            userEmail: payment.userEmail,
            purchaseType: licenseType,
            targetLevel: payment.selectedLevel,
            amount: payment.amount,
            currency: payment.currency,
          }),
        });
      } catch (e) {
        console.warn('Backend admin-verify call:', e);
      }

      // Sync Supabase payments and user_licenses tables
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('payments')
            .update({
              payment_status: 'VERIFIED',
              verified_at: payment.verifiedAt,
              verified_by: payment.verifiedBy,
              admin_notes: adminNotes || null,
            })
            .eq('id', payment.id);

          await supabase.from('user_licenses').insert([
            {
              id: license.id,
              user_id: license.userId,
              user_email: license.userEmail,
              product_id: payment.productId || (licenseType === 'all_activities' ? 'all_activities' : `level_${payment.selectedLevel || 2}`),
              level: payment.selectedLevel || null,
              all_activities_unlocked: license.allActivitiesUnlocked,
              start_date: license.startDate,
              expiry_date: license.expiryDate,
              status: license.status,
              payment_id: license.paymentId,
              created_at: license.createdAt,
            },
          ]);
        } catch (e) {
          console.warn('Supabase license activation sync:', e);
        }
      }

      // Create Notification: Payment Approved
      await this.addNotification(
        payment.userId,
        payment.userEmail,
        'PAYMENT_APPROVED',
        'Payment Approved',
        'Payment Approved — Your 1-Month Premium Access is now active!'
      );

      return { success: true, license };
    } else {
      // REJECT
      payment.paymentStatus = 'REJECTED';
      payment.verifiedAt = now.toISOString();
      payment.verifiedBy = adminEmail;
      payment.adminNotes = adminNotes || 'PAYMENT NOT RECEIVED';
      payments[paymentIndex] = payment;
      localStorage.setItem(STORAGE_PAYMENTS_KEY, JSON.stringify(payments));

      // Also sync rejection to playroom_payment_requests
      try {
        const rawReqs = localStorage.getItem('playroom_payment_requests');
        if (rawReqs) {
          const reqList = JSON.parse(rawReqs);
          const reqIdx = reqList.findIndex((r: any) => r.id === payment.id || r.transactionId === payment.providerTransactionId);
          if (reqIdx !== -1) {
            reqList[reqIdx].status = 'REJECTED';
            reqList[reqIdx].isVerified = false;
            reqList[reqIdx].reviewedAt = now.toISOString();
            reqList[reqIdx].adminNotes = payment.adminNotes;
            localStorage.setItem('playroom_payment_requests', JSON.stringify(reqList));
          }
        }
      } catch (e) {
        console.warn('Sync reject playroom_payment_requests error:', e);
      }

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('payments')
            .update({
              payment_status: 'REJECTED',
              verified_at: payment.verifiedAt,
              verified_by: payment.verifiedBy,
              admin_notes: payment.adminNotes,
            })
            .eq('id', payment.id);
        } catch (e) {
          console.warn('Supabase reject payment sync:', e);
        }
      }

      // Create Notification: Payment Rejected
      await this.addNotification(
        payment.userId,
        payment.userEmail,
        'PAYMENT_REJECTED',
        'Payment Not Verified',
        'Your payment could not be verified (PAYMENT NOT RECEIVED). Premium access remains locked.'
      );

      return { success: true };
    }
  }

  /**
   * Generates a unique school license key and verifies against Supabase.
   */
  public async generateUniqueLicenseKey(): Promise<string> {
    let key = generateSchoolLicenseKey();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 5) {
          attempts++;
          const { data } = await supabase
            .from('school_licenses')
            .select('id')
            .eq('license_key', key)
            .maybeSingle();
          if (!data) {
            isUnique = true;
          } else {
            key = generateSchoolLicenseKey();
          }
        }
      } catch {
        // Continue with generated key
      }
    }
    return key;
  }

  /**
   * 4. School License Management (Admin Manual Verification & Issuance - STRICTLY 1 MONTH)
   */
  public async createSchoolLicense(params: {
    id?: string;
    schoolName: string;
    schoolAdminName?: string;
    contactName?: string;
    contactEmail: string;
    country?: string;
    city?: string;
    price: number;
    currency: Currency;
    allowedDevices?: number;
    durationMonths?: number;
    page1Access?: boolean;
    page2Access?: boolean;
    adminNotes?: string;
    verifiedBy?: string;
    createdBy?: string;
    licenseKey?: string;
    schoolId?: string;
  }): Promise<SchoolLicense> {
    const now = new Date();
    const schoolId = (params.schoolId && isValidUUID(params.schoolId)) ? params.schoolId : generateUUID();
    const generatedKey = params.licenseKey || await this.generateUniqueLicenseKey();
    const adminUser = params.createdBy || params.verifiedBy || 'school-admin@playroom-learning.edu';
    const licenseId = (params.id && isValidUUID(params.id)) ? params.id : generateUUID();

    // The intended creation state is strictly PENDING with NULL validity dates until activated by school
    const schoolLicense: SchoolLicense = {
      id: licenseId,
      licenseKey: generatedKey,
      schoolId,
      schoolName: params.schoolName,
      schoolAdminName: params.schoolAdminName || params.contactName || 'School Administrator',
      contactName: params.contactName || params.schoolAdminName || 'School Administrator',
      contactEmail: params.contactEmail.toLowerCase().trim(),
      country: params.country || 'Pakistan',
      city: params.city || 'Karachi',
      price: params.price,
      currency: params.currency,
      allowedDevices: 999999, // Unlimited devices for schools
      page1Access: true,      // Full App Access
      page2Access: true,      // Full Education Hub Access
      startDate: null,
      expiryDate: null,
      validFrom: null,
      validUntil: null,
      status: 'PENDING',
      durationMonths: 1,
      durationDays: 30,
      createdBy: adminUser,
      verifiedBy: adminUser,
      adminNotes: params.adminNotes,
      createdAt: now.toISOString(),
    };

    // Save locally
    const list = this.getAllSchoolLicensesLocal();
    list.unshift(schoolLicense);
    localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(list));

    // Call Backend API
    try {
      await fetch('/api/payment/school-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...schoolLicense,
          schoolId: schoolLicense.schoolId,
          licenseKey: schoolLicense.licenseKey,
          validFrom: null,
          validUntil: null,
          status: 'PENDING',
          createdBy: adminUser,
        }),
      });
    } catch (e) {
      console.warn('Backend school license fallback to local/supabase:', e);
    }

    // Sync to Supabase schools & school_licenses
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('schools').upsert([
          {
            id: schoolLicense.schoolId,
            school_name: schoolLicense.schoolName,
            school_admin_name: schoolLicense.schoolAdminName,
            contact_name: schoolLicense.contactName,
            contact_email: schoolLicense.contactEmail,
            status: 'ACTIVE',
            account_status: 'active',
            payment_status: 'paid',
            created_at: now.toISOString(),
          },
        ], { onConflict: 'id' });

        await supabase.from('school_licenses').insert([
          {
            id: schoolLicense.id,
            school_id: schoolLicense.schoolId,
            license_key: schoolLicense.licenseKey,
            status: 'PENDING',
            valid_from: null,
            valid_until: null,
            start_date: null,
            expiry_date: null,
            created_by: adminUser,
            school_name: schoolLicense.schoolName,
            contact_email: schoolLicense.contactEmail,
            allowed_devices: 999999,
            page1_access: true,
            page2_access: true,
            price: schoolLicense.price,
            currency: schoolLicense.currency,
            duration_months: 1,
            verified_by: adminUser,
            admin_notes: schoolLicense.adminNotes,
            created_at: schoolLicense.createdAt,
          },
        ]);
      } catch (e) {
        console.warn('Supabase school license insert error:', e);
      }
    }

    return schoolLicense;
  }

  /**
   * Delete a School License manually (Requires explicit confirmation).
   * Does NOT auto-delete or cascade-delete schools / payment requests.
   */
  public async deleteSchoolLicense(
    licenseIdOrKey: string
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getAllSchoolLicensesLocal();
    const filtered = list.filter(
      (l) => l.id !== licenseIdOrKey && (!l.licenseKey || l.licenseKey.toLowerCase() !== licenseIdOrKey.toLowerCase())
    );
    localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(filtered));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const isUUID = isValidUUID(licenseIdOrKey);
        let query = supabase.from('school_licenses').delete();
        if (isUUID) {
          query = query.or(`id.eq.${licenseIdOrKey},license_key.ilike.${licenseIdOrKey}`);
        } else {
          query = query.ilike('license_key', licenseIdOrKey);
        }
        await query;
      } catch (e) {
        console.warn('Supabase delete school license error:', e);
      }
    }

    return { success: true };
  }

  /**
   * Revoke a School License
   */
  public async revokeSchoolLicense(
    licenseIdOrKey: string,
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const list = this.getAllSchoolLicensesLocal();
    const index = list.findIndex(
      (l) => l.id === licenseIdOrKey || (l.licenseKey && l.licenseKey.toLowerCase() === licenseIdOrKey.toLowerCase())
    );
    if (index !== -1) {
      list[index].status = 'REVOKED';
      if (adminNotes) list[index].adminNotes = adminNotes;
      localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(list));
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const isUUID = isValidUUID(licenseIdOrKey);
        let query = supabase.from('school_licenses').update({
          status: 'REVOKED',
          admin_notes: adminNotes || 'License revoked by administrator.',
        });
        if (isUUID) {
          query = query.or(`id.eq.${licenseIdOrKey},license_key.ilike.${licenseIdOrKey}`);
        } else {
          query = query.ilike('license_key', licenseIdOrKey);
        }
        await query;
      } catch (e) {
        console.warn('Supabase revoke school license error:', e);
      }
    }

    return { success: true };
  }

  /**
   * Manually activate a PENDING school license from Admin Console
   */
  public async activateSchoolLicenseAdmin(
    licenseIdOrKey: string,
    adminEmail: string = 'school-admin@playroom-learning.edu'
  ): Promise<{ success: boolean; license?: SchoolLicense; error?: string }> {
    const list = this.getAllSchoolLicensesLocal();
    const index = list.findIndex(
      (l) => l.id === licenseIdOrKey || (l.licenseKey && l.licenseKey.toLowerCase() === licenseIdOrKey.toLowerCase())
    );
    const now = new Date();
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let updatedLicense: SchoolLicense | undefined;
    if (index !== -1) {
      list[index].status = 'ACTIVE';
      list[index].validFrom = now.toISOString();
      list[index].validUntil = expiry.toISOString();
      list[index].startDate = now.toISOString();
      list[index].expiryDate = expiry.toISOString();
      list[index].verifiedBy = adminEmail;
      updatedLicense = list[index];
      localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(list));
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const isUUID = isValidUUID(licenseIdOrKey);
        let query = supabase.from('school_licenses').update({
          status: 'ACTIVE',
          valid_from: now.toISOString(),
          valid_until: expiry.toISOString(),
          start_date: now.toISOString(),
          expiry_date: expiry.toISOString(),
          verified_by: adminEmail,
        });
        if (isUUID) {
          query = query.or(`id.eq.${licenseIdOrKey},license_key.ilike.${licenseIdOrKey}`);
        } else {
          query = query.ilike('license_key', licenseIdOrKey);
        }
        await query;
      } catch (e) {
        console.warn('Supabase activate license error:', e);
      }
    }

    return { success: true, license: updatedLicense };
  }

  /**
   * Renew an existing School License for 30 days.
   *
   * Logic:
   * - Retains the EXACT SAME license_key and school_id.
   * - Does NOT create a new license key or duplicate record.
   * - Keeps valid_from unchanged for record keeping.
   * - If currently active (valid_until > now): new valid_until = current valid_until + 30 days.
   * - If already expired (valid_until <= now): new valid_until = current timestamp + 30 days.
   * - Updates status to 'ACTIVE'.
   * - Updates existing record in Supabase public.school_licenses table and local storage.
   */
  public async renewSchoolLicense(
    licenseIdOrKey: string,
    adminNotes?: string,
    adminEmail: string = 'school-admin@playroom-learning.edu'
  ): Promise<{ success: boolean; license?: SchoolLicense; message?: string; error?: string }> {
    const list = this.getAllSchoolLicensesLocal();
    const index = list.findIndex(
      (l) => l.id === licenseIdOrKey || (l.licenseKey && l.licenseKey.toLowerCase() === licenseIdOrKey.toLowerCase())
    );

    const now = new Date();
    const existing = index !== -1 ? list[index] : null;

    let currentExpiry = existing?.validUntil || existing?.expiryDate;
    let currentStatus = existing?.status || 'ACTIVE';
    let targetSchoolId = existing?.schoolId;
    let targetLicenseKey = existing?.licenseKey;
    let targetSchoolName = existing?.schoolName || 'School Partner';
    let targetContactEmail = existing?.contactEmail || '';
    let targetValidFrom = existing?.validFrom || existing?.startDate || now.toISOString();
    let targetId = (existing?.id && isValidUUID(existing.id)) ? existing.id : (isValidUUID(licenseIdOrKey) ? licenseIdOrKey : generateUUID());

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('school_licenses')
          .select('*')
          .or(`id.eq.${licenseIdOrKey},license_key.ilike.${licenseIdOrKey}`)
          .maybeSingle();

        if (data) {
          targetId = data.id || targetId;
          currentExpiry = data.valid_until || data.expiry_date || currentExpiry;
          currentStatus = data.status || currentStatus;
          targetSchoolId = data.school_id || targetSchoolId;
          targetLicenseKey = data.license_key || targetLicenseKey;
          targetSchoolName = data.school_name || targetSchoolName;
          targetContactEmail = data.contact_email || targetContactEmail;
          targetValidFrom = data.valid_from || data.start_date || targetValidFrom;
        }
      } catch (err) {
        console.warn('Error querying Supabase for license renewal:', err);
      }
    }

    const currentExpiryTime = currentExpiry ? new Date(currentExpiry).getTime() : 0;
    const isCurrentlyActive = currentExpiryTime > now.getTime() && currentStatus.toUpperCase() === 'ACTIVE';

    // Date Logic:
    // If still active: new valid_until = current valid_until + 30 days
    // If already expired: new valid_until = current timestamp + 30 days
    let newValidUntilTime: string;
    if (isCurrentlyActive) {
      newValidUntilTime = new Date(currentExpiryTime + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      newValidUntilTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const renewalNotes = adminNotes || (existing?.adminNotes ? `${existing.adminNotes} | Renewed on ${now.toLocaleDateString()}` : `Renewed for 30 days on ${now.toLocaleDateString()}`);

    // Update in local cache without creating duplicate record
    let updatedLicense: SchoolLicense;
    if (index !== -1) {
      list[index] = {
        ...list[index],
        status: 'ACTIVE',
        validUntil: newValidUntilTime,
        expiryDate: newValidUntilTime,
        adminNotes: renewalNotes,
        verifiedBy: adminEmail,
        createdBy: list[index].createdBy || adminEmail,
      };
      updatedLicense = list[index];
    } else {
      updatedLicense = {
        id: targetId,
        licenseKey: targetLicenseKey || licenseIdOrKey,
        schoolId: (targetSchoolId && isValidUUID(targetSchoolId)) ? targetSchoolId : generateUUID(),
        schoolName: targetSchoolName,
        contactEmail: targetContactEmail,
        price: existing?.price || 15000,
        currency: existing?.currency || 'PKR',
        allowedDevices: 999999,
        page1Access: true,
        page2Access: true,
        startDate: targetValidFrom,
        expiryDate: newValidUntilTime,
        validFrom: targetValidFrom,
        validUntil: newValidUntilTime,
        status: 'ACTIVE',
        durationMonths: 1,
        durationDays: 30,
        createdBy: adminEmail,
        verifiedBy: adminEmail,
        adminNotes: renewalNotes,
        createdAt: targetValidFrom,
      };
      list.unshift(updatedLicense);
    }
    localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(list));

    // Call backend API endpoint
    try {
      await fetch('/api/payment/school-license/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseId: updatedLicense.id,
          licenseKey: updatedLicense.licenseKey,
          adminNotes: renewalNotes,
          adminEmail,
        }),
      });
    } catch (apiErr) {
      console.warn('Backend renewal endpoint fallback:', apiErr);
    }

    // Update existing record in Supabase public.school_licenses
    if (supabase) {
      try {
        await supabase
          .from('school_licenses')
          .update({
            status: 'ACTIVE',
            valid_until: newValidUntilTime,
            expiry_date: newValidUntilTime,
            admin_notes: renewalNotes,
            verified_by: adminEmail,
          })
          .or(`id.eq.${updatedLicense.id},license_key.ilike.${updatedLicense.licenseKey}`);
      } catch (dbErr) {
        console.warn('Supabase license renewal update error:', dbErr);
      }
    }

    return {
      success: true,
      message: 'License renewed successfully for 30 days.',
      license: updatedLicense,
    };
  }

  /**
   * 4b. Submit School Payment Request / Inquiry (School Purchase Flow)
   * Strictly validates all fields (School Name, Contact Name, Email, Phone, Country, Subject, Message),
   * retrieves or creates the school in public.schools first to obtain a valid school_id,
   * and inserts the record into public.school_request (id, created_at, school_id, subject, message).
   * Status is strictly PENDING until manual Admin review.
   * Throws an error if validation fails or if the database insertion cannot be completed.
   */
  public async submitSchoolPaymentRequest(params: {
    schoolName: string;
    schoolAdminName: string;
    contactEmail: string;
    country: string;
    phoneNumber?: string;
    subject?: string;
    city?: string;
    allowedDevices?: number;
    durationMonths?: number; // 1, 3, 6, 12
    page1Access?: boolean;
    page2Access?: boolean;
    amount?: number;
    currency?: Currency;
    paymentMethod?: 'sadapay' | 'bank_transfer' | 'payoneer';
    transactionReference?: string;
    paymentDate?: string;
    adminNotes?: string;
    schoolMessage?: string;
  }): Promise<SchoolPaymentRequest> {
    const trimmedSchoolName = params.schoolName ? params.schoolName.trim() : '';
    const trimmedAdminName = params.schoolAdminName ? params.schoolAdminName.trim() : '';
    const trimmedEmail = params.contactEmail ? params.contactEmail.toLowerCase().trim() : '';
    const trimmedPhone = params.phoneNumber ? params.phoneNumber.trim() : '';
    const trimmedCountry = params.country ? params.country.trim() : '';
    const trimmedCity = params.city ? params.city.trim() : '';
    const trimmedSubject = (params.subject || 'Preschool School License & Classroom Access').trim();
    const trimmedMessage = (params.schoolMessage || '').trim();

    // 1. Practical Validation
    const errCountry = validateSchoolInquiryField('country', trimmedCountry);
    if (errCountry) throw new Error(errCountry);

    const errSchool = validateSchoolInquiryField('schoolName', trimmedSchoolName);
    if (errSchool) throw new Error(errSchool);

    const errAdmin = validateSchoolInquiryField('schoolAdminName', trimmedAdminName);
    if (errAdmin) throw new Error(errAdmin);

    const errEmail = validateSchoolInquiryField('contactEmail', trimmedEmail);
    if (errEmail) throw new Error(errEmail);

    const errPhone = validateSchoolInquiryField('phoneNumber', trimmedPhone);
    if (errPhone) throw new Error(errPhone);

    const errSubject = validateSchoolInquiryField('subject', trimmedSubject);
    if (errSubject) throw new Error(errSubject);

    const errMessage = validateSchoolInquiryField('schoolMessage', trimmedMessage);
    if (errMessage) throw new Error(errMessage);

    const requestId = generateUUID();
    const nowIso = new Date().toISOString();

    const request: SchoolPaymentRequest = {
      id: requestId,
      schoolName: trimmedSchoolName,
      schoolAdminName: trimmedAdminName,
      contactName: trimmedAdminName,
      contactEmail: trimmedEmail,
      contactPhone: trimmedPhone,
      country: trimmedCountry,
      city: trimmedCity || 'Karachi',
      allowedDevices: params.allowedDevices || 999999,
      durationMonths: params.durationMonths || 1,
      page1Access: params.page1Access !== undefined ? params.page1Access : true,
      page2Access: params.page2Access !== undefined ? params.page2Access : true,
      amount: params.amount || 25000,
      currency: params.currency || 'PKR',
      paymentMethod: params.paymentMethod || 'bank_transfer',
      transactionReference: params.transactionReference ? params.transactionReference.trim() : 'INQUIRY-' + Date.now().toString(36).toUpperCase(),
      paymentDate: params.paymentDate || nowIso.split('T')[0],
      status: 'PENDING',
      schoolMessage: trimmedMessage || undefined,
      notes: trimmedMessage || undefined,
      adminNotes: params.adminNotes,
      submittedAt: nowIso,
    };

    let serverConfirmed = false;
    let serverErrorMessage = '';

    // 2. Submit via backend server endpoint (Single fast request)
    try {
      const response = await fetch('/api/payment/school-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          schoolName: trimmedSchoolName,
          schoolAdminName: trimmedAdminName,
          contactEmail: trimmedEmail,
          phoneNumber: trimmedPhone,
          country: trimmedCountry,
          city: trimmedCity,
          subject: trimmedSubject,
          message: trimmedMessage,
          allowedDevices: request.allowedDevices,
          durationMonths: request.durationMonths,
          amount: request.amount,
          currency: request.currency,
          paymentMethod: request.paymentMethod,
          transactionReference: request.transactionReference,
        }),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        serverConfirmed = true;
      } else {
        serverErrorMessage = resData.error || 'Server rejected inquiry submission.';
        console.warn('Backend school request submission error:', resData);
      }
    } catch (e: any) {
      serverErrorMessage = e?.message || 'Network request to server failed.';
      console.warn('Backend school request sync exception:', e);
    }

    // 3. If server confirmed, save to local cache and return immediately (ultra-fast, zero duplicate calls)
    if (serverConfirmed) {
      const requests = this.getAllSchoolPaymentRequestsLocal();
      requests.unshift(request);
      localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));
      return request;
    }

    // 4. Standalone direct client Supabase fallback only if backend was offline / unreachable:
    const supabase = getSupabaseClient();
    let supabaseConfirmed = false;
    let supabaseErrorMessage = '';

    if (supabase) {
      try {
        let targetSchoolId = generateUUID();

        // 1. Check if the inquiry belongs to an existing school using reliable compound identity (matching school name AND contact email)
        const { data: exactMatchSchool } = await supabase
          .from('schools')
          .select('id, school_name, contact_email')
          .ilike('school_name', trimmedSchoolName)
          .ilike('contact_email', trimmedEmail)
          .maybeSingle();

        let existingSchoolToUse = exactMatchSchool;

        if (existingSchoolToUse?.id) {
          targetSchoolId = existingSchoolToUse.id;
        } else {
          // Distinct school: Create a brand new record in public.schools
          const newSchoolId = generateUUID();
          targetSchoolId = newSchoolId;

          const { error: insertSchoolErr } = await supabase.from('schools').insert([
            {
              id: newSchoolId,
              school_name: trimmedSchoolName,
              contact_name: trimmedAdminName,
              contact_email: trimmedEmail,
              country: trimmedCountry || null,
              currency: params.currency || (trimmedCountry === 'Pakistan' ? 'PKR' : 'USD'),
              account_status: 'active',
              payment_status: 'pending',
              created_at: nowIso,
            },
          ]);

          if (insertSchoolErr) {
            console.warn('Direct supabase schools table insert notice:', insertSchoolErr);
            const { data: refetchedSchool } = await supabase
              .from('schools')
              .select('id')
              .ilike('school_name', trimmedSchoolName)
              .ilike('contact_email', trimmedEmail)
              .maybeSingle();
            if (refetchedSchool?.id) {
              targetSchoolId = refetchedSchool.id;
            }
          }
        }

        // Insert into public.school_requests
        const finalMessage = `School: ${trimmedSchoolName} | Admin: ${trimmedAdminName} | Email: ${trimmedEmail} | Phone: ${trimmedPhone} | Country: ${trimmedCountry}${trimmedCity ? ` | City: ${trimmedCity}` : ''}\n\n${trimmedMessage}`;

        const { error: pluralErr } = await supabase.from('school_requests').insert([
          {
            id: request.id,
            school_id: targetSchoolId,
            requested_by: null,
            subject: trimmedSubject,
            message: finalMessage,
            status: 'pending',
            created_at: nowIso,
          },
        ]);

        if (!pluralErr) {
          supabaseConfirmed = true;
        } else {
          console.warn('Direct supabase public.school_requests insert notice, trying singular fallback:', pluralErr);
          const { error: reqInsertErr } = await supabase.from('school_request').insert([
            {
              id: request.id,
              school_id: targetSchoolId,
              subject: trimmedSubject,
              message: finalMessage,
              created_at: nowIso,
            },
          ]);
          if (!reqInsertErr) {
            supabaseConfirmed = true;
          } else {
            supabaseErrorMessage = pluralErr.message || reqInsertErr.message;
          }
        }
      } catch (e: any) {
        supabaseErrorMessage = e?.message || 'Supabase exception';
        console.warn('Direct Supabase school inquiry persistence exception:', e);
      }
    }

    // 4. Verification check: At least one server or Supabase insertion must have succeeded
    if (!serverConfirmed && !supabaseConfirmed) {
      const finalErr = serverErrorMessage || supabaseErrorMessage || 'Failed to submit inquiry to the database. Please check your network connection and try again.';
      throw new Error(`Submission Error: ${finalErr}`);
    }

    // 5. Save locally in cache ONLY after database insert confirmation
    const requests = this.getAllSchoolPaymentRequestsLocal();
    requests.unshift(request);
    localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));

    return request;
  }

  public getAllSchoolPaymentRequestsLocal(): SchoolPaymentRequest[] {
    try {
      const raw = localStorage.getItem(STORAGE_SCHOOL_REQUESTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('School requests parse error:', e);
    }
    return [];
  }

  /**
   * Admin sets or updates the agreed final price for a school request
   */
  public async adminUpdateSchoolRequestPrice(
    requestId: string,
    finalPrice: number,
    finalCurrency: Currency = 'PKR'
  ): Promise<{ success: boolean; error?: string }> {
    const requests = this.getAllSchoolPaymentRequestsLocal();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) {
      return { success: false, error: 'School request not found' };
    }

    requests[reqIndex].finalPrice = finalPrice;
    requests[reqIndex].finalCurrency = finalCurrency;
    requests[reqIndex].amount = finalPrice;
    requests[reqIndex].currency = finalCurrency;

    localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));
    return { success: true };
  }

  /**
   * 4c. Admin Action: Approve School Payment Request
   * Sets payment to VERIFIED and activates School License with start/expiry date.
   */
  public async adminApproveSchoolPayment(
    requestId: string,
    adminEmail: string = 'school-admin@playroom-learning.edu',
    adminNotes?: string,
    approvedAllowedDevices?: number,
    approvedPage1Access?: boolean,
    approvedPage2Access?: boolean,
    approvedPrice?: number,
    approvedCurrency?: Currency,
    customLicenseKey?: string
  ): Promise<{ success: boolean; license?: SchoolLicense; error?: string }> {
    const requests = this.getAllSchoolPaymentRequestsLocal();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) {
      return { success: false, error: 'School request not found' };
    }

    const req = requests[reqIndex];
    const now = new Date();

    const allowedDevices = approvedAllowedDevices !== undefined ? approvedAllowedDevices : 999999;
    const page1Access = approvedPage1Access !== undefined ? approvedPage1Access : true;
    const page2Access = approvedPage2Access !== undefined ? approvedPage2Access : true;
    const price = approvedPrice !== undefined ? approvedPrice : (req.finalPrice !== undefined ? req.finalPrice : req.amount);
    const currency = approvedCurrency || req.finalCurrency || req.currency;

    // 1. Issue School License
    const license = await this.createSchoolLicense({
      schoolName: req.schoolName,
      contactEmail: req.contactEmail,
      price: price,
      currency: currency,
      allowedDevices: 999999,
      durationMonths: 1,
      page1Access,
      page2Access,
      adminNotes: adminNotes || `Approved payment request ${req.id} (Ref: ${req.transactionReference}, Agreed Price: ${currency} ${price})`,
      verifiedBy: adminEmail,
      createdBy: adminEmail,
      licenseKey: customLicenseKey,
    });

    // 2. Update Request Status
    req.status = 'VERIFIED';
    req.reviewedBy = adminEmail;
    req.reviewedAt = now.toISOString();
    req.schoolLicenseId = license.licenseKey || license.id;
    req.allowedDevices = allowedDevices;
    req.page1Access = page1Access;
    req.page2Access = page2Access;
    req.amount = price;
    req.currency = currency;
    req.finalPrice = price;
    req.finalCurrency = currency;
    if (adminNotes) req.adminNotes = adminNotes;

    requests[reqIndex] = req;
    localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));

    // Update Supabase school_requests if exists
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_requests').update({
          status: 'approved',
          admin_reply: adminNotes || `Approved with license key ${license.licenseKey || license.id}`,
          replied_at: now.toISOString(),
        }).eq('id', requestId);
      } catch (dbErr) {
        console.warn('Supabase school_requests update error:', dbErr);
      }
    }

    return { success: true, license };
  }

  /**
   * 4c-2. Admin Action: Approve School Request (Dedicated School Inquiry Workflow)
   * Rules:
   * - Read from public.school_requests.
   * - Show pending inquiries.
   * - Approval uses the request's existing school_id.
   * - Approval does NOT require school payment.
   * - Approval does NOT create another school record.
   * - Approving generates a unique license key if the school does not already have an active license.
   * - 30-day validity.
   * - Same license key is used for renewal.
   */
  public async adminApproveSchoolRequest(
    requestId: string,
    adminNotes?: string,
    adminEmail: string = 'school-admin@playroom-learning.edu'
  ): Promise<{ success: boolean; licenseKey?: string; license?: SchoolLicense; error?: string }> {
    const requests = this.getAllSchoolPaymentRequestsLocal();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    const req = reqIndex !== -1 ? requests[reqIndex] : null;

    const now = new Date();
    const supabase = getSupabaseClient();

    let schoolId = req?.schoolId || req?.id;
    let schoolName = req?.schoolName || 'Partner School';
    let contactEmail = req?.contactEmail || '';

    // Query Supabase for accurate school_id link if possible
    if (supabase) {
      try {
        const { data: dbReq } = await supabase
          .from('school_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (dbReq) {
          if (dbReq.school_id) {
            schoolId = dbReq.school_id;
            const { data: sch } = await supabase
              .from('schools')
              .select('*')
              .eq('id', dbReq.school_id)
              .maybeSingle();
            if (sch) {
              schoolName = sch.school_name || schoolName;
              contactEmail = sch.contact_email || contactEmail;
            }
          }
        }
      } catch (e) {
        console.warn('Error fetching school request details for approval:', e);
      }
    }

    if (!schoolId) {
      schoolId = generateUUID();
    }

    // Check if the school already has an active license in school_licenses
    const allLicenses = this.getAllSchoolLicensesLocal();
    const existingActiveLicense = allLicenses.find((lic) => {
      const isMatchingSchool =
        lic.schoolId === schoolId ||
        (lic.contactEmail && contactEmail && lic.contactEmail.toLowerCase() === contactEmail.toLowerCase()) ||
        (lic.schoolName && schoolName && lic.schoolName.toLowerCase() === schoolName.toLowerCase());
      const exp = lic.validUntil || lic.expiryDate;
      const isActive =
        (lic.status || '').toUpperCase() === 'ACTIVE' && (!exp || new Date(exp).getTime() > now.getTime());
      return isMatchingSchool && isActive;
    });

    let finalLicenseKey: string;
    let createdOrActiveLicense: SchoolLicense;

    if (existingActiveLicense) {
      finalLicenseKey = existingActiveLicense.licenseKey || existingActiveLicense.id;
      createdOrActiveLicense = existingActiveLicense;
    } else {
      // Generate unique license key with 30-day validity
      const newKey = await this.generateUniqueLicenseKey();
      finalLicenseKey = newKey;

      const durationDays = 30;
      const expiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const licId = generateUUID();

      createdOrActiveLicense = {
        id: licId,
        licenseKey: newKey,
        schoolId: schoolId,
        schoolName: schoolName,
        contactEmail: contactEmail,
        price: 0,
        currency: 'PKR',
        allowedDevices: 999999,
        page1Access: true,
        page2Access: true,
        startDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
        validFrom: now.toISOString(),
        validUntil: expiry.toISOString(),
        status: 'ACTIVE',
        durationMonths: 1,
        durationDays: 30,
        createdBy: adminEmail,
        verifiedBy: adminEmail,
        adminNotes: adminNotes || `Approved school inquiry ${requestId}`,
        createdAt: now.toISOString(),
      };

      allLicenses.unshift(createdOrActiveLicense);
      localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(allLicenses));

      if (supabase) {
        try {
          await supabase.from('school_licenses').insert([
            {
              id: licId,
              school_id: schoolId,
              license_key: newKey,
              school_name: schoolName,
              contact_email: contactEmail,
              price: 0,
              currency: 'PKR',
              allowed_devices: 999999,
              page1_access: true,
              page2_access: true,
              valid_from: now.toISOString(),
              valid_until: expiry.toISOString(),
              start_date: now.toISOString(),
              expiry_date: expiry.toISOString(),
              status: 'ACTIVE',
              duration_months: 1,
              created_by: adminEmail,
              verified_by: adminEmail,
              admin_notes: adminNotes || `Approved school request ${requestId}`,
              created_at: now.toISOString(),
            },
          ]);
        } catch (licDbErr) {
          console.warn('Supabase school license insert notice:', licDbErr);
        }
      }
    }

    // Update request state locally
    if (req) {
      req.status = 'VERIFIED';
      req.schoolLicenseId = finalLicenseKey;
      req.reviewedBy = adminEmail;
      req.reviewedAt = now.toISOString();
      if (adminNotes) req.adminNotes = adminNotes;
      if (reqIndex !== -1) {
        requests[reqIndex] = req;
        localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));
      }
    }

    // Call backend API endpoint
    try {
      await fetch('/api/payment/school-request/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          adminEmail,
          adminNotes,
        }),
      });
    } catch (apiErr) {
      console.warn('Backend approve fallback:', apiErr);
    }

    // Update Supabase school_requests
    if (supabase) {
      try {
        await supabase
          .from('school_requests')
          .update({
            status: 'approved',
            admin_reply: adminNotes || `Approved by Administrator. 30-Day License Key: ${finalLicenseKey}`,
            replied_at: now.toISOString(),
          })
          .eq('id', requestId);
      } catch (dbErr) {
        console.warn('Supabase school_requests update notice:', dbErr);
      }
    }

    return { success: true, licenseKey: finalLicenseKey, license: createdOrActiveLicense };
  }

  /**
   * 4d. Admin Action: Reject School Payment Request
   */
  public async adminRejectSchoolPayment(
    requestId: string,
    reason: string = 'Payment not verified in bank records',
    adminEmail: string = 'school-admin@playroom-learning.edu'
  ): Promise<{ success: boolean; error?: string }> {
    const requests = this.getAllSchoolPaymentRequestsLocal();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) {
      return { success: false, error: 'School request not found' };
    }

    const req = requests[reqIndex];
    req.status = 'REJECTED';
    req.reviewedBy = adminEmail;
    req.reviewedAt = new Date().toISOString();
    req.adminNotes = reason;

    requests[reqIndex] = req;
    localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));

    return { success: true };
  }

  /**
   * 4e. Admin Action: Keep Pending
   */
  public async adminKeepPendingSchoolPayment(
    requestId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const requests = this.getAllSchoolPaymentRequestsLocal();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) {
      return { success: false, error: 'School request not found' };
    }

    const req = requests[reqIndex];
    req.status = 'PENDING';
    if (notes) req.adminNotes = notes;

    requests[reqIndex] = req;
    localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(requests));

    return { success: true };
  }

  /**
   * --- SCHOOL DEVICE CONTROL & MANAGEMENT ---
   */
  public getAllSchoolDevicesLocal(): SchoolDeviceRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_SCHOOL_DEVICES_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('School devices parse error:', e);
    }
    return [];
  }

  public getSchoolDevicesWithStats(schoolIdOrEmail: string): {
    devices: SchoolDeviceRecord[];
    allowedDevices: number;
    usedDevices: number;
    remainingDevices: number;
  } {
    const access = this.checkSchoolAccess(schoolIdOrEmail);
    const allowedDevices = access.license ? access.license.allowedDevices : 30;
    const allDevices = this.getAllSchoolDevicesLocal();
    
    const schoolDevices = allDevices.filter(
      (d) =>
        d.schoolId === schoolIdOrEmail ||
        (access.license && d.schoolId === access.license.schoolId)
    );

    const activeDevices = schoolDevices.filter((d) => d.status === 'ACTIVE');
    const usedDevices = activeDevices.length;
    const remainingDevices = Math.max(0, allowedDevices - usedDevices);

    return {
      devices: schoolDevices,
      allowedDevices,
      usedDevices,
      remainingDevices,
    };
  }

  /**
   * Register or update a device for a school license.
   * Schools have UNLIMITED devices — devices are logged for audit/analytics without blocking.
   */
  public async registerSchoolDevice(params: {
    schoolIdOrEmail: string;
    deviceIdentifier: string;
    deviceName?: string;
    userIdentifier?: string;
  }): Promise<{ success: boolean; device?: SchoolDeviceRecord; error?: string }> {
    const access = this.checkSchoolAccess(params.schoolIdOrEmail);
    if (!access.hasAccess || !access.license) {
      return {
        success: false,
        error: 'No active School License found for this school ID or email.',
      };
    }

    const schoolId = access.license.schoolId;
    const allDevices = this.getAllSchoolDevicesLocal();
    const now = new Date().toISOString();

    const existingIndex = allDevices.findIndex(
      (d) => d.schoolId === schoolId && d.deviceIdentifier === params.deviceIdentifier
    );

    if (existingIndex >= 0) {
      const dev = allDevices[existingIndex];
      dev.status = 'ACTIVE';
      dev.revokedAt = undefined;
      dev.lastLogin = now;
      if (params.deviceName) dev.deviceName = params.deviceName;
      allDevices[existingIndex] = dev;
      localStorage.setItem(STORAGE_SCHOOL_DEVICES_KEY, JSON.stringify(allDevices));
      return { success: true, device: dev };
    }

    // New device: registered with unlimited capacity
    const newDevice: SchoolDeviceRecord = {
      id: 'sdev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      schoolId,
      userIdentifier: params.userIdentifier || params.schoolIdOrEmail,
      deviceIdentifier: params.deviceIdentifier,
      deviceName: params.deviceName || 'Classroom Device',
      registeredAt: now,
      lastLogin: now,
      status: 'ACTIVE',
      isActive: true,
    };

    allDevices.unshift(newDevice);
    localStorage.setItem(STORAGE_SCHOOL_DEVICES_KEY, JSON.stringify(allDevices));

    // Sync to Supabase school_devices
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_devices').upsert({
          id: newDevice.id,
          school_id: newDevice.schoolId,
          user_identifier: newDevice.userIdentifier,
          device_identifier: newDevice.deviceIdentifier,
          device_name: newDevice.deviceName,
          registered_at: newDevice.registeredAt,
          last_login: newDevice.lastLogin,
          status: newDevice.status,
        });
      } catch (e) {
        console.warn('Supabase school device sync error:', e);
      }
    }

    return { success: true, device: newDevice };
  }

  /**
   * Revoke a school device (frees up device slot)
   */
  public async revokeSchoolDevice(
    deviceId: string
  ): Promise<{ success: boolean; error?: string }> {
    const allDevices = this.getAllSchoolDevicesLocal();
    const index = allDevices.findIndex((d) => d.id === deviceId);
    if (index === -1) {
      return { success: false, error: 'Device record not found' };
    }

    const now = new Date().toISOString();
    allDevices[index].status = 'REVOKED';
    allDevices[index].revokedAt = now;
    localStorage.setItem(STORAGE_SCHOOL_DEVICES_KEY, JSON.stringify(allDevices));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('school_devices')
          .update({ status: 'REVOKED', revoked_at: now })
          .eq('id', deviceId);
      } catch (e) {
        console.warn('Supabase device revoke error:', e);
      }
    }

    return { success: true };
  }

  /**
   * Update allowed device limit on an active school license (Admin control)
   */
  public async updateSchoolLicenseDeviceLimit(
    licenseIdOrSchoolId: string,
    newAllowedLimit: number
  ): Promise<{ success: boolean; error?: string }> {
    const licenses = this.getAllSchoolLicensesLocal();
    const index = licenses.findIndex(
      (l) => l.id === licenseIdOrSchoolId || l.schoolId === licenseIdOrSchoolId
    );
    if (index === -1) {
      return { success: false, error: 'School license not found' };
    }

    licenses[index].allowedDevices = Math.max(1, newAllowedLimit);
    localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(licenses));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('school_licenses')
          .update({ allowed_devices: licenses[index].allowedDevices })
          .eq('id', licenses[index].id);
      } catch (e) {
        console.warn('Supabase license device limit update error:', e);
      }
    }

    return { success: true };
  }

  /**
   * Save Active School License
   */
  public saveActiveSchoolLicense(license: SchoolLicense): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_SCHOOL_LICENSE_KEY, JSON.stringify(license));
      const list = this.getAllSchoolLicensesLocal();
      const existingIndex = list.findIndex(
        (l) => l.id === license.id || (l.licenseKey && l.licenseKey === license.licenseKey)
      );
      if (existingIndex >= 0) {
        list[existingIndex] = license;
      } else {
        list.unshift(license);
      }
      localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('playroom_license_update'));
    }
  }

  /**
   * Get Active School License (returns null if not found or expired)
   */
  public getActiveSchoolLicense(): SchoolLicense | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_ACTIVE_SCHOOL_LICENSE_KEY);
      if (!raw) return null;
      const lic: SchoolLicense = JSON.parse(raw);
      const now = Date.now();
      const expiryTime = new Date(lic.expiryDate).getTime();
      if (lic.status === 'ACTIVE' && expiryTime > now) {
        return lic;
      } else {
        // Expired or invalid -> clear active session
        localStorage.removeItem(STORAGE_ACTIVE_SCHOOL_LICENSE_KEY);
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Clear Active School License
   */
  public clearActiveSchoolLicense(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_ACTIVE_SCHOOL_LICENSE_KEY);
      window.dispatchEvent(new CustomEvent('playroom_license_update'));
    }
  }

  /**
   * Complete Logout Cleanup: Clears active school license, user session,
   * local access state, and broadcasts update events to all UI listeners.
   */
  public clearAllUserAndSchoolAccessState(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_ACTIVE_SCHOOL_LICENSE_KEY);
        localStorage.removeItem('playroom_user');
        localStorage.removeItem('playroom_current_user');
        sessionStorage.clear();
      } catch (e) {
        console.warn('Error clearing access state during logout:', e);
      }
      window.dispatchEvent(new CustomEvent('playroom_license_update'));
      window.dispatchEvent(new CustomEvent('playroom_auth_change'));
    }
  }

  /**
   * Check School Access and Expiration
   */
  public checkSchoolAccess(
    schoolEmailOrKey?: string | null
  ): {
    hasAccess: boolean;
    license?: SchoolLicense;
    isExpired?: boolean;
    daysRemaining?: number;
    page1Access?: boolean;
    page2Access?: boolean;
  } {
    // 1. Check active school license session
    const activeLic = this.getActiveSchoolLicense();
    const now = Date.now();
    if (activeLic) {
      const expiryTime = new Date(activeLic.expiryDate).getTime();
      const daysRemaining = Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));
      return {
        hasAccess: true,
        license: activeLic,
        isExpired: false,
        daysRemaining,
        page1Access: true,
        page2Access: true,
      };
    }

    if (!schoolEmailOrKey) return { hasAccess: false };
    const query = schoolEmailOrKey.trim().toLowerCase();
    const licenses = this.getAllSchoolLicensesLocal();

    for (const lic of licenses) {
      const matchEmail = lic.contactEmail.toLowerCase() === query;
      const matchId = lic.id.toLowerCase() === query;
      const matchSchoolId = lic.schoolId.toLowerCase() === query;
      const matchKey = lic.licenseKey ? lic.licenseKey.toLowerCase() === query : false;

      if (matchEmail || matchId || matchSchoolId || matchKey) {
        const expiryTime = new Date(lic.expiryDate).getTime();
        const isTimeValid = expiryTime > now;
        const daysRemaining = Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));

        if (lic.status === 'ACTIVE' && isTimeValid) {
          return {
            hasAccess: true,
            license: lic,
            isExpired: false,
            daysRemaining,
            page1Access: true,
            page2Access: true,
          };
        } else {
          return {
            hasAccess: false,
            license: lic,
            isExpired: true,
            daysRemaining: 0,
            page1Access: lic.page1Access,
            page2Access: lic.page2Access,
          };
        }
      }
    }

    return { hasAccess: false };
  }

  /**
   * Check if user has active Full App license (All Activities + Education Hub)
   */
  public checkIndividualFullAppAccess(userEmail?: string | null): boolean {
    if (!userEmail) return false;
    const licenses = this.getUserLicenses(userEmail);
    const now = Date.now();
    for (const lic of licenses) {
      const isTimeValid = new Date(lic.expiryDate).getTime() > now;
      if (lic.status === 'ACTIVE' && isTimeValid) {
        if (lic.allActivitiesUnlocked || lic.licenseType === 'all_activities') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Validate School License Key directly against Supabase `school_licenses` table.
   *
   * Criteria:
   * - Key must exist in database
   * - Status must be ACTIVE
   * - valid_until / expiry_date must be in the future
   * - If expired, deny access
   * - If invalid, show exact required error message
   */
  public async validateSchoolLicenseKey(
    key: string,
    email?: string
  ): Promise<{ success: boolean; license?: SchoolLicense; error?: string }> {
    const trimmedKey = (key || '').trim();
    if (!trimmedKey) {
      return { success: false, error: 'Invalid license key. Please check your key and try again.' };
    }

    const now = Date.now();
    const supabase = getSupabaseClient();

    if (supabase) {
      // 1. Primary: Call Supabase RPC `public.verify_school_license`
      try {
        let rpcRes = await supabase.rpc('verify_school_license', {
          p_license_key: trimmedKey,
        });

        // Fallback parameter name if p_license_key is not recognized
        if (rpcRes.error && (rpcRes.error.message?.includes('parameter') || rpcRes.error.message?.includes('function'))) {
          rpcRes = await supabase.rpc('verify_school_license', {
            license_key: trimmedKey,
          });
        }
        if (rpcRes.error && (rpcRes.error.message?.includes('parameter') || rpcRes.error.message?.includes('function'))) {
          rpcRes = await supabase.rpc('verify_school_license', {
            key: trimmedKey,
          });
        }

        const rawData = rpcRes.data;
        const licRow = Array.isArray(rawData) ? rawData[0] : rawData;

        if (!rpcRes.error && licRow) {
          const isValid = licRow.is_valid === true || licRow.is_valid === 'true';
          const statusUpper = (licRow.status || '').toUpperCase();
          const expiryField = licRow.valid_until || licRow.expiry_date;
          const exp = expiryField ? new Date(expiryField).getTime() : NaN;
          const isPastExpiry = isNaN(exp) || exp <= now;

          if (statusUpper === 'EXPIRED' || isPastExpiry) {
            return {
              success: false,
              error: 'This license has expired. Please contact us to renew your license.',
            };
          }

          if (isValid || statusUpper === 'ACTIVE') {
            // Retrieve school name from schools table if school_id is available
            let schoolName = licRow.school_name || 'Partner School';
            let contactEmail = licRow.contact_email || email || '';

            if (licRow.school_id && (!licRow.school_name || !licRow.contact_email)) {
              try {
                const { data: schoolData } = await supabase
                  .from('schools')
                  .select('school_name, contact_email')
                  .eq('id', licRow.school_id)
                  .maybeSingle();

                if (schoolData) {
                  if (schoolData.school_name) schoolName = schoolData.school_name;
                  if (schoolData.contact_email && !contactEmail) contactEmail = schoolData.contact_email;
                }
              } catch (e) {
                // Ignore school join error
              }
            }

            const parsedLicense: SchoolLicense = {
              id: licRow.license_id || licRow.id || trimmedKey,
              licenseKey: licRow.license_key || trimmedKey,
              schoolId: licRow.school_id || licRow.license_id || trimmedKey,
              schoolName,
              contactEmail,
              price: Number(licRow.price) || 0,
              currency: licRow.currency || 'PKR',
              allowedDevices: 999999, // Unlimited devices
              page1Access: true,      // Full App access
              page2Access: true,      // Education Hub access
              startDate: licRow.valid_from || licRow.start_date || new Date().toISOString(),
              expiryDate: licRow.valid_until || licRow.expiry_date,
              validFrom: licRow.valid_from || licRow.start_date || new Date().toISOString(),
              validUntil: licRow.valid_until || licRow.expiry_date,
              status: 'ACTIVE',
              durationMonths: 1,      // 30 days validity
              durationDays: 30,
              createdBy: licRow.created_by || licRow.verified_by,
              verifiedBy: licRow.verified_by || 'Admin',
              adminNotes: licRow.admin_notes,
              createdAt: licRow.created_at || new Date().toISOString(),
            };

            this.saveActiveSchoolLicense(parsedLicense);
            return { success: true, license: parsedLicense };
          }

          if (licRow.error) {
            return { success: false, error: licRow.error };
          }
        }
      } catch (rpcErr) {
        console.warn('[Supabase] verify_school_license RPC error:', rpcErr);
      }

      // 2. Secondary: Direct table query on `school_licenses` (safely without UUID type mismatches)
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedKey);
        
        let query = supabase
          .from('school_licenses')
          .select('*');

        if (isUUID) {
          query = query.or(`license_key.ilike.${trimmedKey},id.eq.${trimmedKey}`);
        } else {
          query = query.ilike('license_key', trimmedKey);
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          const statusUpper = (data.status || '').toUpperCase();

          if (statusUpper === 'REVOKED') {
            return {
              success: false,
              error: 'This license key has been revoked. Please contact administration.',
            };
          }

          // If license is PENDING or has null validity dates, activate upon first use
          if (statusUpper === 'PENDING' || !data.valid_from || !data.valid_until) {
            const activationTime = new Date();
            const validUntilTime = new Date(activationTime.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            try {
              await supabase.from('school_licenses').update({
                status: 'ACTIVE',
                valid_from: activationTime.toISOString(),
                valid_until: validUntilTime.toISOString(),
                start_date: activationTime.toISOString(),
                expiry_date: validUntilTime.toISOString(),
              }).eq('id', data.id);
            } catch (e) {
              console.warn('Error activating pending license on first use:', e);
            }

            data.status = 'ACTIVE';
            data.valid_from = activationTime.toISOString();
            data.valid_until = validUntilTime.toISOString();
            data.start_date = activationTime.toISOString();
            data.expiry_date = validUntilTime.toISOString();
          }

          const expiryField = data.valid_until || data.expiry_date;
          const exp = expiryField ? new Date(expiryField).getTime() : NaN;
          const isPastExpiry = isNaN(exp) || exp <= now;

          if (isPastExpiry) {
            return {
              success: false,
              error: 'This license has expired. Please contact us to renew your license.',
            };
          }

          if (data.status === 'ACTIVE' || statusUpper === 'ACTIVE') {
            const parsedLicense: SchoolLicense = {
              id: data.id,
              licenseKey: data.license_key || data.id,
              schoolId: data.school_id || data.id,
              schoolName: data.school_name || 'Partner School',
              contactEmail: data.contact_email || email || '',
              country: data.country || 'Pakistan',
              price: Number(data.price) || 0,
              currency: data.currency || 'PKR',
              allowedDevices: 999999, // Unlimited devices
              page1Access: true,      // Full App access
              page2Access: true,      // Education Hub access
              startDate: data.valid_from || data.start_date || new Date().toISOString(),
              expiryDate: data.valid_until || data.expiry_date,
              validFrom: data.valid_from || data.start_date || new Date().toISOString(),
              validUntil: data.valid_until || data.expiry_date,
              status: 'ACTIVE',
              durationMonths: 1,      // 30 days validity
              durationDays: 30,
              createdBy: data.created_by || data.verified_by,
              verifiedBy: data.verified_by || data.created_by,
              adminNotes: data.admin_notes,
              createdAt: data.created_at || new Date().toISOString(),
            };

            this.saveActiveSchoolLicense(parsedLicense);
            return { success: true, license: parsedLicense };
          }
        }
      } catch (err) {
        console.warn('[Supabase] direct school_licenses query error:', err);
      }
    }

    // 3. Fallback check against local storage cache
    const localLicenses = this.getAllSchoolLicensesLocal();
    const found = localLicenses.find(
      (l) =>
        (l.licenseKey && l.licenseKey.toLowerCase() === trimmedKey.toLowerCase()) ||
        l.id.toLowerCase() === trimmedKey.toLowerCase()
    );

    if (found) {
      if (found.status === 'REVOKED') {
        return { success: false, error: 'This license key has been revoked. Please contact administration.' };
      }

      const nowDate = new Date();
      // If PENDING, activate on first usage
      if (found.status === 'PENDING' || !found.validUntil) {
        found.status = 'ACTIVE';
        found.validFrom = nowDate.toISOString();
        found.validUntil = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        found.startDate = found.validFrom;
        found.expiryDate = found.validUntil;
        this.saveActiveSchoolLicense(found);
        return { success: true, license: found };
      }

      const expiryTime = found.validUntil ? new Date(found.validUntil).getTime() : (found.expiryDate ? new Date(found.expiryDate).getTime() : NaN);
      if (!isNaN(expiryTime) && expiryTime <= now) {
        return { success: false, error: 'This license has expired. Please contact us to renew your license.' };
      }

      if (found.status === 'ACTIVE') {
        this.saveActiveSchoolLicense(found);
        return { success: true, license: found };
      }
    }

    return {
      success: false,
      error: 'Invalid license key. Please check your key and try again.',
    };
  }

  /**
   * Check if a specific level has active license
   */
  public checkLevelAccess(
    userEmail: string | undefined | null,
    level: number,
    isDeveloperMode: boolean = false
  ): { hasAccess: boolean; license?: UserLicense; isExpired?: boolean } {
    // Level 1 is always free starter
    if (level === 1) return { hasAccess: true };
    if (isDeveloperMode) return { hasAccess: true };

    // Check Active School License (Institutional Access)
    const activeSchoolLic = this.getActiveSchoolLicense();
    if (activeSchoolLic && activeSchoolLic.status === 'ACTIVE') {
      const isSchoolValid = new Date(activeSchoolLic.expiryDate).getTime() > Date.now();
      if (isSchoolValid && activeSchoolLic.page1Access !== false) {
        return { hasAccess: true };
      }
    }

    if (userEmail) {
      const schoolAccess = this.checkSchoolAccess(userEmail);
      if (schoolAccess.hasAccess && schoolAccess.page1Access !== false) {
        return { hasAccess: true };
      }
    }

    // Google Play Billing All Activities Check
    if (googlePlayBilling.hasAllActivitiesPass().active) {
      return { hasAccess: true };
    }

    if (!userEmail) return { hasAccess: false };

    const licenses = this.getUserLicenses(userEmail);
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
  }

  // --- Local Storage Helpers ---
  public getAllOrdersLocal(): PremiumOrder[] {
    try {
      const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Orders parse error:', e);
    }
    return [];
  }

  public getAllPaymentsLocal(): PaymentRecord[] {
    const list: PaymentRecord[] = [];
    const seenIds = new Set<string>();

    try {
      const raw = localStorage.getItem(STORAGE_PAYMENTS_KEY);
      if (raw) {
        const parsed: PaymentRecord[] = JSON.parse(raw);
        for (const p of parsed) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            list.push(p);
          }
        }
      }
    } catch (e) {
      console.warn('Payments parse error:', e);
    }

    // Merge from playroom_payment_requests if any submitted there
    try {
      const rawReqs = localStorage.getItem('playroom_payment_requests');
      if (rawReqs) {
        const reqs = JSON.parse(rawReqs);
        for (const r of reqs) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            list.push({
              id: r.id,
              orderId: 'ord_' + r.id,
              userId: r.userId || 'user_' + r.id,
              userEmail: r.userEmail,
              productId: r.purchaseType === 'all_activities' ? 'all_activities' : `level_${r.targetLevel || 2}`,
              selectedLevel: r.targetLevel,
              amount: r.amount,
              currency: r.currency,
              paymentMethod: r.paymentMethod,
              provider: r.paymentMethod,
              providerTransactionId: r.transactionId || 'MANUAL-REF',
              paymentStatus: r.status === 'APPROVED' ? 'VERIFIED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
              paymentProofName: r.paymentProofName,
              paymentProofUrl: r.paymentProofUrl,
              verifiedAt: r.reviewedAt,
              verifiedBy: r.verifiedBy,
              adminNotes: r.adminNotes,
              createdAt: r.submittedAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Merge payment requests error:', e);
    }

    return list;
  }

  public getAllLicensesLocal(): UserLicense[] {
    const list: UserLicense[] = [];
    const seenIds = new Set<string>();
    const now = Date.now();

    try {
      const raw = localStorage.getItem(STORAGE_LICENSES_KEY);
      if (raw) {
        const parsed: UserLicense[] = JSON.parse(raw);
        for (const lic of parsed) {
          if (!seenIds.has(lic.id)) {
            seenIds.add(lic.id);
            const isExpired = lic.status === 'ACTIVE' && new Date(lic.expiryDate).getTime() <= now;
            list.push({
              ...lic,
              status: isExpired ? ('EXPIRED' as const) : lic.status,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Licenses parse error:', e);
    }

    // Merge from playroom_user_licenses
    try {
      const rawUserLic = localStorage.getItem('playroom_user_licenses');
      if (rawUserLic) {
        const parsedUserLic = JSON.parse(rawUserLic);
        for (const ul of parsedUserLic) {
          if (!seenIds.has(ul.id)) {
            seenIds.add(ul.id);
            const isExpired = ul.status === 'ACTIVE' && new Date(ul.expiryDate).getTime() <= now;
            list.push({
              id: ul.id,
              userId: ul.userId,
              userEmail: ul.userEmail,
              licenseType: ul.licenseType,
              unlockedLevels: ul.unlockedLevels || (ul.licenseType === 'all_activities' ? [1, 2, 3, 4, 5, 6] : [2]),
              allActivitiesUnlocked: Boolean(ul.allActivitiesUnlocked),
              paymentId: ul.paymentRequestId || 'manual',
              startDate: ul.purchaseDate || new Date().toISOString(),
              expiryDate: ul.expiryDate,
              status: isExpired ? ('EXPIRED' as const) : ul.status,
              verificationType: ul.verificationType || 'ADMIN_VERIFIED',
              verifiedBy: ul.verifiedBy || 'School Administrator',
              pricePaid: ul.pricePaid || 800,
              currency: ul.currency || 'PKR',
              createdAt: ul.purchaseDate || new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Merge user licenses error:', e);
    }

    return list;
  }

  public getUserLicenses(userEmail: string): UserLicense[] {
    return this.getAllLicensesLocal().filter(
      (l) => l.userEmail.toLowerCase() === userEmail.toLowerCase()
    );
  }

  public getUserPayments(userEmail: string): PaymentRecord[] {
    return this.getAllPaymentsLocal().filter(
      (p) => p.userEmail.toLowerCase() === userEmail.toLowerCase()
    );
  }

  public async fetchSchoolLicensesFromSupabase(): Promise<SchoolLicense[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // Fetch schools map for enrichment
        let schoolsMap: { [id: string]: any } = {};
        try {
          const { data: schoolsData } = await supabase.from('schools').select('*');
          if (schoolsData && Array.isArray(schoolsData)) {
            for (const sch of schoolsData) {
              if (sch.id) schoolsMap[sch.id] = sch;
            }
          }
        } catch (_) {}

        const { data, error } = await supabase
          .from('school_licenses')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const now = Date.now();
          const mapped: SchoolLicense[] = data.map((d: any) => {
            const relatedSchool = (d.school_id && schoolsMap[d.school_id]) ? schoolsMap[d.school_id] : {};
            const expiryField = d.valid_until || d.expiry_date;
            const exp = expiryField ? new Date(expiryField).getTime() : NaN;
            const isExpired = !isNaN(exp) && exp <= now;
            
            const rawStatus = (d.status || 'PENDING').toUpperCase();
            let status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING' | 'NOT_ACTIVATED';
            if (rawStatus === 'REVOKED') {
              status = 'REVOKED';
            } else if (rawStatus === 'PENDING' || (!d.valid_until && !d.expiry_date && !d.valid_from && !d.start_date)) {
              status = 'PENDING';
            } else if (isExpired) {
              status = 'EXPIRED';
            } else {
              status = 'ACTIVE';
            }

            return {
              id: d.id,
              licenseKey: d.license_key || d.id,
              schoolId: d.school_id || d.id,
              schoolName: d.school_name || relatedSchool.school_name || 'School Partner',
              schoolAdminName: d.school_admin_name || relatedSchool.school_admin_name || relatedSchool.contact_name || 'School Administrator',
              contactName: d.contact_name || relatedSchool.contact_name || relatedSchool.school_admin_name || 'School Administrator',
              contactEmail: d.contact_email || relatedSchool.contact_email || '',
              country: d.country || relatedSchool.country || 'Pakistan',
              city: d.city || relatedSchool.address || 'Karachi',
              price: Number(d.price) || 0,
              currency: d.currency || 'PKR',
              allowedDevices: d.allowed_devices || 999999,
              page1Access: d.page1_access !== false,
              page2Access: d.page2_access !== false,
              startDate: d.valid_from || d.start_date || null,
              expiryDate: d.valid_until || d.expiry_date || null,
              validFrom: d.valid_from || d.start_date || null,
              validUntil: d.valid_until || d.expiry_date || null,
              status,
              durationMonths: d.duration_months || 1,
              durationDays: 30,
              createdBy: d.created_by || d.verified_by,
              verifiedBy: d.verified_by || d.created_by,
              adminNotes: d.admin_notes,
              createdAt: d.created_at || new Date().toISOString(),
            };
          });

          // Sync with local storage
          localStorage.setItem(STORAGE_SCHOOL_LICENSES_KEY, JSON.stringify(mapped));
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetch school licenses error:', err);
      }
    }
    return this.getAllSchoolLicensesLocal();
  }

  public async fetchSchoolRequestsFromSupabase(): Promise<SchoolPaymentRequest[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const mapped: SchoolPaymentRequest[] = [];
        const seenIds = new Set<string>();

        // 1. Fetch schools list for data enrichment
        let schoolsMap: { [id: string]: any } = {};
        try {
          const { data: schoolsData } = await supabase.from('schools').select('*');
          if (schoolsData && Array.isArray(schoolsData)) {
            for (const sch of schoolsData) {
              if (sch.id) schoolsMap[sch.id] = sch;
            }
          }
        } catch (_) {}

        // 2. Fetch from public.school_request (singular)
        try {
          const { data: singularData, error: singularErr } = await supabase
            .from('school_request')
            .select('*')
            .order('created_at', { ascending: false });

          if (!singularErr && singularData && Array.isArray(singularData)) {
            for (const d of singularData) {
              if (!d.id || seenIds.has(d.id)) continue;
              seenIds.add(d.id);
              const relatedSchool = schoolsMap[d.school_id] || {};

              mapped.push({
                id: d.id,
                schoolName: relatedSchool.school_name || d.school_name || 'Partner School',
                schoolAdminName: relatedSchool.school_admin_name || d.requested_by || 'School Administrator',
                contactName: relatedSchool.school_admin_name || d.requested_by || 'School Administrator',
                contactEmail: relatedSchool.contact_email || d.contact_email || '',
                contactPhone: relatedSchool.phone || d.phone || '',
                city: relatedSchool.address || d.city || 'Karachi',
                country: 'Pakistan',
                estimatedStudents: relatedSchool.student_count || 100,
                allowedDevices: relatedSchool.device_limit || 999999,
                durationMonths: 1,
                amount: 25000,
                currency: (relatedSchool.currency as Currency) || 'PKR',
                paymentMethod: 'bank_transfer',
                transactionReference: 'INQUIRY-' + d.id.substring(d.id.length - 6).toUpperCase(),
                paymentDate: d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                notes: d.subject ? `[Subject: ${d.subject}] ${d.message || ''}` : (d.message || ''),
                schoolMessage: d.message,
                status: 'PENDING',
                submittedAt: d.created_at || new Date().toISOString(),
                createdAt: d.created_at || new Date().toISOString(),
                page1Access: true,
                page2Access: true,
              });
            }
          }
        } catch (e) {
          console.warn('Supabase fetch school_request singular error:', e);
        }

        // 3. Fetch from public.school_requests (plural)
        try {
          const { data, error } = await supabase
            .from('school_requests')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data && Array.isArray(data)) {
            for (const d of data) {
              if (!d.id || seenIds.has(d.id)) continue;
              seenIds.add(d.id);
              const relatedSchool = schoolsMap[d.school_id] || {};

              mapped.push({
                id: d.id,
                schoolName: d.school_name || relatedSchool.school_name || d.name || 'Partner School',
                schoolAdminName: d.admin_name || relatedSchool.school_admin_name || d.contact_name || d.requested_by || 'School Administrator',
                contactName: d.contact_name || relatedSchool.school_admin_name || d.admin_name || d.requested_by || 'School Administrator',
                contactEmail: d.contact_email || relatedSchool.contact_email || d.email || '',
                contactPhone: d.phone || relatedSchool.phone || '',
                city: d.city || relatedSchool.address || 'Karachi',
                country: d.country || 'Pakistan',
                estimatedStudents: d.student_count || 100,
                allowedDevices: d.device_count || relatedSchool.device_limit || 999999,
                durationMonths: 1,
                amount: Number(d.price) || 25000,
                currency: (d.currency as Currency) || 'PKR',
                paymentMethod: 'bank_transfer',
                transactionReference: d.transaction_reference || 'REF-' + d.id.substring(0, 8),
                paymentDate: d.payment_date || (d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                notes: d.notes || d.message || '',
                schoolMessage: d.message,
                proofUrl: d.proof_url,
                status: (d.status === 'approved' ? 'VERIFIED' : d.status === 'rejected' ? 'REJECTED' : 'PENDING') as any,
                submittedAt: d.created_at || new Date().toISOString(),
                createdAt: d.created_at || new Date().toISOString(),
                page1Access: true,
                page2Access: true,
              });
            }
          }
        } catch (e) {
          console.warn('Supabase fetch school_requests plural error:', e);
        }

        if (mapped.length > 0) {
          // Merge with local storage
          const local = this.getAllSchoolPaymentRequestsLocal();
          const existingIds = new Set(mapped.map((m) => m.id));
          for (const loc of local) {
            if (!existingIds.has(loc.id)) {
              mapped.push(loc);
            }
          }
          localStorage.setItem(STORAGE_SCHOOL_REQUESTS_KEY, JSON.stringify(mapped));
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetch school requests overall error:', err);
      }
    }
    return this.getAllSchoolPaymentRequestsLocal();
  }

  public getAllSchoolLicensesLocal(): SchoolLicense[] {
    try {
      const raw = localStorage.getItem(STORAGE_SCHOOL_LICENSES_KEY);
      if (raw) {
        const now = Date.now();
        const list: SchoolLicense[] = JSON.parse(raw);
        return list.map((lic) => {
          if (lic.status === 'ACTIVE' && new Date(lic.expiryDate).getTime() <= now) {
            return { ...lic, status: 'EXPIRED' as const };
          }
          return lic;
        });
      }
    } catch (e) {
      console.warn('School licenses parse error:', e);
    }
    return [];
  }

  /**
   * 5. Payment Issues & Disputes
   */
  public async createPaymentIssue(params: {
    paymentId: string;
    orderId?: string;
    userId: string;
    userEmail: string;
    paymentMethod: PaymentMethod;
    amount: number;
    currency: Currency;
    transactionId: string;
    paymentDate: string;
    userMessage: string;
  }): Promise<{ success: boolean; issue?: PaymentIssue; error?: string }> {
    const issue: PaymentIssue = {
      id: 'iss_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      paymentId: params.paymentId,
      orderId: params.orderId,
      userId: params.userId,
      userEmail: params.userEmail.toLowerCase().trim(),
      paymentMethod: params.paymentMethod,
      amount: params.amount,
      currency: params.currency,
      transactionId: params.transactionId,
      paymentDate: params.paymentDate,
      userMessage: params.userMessage,
      status: 'OPEN',
      submittedAt: new Date().toISOString(),
    };

    // Save locally
    const issues = this.getAllPaymentIssuesLocal();
    issues.unshift(issue);
    localStorage.setItem(STORAGE_DISPUTES_KEY, JSON.stringify(issues));

    // Try backend sync
    try {
      await fetch('/api/payment/dispute/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issue),
      });
    } catch (e) {
      console.warn('Dispute backend sync error:', e);
    }

    // Sync to Supabase payment_issues table
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('payment_issues').insert([
          {
            id: issue.id,
            payment_id: issue.paymentId,
            order_id: issue.orderId || null,
            user_id: issue.userId,
            user_email: issue.userEmail,
            payment_method: issue.paymentMethod,
            amount: issue.amount,
            currency: issue.currency,
            transaction_reference: issue.transactionId,
            payment_date: issue.paymentDate,
            message: issue.userMessage,
            status: issue.status,
            created_at: issue.submittedAt,
          },
        ]);
      } catch (e) {
        console.warn('Supabase payment_issues insert sync:', e);
      }
    }

    return { success: true, issue };
  }

  public getAllPaymentIssuesLocal(): PaymentIssue[] {
    try {
      const raw = localStorage.getItem(STORAGE_DISPUTES_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Disputes parse error:', e);
    }
    return [];
  }

  public getUserPaymentIssues(userEmail: string): PaymentIssue[] {
    return this.getAllPaymentIssuesLocal().filter(
      (d) => d.userEmail.toLowerCase() === userEmail.toLowerCase()
    );
  }

  public async adminResolveDispute(
    disputeId: string,
    action: 'APPROVE' | 'REJECT_NOT_RECEIVED' | 'KEEP_PENDING',
    adminNotes?: string,
    verifiedBy: string = 'School Administrator'
  ): Promise<{ success: boolean; issue?: PaymentIssue; license?: UserLicense; error?: string }> {
    const issues = this.getAllPaymentIssuesLocal();
    const issueIndex = issues.findIndex((d) => d.id === disputeId);
    if (issueIndex === -1) {
      return { success: false, error: 'Dispute record not found' };
    }

    const issue = issues[issueIndex];
    const now = new Date().toISOString();

    let newDisputeStatus: DisputeStatus = 'UNDER_REVIEW';
    let defaultResponse = '';

    if (action === 'APPROVE') {
      newDisputeStatus = 'RESOLVED_APPROVED';
      defaultResponse = 'Payment Approved — Your Premium Access is now active.';

      // Approve underlying payment and generate 1-Month license
      const verifyRes = await this.adminVerifyPayment(
        issue.paymentId,
        'VERIFY',
        adminNotes || 'Approved via Dispute Audit',
        verifiedBy
      );

      issue.status = newDisputeStatus;
      issue.adminResponse = adminNotes || defaultResponse;
      issue.resolvedAt = now;
      issue.resolvedBy = verifiedBy;
      issues[issueIndex] = issue;
      localStorage.setItem(STORAGE_DISPUTES_KEY, JSON.stringify(issues));

      // Sync Supabase payment_issues
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('payment_issues')
            .update({
              status: newDisputeStatus,
              admin_note: issue.adminResponse,
              resolved_at: now,
              resolved_by: verifiedBy,
            })
            .eq('id', issue.id);
        } catch (e) {
          console.warn('Supabase payment_issues resolve error:', e);
        }
      }

      return { success: true, issue, license: verifyRes.license };
    } else if (action === 'REJECT_NOT_RECEIVED') {
      newDisputeStatus = 'RESOLVED_REJECTED';
      defaultResponse = 'Your payment could not be verified. Premium access remains locked.';

      // Reject underlying payment (no license created)
      await this.adminVerifyPayment(
        issue.paymentId,
        'REJECT',
        adminNotes || 'PAYMENT NOT RECEIVED',
        verifiedBy
      );

      issue.status = newDisputeStatus;
      issue.adminResponse = adminNotes || defaultResponse;
      issue.resolvedAt = now;
      issue.resolvedBy = verifiedBy;
      issues[issueIndex] = issue;
      localStorage.setItem(STORAGE_DISPUTES_KEY, JSON.stringify(issues));

      // Sync Supabase payment_issues
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('payment_issues')
            .update({
              status: newDisputeStatus,
              admin_note: issue.adminResponse,
              resolved_at: now,
              resolved_by: verifiedBy,
            })
            .eq('id', issue.id);
        } catch (e) {
          console.warn('Supabase payment_issues reject error:', e);
        }
      }

      return { success: true, issue };
    } else {
      // KEEP_PENDING
      newDisputeStatus = 'UNDER_REVIEW';
      defaultResponse = 'Payment Approval Pending';

      issue.status = newDisputeStatus;
      issue.adminResponse = adminNotes || defaultResponse;
      issues[issueIndex] = issue;
      localStorage.setItem(STORAGE_DISPUTES_KEY, JSON.stringify(issues));

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('payment_issues')
            .update({
              status: newDisputeStatus,
              admin_note: issue.adminResponse,
            })
            .eq('id', issue.id);
        } catch (e) {
          console.warn('Supabase payment_issues keep pending error:', e);
        }
      }

      return { success: true, issue };
    }
  }
}
