import { getSupabaseClient } from '../utils/supabaseClient';
import { generateUUID, isValidUUID } from '../utils/uuid';
import {
  ProfileRecord,
  PlanRecord,
  PurchaseRecord,
  SchoolRecord,
  SchoolDeviceRecord,
  SchoolRequestRecord,
  SchoolMessageRecord,
  SchoolPaymentRecord,
  IndividualPaymentRecord,
  PaymentMethodConfigRecord,
  ContentRecord,
  AdminSettingRecord,
  Currency,
} from '../types/payment';

export type {
  ProfileRecord,
  PlanRecord,
  PurchaseRecord,
  SchoolRecord,
  SchoolDeviceRecord,
  SchoolRequestRecord,
  SchoolMessageRecord,
  SchoolPaymentRecord,
  IndividualPaymentRecord,
  PaymentMethodConfigRecord,
  ContentRecord,
  AdminSettingRecord,
};

// Storage keys for resilient local synchronization
const STORAGE_KEYS = {
  PROFILES: 'playroom_db_profiles',
  SCHOOLS: 'playroom_db_schools',
  PLANS: 'playroom_db_plans',
  PURCHASES: 'playroom_db_purchases',
  SCHOOL_DEVICES: 'playroom_db_school_devices',
  SCHOOL_REQUESTS: 'playroom_db_school_requests',
  SCHOOL_MESSAGES: 'playroom_db_school_messages',
  SCHOOL_PAYMENTS: 'playroom_db_school_payments',
  INDIVIDUAL_PAYMENTS: 'playroom_db_individual_payments',
  PAYMENT_METHODS: 'playroom_db_payment_methods',
  CONTENT: 'playroom_db_content',
  ADMIN_SETTINGS: 'playroom_db_admin_settings',
};

