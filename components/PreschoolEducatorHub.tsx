import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  Sparkles,
  Printer,
  ChevronRight,
  ClipboardCheck,
  Calendar,
  Layers,
  FileText,
  Lightbulb,
  Grid,
  Music,
  CheckCircle2,
  BookOpen,
  ArrowLeft,
  Search,
  Download,
  Share2,
  Copy,
  Check,
  Eye,
  Plus,
  Trash2,
  Star,
  Users,
  Target,
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { LEARNING_AREAS_INFO, LEARNING_ITEMS } from '../data/learningItems';
import { TeacherAssessmentTool } from './educator/TeacherAssessmentTool';
import { LessonPlannerTool } from './educator/LessonPlannerTool';
import { ActivityPlannerTool } from './educator/ActivityPlannerTool';
import { PrintableWorksheetsTool } from './educator/PrintableWorksheetsTool';
import { TeachingTipsTool } from './educator/TeachingTipsTool';
import { FlashCardsTool } from './educator/FlashCardsTool';
import { RhymesResourcesTool } from './educator/RhymesResourcesTool';
import { EducatorBottomNav, EducatorCardId } from './educator/EducatorBottomNav';
import { EducatorCard2DIcon } from './educator/visuals/EducatorCard2DIcon';
import { EducatorHeader2DIllustration } from './educator/visuals/EducatorHeader2DIllustration';
import { SchoolAccessGate } from './educator/SchoolAccessGate';
import { SchoolPurchaseModal } from './educator/SchoolPurchaseModal';
import { UserAccount } from './PremiumAuthModal';
import { SchoolLicense } from '../types/payment';
import { School, ShieldCheck, LogOut, Lock } from 'lucide-react';
import { AdminPaymentRequestsTool } from './educator/AdminPaymentRequestsTool';
import { isAdminAccount } from '../utils/userAuthService';

interface PreschoolEducatorHubProps {
  onBackToPlayroom: () => void;
  isLocked?: boolean;
  isAuthLoading?: boolean;
  activeSchoolLicense?: SchoolLicense | null;
  onSchoolLoginSuccess?: (schoolAccount: UserAccount, activeLicense?: SchoolLicense) => void;
  userAccount?: UserAccount | null;
  initialSection?: ActiveSection;
  onLogout?: () => void;
}

type ActiveSection =
  | 'overview'
  | 'assessment'
  | 'lesson_planner'
  | 'activity_planner'
  | 'worksheets'
  | 'teaching_tips'
  | 'flash_cards'
  | 'rhyme_resources'
  | 'admin_portal';

