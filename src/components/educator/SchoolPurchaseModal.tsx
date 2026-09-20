import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  School,
  Building,
  CheckCircle2,
  Clock,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Globe,
  User,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { soundManager } from '../../utils/audio';
import { SchoolPaymentRequest, COUNTRY_OPTIONS } from '../../types/payment';
import { PaymentServiceManager } from '../../services/payment/PaymentServiceManager';
import { validateSchoolInquiryField } from '../../utils/inquiryValidation';

interface SchoolPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessSubmitted?: (req: SchoolPaymentRequest) => void;
}

export const SchoolPurchaseModal: React.FC<SchoolPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccessSubmitted,
}) => {
  const paymentManager = PaymentServiceManager.getInstance();

  // Form states - School Inquiry
  const [schoolName, setSchoolName] = useState('');
  const [schoolAdminName, setSchoolAdminName] = useState('');
  const [country, setCountry] = useState('Pakistan');
  const [contactEmail, setContactEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [subject, setSubject] = useState('Preschool School License & Classroom Access');
  const [city, setCity] = useState('');
  const [schoolMessage, setSchoolMessage] = useState('');

  // Validation errors map
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState('');

  // Field Validation Rules
  const validateField = (fieldName: string, value: string): string => {
    return validateSchoolInquiryField(fieldName, value);
  };

  const handleBlur = (fieldName: string, value: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const err = validateField(fieldName, value);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
  };

  const handleChange = (fieldName: string, value: string, setter: (val: string) => void) => {
    setter(value);
    // Instant real-time correction: clear or update error as the user types
    if (touched[fieldName] || fieldErrors[fieldName]) {
      const err = validateField(fieldName, value);
      setFieldErrors((prev) => {
        const next = { ...prev, [fieldName]: err };
        if (!err) {
          delete next[fieldName];
        }
        return next;
      });
      if (!err && errorMessage) {
        setErrorMessage('');
      }
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCountry = e.target.value;
    setCountry(selectedCountry);
    if (touched.country || fieldErrors.country) {
      const err = validateField('country', selectedCountry);
      setFieldErrors((prev) => {
        const next = { ...prev, country: err };
        if (!err) delete next.country;
        return next;
      });
    }
    // If phone number is empty, optionally prefix with country code
    const opt = COUNTRY_OPTIONS.find((c) => c.name === selectedCountry);
    if (opt && opt.code && !phoneNumber.trim()) {
      setPhoneNumber(opt.code + ' ');
    }
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double-click submission
    setErrorMessage('');

    // Mark all required fields as touched and validate all
    const errors: Record<string, string> = {
      country: validateField('country', country),
      schoolName: validateField('schoolName', schoolName),
      schoolAdminName: validateField('schoolAdminName', schoolAdminName),
      contactEmail: validateField('contactEmail', contactEmail),
      phoneNumber: validateField('phoneNumber', phoneNumber),
      subject: validateField('subject', subject),
      schoolMessage: validateField('schoolMessage', schoolMessage),
    };

    setTouched({
      country: true,
      schoolName: true,
      schoolAdminName: true,
      contactEmail: true,
      phoneNumber: true,
      subject: true,
      schoolMessage: true,
    });
    setFieldErrors(errors);

    const hasErrors = Object.values(errors).some((err) => err.length > 0);
    if (hasErrors) {
      soundManager.playPop();
      setErrorMessage('Please correct the highlighted fields with valid information before submitting.');
      return;
    }

    setIsSubmitting(true);
    soundManager.playPop();

    try {
      const request = await paymentManager.submitSchoolPaymentRequest({
        schoolName: schoolName.trim(),
        schoolAdminName: schoolAdminName.trim(),
        country: country.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        subject: subject.trim(),
        city: city.trim(),
        allowedDevices: 999999, // Unlimited devices for schools
        durationMonths: 1,      // Standard 30-day term
        page1Access: true,      // Full App Access
        page2Access: true,      // Full Education Hub Access
        amount: 25000,
        currency: country === 'Pakistan' ? 'PKR' : 'USD',
        paymentMethod: 'bank_transfer',
        transactionReference: 'INQUIRY-' + Date.now().toString(36).toUpperCase(),
        schoolMessage: schoolMessage.trim(),
      });

      soundManager.playSuccess();
      setSubmittedId(request.id);
      setIsSubmitted(true);
      if (onSuccessSubmitted) {
        onSuccessSubmitted(request);
      }
    } catch (err: any) {
      console.error('School inquiry submission failed:', err);
      setErrorMessage(err.message || 'Failed to submit school inquiry. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    soundManager.playPop();
    setIsSubmitted(false);
    setSchoolName('');
    setSchoolAdminName('');
    setCountry('Pakistan');
    setContactEmail('');
    setPhoneNumber('');
    setSubject('Preschool School License & Classroom Access');
    setCity('');
    setSchoolMessage('');
    setErrorMessage('');
    setFieldErrors({});
    setTouched({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/50 backdrop-blur-xs overflow-y-auto select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-xl bg-white border-4 border-indigo-300 rounded-3xl shadow-2xl overflow-hidden my-auto text-slate-800"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 sm:p-6 border-b-4 border-indigo-500 relative">
          <button
            type="button"
            onClick={handleResetAndClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 border-2 border-indigo-400/40 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
              🏫
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1">
                <School className="w-3 h-3" />
                <span>Official School License Inquiry</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                Preschool School License
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-700 text-xs font-bold flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isSubmitted ? (
            <form onSubmit={handleSubmitInquiry} className="space-y-4" noValidate>
              <div className="bg-indigo-50/80 border-2 border-indigo-100 rounded-2xl p-3.5 text-xs text-indigo-950">
                <p className="font-bold leading-relaxed">
                  Submit an inquiry for your school. Our team will review your submission, confirm payment details, and activate your <strong>30-Day School License Key</strong> with unlimited classroom devices.
                </p>
              </div>

              {/* Country Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                  Country *
                </label>
                <div className="relative">
                  <Globe className={`w-4 h-4 absolute left-3 top-3.5 ${fieldErrors.country ? 'text-rose-500' : 'text-slate-400'}`} />
                  <select
                    id="school-inquiry-country-select"
                    value={country}
                    onChange={handleCountryChange}
                    onBlur={() => handleBlur('country', country)}
                    className={`w-full pl-9 pr-8 p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-800 transition-colors focus:outline-hidden appearance-none ${
                      fieldErrors.country
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-indigo-500'
                    }`}
                  >
                    <option value="">-- Select Country --</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
                {fieldErrors.country && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.country}
                  </p>
                )}
              </div>

              {/* School Name & Administrator Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                    School Name *
                  </label>
                  <div className="relative">
                    <Building className={`w-4 h-4 absolute left-3 top-3.5 ${fieldErrors.schoolName ? 'text-rose-500' : 'text-slate-400'}`} />
                    <input
                      id="school-inquiry-name-input"
                      type="text"
                      value={schoolName}
                      onChange={(e) => handleChange('schoolName', e.target.value, setSchoolName)}
                      onBlur={(e) => handleBlur('schoolName', e.target.value)}
                      placeholder="e.g. Beaconhouse Preschool"
                      className={`w-full pl-9 p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-800 transition-colors focus:outline-hidden ${
                        fieldErrors.schoolName
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.schoolName && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.schoolName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                    Principal / Contact Name *
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3 top-3.5 ${fieldErrors.schoolAdminName ? 'text-rose-500' : 'text-slate-400'}`} />
                    <input
                      id="school-inquiry-admin-input"
                      type="text"
                      value={schoolAdminName}
                      onChange={(e) => handleChange('schoolAdminName', e.target.value, setSchoolAdminName)}
                      onBlur={(e) => handleBlur('schoolAdminName', e.target.value)}
                      placeholder="e.g. Mrs. Ayesha Khan"
                      className={`w-full pl-9 p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-800 transition-colors focus:outline-hidden ${
                        fieldErrors.schoolAdminName
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.schoolAdminName && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.schoolAdminName}
                    </p>
                  )}
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                    Contact Email *
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 absolute left-3 top-3.5 ${fieldErrors.contactEmail ? 'text-rose-500' : 'text-slate-400'}`} />
                    <input
                      id="school-inquiry-email-input"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => handleChange('contactEmail', e.target.value, setContactEmail)}
                      onBlur={(e) => handleBlur('contactEmail', e.target.value)}
                      placeholder="admin@school.edu.pk"
                      className={`w-full pl-9 p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-800 transition-colors focus:outline-hidden ${
                        fieldErrors.contactEmail
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.contactEmail && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.contactEmail}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                    Phone / WhatsApp Number *
                  </label>
                  <div className="relative">
                    <Phone className={`w-4 h-4 absolute left-3 top-3.5 ${fieldErrors.phoneNumber ? 'text-rose-500' : 'text-slate-400'}`} />
                    <input
                      id="school-inquiry-phone-input"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => handleChange('phoneNumber', e.target.value, setPhoneNumber)}
                      onBlur={(e) => handleBlur('phoneNumber', e.target.value)}
                      placeholder="+92 300 1234567"
                      className={`w-full pl-9 p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-800 transition-colors focus:outline-hidden ${
                        fieldErrors.phoneNumber
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.phoneNumber && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.phoneNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Subject & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                    Subject *
                  </label>
                  <div className="relative">
                    <FileText className={`w-4 h-4 absolute left-3 top-3.5 ${fieldErrors.subject ? 'text-rose-500' : 'text-slate-400'}`} />
                    <input
                      id="school-inquiry-subject-input"
                      type="text"
                      value={subject}
                      onChange={(e) => handleChange('subject', e.target.value, setSubject)}
                      onBlur={(e) => handleBlur('subject', e.target.value)}
                      placeholder="e.g. Preschool License Inquiry"
                      className={`w-full pl-9 p-3 bg-slate-50 border-2 rounded-xl text-xs font-bold text-slate-800 transition-colors focus:outline-hidden ${
                        fieldErrors.subject
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                  {fieldErrors.subject && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.subject}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                    City / Campus Location
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      id="school-inquiry-city-input"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Karachi, Lahore, Dubai"
                      className="w-full pl-9 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1">
                  Message / Classroom Requirements *
                </label>
                <div className="relative">
                  <textarea
                    id="school-inquiry-message-input"
                    value={schoolMessage}
                    onChange={(e) => handleChange('schoolMessage', e.target.value, setSchoolMessage)}
                    onBlur={(e) => handleBlur('schoolMessage', e.target.value)}
                    placeholder="Tell us about your campus branches, classroom requirements, estimated number of students..."
                    rows={3}
                    className={`w-full p-3 bg-slate-50 border-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden resize-none transition-colors ${
                      fieldErrors.schoolMessage
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {fieldErrors.schoolMessage && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.schoolMessage}
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>30-Day School License Includes:</span>
                </div>
                <p>• Full Playroom & Activity Page Access</p>
                <p>• Full Preschool Educator Hub (Lesson Planners, Assessments, Worksheets)</p>
                <p>• <strong>Unlimited classroom devices</strong> for your teachers & students</p>
              </div>

              <button
                id="modal-submit-inquiry-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-black text-xs sm:text-sm uppercase tracking-wider py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>Submit School Inquiry</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-5 py-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 border-2 border-emerald-300 rounded-3xl flex items-center justify-center mx-auto text-3xl shadow-md">
                ✅
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Inquiry Confirmed in Database</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase">
                  School Inquiry Submitted
                </h3>
                <p className="text-xs font-bold text-slate-700 max-w-lg mx-auto mt-2 leading-relaxed bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                  Thank you! Your school inquiry has been saved and sent to our administration team. We will review your request and issue your <strong>30-Day School License Key</strong>.
                </p>
              </div>

              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2 max-w-lg mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-bold">Reference:</span>
                  <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {submittedId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Country:</span>
                  <span className="font-bold text-slate-800">{country}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">School:</span>
                  <span className="font-bold text-slate-800">{schoolName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Contact Person:</span>
                  <span className="font-bold text-slate-800">{schoolAdminName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Email:</span>
                  <span className="font-bold text-slate-800">{contactEmail}</span>
                </div>
                {phoneNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Phone:</span>
                    <span className="font-bold text-slate-800">{phoneNumber}</span>
                  </div>
                )}
                {city && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">City:</span>
                    <span className="font-bold text-slate-800">{city}</span>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-[11px] font-bold max-w-lg mx-auto text-left leading-relaxed">
                💡 <strong>Next Steps:</strong> When you receive your License Key from our administrator, return to the Preschool Educator Hub and enter your key in the <strong>License Key Activation</strong> box to instantly unlock full access.
              </div>

              <button
                id="modal-inquiry-close-btn"
                type="button"
                onClick={handleResetAndClose}
                className="w-full max-w-xs bg-indigo-900 hover:bg-indigo-950 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow-md transition-all cursor-pointer mx-auto block"
              >
                Close & Return
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};


