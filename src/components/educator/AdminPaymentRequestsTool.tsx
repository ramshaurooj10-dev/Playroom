import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Building,
  Smartphone,
  Globe,
  ArrowLeft,
  Settings,
  ShieldCheck,
  Check,
  X,
  FileText,
  AlertTriangle,
  Key,
  ShoppingBag,
  School,
  Plus,
  Lock,
  Sparkles,
  Server,
  Layers,
  MessageSquare,
  HelpCircle,
  AlertCircle,
  Calendar,
  Save,
  Trash2,
  Cpu,
  MonitorCheck,
  Ban,
  UserCheck,
  Copy,
  ExternalLink,
  MapPin,
  Mail,
  User,
} from 'lucide-react';
import { soundManager } from '../../utils/audio';
import {
  Currency,
  PaymentRecord,
  PaymentStatus,
  PremiumOrder,
  UserLicense,
  SchoolLicense,
  SchoolPaymentRequest,
  ProviderConfig,
  PaymentIssue,
  SchoolDeviceRecord,
} from '../../types/payment';
import { PaymentServiceManager } from '../../services/payment/PaymentServiceManager';
import {
  PaymentSettingsConfig,
  getPaymentSettings,
  savePaymentSettings,
  formatExpiryDate,
} from '../../utils/licenseService';
import {
  getSchoolPricingConfig,
  saveSchoolPricingConfig,
  SchoolTierConfig,
} from '../../utils/schoolPricingService';
import { UserAccount } from '../PremiumAuthModal';
import { isAdminAccount } from '../../utils/userAuthService';

interface AdminPaymentRequestsToolProps {
  onBackToOverview: () => void;
  userAccount?: UserAccount | null;
}