export const PreschoolEducatorHub: React.FC<PreschoolEducatorHubProps> = ({
  onBackToPlayroom,
  isLocked = false,
  isAuthLoading = false,
  activeSchoolLicense,
  onSchoolLoginSuccess,
  userAccount,
  initialSection = 'overview',
  onLogout,
}) => {
  // Strict authorization: Only application-level admin roles (admin, super_admin) have admin access
  const isAdmin = isAdminAccount(userAccount);

  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    if (initialSection === 'admin_portal') {
      return isAdmin ? 'admin_portal' : 'overview';
    }
    return initialSection || 'overview';
  });

  useEffect(() => {
    if (initialSection) {
      if (initialSection === 'admin_portal') {
        setActiveSection(isAdmin ? 'admin_portal' : 'overview');
      } else {
        setActiveSection(initialSection);
      }
    }
  }, [initialSection, isAdmin]);

  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  // --- 1. Teacher Assessment State ---
  const [childrenList, setChildrenList] = useState([
    { id: '1', name: 'Maya S.', age: '4 yrs', status: 'On Track', strengths: 'Letter recognition, pattern recall', support: 'Pencil grip, number ordering' },
    { id: '2', name: 'Liam K.', age: '3.5 yrs', status: 'Needs Practice', strengths: 'Color mixing, shape identification', support: 'One-to-one counting, waiting turns' },
    { id: '3', name: 'Aria R.', age: '4.5 yrs', status: 'Excelling', strengths: 'Early phonics, sorting logic, fine motor', support: 'Multi-step story recall' },
    { id: '4', name: 'Noah T.', age: '4 yrs', status: 'On Track', strengths: 'Animal categories, rhyme rhythm', support: 'Subitizing 1–5' },
  ]);
  const [selectedChildId, setSelectedChildId] = useState<string>('1');
  const [assessmentNotes, setAssessmentNotes] = useState<string>(
    'Demonstrated clear understanding of shapes and primary colors. Actively engages during group rhyme time and shows strong visual attention in item sorting.'
  );
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('4 yrs');

  // --- 7. Rhyme & Classroom Resources State ---
  const [selectedRhymeCat, setSelectedRhymeCat] = useState('All');

  // --- Copy/Print feedback state ---
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    soundManager.playPop();
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePrint = () => {
    soundManager.playPop();
    window.print();
  };

  // Welcome voice once on initial mount
  React.useEffect(() => {
    soundManager.speak('Welcome to Preschool Educators Hub!');
  }, []);

  const educatorCards = [
    {
      id: 'assessment' as ActiveSection,
      sectionNumber: '1',
      title: 'TEACHER ASSESSMENT',
      subtitle: "Assess children's learning and progress.",
      iconType: 'assessment',
      badge: 'Assessment & Progress',
      targetCardId: 'educator-assessment-card',
      cardBg: 'bg-gradient-to-b from-[#FAF5FF] to-[#F3E8FF]/60',
      borderColor: 'border-[#D8B4FE] hover:border-[#A855F7]',
      shadowColor: 'hover:shadow-purple-200/60',
      badgeBg: 'bg-[#F3E8FF] text-[#6B21A8] border-[#D8B4FE]',
      accentColor: 'bg-[#9333EA] hover:bg-[#7E22CE] text-white',
    },
    {
      id: 'lesson_planner' as ActiveSection,
      sectionNumber: '2',
      title: 'LESSON PLANNER',
      subtitle: 'Plan preschool lessons and classroom routines.',
      iconType: 'lesson_planner',
      badge: 'Curriculum & Routines',
      targetCardId: 'educator-lesson-planner-card',
      cardBg: 'bg-gradient-to-b from-[#F0F9FF] to-[#E0F2FE]/60',
      borderColor: 'border-[#BAE6FD] hover:border-[#38BDF8]',
      shadowColor: 'hover:shadow-sky-200/60',
      badgeBg: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
      accentColor: 'bg-[#0284C7] hover:bg-[#0369A1] text-white',
    },
    {
      id: 'activity_planner' as ActiveSection,
      sectionNumber: '3',
      title: 'ACTIVITY PLANNER',
      subtitle: 'Find ready-made classroom activities.',
      iconType: 'activity_planner',
      badge: 'Hands-on Activities',
      targetCardId: 'educator-activity-planner-card',
      cardBg: 'bg-gradient-to-b from-[#FFF7ED] to-[#FFEDD5]/60',
      borderColor: 'border-[#FED7AA] hover:border-[#FB923C]',
      shadowColor: 'hover:shadow-orange-200/60',
      badgeBg: 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]',
      accentColor: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    },
    {
      id: 'worksheets' as ActiveSection,
      sectionNumber: '4',
      title: 'PRINTABLE WORKSHEETS',
      subtitle: 'Browse ready-made preschool worksheets.',
      iconType: 'worksheets',
      badge: 'Ready-to-Print Worksheets',
      targetCardId: 'educator-worksheets-card',
      cardBg: 'bg-gradient-to-b from-[#FDF2F8] to-[#FCE7F3]/60',
      borderColor: 'border-[#FBCFE8] hover:border-[#F472B6]',
      shadowColor: 'hover:shadow-pink-200/60',
      badgeBg: 'bg-[#FCE7F3] text-[#BE185D] border-[#FBCFE8]',
      accentColor: 'bg-[#DB2777] hover:bg-[#BE185D] text-white',
    },
    {
      id: 'teaching_tips' as ActiveSection,
      sectionNumber: '5',
      title: 'TEACHING TIPS',
      subtitle: 'Practical tips for preschool educators.',
      iconType: 'teaching_tips',
      badge: 'Classroom Strategies',
      targetCardId: 'educator-teaching-tips-card',
      cardBg: 'bg-gradient-to-b from-[#FEFCE8] to-[#FEF08A]/60',
      borderColor: 'border-[#FEF08A] hover:border-[#FACC15]',
      shadowColor: 'hover:shadow-amber-200/60',
      badgeBg: 'bg-[#FEF08A] text-[#854D0E] border-[#FDE047]',
      accentColor: 'bg-[#D97706] hover:bg-[#B45309] text-white',
    },
    {
      id: 'flash_cards' as ActiveSection,
      sectionNumber: '6',
      title: 'FLASH CARDS',
      subtitle: 'Ready-made 2D educational flash cards.',
      iconType: 'flash_cards',
      badge: '2D Flash Cards',
      targetCardId: 'educator-flash-cards-card',
      cardBg: 'bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5]/60',
      borderColor: 'border-[#A7F3D0] hover:border-[#34D399]',
      shadowColor: 'hover:shadow-emerald-200/60',
      badgeBg: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]',
      accentColor: 'bg-[#059669] hover:bg-[#047857] text-white',
    },
    {
      id: 'rhyme_resources' as ActiveSection,
      sectionNumber: '7',
      title: 'RHYME & CLASSROOM RESOURCES',
      subtitle: 'Written rhymes and classroom resources.',
      iconType: 'rhyme_resources',
      badge: 'Written Rhymes & Guides',
      targetCardId: 'educator-rhyme-resources-card',
      cardBg: 'bg-gradient-to-b from-[#FFF1F2] to-[#FFE4E6]/60',
      borderColor: 'border-[#FECDD3] hover:border-[#FB7185]',
      shadowColor: 'hover:shadow-rose-200/60',
      badgeBg: 'bg-[#FFE4E6] text-[#BE123C] border-[#FECDD3]',
      accentColor: 'bg-[#E11D48] hover:bg-[#BE123C] text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16 font-sans">
      {/* Top Educator Navbar Banner */}
      <nav className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 shadow-lg sticky top-0 z-30 border-b-4 border-indigo-500">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              id="back-to-playroom-top-btn"
              type="button"
              onClick={() => {
                soundManager.playPop();
                onBackToPlayroom();
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer shadow-sm border border-indigo-400"
            >
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
              <span>RETURN TO PLAYROOM</span>
            </button>

            <span className="hidden md:inline-block text-slate-400 text-xs font-bold">
              Preschool Educator Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Console Navigation Button - ONLY visible to verified application admins */}
            {isAdmin ? (
              <button
                id="educator-admin-console-btn"
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  setActiveSection('admin_portal');
                }}
                className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs sm:text-sm font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-amber-500/50 shadow-sm"
                title="Open Admin Licensing & School Requests Console"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Admin Console</span>
              </button>
            ) : null}

            {isLocked ? (
              <button
                id="top-right-submit-inquiry-btn"
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  setIsInquiryModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-md border-2 border-amber-300 active:scale-95"
              >
                <School className="w-4 h-4" />
                <span>Submit Inquiry</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-black bg-emerald-950/90 border border-emerald-400 text-emerald-300 px-3 py-1 rounded-full uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {isAdmin
                      ? 'Administrator • Full Access'
                      : activeSchoolLicense?.schoolName || userAccount?.schoolName || 'School Admin • Active'}
                  </span>
                </span>
                {activeSchoolLicense?.expiryDate && (
                  <span className="text-[11px] font-bold text-slate-300 hidden md:inline-block bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
                    Expires {new Date(activeSchoolLicense.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}

            {/* Logout Button in Right Corner of Navbar */}
            {onLogout && !isLocked && (
              <button
                id="educator-logout-btn"
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  onLogout();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer border-2 border-rose-300 select-none uppercase tracking-wider active:scale-95 shrink-0"
                title="Log Out School Session & Lock App"
                aria-label="Log Out School"
              >
                <LogOut className="w-4 h-4 stroke-[2.5]" />
                <span>LOGOUT</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* ========================================================================= */}
        {/* PAGE 2 HEADER (2D POLISHED EDUCATOR DASHBOARD BANNER)                      */}
        {/* ========================================================================= */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-r from-[#EEF2FF] via-[#F8FAFC] to-[#FAF5FF] border-4 border-[#C7D2FE] rounded-3xl p-6 sm:p-8 shadow-xl mb-8 sm:mb-10 relative overflow-hidden"
        >
          {/* Subtle 2D background accents */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-100/50 rounded-full blur-2xl -z-10 pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 relative z-10 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-4 sm:gap-6">
              <div className="shrink-0 bg-white border-3 border-[#C7D2FE] rounded-3xl p-2 sm:p-2.5 shadow-md">
                <EducatorHeader2DIllustration className="w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24" />
              </div>

              <div className="flex flex-col items-center sm:items-start">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-indigo-950 uppercase tracking-tight drop-shadow-xs">
                  PRESCHOOL EDUCATOR HUB
                </h1>
                <p className="text-xs sm:text-sm font-bold text-indigo-800/80 mt-1">
                  Professional Curriculum, Assessment & Classroom Resources
                </p>
              </div>
            </div>

            {/* RIGHT CORNER: Active School Partner Status Badge */}
            {!isLocked && (
              <div className="flex flex-col sm:items-end items-center gap-2.5 shrink-0">
                <div className="inline-flex items-center gap-2 bg-white/95 border-2 border-indigo-200 px-4 py-2 rounded-2xl shadow-xs">
                  <School className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                    {activeSchoolLicense?.schoolName || userAccount?.schoolName || 'School Session Active'}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Session Active" />
                </div>
              </div>
            )}
          </div>
        </motion.header>

        {/* ========================================================================= */}
        {/* INTERACTIVE EDUCATOR DASHBOARD CARDS (MAIN HUB PAGE)                     */}
        {/* ========================================================================= */}
        {activeSection === 'overview' && (
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
              {educatorCards.map((card, index) => (
                <motion.button
                  key={card.id}
                  id={`educator-card-${card.id}`}
                  type="button"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    soundManager.playPop();
                    if (!isLocked) {
                      setActiveSection(card.id);
                    }
                  }}
                  className={`group relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl ${card.cardBg} border-4 ${card.borderColor} ${card.shadowColor} shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer text-left w-full h-full min-h-[290px] select-none`}
                >
                  <div>
                    {/* Top Row: 2D Illustration and Tool Badge */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-white/90 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                        <EducatorCard2DIcon type={card.iconType} className="w-14 h-14 sm:w-16 sm:h-16" />
                      </div>
                      <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full border-2 tracking-wider ${card.badgeBg}`}>
                        Tool {card.sectionNumber} of 7
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 mb-1.5 group-hover:text-indigo-950 transition-colors">
                      {card.title}
                    </h2>

                    {/* Short description */}
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed mb-6">
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Action Button Pill */}
                  <div className="pt-4 border-t border-black/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Teacher Tool
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-full transition-all shadow-sm ${card.accentColor}`}>
                      <span>OPEN TOOL</span>
                      <ChevronRight className="w-4 h-4 stroke-[3] transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CARD 1: TEACHER ASSESSMENT                                               */}
        {/* ========================================================================= */}
        {activeSection === 'assessment' && (
          <TeacherAssessmentTool onBackToOverview={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 2: LESSON PLANNER                                                   */}
        {/* ========================================================================= */}
        {activeSection === 'lesson_planner' && (
          <LessonPlannerTool onBackToOverview={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 3: ACTIVITY PLANNER & VISUAL STEP GUIDE                             */}
        {/* ========================================================================= */}
        {activeSection === 'activity_planner' && (
          <ActivityPlannerTool onBackToOverview={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 4: PRINTABLE WORKSHEETS (50 READY-MADE A4 WORKSHEETS)               */}
        {/* ========================================================================= */}
        {activeSection === 'worksheets' && (
          <PrintableWorksheetsTool onBackToOverview={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 5: TEACHING TIPS (12 CATEGORIES, 50+ STRATEGIES, SEARCH & QUICK TIPS) */}
        {/* ========================================================================= */}
        {activeSection === 'teaching_tips' && (
          <TeachingTipsTool onBackToOverview={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 6: READY-MADE FLASH CARDS LIBRARY                                   */}
        {/* ========================================================================= */}
        {activeSection === 'flash_cards' && (
          <FlashCardsTool onBack={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 7: RHYME & CLASSROOM RESOURCES                                       */}
        {/* ========================================================================= */}
        {activeSection === 'rhyme_resources' && (
          <RhymesResourcesTool onBack={() => setActiveSection('overview')} />
        )}

        {/* ========================================================================= */}
        {/* CARD 8 / ADMIN CONSOLE: SCHOOL REQUESTS & SCHOOL LICENSES (ADMIN ONLY)     */}
        {/* ========================================================================= */}
        {activeSection === 'admin_portal' && (
          isAdmin ? (
            <AdminPaymentRequestsTool
              onBackToOverview={() => setActiveSection('overview')}
              userAccount={userAccount}
            />
          ) : (
            <div className="w-full max-w-2xl mx-auto my-8 p-8 bg-white border-4 border-rose-300 rounded-3xl shadow-xl text-center space-y-4">
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
                onClick={() => setActiveSection('overview')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl cursor-pointer"
              >
                Return to Educator Hub
              </button>
            </div>
          )
        )}

        {/* ========================================================================= */}
        {/* UNIFIED EDUCATOR HUB BOTTOM NAVIGATION (PREV / HOME / NEXT)               */}
        {/* ========================================================================= */}
        {activeSection !== 'overview' && activeSection !== 'admin_portal' && (
          <EducatorBottomNav
            currentSection={activeSection as EducatorCardId}
            onNavigate={(nextSection) => setActiveSection(nextSection as ActiveSection)}
          />
        )}

        {/* ========================================================================= */}
        {/* AUTH SESSION LOADING STATE                                                */}
        {/* ========================================================================= */}
        {isAuthLoading && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 border-4 border-indigo-300 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-lg font-black text-indigo-950 uppercase tracking-tight">
                Verifying School Admin Access
              </div>
              <p className="text-xs text-slate-500 font-bold">
                Checking authenticated session and credentials...
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TRANSPARENT SCHOOL ACCESS LOCK OVERLAY                                   */}
        {/* ========================================================================= */}
        {!isAuthLoading && isLocked && (
          <SchoolAccessGate
            onBackToPlayroom={onBackToPlayroom}
            onSchoolLoginSuccess={onSchoolLoginSuccess}
            onOpenInquiry={() => setIsInquiryModalOpen(true)}
          />
        )}
      </main>

      {/* School Inquiry / Request Modal */}
      <SchoolPurchaseModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
      />
    </div>
  );
};
