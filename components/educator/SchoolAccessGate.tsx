import React, { useState } from 'react';
import { motion } from 'motion/react';
import { School, ArrowLeft, KeyRound, CheckCircle2, Lock, AlertCircle, Sparkles, HelpCircle, ShieldCheck } from 'lucide-react';
import { soundManager } from '../../utils/audio';
import { UserAccount } from '../PremiumAuthModal';
import { PaymentServiceManager } from '../../services/payment/PaymentServiceManager';
import { SchoolLicense } from '../../types/payment';
import { emitLicenseStateChange } from '../../utils/licenseService';

interface SchoolAccessGateProps {
  onBackToPlayroom: () => void;
  onSchoolLoginSuccess?: (schoolAccount: UserAccount, activeLicense?: SchoolLicense) => void;
  onOpenInquiry?: () => void;
}

export const SchoolAccessGate: React.FC<SchoolAccessGateProps> = ({
  onBackToPlayroom,
  onSchoolLoginSuccess,
  onOpenInquiry,
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const paymentManager = PaymentServiceManager.getInstance();

  const handleReturnHome = () => {
    soundManager.playPop();
    onBackToPlayroom();
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedKey = licenseKey.trim();

    if (!trimmedKey) {
      setErrorMessage('Invalid license key. Please check your key and try again.');
      return;
    }

    setIsVerifying(true);
    try {
      // Query and verify key strictly against Supabase `school_licenses` table
      const result = await paymentManager.validateSchoolLicenseKey(trimmedKey);
      setIsVerifying(false);

      if (!result.success || !result.license) {
        setErrorMessage(result.error || 'Invalid license key. Please check your key and try again.');
        return;
      }

      const verifiedLicense = result.license;

      const schoolAccount: UserAccount = {
        id: verifiedLicense.schoolId || 'school_' + Date.now(),
        email: verifiedLicense.contactEmail || 'school_admin@partner.edu',
        isLoggedIn: true,
        role: 'school_admin',
        hasPage1Access: true,
        hasPage2SchoolAccess: true,
        schoolName: verifiedLicense.schoolName || 'Authorized School Partner',
        licenseKey: verifiedLicense.licenseKey || trimmedKey.toUpperCase(),
      };

      // Save active school license and user session
      paymentManager.saveActiveSchoolLicense(verifiedLicense);
      localStorage.setItem('playroom_user', JSON.stringify(schoolAccount));
      soundManager.playSuccess();
      setSuccessMessage('School license activated successfully! Unlocking Education Hub and Activities...');
      emitLicenseStateChange();

      setTimeout(() => {
        if (onSchoolLoginSuccess) {
          onSchoolLoginSuccess(schoolAccount, verifiedLicense);
        } else {
          window.location.reload();
        }
      }, 750);
    } catch (err: any) {
      setIsVerifying(false);
      setErrorMessage(err?.message || 'Invalid license key. Please check your key and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-xs overflow-y-auto select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg bg-white border-4 border-indigo-300 rounded-3xl shadow-2xl overflow-hidden text-slate-800 my-auto"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-5 sm:p-6 text-white text-center border-b-4 border-indigo-500 relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/10 border-2 border-indigo-300/40 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mx-auto mb-2.5 shadow-inner">
            🏫
          </div>
          <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>School Administration Access</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-sm">
            ACCESS ONLY FOR SCHOOL ADMINISTRATION
          </h1>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 space-y-5">
          <div className="bg-indigo-50/90 border-2 border-indigo-100 rounded-2xl p-4 text-center">
            <p className="text-xs sm:text-sm font-bold text-indigo-950 leading-relaxed">
              Preschool Educator Hub is reserved for authorized school administration accounts.
            </p>
            <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-1.5 leading-relaxed">
              Includes classroom curriculum tools, teacher assessments, lesson planners, visual activity guides, and printable worksheets.
            </p>
          </div>

          {/* License Key Activation Form */}
          <form onSubmit={handleActivateLicense} className="space-y-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <label htmlFor="license-key-input" className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wide">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>License Key</span>
              </label>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded-md">
                30-Day School License
              </span>
            </div>

            <div>
              <input
                id="license-key-input"
                type="text"
                value={licenseKey}
                onChange={(e) => {
                  setLicenseKey(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Enter your 30-day school license key..."
                className="w-full p-3 bg-white border-2 border-slate-300 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:normal-case placeholder:font-normal focus:border-indigo-600 focus:outline-hidden shadow-xs"
                autoComplete="off"
                spellCheck={false}
                disabled={isVerifying}
              />
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 text-xs font-bold text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              id="activate-license-btn"
              type="submit"
              disabled={isVerifying}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-black text-xs sm:text-sm uppercase tracking-wider py-3.5 px-5 rounded-xl border-b-4 border-indigo-950 active:border-b-0 active:translate-y-0.5 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4 stroke-[2.5]" />
              <span>{isVerifying ? 'Verifying License Key...' : 'Activate License'}</span>
            </button>
          </form>

          {/* Alternative Actions: Submit Inquiry & Return to Playroom */}
          <div className="space-y-2.5 pt-1">
            {onOpenInquiry && (
              <button
                id="gate-submit-inquiry-btn"
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  onOpenInquiry();
                }}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider py-3 px-4 rounded-xl border-b-3 border-amber-800 active:border-b-0 active:translate-y-0.5 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <School className="w-4 h-4 stroke-[2.5]" />
                <span>Don't have a license? Submit Inquiry</span>
              </button>
            )}

            <button
              id="return-to-playroom-gate-btn"
              type="button"
              onClick={handleReturnHome}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Playroom</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