export const AdminPaymentRequestsTool: React.FC<AdminPaymentRequestsToolProps> = ({
  onBackToOverview,
  userAccount,
}) => {
  const isAuthorizedAdmin = isAdminAccount(userAccount);
  const [activeTab, setActiveTab] = useState<
    'school_requests' | 'school_pricing' | 'school_devices' | 'school_licenses' | 'payments' | 'orders' | 'licenses' | 'providers' | 'disputes'
  >('school_requests');

  const paymentManager = PaymentServiceManager.getInstance();

  // Data states
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [schoolRequests, setSchoolRequests] = useState<SchoolPaymentRequest[]>([]);
  const [orders, setOrders] = useState<PremiumOrder[]>([]);
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [schoolLicenses, setSchoolLicenses] = useState<SchoolLicense[]>([]);
  const [disputes, setDisputes] = useState<PaymentIssue[]>([]);
  const [schoolDevices, setSchoolDevices] = useState<SchoolDeviceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic School Pricing Configuration State
  const [schoolTiers, setSchoolTiers] = useState<SchoolTierConfig[]>(getSchoolPricingConfig());
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingSavedToast, setPricingSavedToast] = useState(false);

  // License Device Limit editing state
  const [editingDeviceLimits, setEditingDeviceLimits] = useState<{ [schoolId: string]: number }>({});

  // Filter and Search states
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  // Provider Status state
  const [providerStatuses, setProviderStatuses] = useState<any>(null);

  // Settings State
  const [settings, setSettings] = useState<PaymentSettingsConfig>(getPaymentSettings());
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Approved Schools Tab state
  const [approvedSchoolFilter, setApprovedSchoolFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED'>('ALL');
  const [approvedSchoolSearch, setApprovedSchoolSearch] = useState('');
  const [selectedSchoolDetails, setSelectedSchoolDetails] = useState<SchoolLicense | null>(null);
  const [deletingSchoolLicense, setDeletingSchoolLicense] = useState<SchoolLicense | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Create School License Modal state
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    schoolName: '',
    schoolAdminName: '',
    contactEmail: '',
    country: 'Pakistan',
    city: 'Karachi',
    price: '15000',
    currency: 'PKR' as 'PKR' | 'USD',
    allowedDevices: '999999',
    durationMonths: '1',
    page1Access: true,
    page2Access: true,
    licenseKey: '',
    adminNotes: '',
  });

  // Action status message
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Renewal Confirmation Modal state
  const [renewingLicense, setRenewingLicense] = useState<SchoolLicense | null>(null);
  const [isProcessingRenewal, setIsProcessingRenewal] = useState(false);

  // Admin Custom Final Price state for school requests
  const [adminFinalPrices, setAdminFinalPrices] = useState<{
    [requestId: string]: { price: number; currency: Currency };
  }>({});

  const loadAllData = async () => {
    setIsLoading(true);
    const p = paymentManager.getAllPaymentsLocal();
    const o = paymentManager.getAllOrdersLocal();
    const l = paymentManager.getAllLicensesLocal();
    const d = paymentManager.getAllPaymentIssuesLocal();
    const dev = paymentManager.getAllSchoolDevicesLocal();
    const currentTiers = getSchoolPricingConfig();

    setPayments(p);
    setOrders(o);
    setLicenses(l);
    setDisputes(d);
    setSchoolDevices(dev);
    setSchoolTiers(currentTiers);

    // Fetch school licenses & requests from Supabase
    try {
      const s = await paymentManager.fetchSchoolLicensesFromSupabase();
      const reqs = await paymentManager.fetchSchoolRequestsFromSupabase();
      setSchoolLicenses(s);
      setSchoolRequests(reqs);

      const initialLimits: { [schoolId: string]: number } = {};
      s.forEach((sch) => {
        initialLimits[sch.schoolId] = sch.allowedDevices || 999999;
      });
      setEditingDeviceLimits(initialLimits);
    } catch (e) {
      console.warn('Error fetching school data from Supabase:', e);
      const s = paymentManager.getAllSchoolLicensesLocal();
      setSchoolLicenses(s);
      setSchoolRequests(paymentManager.getAllSchoolPaymentRequestsLocal());
    }

    // Check provider statuses from backend
    try {
      const res = await fetch('/api/payment/providers/status');
      if (res.ok) {
        const data = await res.json();
        setProviderStatuses(data.providers);
      }
    } catch (e) {
      console.warn('Could not fetch provider status:', e);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Save Dynamic School Pricing Tiers
  const handleSaveSchoolPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPricing(true);
    soundManager.playPop();

    const success = await saveSchoolPricingConfig(schoolTiers);
    setIsSavingPricing(false);

    if (success) {
      soundManager.playSuccess();
      setPricingSavedToast(true);
      setActionMessage('School pricing configurations saved and live across all school portals!');
      setTimeout(() => {
        setPricingSavedToast(false);
        setActionMessage(null);
      }, 4000);
    }
  };

  const handleUpdateTierField = (
    durationMonths: number,
    field: keyof SchoolTierConfig,
    val: any
  ) => {
    setSchoolTiers((prev) =>
      prev.map((t) => (t.durationMonths === durationMonths ? { ...t, [field]: val } : t))
    );
  };

  // Device Management Actions
  const handleRevokeDevice = async (deviceId: string) => {
    soundManager.playPop();
    const res = await paymentManager.revokeSchoolDevice(deviceId);
    if (res.success) {
      soundManager.playSuccess();
      setActionMessage('Classroom device revoked successfully. Device slot is now available.');
      await loadAllData();
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  const handleUpdateSchoolDeviceLimit = async (schoolId: string) => {
    soundManager.playPop();
    const limit = editingDeviceLimits[schoolId];
    if (!limit || limit < 1) return;

    const res = await paymentManager.updateSchoolLicenseDeviceLimit(schoolId, limit);
    if (res.success) {
      soundManager.playSuccess();
      setActionMessage(`Updated device limit to ${limit} devices for this school.`);
      await loadAllData();
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  // Admin Dispute Resolution
  const handleResolveDispute = async (
    disputeId: string,
    action: 'APPROVE' | 'REJECT_NOT_RECEIVED' | 'KEEP_PENDING',
    customNotes?: string
  ) => {
    soundManager.playPop();
    const res = await paymentManager.adminResolveDispute(
      disputeId,
      action,
      customNotes,
      'School Administrator'
    );

    if (res.success) {
      soundManager.playSuccess();
      if (action === 'APPROVE') {
        setActionMessage('Payment Approved — 1-Month Premium Access is now active.');
      } else if (action === 'REJECT_NOT_RECEIVED') {
        setActionMessage('Payment Rejected (Payment Not Received). Premium access remains locked.');
      } else {
        setActionMessage('Payment dispute updated: Status kept as PENDING (Under Review).');
      }
      await loadAllData();
      setTimeout(() => setActionMessage(null), 4500);
    }
  };

  // Admin Payment Verification
  const handleVerify = async (paymentId: string) => {
    soundManager.playPop();
    const res = await paymentManager.adminVerifyPayment(
      paymentId,
      'VERIFY',
      'Verified via Official Statement Audit',
      'school-admin@playroom-learning.edu'
    );
    if (res.success) {
      soundManager.playSuccess();
      setActionMessage('Payment verified & approved! 1-Month License activated.');
      await loadAllData();
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleReject = async (paymentId: string) => {
    soundManager.playPop();
    const res = await paymentManager.adminVerifyPayment(
      paymentId,
      'REJECT',
      'Payment unverified in bank records',
      'school-admin@playroom-learning.edu'
    );
    if (res.success) {
      soundManager.playPop();
      setActionMessage('Payment marked as REJECTED.');
      await loadAllData();
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Copy License Key to Clipboard
  const handleCopyLicenseKey = (key: string) => {
    soundManager.playPop();
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Create School License (Strictly 1-Month Term, Pending Activation)
  const handleCreateSchoolLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playPop();
    if (!schoolForm.schoolName || !schoolForm.contactEmail) return;

    const created = await paymentManager.createSchoolLicense({
      schoolName: schoolForm.schoolName,
      schoolAdminName: schoolForm.schoolAdminName || schoolForm.schoolName,
      contactName: schoolForm.schoolAdminName || schoolForm.schoolName,
      contactEmail: schoolForm.contactEmail,
      country: schoolForm.country,
      city: schoolForm.city,
      price: parseFloat(schoolForm.price) || 0,
      currency: schoolForm.currency,
      allowedDevices: 999999,
      durationMonths: 1,
      page1Access: true,
      page2Access: true,
      licenseKey: schoolForm.licenseKey.trim() || undefined,
      adminNotes: schoolForm.adminNotes,
      verifiedBy: 'School Administrator',
    });

    soundManager.playSuccess();
    setShowSchoolModal(false);
    setSchoolForm({
      schoolName: '',
      schoolAdminName: '',
      contactEmail: '',
      country: 'Pakistan',
      city: 'Karachi',
      price: '15000',
      currency: 'PKR',
      allowedDevices: '999999',
      durationMonths: '1',
      page1Access: true,
      page2Access: true,
      licenseKey: '',
      adminNotes: '',
    });
    setActionMessage(`New School License successfully issued in PENDING state. License Key: ${created.licenseKey}`);
    await loadAllData();
    setTimeout(() => setActionMessage(null), 5000);
  };

  // Manual Activate Pending License from Admin Console
  const handleManualActivateSchoolLicense = async (sch: SchoolLicense) => {
    soundManager.playPop();
    const res = await paymentManager.activateSchoolLicenseAdmin(
      sch.id || sch.licenseKey,
      'School Administrator'
    );
    if (res.success) {
      soundManager.playSuccess();
      setActionMessage(`License for ${sch.schoolName} is now ACTIVE for 30 days.`);
      await loadAllData();
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Revoke School License
  const handleRevokeSchoolLicense = async (sch: SchoolLicense) => {
    soundManager.playPop();
    const res = await paymentManager.revokeSchoolLicense(
      sch.id || sch.licenseKey,
      'Revoked by school administrator from Admin Management Console'
    );
    if (res.success) {
      soundManager.playSuccess();
      setActionMessage(`License for ${sch.schoolName} (${sch.licenseKey}) has been REVOKED.`);
      await loadAllData();
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Trigger Delete Confirmation Modal (Explicit confirmation required)
  const handleDeleteSchoolLicense = (sch: SchoolLicense) => {
    soundManager.playPop();
    setDeletingSchoolLicense(sch);
  };

  // Confirm and Execute Manual Deletion
  const handleConfirmDeleteLicense = async () => {
    if (!deletingSchoolLicense) return;
    setIsProcessingDelete(true);
    soundManager.playPop();
    try {
      const res = await paymentManager.deleteSchoolLicense(
        deletingSchoolLicense.id || deletingSchoolLicense.licenseKey
      );
      if (res.success) {
        soundManager.playSuccess();
        setActionMessage(`School License for ${deletingSchoolLicense.schoolName} removed from public.school_licenses.`);
        await loadAllData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingDelete(false);
      setDeletingSchoolLicense(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Renewal for School License - Trigger Confirmation Modal
  const handleRenewSchoolLicense = (sch: SchoolLicense) => {
    soundManager.playPop();
    setRenewingLicense(sch);
  };

  // Confirm and Execute Renewal
  const handleConfirmRenewal = async () => {
    if (!renewingLicense) return;
    setIsProcessingRenewal(true);
    soundManager.playPop();

    try {
      const res = await paymentManager.renewSchoolLicense(
        renewingLicense.id || renewingLicense.licenseKey,
        undefined,
        'School Administrator'
      );

      if (res.success) {
        soundManager.playSuccess();
        setActionMessage('License renewed successfully for 30 days (same license key retained).');
        await loadAllData();
      } else {
        setActionMessage(res.error || 'Failed to renew school license.');
      }
    } catch (err: any) {
      console.error('Error renewing license:', err);
      setActionMessage('Failed to renew school license.');
    } finally {
      setIsProcessingRenewal(false);
      setRenewingLicense(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // School Inquiry / Request Actions (No payment required)
  const handleApproveSchoolInquiry = async (requestId: string, notes?: string) => {
    soundManager.playPop();
    const res = await paymentManager.adminApproveSchoolRequest(
      requestId,
      notes,
      'school-admin@playroom-learning.edu'
    );
    if (res.success) {
      soundManager.playSuccess();
      setActionMessage(
        `School Request Approved! 30-Day School License Key: ${res.licenseKey} generated/activated for ${
          res.license?.schoolName || 'School'
        }.`
      );
      await loadAllData();
      setTimeout(() => setActionMessage(null), 5000);
    } else {
      setActionMessage(res.error || 'Failed to approve school request.');
    }
  };

  const handleRejectSchoolInquiry = async (requestId: string, reason?: string) => {
    soundManager.playPop();
    const res = await paymentManager.adminRejectSchoolPayment(
      requestId,
      reason || 'Inquiry declined by administration',
      'school-admin@playroom-learning.edu'
    );
    if (res.success) {
      soundManager.playPop();
      setActionMessage('School Request marked as REJECTED.');
      await loadAllData();
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleApproveSchoolRequest = async (requestId: string, notes?: string) => {
    return handleApproveSchoolInquiry(requestId, notes);
  };

  const handleRejectSchoolRequest = async (requestId: string, reason?: string) => {
    return handleRejectSchoolInquiry(requestId, reason);
  };

  const handleKeepPendingSchoolRequest = async (requestId: string, notes?: string) => {
    soundManager.playPop();
    const res = await paymentManager.adminKeepPendingSchoolPayment(
      requestId,
      notes || 'Under review with administration'
    );
    if (res.success) {
      soundManager.playPop();
      setActionMessage('School Request kept as PENDING.');
      await loadAllData();
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    soundManager.playPop();
    const success = await savePaymentSettings(settings);
    setIsSavingSettings(false);
    if (success) {
      soundManager.playSuccess();
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 3000);
    }
  };

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    const matchesStatus = filterStatus === 'ALL' || p.paymentStatus === filterStatus;
    const matchesSearch =
      p.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.providerTransactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingPaymentsCount = payments.filter((p) => p.paymentStatus === 'PENDING').length;
  const pendingSchoolRequestsCount = schoolRequests.filter((r) => r.status === 'PENDING').length;

  if (!isAuthorizedAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto my-12 p-8 bg-white border-4 border-rose-300 rounded-3xl shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 border-2 border-rose-300 rounded-2xl flex items-center justify-center mx-auto text-3xl">
          🔒
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase">Admin Access Restricted</h2>
        <p className="text-sm font-bold text-slate-600">
          This management console is strictly restricted to verified application administrators.
          Active school licenses and educator accounts do not grant administrative privileges.
        </p>
        <button
          type="button"
          onClick={onBackToOverview}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl cursor-pointer shadow-sm transition-colors"
        >
          Return to Educator Hub
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border-4 border-indigo-200 rounded-3xl p-5 sm:p-6 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playPop();
              onBackToOverview();
            }}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors cursor-pointer text-slate-700"
            title="Back to Educator Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                School Administration Architecture
              </span>
              {pendingPaymentsCount > 0 && (
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                  {pendingPaymentsCount} PENDING
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-indigo-950 mt-1">
              PAYMENT & LICENSE MANAGEMENT
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundManager.playPop();
              loadAllData();
            }}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('school_requests');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'school_requests'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <School className="w-4 h-4" />
          <span>SCHOOL REQUESTS</span>
          {pendingSchoolRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px]">
              {pendingSchoolRequestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('school_pricing');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'school_pricing'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>SCHOOL PRICING CONFIG</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('school_devices');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'school_devices'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>SCHOOL DEVICES & LIMITS</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('school_licenses');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'school_licenses'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>APPROVED SCHOOLS</span>
          {schoolLicenses.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'school_licenses'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {schoolLicenses.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('payments');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'payments'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>INDIVIDUAL PAYMENT REQUESTS</span>
          {pendingPaymentsCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px]">
              {pendingPaymentsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('orders');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>ORDERS</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('licenses');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'licenses'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>PREMIUM LICENSES</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('providers');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'providers'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>PAYMENT PROVIDERS</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playPop();
            setActiveTab('disputes');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'disputes'
              ? 'bg-indigo-900 text-white shadow-sm'
              : 'bg-transparent text-slate-700 hover:bg-white/50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>PAYMENT ISSUES / DISPUTES</span>
          {disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] animate-pulse">
              {disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length}
            </span>
          )}
        </button>
      </div>

      {/* Action Banner Toast */}
      {actionMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-600 text-white p-3.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:bg-white/20 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 0. SCHOOL REQUESTS TAB (DEDICATED INQUIRY WORKFLOW - NO PAYMENT REQUIRED)  */}
      {/* ========================================================================= */}
      {activeTab === 'school_requests' && (
        <div className="space-y-4">
          {/* Institutional Notice */}
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-950 shadow-xs">
            <School className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-black uppercase tracking-wide block">
                School Requests & Inquiries Management (public.school_requests)
              </span>
              <p className="leading-relaxed font-medium">
                Review and approve school inquiries directly. Approving uses the request's existing school record (without duplicate school records or payment requirements) and immediately generates a unique 30-day institutional license key.
              </p>
            </div>
          </div>

          {/* Filter Bar & Quick Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border-2 border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-500">Filter Inquiries:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-3 py-1 text-xs font-black rounded-lg uppercase transition-all cursor-pointer ${
                    filterStatus === 'ALL'
                      ? 'bg-indigo-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({schoolRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('PENDING')}
                  className={`px-3 py-1 text-xs font-black rounded-lg uppercase transition-all cursor-pointer ${
                    filterStatus === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending ({schoolRequests.filter((r) => r.status === 'PENDING').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('VERIFIED')}
                  className={`px-3 py-1 text-xs font-black rounded-lg uppercase transition-all cursor-pointer ${
                    filterStatus === 'VERIFIED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Approved ({schoolRequests.filter((r) => r.status === 'VERIFIED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('REJECTED')}
                  className={`px-3 py-1 text-xs font-black rounded-lg uppercase transition-all cursor-pointer ${
                    filterStatus === 'REJECTED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rejected ({schoolRequests.filter((r) => r.status === 'REJECTED').length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search school, email, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 w-48 sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* Filtered School Requests List */}
          {(() => {
            const filtered = schoolRequests.filter((req) => {
              if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const schoolMatch = (req.schoolName || '').toLowerCase().includes(q);
                const emailMatch = (req.contactEmail || '').toLowerCase().includes(q);
                const adminMatch = (req.schoolAdminName || '').toLowerCase().includes(q);
                const cityMatch = (req.city || '').toLowerCase().includes(q);
                const countryMatch = (req.country || '').toLowerCase().includes(q);
                const msgMatch = (req.schoolMessage || req.message || req.notes || '').toLowerCase().includes(q);
                const subjectMatch = (req.subject || '').toLowerCase().includes(q);
                return schoolMatch || emailMatch || adminMatch || cityMatch || countryMatch || msgMatch || subjectMatch;
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-10 text-center text-slate-500 space-y-3">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                    🏛️
                  </div>
                  <h3 className="text-sm font-black uppercase text-slate-800">No School Inquiries Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {filterStatus !== 'ALL'
                      ? `No inquiries currently match the ${filterStatus} filter.`
                      : 'When institutions submit partnership or licensing requests, they will appear here.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {filtered.map((req) => (
                  <div
                    key={req.id}
                    className={`bg-white border-3 rounded-2xl p-5 sm:p-6 transition-all shadow-sm ${
                      req.status === 'PENDING'
                        ? 'border-amber-300 ring-2 ring-amber-100'
                        : req.status === 'VERIFIED'
                        ? 'border-emerald-300'
                        : 'border-rose-200 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                      {/* Left Column: School Request Data */}
                      <div className="space-y-3 flex-1">
                        {/* Top Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                              req.status === 'PENDING'
                                ? 'bg-amber-500 text-white animate-pulse'
                                : req.status === 'VERIFIED'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            STATUS: {req.status === 'VERIFIED' ? 'APPROVED' : req.status}
                          </span>

                          <span className="text-xs font-bold text-slate-400">
                            Submitted: {new Date(req.submittedAt || req.createdAt || Date.now()).toLocaleString()}
                          </span>

                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            Req ID: {req.id}
                          </span>

                          {req.schoolId && (
                            <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              School ID: {req.schoolId}
                            </span>
                          )}
                        </div>

                        {/* School Name */}
                        <div>
                          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <Building className="w-5 h-5 text-indigo-600 shrink-0" />
                            <span>{req.schoolName}</span>
                          </h3>
                        </div>

                        {/* Details Grid: Admin, Email, Phone, Country, City */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs">
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Admin Contact</span>
                            <strong className="text-slate-900">{req.schoolAdminName || req.contactName || 'School Administrator'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Email</span>
                            <strong className="text-slate-900 font-mono select-all">{req.contactEmail || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Phone</span>
                            <strong className="text-slate-900">{req.contactPhone || req.phoneNumber || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Country</span>
                            <strong className="text-slate-900">{req.country || 'Pakistan'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">City</span>
                            <strong className="text-slate-900">{req.city || 'Karachi'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Subject</span>
                            <strong className="text-indigo-950 font-bold">{req.subject || 'School License Request'}</strong>
                          </div>
                        </div>

                        {/* Message from School */}
                        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-black text-indigo-950 uppercase text-[10px] tracking-wide">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>INQUIRY MESSAGE</span>
                          </div>
                          <p className="text-slate-800 font-medium italic bg-white p-3 rounded-lg border border-indigo-100 leading-relaxed">
                            "{req.schoolMessage || req.message || req.notes || 'Inquiry requesting institutional licensing for classroom learning.'}"
                          </p>
                        </div>

                        {/* If Approved, Show Generated 30-Day License Key */}
                        {(req.status === 'VERIFIED' || req.schoolLicenseId) && (
                          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-black text-emerald-950 uppercase text-[10px]">
                                <Key className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Active 30-Day License Key:</span>
                              </div>
                              <div className="font-mono font-black text-sm text-emerald-900 select-all">
                                {req.schoolLicenseId || 'ACTIVE'}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {req.schoolLicenseId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(req.schoolLicenseId || '');
                                    setActionMessage(`Copied License Key: ${req.schoolLicenseId}`);
                                    setTimeout(() => setActionMessage(null), 3000);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>Copy Key</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playPop();
                                  setActiveTab('school_licenses');
                                }}
                                className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer"
                              >
                                View in Licenses →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Approval Controls (No payment required) */}
                      <div className="flex flex-col items-stretch lg:w-56 shrink-0 space-y-2.5">
                        {req.status === 'PENDING' && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-center">
                            <div className="text-[10px] font-black uppercase text-slate-500">
                              Admin Action
                            </div>

                            <button
                              type="button"
                              onClick={() => handleApproveSchoolInquiry(req.id)}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase py-3 px-3 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>APPROVE REQUEST</span>
                            </button>

                            <p className="text-[10px] text-slate-500 font-medium leading-tight">
                              Generates 30-day license using existing school record. No payment required.
                            </p>

                            <button
                              type="button"
                              onClick={() => handleRejectSchoolInquiry(req.id)}
                              className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs uppercase py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200"
                            >
                              <X className="w-4 h-4" />
                              <span>REJECT REQUEST</span>
                            </button>
                          </div>
                        )}

                        {req.status === 'VERIFIED' && (
                          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center space-y-1">
                            <div className="flex items-center justify-center gap-1 text-xs font-black text-emerald-700">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>APPROVED</span>
                            </div>
                            <p className="text-[10px] text-emerald-600 font-medium">30-Day License Issued</p>
                          </div>
                        )}

                        {req.status === 'REJECTED' && (
                          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center space-y-2">
                            <div className="flex items-center justify-center gap-1 text-xs font-black text-rose-700">
                              <XCircle className="w-4 h-4 text-rose-600" />
                              <span>REJECTED</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleApproveSchoolInquiry(req.id, 'Re-audited and approved')}
                              className="text-[10px] text-indigo-600 hover:underline font-bold block w-full"
                            >
                              Re-evaluate & Approve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0B. SCHOOL PRICING CONFIG TAB (ADMIN CONTROLLED)                          */}
      {/* ========================================================================= */}
      {activeTab === 'school_pricing' && (
        <div className="space-y-5">
          {/* Header Notice */}
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5 flex items-start gap-4">
            <Settings className="w-6 h-6 text-indigo-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h2 className="font-black text-sm uppercase text-indigo-950 tracking-wide">
                Admin Dynamic School Pricing & Tier Settings
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                Configure official school licensing rates and classroom device allocations for each duration tier (1 Month, 3 Months, 6 Months, 12 Months). 
                The exact numbers and access permissions you set here will be dynamically rendered across all School Purchase portals.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSchoolPricing} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schoolTiers.map((tier) => (
                <div
                  key={tier.durationMonths}
                  className="bg-white border-3 border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-black text-xs">
                        {tier.durationMonths}M
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-slate-900 uppercase">{tier.label}</h3>
                        <span className="text-[10px] text-slate-500 font-bold">
                          Duration: {tier.durationMonths} Month{tier.durationMonths > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.isActive}
                          onChange={(e) =>
                            handleUpdateTierField(tier.durationMonths, 'isActive', e.target.checked)
                          }
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-0"
                        />
                        <span className={tier.isActive ? 'text-emerald-700 font-black' : 'text-slate-400'}>
                          {tier.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Price PKR */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                        Price (PKR Rs.) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={tier.pricePkr}
                        onChange={(e) =>
                          handleUpdateTierField(tier.durationMonths, 'pricePkr', Math.max(0, parseInt(e.target.value, 10) || 0))
                        }
                        className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>

                    {/* Price USD */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                        Price (USD $) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={tier.priceUsd}
                        onChange={(e) =>
                          handleUpdateTierField(tier.durationMonths, 'priceUsd', Math.max(0, parseInt(e.target.value, 10) || 0))
                        }
                        className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  {/* Maximum Classroom Devices */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                      Max Classroom Devices *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={tier.maxDevices}
                      onChange={(e) =>
                        handleUpdateTierField(tier.durationMonths, 'maxDevices', Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Classroom tablet/computer limit allowed under this package.
                    </p>
                  </div>

                  {/* Access Scopes */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[10px] font-black uppercase text-slate-500">
                      Curriculum Access Permissions
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.page1Access}
                          onChange={(e) =>
                            handleUpdateTierField(tier.durationMonths, 'page1Access', e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-0"
                        />
                        <span>Page 1 (Playroom Activities)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.page2Access}
                          onChange={(e) =>
                            handleUpdateTierField(tier.durationMonths, 'page2Access', e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-0"
                        />
                        <span>Page 2 (Educator Hub)</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between bg-white border-2 border-slate-200 p-4 rounded-2xl">
              <div className="text-xs text-slate-600">
                {pricingSavedToast ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Pricing changes saved and active!
                  </span>
                ) : (
                  <span>Click save to broadcast new tier pricing to prospective schools.</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSavingPricing}
                className="bg-indigo-900 hover:bg-indigo-950 disabled:bg-slate-400 text-white font-black text-xs uppercase px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPricing ? 'SAVING PRICING...' : 'SAVE ALL SCHOOL PRICING'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0C. SCHOOL DEVICES & LIMITS TAB                                           */}
      {/* ========================================================================= */}
      {activeTab === 'school_devices' && (
        <div className="space-y-5">
          {/* Header Notice */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 flex items-start gap-4">
            <Smartphone className="w-6 h-6 text-purple-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h2 className="font-black text-sm uppercase text-purple-950 tracking-wide">
                Classroom Device Tracking & School Limit Management
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                Control the exact number of active classroom tablets, laptops, and smartboards permitted per school.
                You can increase/decrease device allowances anytime or revoke specific device slots.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center">
              <div className="text-[10px] font-black uppercase text-slate-400">Total Schools</div>
              <div className="text-2xl font-black text-indigo-950 mt-1">{schoolLicenses.length}</div>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center">
              <div className="text-[10px] font-black uppercase text-slate-400">Total Allowed Devices</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {schoolLicenses.reduce((acc, s) => acc + (s.allowedDevices || 30), 0)}
              </div>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center">
              <div className="text-[10px] font-black uppercase text-slate-400">Active Devices</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {schoolDevices.filter((d) => d.status === 'ACTIVE').length}
              </div>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center">
              <div className="text-[10px] font-black uppercase text-slate-400">Revoked Slots</div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {schoolDevices.filter((d) => d.status === 'REVOKED').length}
              </div>
            </div>
          </div>

          {/* Schools Device List */}
          {schoolLicenses.length > 0 ? (
            <div className="space-y-4">
              {schoolLicenses.map((sch) => {
                const schoolRegisteredDevices = schoolDevices.filter(
                  (d) => d.schoolId === sch.schoolId || d.schoolId === sch.contactEmail
                );
                const activeCount = schoolRegisteredDevices.filter((d) => d.status === 'ACTIVE').length;
                const allowed = sch.allowedDevices || 30;
                const remaining = Math.max(0, allowed - activeCount);

                return (
                  <div
                    key={sch.id}
                    className="bg-white border-3 border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-100">
                      <div>
                        <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                          <Building className="w-5 h-5 text-indigo-600" />
                          <span>{sch.schoolName}</span>
                        </h3>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {sch.contactEmail} • ID: {sch.schoolId}
                        </div>
                      </div>

                      {/* Device Count Pill */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl">
                          {activeCount} / {allowed} Devices Used ({remaining} Available)
                        </span>
                      </div>
                    </div>

                    {/* Device Limit Editor */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-black text-slate-700 uppercase">Set Allowed Limit:</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={editingDeviceLimits[sch.schoolId] ?? allowed}
                          onChange={(e) =>
                            setEditingDeviceLimits({
                              ...editingDeviceLimits,
                              [sch.schoolId]: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="w-20 p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-center text-slate-900 focus:outline-hidden focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateSchoolDeviceLimit(sch.schoolId)}
                          className="bg-indigo-900 hover:bg-indigo-950 text-white text-[11px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Update Limit
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-500 font-medium">
                        License Status: <strong className={sch.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-600'}>{sch.status}</strong> (Expires: {new Date(sch.expiryDate).toLocaleDateString()})
                      </div>
                    </div>

                    {/* Registered Devices Sub-Table */}
                    {schoolRegisteredDevices.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                              <th className="p-2.5">Device Name / Browser</th>
                              <th className="p-2.5">Device Identifier</th>
                              <th className="p-2.5">Registered Date</th>
                              <th className="p-2.5">Last Active</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {schoolRegisteredDevices.map((dev) => (
                              <tr key={dev.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{dev.deviceName}</span>
                                </td>
                                <td className="p-2.5 font-mono text-[11px] text-slate-500">
                                  {dev.deviceIdentifier}
                                </td>
                                <td className="p-2.5 text-slate-600">
                                  {new Date(dev.registeredAt).toLocaleDateString()}
                                </td>
                                <td className="p-2.5 text-slate-600">
                                  {new Date(dev.lastLogin).toLocaleDateString()}
                                </td>
                                <td className="p-2.5">
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                      dev.status === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {dev.status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right">
                                  {dev.status === 'ACTIVE' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeDevice(dev.id)}
                                      className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-md text-[10px] font-black uppercase transition-colors cursor-pointer"
                                    >
                                      Revoke Device
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-bold italic">
                                      Revoked
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500 font-medium">
                        No classroom devices have logged in under this school license yet.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-10 text-center text-slate-500 space-y-3">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                📱
              </div>
              <h3 className="text-sm font-black uppercase text-slate-800">No Active School Licenses Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once school payment requests are approved, their classroom devices will appear here for tracking and limit control.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 0D. APPROVED SCHOOLS TAB                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'school_licenses' && (
        <div className="space-y-5">
          {/* Header Banner & Stats */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border-2 border-indigo-700/40 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Building className="w-48 h-48" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                    Live Supabase Registry
                  </span>
                  <span className="text-slate-400 text-xs font-mono">public.school_licenses</span>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
                  <Building className="w-6 h-6 text-indigo-400" />
                  Approved Schools & Institutional Licenses
                </h2>
                <p className="text-xs text-indigo-200/80 leading-relaxed font-normal">
                  View and manage verified institutional school licenses. Track live remaining validity, execute renewals while preserving key identity, provision new licenses, or manage school access states.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => loadAllData()}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Records</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playPop();
                    setShowSchoolModal(true);
                  }}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Add School / Create License</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            {(() => {
              const now = Date.now();
              const totalCount = schoolLicenses.length;
              let activeCount = 0;
              let pendingCount = 0;
              let expiredCount = 0;
              let revokedCount = 0;

              schoolLicenses.forEach((sch) => {
                const expField = sch.validUntil || sch.expiryDate;
                const expTime = expField ? new Date(expField).getTime() : NaN;
                const isPastExpiry = !isNaN(expTime) && expTime <= now;

                if (sch.status === 'REVOKED') {
                  revokedCount++;
                } else if (sch.status === 'PENDING' || (!sch.validUntil && !sch.expiryDate && !sch.validFrom && !sch.startDate)) {
                  pendingCount++;
                } else if (isPastExpiry) {
                  expiredCount++;
                } else {
                  activeCount++;
                }
              });

              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Schools</div>
                    <div className="text-xl font-black text-white mt-0.5">{totalCount}</div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Active Licenses</div>
                    <div className="text-xl font-black text-emerald-400 mt-0.5">{activeCount}</div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Pending Activation</div>
                    <div className="text-xl font-black text-amber-400 mt-0.5">{pendingCount}</div>
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Expired</div>
                    <div className="text-xl font-black text-rose-400 mt-0.5">{expiredCount}</div>
                  </div>

                  <div className="bg-slate-500/10 border border-slate-500/20 rounded-2xl p-3">
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Revoked</div>
                    <div className="text-xl font-black text-slate-400 mt-0.5">{revokedCount}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border-2 border-slate-200">
            {/* Search */}
            <div className="flex items-center gap-2.5 w-full md:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={approvedSchoolSearch}
                onChange={(e) => setApprovedSchoolSearch(e.target.value)}
                placeholder="Search school name, admin, email, country, key..."
                className="text-xs font-medium bg-transparent border-none focus:outline-hidden w-full md:w-80 text-slate-800 placeholder-slate-400"
              />
              {approvedSchoolSearch && (
                <button
                  type="button"
                  onClick={() => setApprovedSchoolSearch('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {(
                [
                  { id: 'ALL', label: 'All Schools' },
                  { id: 'ACTIVE', label: 'Active' },
                  { id: 'PENDING', label: 'Pending' },
                  { id: 'EXPIRED', label: 'Expired' },
                  { id: 'REVOKED', label: 'Revoked' },
                ] as const
              ).map((tab) => {
                const isActive = approvedSchoolFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundManager.playPop();
                      setApprovedSchoolFilter(tab.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-indigo-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Approved Schools */}
          {(() => {
            const now = Date.now();
            
            // Enrich
            const enriched = schoolLicenses.map((sch) => {
              const expField = sch.validUntil || sch.expiryDate;
              const expTime = expField ? new Date(expField).getTime() : NaN;
              const isPastExpiry = !isNaN(expTime) && expTime <= now;

              let computedStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED' = 'ACTIVE';
              let remainingDays: number | null = null;

              if (sch.status === 'REVOKED') {
                computedStatus = 'REVOKED';
                remainingDays = 0;
              } else if (sch.status === 'PENDING' || (!sch.validUntil && !sch.expiryDate && !sch.validFrom && !sch.startDate)) {
                computedStatus = 'PENDING';
                remainingDays = null;
              } else if (isPastExpiry) {
                computedStatus = 'EXPIRED';
                remainingDays = 0;
              } else {
                computedStatus = 'ACTIVE';
                if (!isNaN(expTime)) {
                  remainingDays = Math.max(0, Math.ceil((expTime - now) / (1000 * 60 * 60 * 24)));
                }
              }

              return {
                ...sch,
                computedStatus,
                remainingDays,
                expTime: isNaN(expTime) ? (computedStatus === 'PENDING' ? Infinity : 0) : expTime,
              };
            });

            // Filter
            let filtered = enriched.filter((sch) => {
              if (approvedSchoolFilter === 'ACTIVE' && sch.computedStatus !== 'ACTIVE') return false;
              if (approvedSchoolFilter === 'PENDING' && sch.computedStatus !== 'PENDING') return false;
              if (approvedSchoolFilter === 'EXPIRED' && sch.computedStatus !== 'EXPIRED') return false;
              if (approvedSchoolFilter === 'REVOKED' && sch.computedStatus !== 'REVOKED') return false;

              if (approvedSchoolSearch.trim()) {
                const q = approvedSchoolSearch.toLowerCase().trim();
                const matchName = sch.schoolName?.toLowerCase().includes(q);
                const matchAdmin = (sch.schoolAdminName || sch.contactName || '')?.toLowerCase().includes(q);
                const matchEmail = sch.contactEmail?.toLowerCase().includes(q);
                const matchKey = (sch.licenseKey || sch.id)?.toLowerCase().includes(q);
                const matchCountry = sch.country?.toLowerCase().includes(q);
                const matchCity = sch.city?.toLowerCase().includes(q);
                return matchName || matchAdmin || matchEmail || matchKey || matchCountry || matchCity;
              }

              return true;
            });

            // Sort: ACTIVE sorted by nearest expiry first (ascending expTime)
            filtered.sort((a, b) => {
              if (a.computedStatus === 'ACTIVE' && b.computedStatus === 'ACTIVE') {
                return a.expTime - b.expTime;
              }
              if (a.computedStatus === 'ACTIVE') return -1;
              if (b.computedStatus === 'ACTIVE') return 1;
              return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-white border-2 border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-3">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-3xl">
                    🏫
                  </div>
                  <h3 className="text-base font-black uppercase text-slate-800">
                    No School Licenses Found
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {approvedSchoolSearch
                      ? `No records match search "${approvedSchoolSearch}". Try adjusting your query.`
                      : approvedSchoolFilter !== 'ALL'
                      ? `No school licenses currently in "${approvedSchoolFilter}" status.`
                      : 'No approved school licenses registered yet. Click "+ Add School / Create License" to provision your first institutional partner.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {filtered.map((sch) => {
                  const keyToDisplay = sch.licenseKey || sch.id;
                  const isCopied = copiedKey === keyToDisplay;

                  return (
                    <div
                      key={sch.id || sch.licenseKey}
                      className={`bg-white border-2 rounded-3xl p-5 sm:p-6 transition-all shadow-xs hover:shadow-md ${
                        sch.computedStatus === 'ACTIVE'
                          ? 'border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20'
                          : sch.computedStatus === 'PENDING'
                          ? 'border-amber-200 bg-gradient-to-b from-white to-amber-50/20'
                          : sch.computedStatus === 'EXPIRED'
                          ? 'border-rose-200 bg-gradient-to-b from-white to-rose-50/20'
                          : 'border-slate-200 bg-gradient-to-b from-white to-slate-50/50'
                      }`}
                    >
                      {/* Top Row: School Info, Country Badge & Status */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                              sch.computedStatus === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sch.computedStatus === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : sch.computedStatus === 'EXPIRED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            🏫
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-black text-slate-900 tracking-tight">
                                {sch.schoolName}
                              </h3>

                              {sch.country && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                                  <MapPin className="w-3 h-3 text-slate-500" />
                                  <span>{sch.city ? `${sch.city}, ` : ''}{sch.country}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <strong>Admin:</strong> {sch.schoolAdminName || sch.contactName || 'School Administrator'}
                              </span>

                              <span className="text-slate-300">•</span>

                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                <a
                                  href={`mailto:${sch.contactEmail}`}
                                  className="text-indigo-600 hover:underline font-bold"
                                >
                                  {sch.contactEmail}
                                </a>
                              </span>

                              {sch.schoolId && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    ID: {sch.schoolId.slice(0, 8)}...
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badges & Remaining Days */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* License Status Badge */}
                          {sch.computedStatus === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              ACTIVE
                            </span>
                          )}

                          {sch.computedStatus === 'PENDING' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              NOT ACTIVATED / PENDING
                            </span>
                          )}

                          {sch.computedStatus === 'EXPIRED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                              <Lock className="w-3.5 h-3.5 text-rose-700" />
                              EXPIRED
                            </span>
                          )}

                          {sch.computedStatus === 'REVOKED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase bg-slate-200 text-slate-700 border border-slate-300">
                              <Ban className="w-3.5 h-3.5 text-slate-600" />
                              REVOKED
                            </span>
                          )}

                          {/* Remaining Days Badge */}
                          {sch.computedStatus === 'ACTIVE' && sch.remainingDays !== null && (
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black ${
                                sch.remainingDays <= 5
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                {sch.remainingDays} {sch.remainingDays === 1 ? 'Day' : 'Days'} Remaining
                                {sch.remainingDays <= 5 ? ' (Expiring Soon)' : ''}
                              </span>
                            </span>
                          )}

                          {sch.computedStatus === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              <span>⏱️ 30 Days (on activation)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle Grid: License Key, Dates, and Access State */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 text-xs">
                        {/* 1. License Key */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            License Key (1-Month Institutional)
                          </div>
                          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2">
                            <span className="font-mono font-black text-indigo-950 text-xs tracking-wider select-all truncate">
                              {keyToDisplay}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyLicenseKey(keyToDisplay)}
                              className={`p-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900'
                              }`}
                              title="Copy License Key"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span className="text-[10px]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span className="text-[10px]">Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 2. Validity Dates */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Validity Period & Timestamps
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-slate-700">
                              <span className="font-bold">Activated At:</span>
                              <span className="font-mono text-slate-900 font-medium">
                                {sch.validFrom || sch.startDate
                                  ? new Date(sch.validFrom || sch.startDate!).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'Not activated yet'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-700">
                              <span className="font-bold">Expiry Date:</span>
                              <span
                                className={`font-mono font-black ${
                                  sch.computedStatus === 'EXPIRED'
                                    ? 'text-rose-600'
                                    : sch.computedStatus === 'ACTIVE'
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {sch.validUntil || sch.expiryDate
                                  ? new Date(sch.validUntil || sch.expiryDate!).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'Awaits First Use (30 Days)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Current Access State */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Current Access State & Limits
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {sch.computedStatus === 'ACTIVE' ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-900">Full Access (App + Hub)</span>
                                </>
                              ) : sch.computedStatus === 'PENDING' ? (
                                <>
                                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span className="text-amber-900">Access Locked (Pending Key Entry)</span>
                                </>
                              ) : sch.computedStatus === 'EXPIRED' ? (
                                <>
                                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                                  <span className="text-rose-900">Access Expired (Renewal Needed)</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-4 h-4 text-slate-600 shrink-0" />
                                  <span className="text-slate-800">Access Revoked</span>
                                </>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              Device Allowance: <strong>Unlimited (999,999)</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                        <div className="text-[11px] text-slate-500 font-medium">
                          {sch.adminNotes && (
                            <span>
                              <strong>Notes:</strong> {sch.adminNotes}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* View Details Modal Button */}
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playPop();
                              setSelectedSchoolDetails(sch);
                            }}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* Quick Activate (for Pending licenses) */}
                          {sch.computedStatus === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleManualActivateSchoolLicense(sch)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Start 30-day validity immediately without waiting for teacher key entry"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Activate Now (30 Days)</span>
                            </button>
                          )}

                          {/* Renew License Button (ACTIVE or EXPIRED) */}
                          {(sch.computedStatus === 'ACTIVE' || sch.computedStatus === 'EXPIRED') && (
                            <button
                              type="button"
                              onClick={() => handleRenewSchoolLicense(sch)}
                              className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-black uppercase shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Renew school license for 30 days (retains the exact same license key)"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Renew (+30 Days)</span>
                            </button>
                          )}

                          {/* Revoke Button (ACTIVE) */}
                          {sch.computedStatus === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleRevokeSchoolLicense(sch)}
                              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-amber-200"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          )}

                          {/* Delete Button (Explicit Confirmation required) */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSchoolLicense(sch)}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-rose-200"
                            title="Delete license record (requires confirmation)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PAYMENTS TAB                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Security & Verification Notice */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-black uppercase tracking-wide block">
                Official Verification Architecture
              </span>
              <p className="leading-relaxed font-medium">
                User-submitted payment slips and transaction IDs are <strong>UNVERIFIED</strong> by default and remain in <strong>PENDING</strong> status. Premium access only activates when confirmed via official provider webhook or when verified in this Admin panel.
              </p>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border-2 border-slate-200">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, TID, order ID..."
                className="text-xs font-medium bg-transparent border-none focus:outline-hidden w-full sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {(
                [
                  'ALL',
                  'PENDING',
                  'PROCESSING',
                  'VERIFIED',
                  'FAILED',
                  'REJECTED',
                  'REFUNDED',
                  'EXPIRED',
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    soundManager.playPop();
                    setFilterStatus(st);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Payments List */}
          {filteredPayments.length > 0 ? (
            <div className="space-y-3">
              {filteredPayments.map((p) => (
                <div
                  key={p.id}
                  className={`bg-white border-3 rounded-2xl p-4 sm:p-5 transition-all shadow-sm ${
                    p.paymentStatus === 'PENDING'
                      ? 'border-amber-300 ring-2 ring-amber-100'
                      : p.paymentStatus === 'VERIFIED'
                      ? 'border-emerald-300'
                      : 'border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            p.paymentStatus === 'PENDING'
                              ? 'bg-amber-500 text-white'
                              : p.paymentStatus === 'VERIFIED'
                              ? 'bg-emerald-600 text-white'
                              : p.paymentStatus === 'PROCESSING'
                              ? 'bg-blue-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {p.paymentStatus}
                        </span>

                        <span className="text-xs font-bold text-slate-400">
                          {new Date(p.createdAt).toLocaleString()}
                        </span>

                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                          Method: {p.paymentMethod.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <h3 className="text-base font-black text-slate-900">
                          {p.userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </h3>
                        <span className="text-xs font-bold text-slate-500 font-mono">({p.userEmail})</span>
                        <span className="text-[11px] text-slate-400 font-mono">ID: {p.id}</span>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Product:</span>
                          <span className="font-black text-indigo-950">
                            {p.selectedLevel ? `Level ${p.selectedLevel}` : 'All Activities (1 Mo)'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Amount:</span>
                          <span className="font-black text-emerald-600">
                            {p.currency === 'PKR' ? 'Rs. ' : '$'}
                            {p.amount.toLocaleString()}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Transaction ID:</span>
                          <span className="font-black text-indigo-700 select-all">{p.providerTransactionId}</span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Expiry Date:</span>
                          <span className="font-bold text-slate-700">
                            {p.expiryDate ? formatExpiryDate(p.expiryDate) : 'Pending Activation'}
                          </span>
                        </div>
                      </div>

                      {/* Payment proof */}
                      {p.paymentProofUrl && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(p.paymentProofUrl || null)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Uploaded Proof ({p.paymentProofName || 'Receipt'})</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {p.paymentStatus === 'PENDING' ? (
                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleVerify(p.id)}
                          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>APPROVE PAYMENT</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReject(p.id)}
                          className="flex-1 sm:flex-none bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>REJECT PAYMENT</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-slate-500 space-y-1">
                        <div>
                          <span className="font-bold">Audited By:</span> {p.verifiedBy || 'System'}
                        </div>
                        {p.verifiedAt && (
                          <div>
                            <span className="font-bold">Verified:</span> {new Date(p.verifiedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-bold">No payments match your criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ORDERS TAB                                                             */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="bg-white border-3 border-indigo-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-black uppercase text-indigo-950">Customer Orders</h2>
              <p className="text-xs text-slate-500">
                Log of checkout orders initiated by users across Pakistan and International regions.
              </p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-indigo-100 text-indigo-900 rounded-xl">
              {orders.length} Orders
            </span>
          </div>

          {orders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {orders.map((ord) => (
                <div key={ord.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{ord.userEmail}</span>
                      <span className="text-slate-400 font-mono">({ord.id})</span>
                    </div>
                    <div className="text-slate-500">
                      Product:{' '}
                      <strong className="text-indigo-950 font-bold">
                        {ord.selectedLevel ? `Level ${ord.selectedLevel}` : 'All Activities (1 Mo)'}
                      </strong>{' '}
                      • Created: {new Date(ord.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="font-black text-emerald-600 block">
                      {ord.currency === 'PKR' ? 'Rs. ' : '$'}
                      {ord.totalAmount.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        ord.orderStatus === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ord.orderStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">No orders recorded yet.</div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PREMIUM LICENSES TAB                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'licenses' && (
        <div className="bg-white border-3 border-indigo-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-black uppercase text-indigo-950">Individual Active Licenses</h2>
              <p className="text-xs text-slate-500">
                Verified licenses for Playroom Page 1 access (1-Month duration from verified date).
              </p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-emerald-100 text-emerald-900 rounded-xl">
              {licenses.filter((l) => l.status === 'ACTIVE').length} Active
            </span>
          </div>

          {licenses.length > 0 ? (
            <div className="space-y-3">
              {licenses.map((lic) => (
                <div
                  key={lic.id}
                  className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    lic.status === 'ACTIVE'
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{lic.userEmail}</span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          lic.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
                        }`}
                      >
                        {lic.status}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Unlocked:{' '}
                      <strong className="text-indigo-950">
                        {lic.allActivitiesUnlocked ? 'All Activities (Levels 1-6)' : `Level(s): ${lic.unlockedLevels.join(', ')}`}
                      </strong>{' '}
                      • Verified By: {lic.verifiedBy || 'Admin'}
                    </div>
                  </div>

                  <div className="text-left sm:text-right space-y-0.5">
                    <div className="text-slate-500 font-medium">Valid Until:</div>
                    <div className="font-black text-indigo-950">{formatExpiryDate(lic.expiryDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">No individual licenses issued yet.</div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SCHOOL LICENSES TAB                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'school_licenses' && (
        <div className="space-y-4">
          <div className="bg-white border-3 border-indigo-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-black uppercase text-indigo-950">School & Institutional Licenses</h2>
                <p className="text-xs text-slate-500">
                  Separated from individual users. Grants classroom multi-device access to Page 1 and Page 2 Educator Hub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  setShowSchoolModal(true);
                }}
                className="bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Issue School License</span>
              </button>
            </div>

            {schoolLicenses.length > 0 ? (
              <div className="space-y-3">
                {schoolLicenses.map((sch) => (
                  <div
                    key={sch.id}
                    className={`p-5 rounded-2xl border-3 transition-all ${
                      sch.status === 'ACTIVE'
                        ? 'bg-white border-indigo-200 shadow-xs'
                        : 'bg-slate-50 border-slate-200 opacity-70'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-slate-900">{sch.schoolName}</span>
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              sch.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'
                            }`}
                          >
                            {sch.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 font-medium">
                          Contact: <strong>{sch.contactEmail}</strong> • ID: <span className="font-mono">{sch.schoolId}</span>
                        </div>

                        {/* Prominent License Key Display */}
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 p-2 rounded-xl">
                          <span className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">License Key:</span>
                          <span className="font-mono font-black text-sm text-indigo-950 select-all">
                            {sch.licenseKey || sch.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(sch.licenseKey || sch.id);
                              setActionMessage(`Copied License Key: ${sch.licenseKey || sch.id}`);
                              setTimeout(() => setActionMessage(null), 3000);
                            }}
                            className="ml-auto px-2 py-1 bg-indigo-900 text-white rounded text-[10px] font-black uppercase hover:bg-indigo-950 transition-colors cursor-pointer"
                          >
                            Copy Key
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800">
                            📱 Unlimited Devices
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800">
                            🎮 Full App + Education Hub
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800">
                            ⏱️ 30-Day License
                          </span>
                        </div>
                      </div>

                      <div className="text-left lg:text-right space-y-1.5 text-xs">
                        <div className="font-black text-emerald-600 text-sm">
                          {sch.currency === 'PKR' ? 'Rs. ' : '$'}
                          {sch.price.toLocaleString()} (30-Day Term)
                        </div>
                        <div className="text-slate-500">
                          Start: <strong>{new Date(sch.startDate).toLocaleDateString()}</strong> →{' '}
                          Expiry: <strong>{new Date(sch.expiryDate).toLocaleDateString()}</strong>
                        </div>
                        <div className="flex items-center lg:justify-end gap-2 pt-1">
                          {(() => {
                            const now = Date.now();
                            const diffDays = Math.ceil((new Date(sch.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24));
                            if (diffDays > 0 && sch.status === 'ACTIVE') {
                              return (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                  ⏳ {diffDays} Days Remaining
                                </span>
                              );
                            }
                            return (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                                🔒 Term Expired
                              </span>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() => handleRenewSchoolLicense(sch)}
                            className="text-[11px] font-black px-3 py-1 bg-indigo-900 hover:bg-indigo-950 text-white rounded-lg transition-colors cursor-pointer"
                          >
                            + Renew 30 Days
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No school licenses issued yet. Click &quot;Issue School License&quot; to authorize an institution.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PAYMENT PROVIDERS TAB                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div className="bg-white border-3 border-indigo-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-black uppercase text-indigo-950">Payment Providers & Credentials</h2>
              <p className="text-xs text-slate-500 font-medium">
                Review integration status for Pakistan and International payment gateways. Real merchant secrets remain server-side.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* SadaPay Card */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-teal-700" />
                    <span className="font-black text-sm text-slate-900">SadaPay</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                    NOT CONFIGURED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  SadaPay mobile wallet & debit transfers for Pakistan (Rs. 800/level, Rs. 5,000/mo). Awaiting official credentials.
                </p>
                <div className="text-[10px] font-mono bg-white p-2 rounded-lg border border-slate-200 text-slate-600">
                  Status: NOT CONFIGURED (Manual Admin Verification active)
                </div>
              </div>

              {/* Bank Transfer Card */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-indigo-700" />
                    <span className="font-black text-sm text-slate-900">Bank Transfer</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                    MANUAL AUDIT
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Direct commercial bank IBAN transfer. Strictly audited manually by Admin before activation.
                </p>
                <div className="text-[10px] font-mono bg-white p-2 rounded-lg border border-slate-200 text-slate-600">
                  Verification: Bank statement audit in Admin Payments tab
                </div>
              </div>

              {/* Payoneer Card */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-700" />
                    <span className="font-black text-sm text-slate-900">Payoneer USD</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                    NOT CONFIGURED
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  International USD checkout ($5/level, $20/month) for worldwide preschool parents and educators.
                </p>
                <div className="text-[10px] font-mono bg-white p-2 rounded-lg border border-slate-200 text-slate-600">
                  Required Env: PAYONEER_PROGRAM_ID, PAYONEER_API_SECRET
                </div>
              </div>
            </div>

            {/* Provider Instructions Editor */}
            <form onSubmit={handleSaveSettings} className="pt-4 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-black uppercase text-indigo-950">Payment Instructions Display</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SadaPay Title & Instructions</label>
                  <textarea
                    rows={3}
                    value={settings.pakistan.sadapay.instructions}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        pakistan: {
                          ...settings.pakistan,
                          sadapay: { ...settings.pakistan.sadapay, instructions: e.target.value },
                        },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Transfer IBAN & Instructions</label>
                  <textarea
                    rows={3}
                    value={settings.pakistan.bankTransfer.instructions}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        pakistan: {
                          ...settings.pakistan,
                          bankTransfer: { ...settings.pakistan.bankTransfer, instructions: e.target.value },
                        },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs uppercase px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Payment Instructions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PAYMENT ISSUES / DISPUTES TAB                                          */}
      {/* ========================================================================= */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {/* Dispute Policy Notice */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs space-y-1.5 text-amber-950">
            <div className="flex items-center gap-2 font-black uppercase text-[11px] text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Admin Payment Dispute & Verification Protocol</span>
            </div>
            <p className="leading-relaxed">
              When a user reports a payment issue (<span className="font-bold">"I made the payment but my payment has not been verified"</span>),
              audit your actual bank / SadaPay account statement before taking action.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-bold text-[11px]">
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                <span className="text-emerald-700 font-black block">1. APPROVE PAYMENT:</span>
                Activates 1-Month Premium License. Sets payment to VERIFIED.
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                <span className="text-rose-700 font-black block">2. REJECT — PAYMENT NOT RECEIVED:</span>
                Locks access. Does not fabricate refunds.
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                <span className="text-amber-800 font-black block">3. KEEP PENDING:</span>
                Holds status as PENDING / Under Review.
              </div>
            </div>
          </div>

          {/* Search & Filter Header */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-2xl border-2 border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search dispute by user email, order ID, or transaction ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Total Disputes:</span>
              <span className="px-2 py-0.5 bg-slate-100 rounded-full font-black text-slate-800">
                {disputes.length}
              </span>
            </div>
          </div>

          {/* Disputes List */}
          {disputes.length > 0 ? (
            <div className="space-y-4">
              {disputes
                .filter((disp) => {
                  const q = searchQuery.toLowerCase();
                  return (
                    !q ||
                    disp.userEmail.toLowerCase().includes(q) ||
                    disp.transactionId.toLowerCase().includes(q) ||
                    disp.id.toLowerCase().includes(q) ||
                    (disp.orderId && disp.orderId.toLowerCase().includes(q))
                  );
                })
                .map((disp) => {
                  const linkedPayment = payments.find(
                    (p) => p.id === disp.paymentId || (p.providerTransactionId && p.providerTransactionId === disp.transactionId)
                  );
                  const isPendingOrOpen = disp.status === 'OPEN' || disp.status === 'UNDER_REVIEW';

                  return (
                    <div
                      key={disp.id}
                      className={`bg-white border-3 rounded-2xl p-5 shadow-sm space-y-4 transition-all ${
                        isPendingOrOpen
                          ? 'border-amber-300 bg-amber-50/20'
                          : disp.status === 'RESOLVED_APPROVED'
                          ? 'border-emerald-300 bg-emerald-50/10'
                          : 'border-rose-200 bg-rose-50/10'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-slate-900">
                              {disp.userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span className="text-xs font-bold text-slate-500 font-mono">
                              ({disp.userEmail})
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            <span><strong>Dispute ID:</strong> {disp.id}</span>
                            <span>•</span>
                            <span><strong>Order ID:</strong> {disp.orderId || disp.paymentId}</span>
                            <span>•</span>
                            <span><strong>Submitted:</strong> {new Date(disp.submittedAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span
                            className={`px-3 py-1 rounded-full font-black text-[10px] uppercase shadow-xs ${
                              isPendingOrOpen
                                ? 'bg-amber-500 text-white animate-pulse'
                                : disp.status === 'RESOLVED_APPROVED'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            Dispute: {disp.status === 'OPEN' ? 'OPEN / UNDER REVIEW' : disp.status === 'UNDER_REVIEW' ? 'UNDER REVIEW' : disp.status}
                          </span>

                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                              linkedPayment?.paymentStatus === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : linkedPayment?.paymentStatus === 'REJECTED'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            Payment Status: {linkedPayment?.paymentStatus || 'PENDING'}
                          </span>
                        </div>
                      </div>

                      {/* Dispute Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Payment Method:</span>
                          <span className="font-black text-indigo-950 uppercase">{disp.paymentMethod}</span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Claimed Amount:</span>
                          <span className="font-black text-emerald-700">
                            {disp.currency === 'PKR' ? 'Rs. ' : '$'}
                            {disp.amount.toLocaleString()}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Transaction ID / Ref:</span>
                          <span className="font-black text-indigo-700 select-all">{disp.transactionId}</span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Claimed Payment Date:</span>
                          <span className="font-black text-slate-800">{disp.paymentDate}</span>
                        </div>
                      </div>

                      {/* User's Message / Statement */}
                      <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                        <span className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>User Message / Statement:</span>
                        </span>
                        <p className="italic font-medium leading-relaxed">
                          "{disp.userMessage || 'I made the payment but my payment has not been verified.'}"
                        </p>
                      </div>

                      {/* Resolution details if already resolved */}
                      {!isPendingOrOpen && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                          <div className="flex justify-between font-bold text-[11px]">
                            <span>Audited By: {disp.resolvedBy || 'School Administrator'}</span>
                            {disp.resolvedAt && (
                              <span>Resolved: {new Date(disp.resolvedAt).toLocaleString()}</span>
                            )}
                          </div>
                          {disp.adminResponse && (
                            <p className="text-[11px] italic text-slate-600">
                              <strong>Resolution Note:</strong> {disp.adminResponse}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Admin Actions Toolbar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {/* 1. APPROVE PAYMENT */}
                        <button
                          type="button"
                          onClick={() => handleResolveDispute(disp.id, 'APPROVE')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>APPROVE PAYMENT</span>
                        </button>

                        {/* 2. REJECT — PAYMENT NOT RECEIVED */}
                        <button
                          type="button"
                          onClick={() => handleResolveDispute(disp.id, 'REJECT_NOT_RECEIVED')}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 font-black text-xs uppercase px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>REJECT — PAYMENT NOT RECEIVED</span>
                        </button>

                        {/* 3. KEEP PENDING */}
                        <button
                          type="button"
                          onClick={() => handleResolveDispute(disp.id, 'KEEP_PENDING')}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Clock className="w-4 h-4" />
                          <span>KEEP PENDING</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-10 text-center text-slate-500 space-y-2">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-bold">No payment disputes or reported issues found.</p>
              <p className="text-xs text-slate-400">
                When users report payment verification issues from their account history, they will appear here for audit.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Proof Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase text-sm">Payment Proof</h3>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
              <img
                src={selectedProofUrl}
                alt="Payment proof"
                className="w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Create School License Modal */}
      {showSchoolModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-900">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <h3 className="font-black text-indigo-950 uppercase text-sm">Issue Institutional School License</h3>
              </div>
              <button
                onClick={() => setShowSchoolModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full cursor-pointer text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchoolLicense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">School / Institution Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smart School Karachi"
                  value={schoolForm.schoolName}
                  onChange={(e) => setSchoolForm({ ...schoolForm, schoolName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Admin / Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Principal Sarah Khan"
                    value={schoolForm.schoolAdminName}
                    onChange={(e) => setSchoolForm({ ...schoolForm, schoolAdminName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@smartschool.edu.pk"
                    value={schoolForm.contactEmail}
                    onChange={(e) => setSchoolForm({ ...schoolForm, contactEmail: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="Pakistan"
                    value={schoolForm.country}
                    onChange={(e) => setSchoolForm({ ...schoolForm, country: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Karachi"
                    value={schoolForm.city}
                    onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agreed Price</label>
                  <input
                    type="number"
                    value={schoolForm.price}
                    onChange={(e) => setSchoolForm({ ...schoolForm, price: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={schoolForm.currency}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, currency: e.target.value as 'PKR' | 'USD' })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="PKR">PKR (Rs.)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Custom License Key <span className="font-normal text-slate-400">(Optional — auto-generated if left blank)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SCH-SMART-2026-002"
                  value={schoolForm.licenseKey}
                  onChange={(e) => setSchoolForm({ ...schoolForm, licenseKey: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold uppercase text-indigo-950"
                />
              </div>

              {/* Fixed Term and Lifecycle Explanation */}
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Initial State:</span>
                  <span className="font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    PENDING (Awaits First Key Activation)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">License Duration:</span>
                  <span className="font-black text-indigo-950 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    30 Days (Starts upon first activation)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Device Allocation:</span>
                  <span className="font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    Unlimited Devices (999,999)
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Approved via institutional agreement"
                  value={schoolForm.adminNotes}
                  onChange={(e) => setSchoolForm({ ...schoolForm, adminNotes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSchoolModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white font-black uppercase rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Key className="w-4 h-4" />
                  <span>Issue Pending License</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View School Details Modal */}
      {selectedSchoolDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-900">
                  <Building className="w-4 h-4" />
                </div>
                <h3 className="font-black text-indigo-950 uppercase text-sm">School License Details</h3>
              </div>
              <button
                onClick={() => setSelectedSchoolDetails(null)}
                className="p-1 hover:bg-slate-100 rounded-full cursor-pointer text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* School Name & Country */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="text-sm font-black text-slate-900 flex items-center justify-between">
                  <span>{selectedSchoolDetails.schoolName}</span>
                  {selectedSchoolDetails.country && (
                    <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {selectedSchoolDetails.city ? `${selectedSchoolDetails.city}, ` : ''}{selectedSchoolDetails.country}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  School ID: {selectedSchoolDetails.schoolId || selectedSchoolDetails.id || 'N/A'}
                </div>
              </div>

              {/* License Key with 1-Click Copy */}
              <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-200 space-y-1.5">
                <span className="font-bold text-indigo-900 block text-[11px] uppercase">
                  Institutional License Key
                </span>
                <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-indigo-200">
                  <span className="font-mono font-black text-sm text-indigo-950 select-all">
                    {selectedSchoolDetails.licenseKey || selectedSchoolDetails.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyLicenseKey(selectedSchoolDetails.licenseKey || selectedSchoolDetails.id)}
                    className="px-2.5 py-1 bg-indigo-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === (selectedSchoolDetails.licenseKey || selectedSchoolDetails.id) ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-black text-slate-700 uppercase text-[10px]">Contact Information</span>
                <div className="grid grid-cols-2 gap-2 text-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Admin Name</span>
                    <span className="font-bold">{selectedSchoolDetails.schoolAdminName || selectedSchoolDetails.contactName || 'School Administrator'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Authorized Email</span>
                    <a href={`mailto:${selectedSchoolDetails.contactEmail}`} className="font-bold text-indigo-600 hover:underline">
                      {selectedSchoolDetails.contactEmail}
                    </a>
                  </div>
                </div>
              </div>

              {/* Status and Timestamps */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-black text-slate-700 uppercase text-[10px]">Lifecycle & Validity</span>
                <div className="grid grid-cols-2 gap-2 text-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Current Status</span>
                    <span className="font-black uppercase text-indigo-900">{selectedSchoolDetails.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Device Allowance</span>
                    <span className="font-bold text-emerald-700">Unlimited Devices</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Activated At</span>
                    <span className="font-medium">
                      {selectedSchoolDetails.validFrom || selectedSchoolDetails.startDate
                        ? new Date(selectedSchoolDetails.validFrom || selectedSchoolDetails.startDate!).toLocaleString()
                        : 'Not activated yet'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Expiry Date</span>
                    <span className="font-medium">
                      {selectedSchoolDetails.validUntil || selectedSchoolDetails.expiryDate
                        ? new Date(selectedSchoolDetails.validUntil || selectedSchoolDetails.expiryDate!).toLocaleString()
                        : 'Awaits First Activation'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Teacher Activation Instructions */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-1 text-emerald-950">
                <span className="font-black uppercase text-[10px] text-emerald-900">
                  How Teachers Activate on Classroom Devices
                </span>
                <p className="text-[11px] leading-relaxed">
                  Teachers open the application, click <strong>&quot;School License&quot;</strong> on the lock screen or Educator Hub, and enter this license key. Access immediately unlocks on that classroom device.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSchoolDetails(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete School License Confirmation Modal */}
      {deletingSchoolLicense && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 text-rose-700">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-black uppercase text-sm">Delete School License</h3>
              </div>
              <button
                onClick={() => setDeletingSchoolLicense(null)}
                className="p-1 hover:bg-slate-100 rounded-full cursor-pointer text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2 text-xs text-rose-950">
              <p className="font-bold text-sm">
                Are you sure you want to permanently delete this school license record?
              </p>
              <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">School: </span>
                  <strong className="text-slate-900">{deletingSchoolLicense.schoolName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">License Key: </span>
                  <strong className="font-mono text-indigo-900">{deletingSchoolLicense.licenseKey || deletingSchoolLicense.id}</strong>
                </div>
              </div>
              <p className="text-[11px] text-rose-700">
                This removes the institutional license entry from <code>public.school_licenses</code>. This does not erase user accounts or historic billing transactions.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessingDelete}
                onClick={() => setDeletingSchoolLicense(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingDelete}
                onClick={handleConfirmDeleteLicense}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isProcessingDelete ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew School License Confirmation Modal */}
      {renewingLicense && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-900">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h3 className="font-black text-indigo-950 uppercase text-sm">Renew School License</h3>
              </div>
              <button
                onClick={() => setRenewingLicense(null)}
                className="p-1 hover:bg-slate-100 rounded-full cursor-pointer text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm font-bold text-slate-900 text-center py-1">
              Renew this school&apos;s license for 30 days?
            </div>

            {/* School & License Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">School:</span>
                <span className="font-black text-slate-900">{renewingLicense.schoolName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Contact:</span>
                <span className="font-medium text-slate-700">{renewingLicense.contactEmail}</span>
              </div>

              <div className="flex justify-between items-center bg-indigo-50/80 p-2 rounded-xl border border-indigo-200">
                <span className="font-bold text-indigo-900">License Key:</span>
                <span className="font-mono font-black text-indigo-950 select-all">
                  {renewingLicense.licenseKey || renewingLicense.id}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Current Status:</span>
                <span
                  className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full ${
                    renewingLicense.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {renewingLicense.status}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">Current Expiry:</span>
                <span className="font-bold text-slate-800">
                  {new Date(renewingLicense.expiryDate || renewingLicense.validUntil || Date.now()).toLocaleDateString()}
                </span>
              </div>

              {/* Calculated New Expiry Date */}
              {(() => {
                const now = Date.now();
                const expiryTime = new Date(renewingLicense.expiryDate || renewingLicense.validUntil || now).getTime();
                const isCurrentlyActive = expiryTime > now && renewingLicense.status === 'ACTIVE';
                const newExpiryDate = isCurrentlyActive
                  ? new Date(expiryTime + 30 * 24 * 60 * 60 * 1000)
                  : new Date(now + 30 * 24 * 60 * 60 * 1000);

                return (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-emerald-900 font-black">
                      <span>New Expiry (+30 Days):</span>
                      <span className="text-emerald-700 text-xs">{newExpiryDate.toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      {isCurrentlyActive
                        ? 'Active license: +30 days added to current expiry date.'
                        : 'Expired license: Reactivated for 30 days starting from today.'}
                    </p>
                  </div>
                );
              })()}

              <div className="text-[11px] text-slate-500 font-medium text-center">
                The school keeps the <strong>SAME</strong> license key. Access is immediately renewed upon confirmation.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessingRenewal}
                onClick={() => setRenewingLicense(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingRenewal}
                onClick={handleConfirmRenewal}
                className="px-5 py-2 bg-indigo-900 hover:bg-indigo-950 disabled:opacity-50 text-white font-black uppercase rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
              >
                {isProcessingRenewal ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Renewing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Renewal (30 Days)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