// Initial Seed Data Fallbacks (used if Supabase is offline or not yet seeded)
export const DEFAULT_PLANS: PlanRecord[] = [
  {
    id: 'indiv_level_1',
    name: 'Level 1: Nursery Explorers (Free Starter)',
    description: 'Playful foundation with letter shapes, first sounds, and colors.',
    type: 'individual',
    pricePkr: 0,
    priceUsd: 0,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: 1,
    isActive: true,
  },
  {
    id: 'indiv_level_2',
    name: 'Level 2: Phonics & Math Beginners',
    description: 'Beginning letter sounds, counting up to 10, pattern recognition.',
    type: 'individual',
    pricePkr: 800,
    priceUsd: 5,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: 2,
    isActive: true,
  },
  {
    id: 'indiv_level_3',
    name: 'Level 3: Early Word Builders & Addition',
    description: 'Word blends, simple addition, rhyming words, and classification.',
    type: 'individual',
    pricePkr: 800,
    priceUsd: 5,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: 3,
    isActive: true,
  },
  {
    id: 'indiv_level_4',
    name: 'Level 4: Reading Sentences & Math Explorer',
    description: 'Sentence construction, subtraction, 2D/3D shapes, and logic.',
    type: 'individual',
    pricePkr: 800,
    priceUsd: 5,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: 4,
    isActive: true,
  },
  {
    id: 'indiv_level_5',
    name: 'Level 5: Advanced Kindergarten Phonics & Logic',
    description: 'Complex phonics, reading comprehension, skip counting, time & money.',
    type: 'individual',
    pricePkr: 800,
    priceUsd: 5,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: 5,
    isActive: true,
  },
  {
    id: 'indiv_level_6',
    name: 'Level 6: Grade 1 Readiness & Mastery',
    description: 'Fluent reading, critical thinking puzzles, multi-step math challenges.',
    type: 'individual',
    pricePkr: 800,
    priceUsd: 5,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: 6,
    isActive: true,
  },
  {
    id: 'indiv_all_activities',
    name: 'All Activities (Full Access)',
    description: 'Unlock 100% full access to all preschool learning activities, phonics, math, and games for 1 month.',
    type: 'individual',
    pricePkr: 5000,
    priceUsd: 20,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 1,
    levelNumber: null,
    isActive: true,
  },
  {
    id: 'school_license_30d',
    name: 'School License (30 Days)',
    description: 'Preschool license for unlimited classroom devices with full Playroom and Preschool Educator Hub access for 30 days.',
    type: 'school',
    pricePkr: 25000,
    priceUsd: 100,
    durationMonths: 1,
    durationDays: 30,
    deviceLimit: 999999,
    levelNumber: null,
    isActive: true,
  },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfigRecord[] = [
  {
    id: 'pm_payoneer',
    name: 'Payoneer',
    paymentScope: 'individual',
    receivingEmail: 'payments@playroomapp.com',
    accountTitle: 'Playroom Global Education LLC',
    bankName: 'Payoneer USD Receiving Account',
    instructions: 'Send USD payment via Payoneer to payments@playroomapp.com. Copy your Payoneer Transaction ID and enter it below with screenshot proof.',
    isActive: true,
  },
  {
    id: 'pm_sadapay',
    name: 'SadaPay',
    paymentScope: 'both',
    accountTitle: 'Playroom Education Services',
    accountNumber: '03001234567',
    bankName: 'SadaPay Microfinance Bank',
    iban: 'PK00SADA00000003001234567',
    instructions: 'Transfer to SadaPay account 03001234567 (Playroom Education Services). Enter your 6-digit transaction ID and upload payment screenshot receipt.',
    isActive: true,
  },
  {
    id: 'pm_jazzcash',
    name: 'JazzCash',
    paymentScope: 'both',
    accountTitle: 'Playroom Education Services',
    accountNumber: '03009876543',
    bankName: 'JazzCash / Mobilink Microfinance Bank',
    instructions: 'Transfer fee via JazzCash app to 03009876543. Enter transaction ID (TID) and upload screenshot receipt.',
    isActive: true,
  },
  {
    id: 'pm_bank_transfer',
    name: 'Bank Transfer',
    paymentScope: 'both',
    accountTitle: 'Playroom Education Private Limited',
    accountNumber: '1234567890123456',
    bankName: 'Meezan Bank Ltd',
    iban: 'PK90MEZN0012345678901234',
    instructions: 'Direct IBFT transfer to Meezan Bank, Account: 1234567890123456. Enter bank transaction reference number and upload receipt.',
    isActive: true,
  },
];

export const DEFAULT_SCHOOLS: SchoolRecord[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    schoolName: 'Bright Start Academy',
    schoolAdminName: 'Principal Sarah Khan',
    contactEmail: 'admin@brightstart.edu.pk',
    phone: '+92 300 1234567',
    address: 'Gulberg III, Lahore, Pakistan',
    status: 'ACTIVE',
    accountStatus: 'active',
    paymentStatus: 'paid',
    planId: 'school_monthly',
    deviceLimit: 15,
    customPrice: 20000,
    customDeviceLimit: 20,
    customDealNote: 'Special institutional discount approved for 20 devices.',
    currency: 'PKR',
    subscriptionStart: new Date().toISOString(),
    subscriptionExpiry: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    schoolName: 'Sunshine Montessori & Kindergarten',
    schoolAdminName: 'Director Ayesha Malik',
    contactEmail: 'contact@sunshinemontessori.edu.pk',
    phone: '+92 321 9876543',
    address: 'F-7/2, Islamabad, Pakistan',
    status: 'ACTIVE',
    accountStatus: 'active',
    paymentStatus: 'paid',
    planId: 'school_3months',
    deviceLimit: 15,
    customPrice: null,
    customDeviceLimit: 15,
    customDealNote: null,
    currency: 'PKR',
    subscriptionStart: new Date().toISOString(),
    subscriptionExpiry: new Date(Date.now() + 90 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];


function getStoredItem<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setStoredItem<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export class SupabaseDataService {
  private static instance: SupabaseDataService;

  private constructor() {
    this.initLocalStorage();
  }

  public static getInstance(): SupabaseDataService {
    if (!SupabaseDataService.instance) {
      SupabaseDataService.instance = new SupabaseDataService();
    }
    return SupabaseDataService.instance;
  }

  private initLocalStorage() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.PLANS)) {
      setStoredItem(STORAGE_KEYS.PLANS, DEFAULT_PLANS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS)) {
      setStoredItem(STORAGE_KEYS.PAYMENT_METHODS, DEFAULT_PAYMENT_METHODS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SCHOOLS)) {
      setStoredItem(STORAGE_KEYS.SCHOOLS, DEFAULT_SCHOOLS);
    }
  }

  // ============================================================================
  // 1. PLANS
  // ============================================================================
  async getPlans(type?: 'individual' | 'school'): Promise<PlanRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('plans').select('*').eq('is_active', true);
        if (type) q = q.eq('type', type);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          const mapped: PlanRecord[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description || '',
            type: d.type,
            pricePkr: Number(d.price_pkr) || 0,
            priceUsd: Number(d.price_usd) || 0,
            durationMonths: d.duration_months || 1,
            durationDays: d.duration_days || (d.duration_months || 1) * 30,
            deviceLimit: d.device_limit || (d.type === 'school' ? 15 : 1),
            levelNumber: d.level_number,
            isActive: d.is_active,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
          setStoredItem(STORAGE_KEYS.PLANS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch plans:', err);
      }
    }
    const local = getStoredItem<PlanRecord[]>(STORAGE_KEYS.PLANS, DEFAULT_PLANS);
    return type ? local.filter((p) => p.type === type) : local;
  }

  // ============================================================================
  // 2. PAYMENT METHODS
  // ============================================================================
  async getPaymentMethods(scope?: 'individual' | 'school'): Promise<PaymentMethodConfigRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('payment_methods').select('*').eq('is_active', true);
        if (scope) {
          q = q.or(`payment_scope.eq.${scope},payment_scope.eq.both`);
        }
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          const mapped: PaymentMethodConfigRecord[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            paymentScope: d.payment_scope,
            receivingEmail: d.receiving_email,
            accountTitle: d.account_title,
            accountNumber: d.account_number,
            bankName: d.bank_name,
            iban: d.iban,
            instructions: d.instructions || '',
            isActive: d.is_active,
            createdAt: d.created_at,
          }));
          setStoredItem(STORAGE_KEYS.PAYMENT_METHODS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch payment methods:', err);
      }
    }
    const local = getStoredItem<PaymentMethodConfigRecord[]>(STORAGE_KEYS.PAYMENT_METHODS, DEFAULT_PAYMENT_METHODS);
    if (!scope) return local;
    return local.filter((pm) => pm.paymentScope === scope || pm.paymentScope === 'both');
  }

  async savePaymentMethod(pm: PaymentMethodConfigRecord): Promise<boolean> {
    const local = getStoredItem<PaymentMethodConfigRecord[]>(STORAGE_KEYS.PAYMENT_METHODS, DEFAULT_PAYMENT_METHODS);
    const idx = local.findIndex((p) => p.id === pm.id);
    if (idx >= 0) local[idx] = pm;
    else local.push(pm);
    setStoredItem(STORAGE_KEYS.PAYMENT_METHODS, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('payment_methods').upsert({
          id: pm.id,
          name: pm.name,
          payment_scope: pm.paymentScope,
          receiving_email: pm.receivingEmail,
          account_title: pm.accountTitle,
          account_number: pm.accountNumber,
          bank_name: pm.bankName,
          iban: pm.iban,
          instructions: pm.instructions,
          is_active: pm.isActive,
        });
        return true;
      } catch (err) {
        console.error('[Supabase] Error saving payment method:', err);
      }
    }
    return true;
  }

  // ============================================================================
  // 3. SCHOOLS & CUSTOM PRICING DEALS
  // ============================================================================
  async getSchools(): Promise<SchoolRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          const mapped: SchoolRecord[] = data.map((d: any) => ({
            id: d.id,
            schoolName: d.school_name,
            schoolAdminName: d.school_admin_name || d.contact_name || 'School Administrator',
            contactName: d.contact_name || d.school_admin_name || 'School Administrator',
            contactEmail: d.contact_email,
            phone: d.phone,
            address: d.address,
            country: d.country,
            status: d.status || 'ACTIVE',
            accountStatus: d.account_status || 'active',
            paymentStatus: d.payment_status || 'unpaid',
            planId: d.plan_id,
            deviceLimit: d.device_limit || 15,
            customPrice: d.custom_price ? Number(d.custom_price) : null,
            customDeviceLimit: d.custom_device_limit ? Number(d.custom_device_limit) : null,
            customDealNote: d.custom_deal_note || null,
            currency: d.currency || 'PKR',
            subscriptionStart: d.subscription_start,
            subscriptionExpiry: d.subscription_expiry,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
          setStoredItem(STORAGE_KEYS.SCHOOLS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching schools:', err);
      }
    }
    return getStoredItem<SchoolRecord[]>(STORAGE_KEYS.SCHOOLS, DEFAULT_SCHOOLS);
  }

  async getSchoolByEmail(email: string): Promise<SchoolRecord | null> {
    const schools = await this.getSchools();
    const normalized = email.trim().toLowerCase();
    return schools.find((s) => s.contactEmail.trim().toLowerCase() === normalized) || null;
  }

  async getSchoolById(schoolId: string): Promise<SchoolRecord | null> {
    const schools = await this.getSchools();
    return schools.find((s) => s.id === schoolId) || null;
  }

  async createOrUpdateSchool(school: Partial<SchoolRecord> & { contactEmail: string; schoolName: string }): Promise<SchoolRecord> {
    const now = new Date().toISOString();
    const existing = await this.getSchoolByEmail(school.contactEmail);
    const schoolId = (school.id && isValidUUID(school.id)) 
      ? school.id 
      : (existing?.id && isValidUUID(existing.id)) 
        ? existing.id 
        : generateUUID();

    const adminName = school.schoolAdminName || school.contactName || existing?.schoolAdminName || 'School Administrator';
    const record: SchoolRecord = {
      id: schoolId,
      schoolName: school.schoolName,
      schoolAdminName: adminName,
      contactName: adminName,
      contactEmail: school.contactEmail.trim().toLowerCase(),
      phone: school.phone || existing?.phone || '',
      address: school.address || existing?.address || '',
      country: school.country || existing?.country || '',
      status: school.status || existing?.status || 'ACTIVE',
      accountStatus: school.accountStatus || existing?.accountStatus || 'active',
      paymentStatus: school.paymentStatus || existing?.paymentStatus || 'unpaid',
      planId: school.planId || existing?.planId || 'school_monthly',
      deviceLimit: school.deviceLimit ?? existing?.deviceLimit ?? 15,
      customPrice: school.customPrice ?? existing?.customPrice ?? null,
      customDeviceLimit: school.customDeviceLimit ?? existing?.customDeviceLimit ?? null,
      customDealNote: school.customDealNote ?? existing?.customDealNote ?? null,
      currency: school.currency || existing?.currency || 'PKR',
      subscriptionStart: school.subscriptionStart || existing?.subscriptionStart || null,
      subscriptionExpiry: school.subscriptionExpiry || existing?.subscriptionExpiry || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const local = getStoredItem<SchoolRecord[]>(STORAGE_KEYS.SCHOOLS, DEFAULT_SCHOOLS);
    const idx = local.findIndex((s) => s.id === schoolId);
    if (idx >= 0) local[idx] = record;
    else local.push(record);
    setStoredItem(STORAGE_KEYS.SCHOOLS, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const adminName = record.schoolAdminName || record.contactName || 'School Administrator';
        await supabase.from('schools').upsert({
          id: record.id,
          school_name: record.schoolName,
          contact_name: adminName,
          contact_email: record.contactEmail,
          country: record.country || null,
          account_status: record.accountStatus || 'active',
          payment_status: record.paymentStatus || 'unpaid',
          device_limit: record.deviceLimit || 15,
          custom_device_limit: record.customDeviceLimit || null,
          custom_deal_note: record.customDealNote || null,
          custom_price: record.customPrice || null,
          currency: record.currency || 'PKR',
        }, { onConflict: 'id' });
      } catch (err) {
        console.error('[Supabase] Error persisting school:', err);
      }
    }
    return record;
  }

  async updateSchoolCustomDeal(
    schoolId: string,
    customPrice: number | null,
    customDeviceLimit: number | null,
    customDealNote: string | null
  ): Promise<boolean> {
    const school = await this.getSchoolById(schoolId);
    if (!school) return false;

    return Boolean(
      await this.createOrUpdateSchool({
        ...school,
        customPrice,
        customDeviceLimit,
        customDealNote,
      })
    );
  }

  // ============================================================================
  // 4. SCHOOL DEVICE LIMIT & REGISTRATION
  // ============================================================================
  async getSchoolDevices(schoolId?: string): Promise<SchoolDeviceRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('school_devices').select('*').order('registered_at', { ascending: false });
        if (schoolId) q = q.eq('school_id', schoolId);
        const { data, error } = await q;
        if (!error && data) {
          const mapped: SchoolDeviceRecord[] = data.map((d: any) => ({
            id: d.id,
            schoolId: d.school_id,
            deviceIdentifier: d.device_id,
            deviceId: d.device_id,
            deviceName: d.device_name || 'Classroom Device',
            registeredAt: d.registered_at,
            lastLogin: d.last_login,
            status: d.is_active ? 'ACTIVE' : 'REVOKED',
            isActive: Boolean(d.is_active),
          }));
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching school devices:', err);
      }
    }
    const local = getStoredItem<SchoolDeviceRecord[]>(STORAGE_KEYS.SCHOOL_DEVICES, []);
    return schoolId ? local.filter((d) => d.schoolId === schoolId) : local;
  }

  async canRegisterSchoolDevice(schoolId: string): Promise<{
    allowed: boolean;
    error?: string;
    currentCount?: number;
    maxLimit?: number;
    slotsRemaining?: number;
  }> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('can_register_school_device', { p_school_id: schoolId });
        if (!error && data) {
          return {
            allowed: data.allowed,
            error: data.error,
            currentCount: data.current_count,
            maxLimit: data.max_limit,
            slotsRemaining: data.slots_remaining,
          };
        }
      } catch (e) {
        console.warn('[Supabase] can_register_school_device RPC check fallback:', e);
      }
    }

    // Fallback logic in code
    const school = await this.getSchoolById(schoolId);
    if (!school) return { allowed: false, error: 'School not found' };

    const devices = await this.getSchoolDevices(schoolId);
    const activeCount = devices.filter((d) => d.isActive).length;

    return {
      allowed: true,
      currentCount: activeCount,
      maxLimit: 999999,
      slotsRemaining: 999999,
    };
  }

  async registerSchoolDevice(schoolId: string, deviceId: string, deviceName?: string): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();
    const recId = 'sdev_' + Math.random().toString(36).substring(2, 9);
    const deviceRecord: SchoolDeviceRecord = {
      id: recId,
      schoolId,
      deviceIdentifier: deviceId,
      deviceId,
      deviceName: deviceName || 'Classroom Tablet',
      registeredAt: now,
      lastLogin: now,
      status: 'ACTIVE',
      isActive: true,
    };

    const local = getStoredItem<SchoolDeviceRecord[]>(STORAGE_KEYS.SCHOOL_DEVICES, []);
    const existingIdx = local.findIndex((d) => d.schoolId === schoolId && d.deviceIdentifier === deviceId);
    if (existingIdx >= 0) {
      local[existingIdx].isActive = true;
      local[existingIdx].status = 'ACTIVE';
      local[existingIdx].lastLogin = now;
    } else {
      local.push(deviceRecord);
    }
    setStoredItem(STORAGE_KEYS.SCHOOL_DEVICES, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_devices').upsert({
          id: recId,
          school_id: schoolId,
          device_id: deviceId,
          device_name: deviceName || 'Classroom Device',
          registered_at: now,
          is_active: true,
          last_login: now,
        });
      } catch (err) {
        console.error('[Supabase] Error registering school device:', err);
      }
    }
    return { success: true };
  }

  async setSchoolDeviceActive(deviceId: string, isActive: boolean): Promise<boolean> {
    const local = getStoredItem<SchoolDeviceRecord[]>(STORAGE_KEYS.SCHOOL_DEVICES, []);
    const d = local.find((item) => item.id === deviceId || item.deviceIdentifier === deviceId);
    if (d) {
      d.isActive = isActive;
      d.status = isActive ? 'ACTIVE' : 'REVOKED';
      setStoredItem(STORAGE_KEYS.SCHOOL_DEVICES, local);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_devices').update({ is_active: isActive }).or(`id.eq.${deviceId},device_id.eq.${deviceId}`);
        return true;
      } catch (err) {
        console.error('[Supabase] Error toggling school device:', err);
      }
    }
    return true;
  }

  // ============================================================================
  // 5. SCHOOL REQUESTS
  // ============================================================================
  async getSchoolRequests(schoolId?: string): Promise<SchoolRequestRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('school_requests').select('*').order('created_at', { ascending: false });
        if (schoolId) q = q.eq('school_id', schoolId);
        const { data, error } = await q;
        if (!error && data) {
          const mapped: SchoolRequestRecord[] = data.map((d: any) => ({
            id: d.id,
            schoolId: d.school_id,
            requestedBy: d.requested_by,
            subject: d.subject,
            message: d.message,
            status: d.status,
            adminReply: d.admin_reply,
            repliedAt: d.replied_at,
            createdAt: d.created_at,
          }));
          setStoredItem(STORAGE_KEYS.SCHOOL_REQUESTS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching school requests:', err);
      }
    }
    const local = getStoredItem<SchoolRequestRecord[]>(STORAGE_KEYS.SCHOOL_REQUESTS, []);
    return schoolId ? local.filter((r) => r.schoolId === schoolId) : local;
  }

  async submitSchoolRequest(schoolId: string, requestedBy: string, subject: string, message: string): Promise<SchoolRequestRecord> {
    const now = new Date().toISOString();
    const validSchoolId = isValidUUID(schoolId) ? schoolId : generateUUID();
    const reqRecord: SchoolRequestRecord = {
      id: generateUUID(),
      schoolId: validSchoolId,
      requestedBy,
      subject,
      message,
      status: 'pending',
      createdAt: now,
    };

    const local = getStoredItem<SchoolRequestRecord[]>(STORAGE_KEYS.SCHOOL_REQUESTS, []);
    local.unshift(reqRecord);
    setStoredItem(STORAGE_KEYS.SCHOOL_REQUESTS, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_requests').insert({
          id: reqRecord.id,
          school_id: validSchoolId,
          requested_by: requestedBy,
          subject,
          message,
          status: 'pending',
          created_at: now,
        });
      } catch (err) {
        console.error('[Supabase] Error inserting school request:', err);
      }
    }
    return reqRecord;
  }

  async replySchoolRequest(requestId: string, adminReply: string, newStatus: 'replied' | 'approved' | 'rejected' = 'replied'): Promise<boolean> {
    const now = new Date().toISOString();
    const local = getStoredItem<SchoolRequestRecord[]>(STORAGE_KEYS.SCHOOL_REQUESTS, []);
    const r = local.find((item) => item.id === requestId);
    if (r) {
      r.adminReply = adminReply;
      r.repliedAt = now;
      r.status = newStatus;
      setStoredItem(STORAGE_KEYS.SCHOOL_REQUESTS, local);
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_requests').update({
          admin_reply: adminReply,
          replied_at: now,
          status: newStatus,
        }).eq('id', requestId);
        return true;
      } catch (err) {
        console.error('[Supabase] Error replying to school request:', err);
      }
    }
    return true;
  }

  // ============================================================================
  // 6. SCHOOL MESSAGES (Live 2-Way Chat)
  // ============================================================================
  async getSchoolMessages(schoolId: string): Promise<SchoolMessageRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('school_messages')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: true });
        if (!error && data) {
          const mapped: SchoolMessageRecord[] = data.map((d: any) => ({
            id: d.id,
            schoolId: d.school_id,
            senderId: d.sender_id,
            senderType: d.sender_type,
            message: d.message,
            isRead: Boolean(d.is_read),
            readAt: d.read_at,
            createdAt: d.created_at,
          }));
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching school messages:', err);
      }
    }
    const local = getStoredItem<SchoolMessageRecord[]>(STORAGE_KEYS.SCHOOL_MESSAGES, []);
    return local.filter((m) => m.schoolId === schoolId);
  }

  async sendSchoolMessage(schoolId: string, senderId: string, senderType: 'school' | 'admin', message: string): Promise<SchoolMessageRecord> {
    const now = new Date().toISOString();
    const msgRecord: SchoolMessageRecord = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      schoolId,
      senderId,
      senderType,
      message,
      isRead: false,
      createdAt: now,
    };

    const local = getStoredItem<SchoolMessageRecord[]>(STORAGE_KEYS.SCHOOL_MESSAGES, []);
    local.push(msgRecord);
    setStoredItem(STORAGE_KEYS.SCHOOL_MESSAGES, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_messages').insert({
          id: msgRecord.id,
          school_id: schoolId,
          sender_id: senderId,
          sender_type: senderType,
          message,
          is_read: false,
          created_at: now,
        });
      } catch (err) {
        console.error('[Supabase] Error sending message:', err);
      }
    }
    return msgRecord;
  }

  async markSchoolMessagesAsRead(schoolId: string, senderTypeToMarkRead: 'school' | 'admin'): Promise<void> {
    const now = new Date().toISOString();
    const local = getStoredItem<SchoolMessageRecord[]>(STORAGE_KEYS.SCHOOL_MESSAGES, []);
    local.forEach((m) => {
      if (m.schoolId === schoolId && m.senderType === senderTypeToMarkRead) {
        m.isRead = true;
        m.readAt = now;
      }
    });
    setStoredItem(STORAGE_KEYS.SCHOOL_MESSAGES, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('school_messages')
          .update({ is_read: true, read_at: now })
          .eq('school_id', schoolId)
          .eq('sender_type', senderTypeToMarkRead);
      } catch (err) {
        console.error('[Supabase] Error marking messages read:', err);
      }
    }
  }

  // ============================================================================
  // 7. SCHOOL PAYMENTS (Approval & Rejection)
  // ============================================================================
  async getSchoolPayments(schoolId?: string): Promise<SchoolPaymentRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('school_payments').select('*').order('created_at', { ascending: false });
        if (schoolId) q = q.eq('school_id', schoolId);
        const { data, error } = await q;
        if (!error && data) {
          const mapped: SchoolPaymentRecord[] = data.map((d: any) => ({
            id: d.id,
            schoolId: d.school_id,
            schoolName: d.school_name,
            planId: d.plan_id,
            standardPrice: Number(d.standard_price) || 0,
            customPrice: d.custom_price ? Number(d.custom_price) : null,
            amount: Number(d.amount) || 0,
            currency: d.currency || 'PKR',
            deviceLimit: d.device_limit || 15,
            paymentMethod: d.payment_method,
            transactionReference: d.transaction_reference,
            paymentProofName: d.payment_proof_name,
            paymentProofUrl: d.payment_proof_url,
            status: d.status,
            adminNote: d.admin_note,
            reviewedBy: d.reviewed_by,
            reviewedAt: d.reviewed_at,
            createdAt: d.created_at,
          }));
          setStoredItem(STORAGE_KEYS.SCHOOL_PAYMENTS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching school payments:', err);
      }
    }
    const local = getStoredItem<SchoolPaymentRecord[]>(STORAGE_KEYS.SCHOOL_PAYMENTS, []);
    return schoolId ? local.filter((p) => p.schoolId === schoolId) : local;
  }

  async submitSchoolPayment(payload: {
    schoolId: string;
    schoolName: string;
    planId: string;
    standardPrice: number;
    customPrice?: number | null;
    amount: number;
    currency: Currency;
    deviceLimit: number;
    paymentMethod: 'sadapay' | 'jazzcash' | 'bank_transfer';
    transactionReference: string;
    paymentProofName?: string;
    paymentProofUrl?: string;
  }): Promise<SchoolPaymentRecord> {
    const now = new Date().toISOString();
    const paymentRecord: SchoolPaymentRecord = {
      id: 'spay_' + Math.random().toString(36).substring(2, 9),
      ...payload,
      status: 'pending',
      createdAt: now,
    };

    const local = getStoredItem<SchoolPaymentRecord[]>(STORAGE_KEYS.SCHOOL_PAYMENTS, []);
    local.unshift(paymentRecord);
    setStoredItem(STORAGE_KEYS.SCHOOL_PAYMENTS, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('school_payments').insert({
          id: paymentRecord.id,
          school_id: payload.schoolId,
          school_name: payload.schoolName,
          plan_id: payload.planId,
          standard_price: payload.standardPrice,
          custom_price: payload.customPrice,
          amount: payload.amount,
          currency: payload.currency,
          device_limit: payload.deviceLimit,
          payment_method: payload.paymentMethod,
          transaction_reference: payload.transactionReference,
          payment_proof_name: payload.paymentProofName,
          payment_proof_url: payload.paymentProofUrl,
          status: 'pending',
          created_at: now,
        });
      } catch (err) {
        console.error('[Supabase] Error inserting school payment:', err);
      }
    }
    return paymentRecord;
  }

  async approveSchoolPayment(paymentId: string, adminId: string = 'system_admin'): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('approve_school_payment', {
          p_payment_id: paymentId,
          p_admin_id: adminId,
        });
        if (!error && data?.success) {
          await this.getSchoolPayments();
          await this.getSchools();
          return { success: true };
        }
      } catch (e) {
        console.warn('[Supabase] approve_school_payment RPC fallback:', e);
      }
    }

    // Local fallback update
    const payments = getStoredItem<SchoolPaymentRecord[]>(STORAGE_KEYS.SCHOOL_PAYMENTS, []);
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment record not found' };

    payment.status = 'approved';
    payment.reviewedBy = adminId;
    payment.reviewedAt = new Date().toISOString();
    setStoredItem(STORAGE_KEYS.SCHOOL_PAYMENTS, payments);

    // Update school
    const schools = getStoredItem<SchoolRecord[]>(STORAGE_KEYS.SCHOOLS, DEFAULT_SCHOOLS);
    const sch = schools.find((s) => s.id === payment.schoolId);
    if (sch) {
      sch.paymentStatus = 'paid';
      sch.status = 'ACTIVE';
      sch.accountStatus = 'active';
      sch.subscriptionStart = new Date().toISOString();
      sch.subscriptionExpiry = new Date(Date.now() + 30 * 86400000).toISOString();
      setStoredItem(STORAGE_KEYS.SCHOOLS, schools);
    }

    return { success: true };
  }

  async rejectSchoolPayment(paymentId: string, adminId: string = 'system_admin', adminNote: string = 'Verification failed'): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('reject_school_payment', {
          p_payment_id: paymentId,
          p_admin_id: adminId,
          p_admin_note: adminNote,
        });
        if (!error && data?.success) {
          await this.getSchoolPayments();
          return { success: true };
        }
      } catch (e) {
        console.warn('[Supabase] reject_school_payment RPC fallback:', e);
      }
    }

    const payments = getStoredItem<SchoolPaymentRecord[]>(STORAGE_KEYS.SCHOOL_PAYMENTS, []);
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };

    payment.status = 'rejected';
    payment.adminNote = adminNote;
    payment.reviewedBy = adminId;
    payment.reviewedAt = new Date().toISOString();
    setStoredItem(STORAGE_KEYS.SCHOOL_PAYMENTS, payments);

    return { success: true };
  }

  // ============================================================================
  // 8. INDIVIDUAL PAYMENTS (Approval & Access Granting)
  // ============================================================================
  async getIndividualPayments(userEmail?: string): Promise<IndividualPaymentRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('individual_payments').select('*').order('created_at', { ascending: false });
        if (userEmail) q = q.eq('user_email', userEmail.trim().toLowerCase());
        const { data, error } = await q;
        if (!error && data) {
          const mapped: IndividualPaymentRecord[] = data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            userEmail: d.user_email,
            planId: d.plan_id,
            selectedLevel: d.selected_level,
            amount: Number(d.amount) || 0,
            currency: d.currency || 'PKR',
            paymentMethod: d.payment_method,
            transactionReference: d.transaction_reference,
            paymentProofName: d.payment_proof_name,
            paymentProofUrl: d.payment_proof_url,
            status: d.status,
            adminNote: d.admin_note,
            reviewedBy: d.reviewed_by,
            reviewedAt: d.reviewed_at,
            createdAt: d.created_at,
          }));
          setStoredItem(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching individual payments:', err);
      }
    }
    const local = getStoredItem<IndividualPaymentRecord[]>(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, []);
    return userEmail ? local.filter((p) => p.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) : local;
  }

  async submitIndividualPayment(payload: {
    userId: string;
    userEmail: string;
    planId: string;
    selectedLevel?: number | null;
    amount: number;
    currency: Currency;
    paymentMethod: any;
    transactionReference: string;
    paymentProofName?: string;
    paymentProofUrl?: string;
  }): Promise<IndividualPaymentRecord> {
    const now = new Date().toISOString();
    const paymentRecord: IndividualPaymentRecord = {
      id: 'ipay_' + Math.random().toString(36).substring(2, 9),
      ...payload,
      status: 'pending',
      createdAt: now,
    };

    const local = getStoredItem<IndividualPaymentRecord[]>(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, []);
    local.unshift(paymentRecord);
    setStoredItem(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, local);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('individual_payments').insert({
          id: paymentRecord.id,
          user_id: payload.userId,
          user_email: payload.userEmail.trim().toLowerCase(),
          plan_id: payload.planId,
          selected_level: payload.selectedLevel,
          amount: payload.amount,
          currency: payload.currency,
          payment_method: payload.paymentMethod,
          transaction_reference: payload.transactionReference,
          payment_proof_name: payload.paymentProofName,
          payment_proof_url: payload.paymentProofUrl,
          status: 'pending',
          created_at: now,
        });
      } catch (err) {
        console.error('[Supabase] Error inserting individual payment:', err);
      }
    }
    return paymentRecord;
  }

  async approveIndividualPayment(paymentId: string, adminId: string = 'system_admin'): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('approve_individual_payment', {
          p_payment_id: paymentId,
          p_admin_id: adminId,
        });
        if (!error && data?.success) {
          await this.getIndividualPayments();
          await this.getPurchases();
          return { success: true };
        }
      } catch (e) {
        console.warn('[Supabase] approve_individual_payment RPC fallback:', e);
      }
    }

    // Local fallback
    const payments = getStoredItem<IndividualPaymentRecord[]>(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, []);
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };

    payment.status = 'approved';
    payment.reviewedBy = adminId;
    payment.reviewedAt = new Date().toISOString();
    setStoredItem(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, payments);

    // Create purchase record
    const purchases = getStoredItem<PurchaseRecord[]>(STORAGE_KEYS.PURCHASES, []);
    const accessLvl = payment.selectedLevel ? `level_${payment.selectedLevel}` : 'full';
    const newPurchase: PurchaseRecord = {
      id: 'pur_' + Math.random().toString(36).substring(2, 9),
      userId: payment.userId,
      userEmail: payment.userEmail,
      productId: payment.planId,
      planId: payment.planId,
      accessStatus: 'active',
      accessLevel: accessLvl,
      startDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      paymentStatus: 'paid',
      paymentId,
      createdAt: new Date().toISOString(),
    };
    purchases.push(newPurchase);
    setStoredItem(STORAGE_KEYS.PURCHASES, purchases);

    return { success: true };
  }

  async rejectIndividualPayment(paymentId: string, adminId: string = 'system_admin', adminNote: string = 'Verification failed'): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('reject_individual_payment', {
          p_payment_id: paymentId,
          p_admin_id: adminId,
          p_admin_note: adminNote,
        });
        if (!error && data?.success) {
          await this.getIndividualPayments();
          return { success: true };
        }
      } catch (e) {
        console.warn('[Supabase] reject_individual_payment RPC fallback:', e);
      }
    }

    const payments = getStoredItem<IndividualPaymentRecord[]>(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, []);
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };

    payment.status = 'rejected';
    payment.adminNote = adminNote;
    payment.reviewedBy = adminId;
    payment.reviewedAt = new Date().toISOString();
    setStoredItem(STORAGE_KEYS.INDIVIDUAL_PAYMENTS, payments);

    return { success: true };
  }

  // ============================================================================
  // 9. PURCHASES & USER ACCESS VERIFICATION
  // ============================================================================
  async getPurchases(userEmail?: string): Promise<PurchaseRecord[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let q = supabase.from('purchases').select('*').order('created_at', { ascending: false });
        if (userEmail) q = q.eq('user_email', userEmail.trim().toLowerCase());
        const { data, error } = await q;
        if (!error && data) {
          const mapped: PurchaseRecord[] = data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            userEmail: d.user_email,
            productId: d.product_id,
            planId: d.plan_id,
            accessStatus: d.access_status,
            accessLevel: d.access_level || 'full',
            startDate: d.start_date,
            expiryDate: d.expiry_date,
            paymentStatus: d.payment_status,
            paymentId: d.payment_id,
            createdAt: d.created_at,
          }));
          setStoredItem(STORAGE_KEYS.PURCHASES, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching purchases:', err);
      }
    }
    const local = getStoredItem<PurchaseRecord[]>(STORAGE_KEYS.PURCHASES, []);
    return userEmail ? local.filter((p) => p.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()) : local;
  }

  async checkAccess(userEmail: string, levelNumber?: number): Promise<{
    hasAccess: boolean;
    accessLevel: string;
    expiryDate?: string;
    isAllActivities: boolean;
  }> {
    const purchases = await this.getPurchases(userEmail);
    const now = new Date().getTime();

    // Check active paid purchase
    for (const p of purchases) {
      if (p.paymentStatus === 'paid' && p.accessStatus === 'active') {
        const expTime = new Date(p.expiryDate).getTime();
        if (expTime > now) {
          if (p.accessLevel === 'full' || p.accessLevel === 'all_activities') {
            return {
              hasAccess: true,
              accessLevel: 'full',
              expiryDate: p.expiryDate,
              isAllActivities: true,
            };
          }
          if (levelNumber && (p.accessLevel === `level_${levelNumber}` || p.accessLevel === String(levelNumber))) {
            return {
              hasAccess: true,
              accessLevel: p.accessLevel,
              expiryDate: p.expiryDate,
              isAllActivities: false,
            };
          }
        }
      }
    }

    return {
      hasAccess: false,
      accessLevel: 'none',
      isAllActivities: false,
    };
  }

  // ============================================================================
  // 10. ADMIN DASHBOARD STATS AGGREGATION
  // ============================================================================
  async getAdminDashboardStats() {
    const [schools, schoolPayments, individualPayments, schoolRequests, schoolDevices, purchases] = await Promise.all([
      this.getSchools(),
      this.getSchoolPayments(),
      this.getIndividualPayments(),
      this.getSchoolRequests(),
      this.getSchoolDevices(),
      this.getPurchases(),
    ]);

    const totalSchools = schools.length;
    const activeSchools = schools.filter((s) => s.status === 'ACTIVE' && s.paymentStatus === 'paid').length;
    const pendingSchoolPayments = schoolPayments.filter((p) => p.status === 'pending').length;
    const pendingIndividualPayments = individualPayments.filter((p) => p.status === 'pending').length;
    const pendingSchoolRequests = schoolRequests.filter((r) => r.status === 'pending').length;
    const totalDevicesRegistered = schoolDevices.length;
    const activeDevices = schoolDevices.filter((d) => d.isActive).length;

    const now = new Date().getTime();
    const activePurchases = purchases.filter((p) => p.accessStatus === 'active' && new Date(p.expiryDate).getTime() > now).length;
    const expiredPurchases = purchases.filter((p) => p.accessStatus === 'expired' || new Date(p.expiryDate).getTime() <= now).length;

    return {
      totalSchools,
      activeSchools,
      pendingSchoolPayments,
      pendingIndividualPayments,
      pendingSchoolRequests,
      totalDevicesRegistered,
      activeDevices,
      activePurchases,
      expiredPurchases,
    };
  }
}

export const supabaseDataService = SupabaseDataService.getInstance();
