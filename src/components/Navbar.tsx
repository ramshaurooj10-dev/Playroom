import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Volume2,
  VolumeX,
  Star,
  Sparkles,
  ArrowDownToLine,
  User,
  Lock,
  Search,
  X,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityId } from '../types';
import { soundManager } from '../utils/audio';
import { usePwaInstall } from '../usePwaInstall';
import { UserAccount } from './PremiumAuthModal';
import { LEARNING_ITEMS, LearningItem } from '../data/learningItems';
import { useDeveloperMode } from '../utils/devMode';
import { checkActivityAccess } from '../utils/licenseService';
import { isAdminAccount } from '../utils/userAuthService';

interface NavbarProps {
  currentActivity: ActivityId;
  onNavigateHome: () => void;
  onSelectActivity?: (id: ActivityId) => void;
  starsCount: number;
  activityTitle?: string;
  activityEmoji?: string;
  onOpenPremiumModal?: (title?: string, level?: number, activityId?: string) => void;
  userAccount?: UserAccount | null;
  onOpenEducatorHub?: () => void;
  onOpenAdminConsole?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentActivity,
  onNavigateHome,
  onSelectActivity,
  starsCount,
  activityTitle,
  activityEmoji,
  onOpenPremiumModal,
  userAccount,
  onOpenEducatorHub,
  onOpenAdminConsole,
  onLogout,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(soundManager.enabled);
  const { isDeveloperMode: isDev } = useDeveloperMode();
  const { isInstallable, installApp } = usePwaInstall();
  const [installToast, setInstallToast] = useState(false);

  const isSchoolActive = Boolean(
    userAccount?.role === 'school_admin' ||
    (typeof window !== 'undefined' && localStorage.getItem('playroom_active_school_license'))
  );

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSearchCategory, setSelectedSearchCategory] = useState<string>('All');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const toggleSound = () => {
    const newStatus = !soundEnabled;
    soundManager.enabled = newStatus;
    setSoundEnabled(newStatus);
    if (newStatus) {
      soundManager.startBackgroundMusic();
      soundManager.playPop();
    } else {
      soundManager.stopSpeech();
      soundManager.stopBackgroundMusic();
    }
  };

  const handleHomeClick = () => {
    soundManager.playPop();
    setIsSearchOpen(false);
    onNavigateHome();
  };

  const handleInstallClick = () => {
    soundManager.playPop();
    if (isInstallable) {
      installApp();
    } else {
      soundManager.speak("To install Playroom, tap your browser menu and select Add to Home Screen!");
      setInstallToast(true);
      setTimeout(() => setInstallToast(false), 4000);
    }
  };

  const toggleSearch = () => {
    soundManager.playPop();
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 150);
      }
      return next;
    });
  };

  // Close search when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isSearchOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        const toggleBtn = document.getElementById('search-toggle-btn-nav');
        if (toggleBtn && toggleBtn.contains(e.target as Node)) return;
        setIsSearchOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen]);

  // Filtered search results
  const searchResults = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return LEARNING_ITEMS.filter((item) => {
      const matchesCategory =
        selectedSearchCategory === 'All' ||
        item.learningArea.toLowerCase().includes(selectedSearchCategory.toLowerCase()) ||
        (selectedSearchCategory === 'Free' && item.isFree) ||
        (selectedSearchCategory === 'Premium' && !item.isFree);

      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.learningArea.toLowerCase().includes(query) ||
        item.keywords.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, selectedSearchCategory]);

  const handleSelectSearchResult = (item: LearningItem) => {
    soundManager.playPop();
    soundManager.speak(item.title);
    setIsSearchOpen(false);
    setSearchQuery('');

    const levelNum = typeof item.level === 'number' ? item.level : parseInt(String(item.level), 10) || 1;
    const access = checkActivityAccess(item.id, levelNum, userAccount?.email, isDev);
    const hasAccess = item.isFree || isDev || access.hasAccess;

    if (hasAccess) {
      if (onSelectActivity) {
        onSelectActivity(item.id);
      }
    } else if (onOpenPremiumModal) {
      onOpenPremiumModal(item.title, item.level, item.id);
    }
  };

  const searchCategories = [
    { label: 'All', icon: '✨' },
    { label: 'Literacy', icon: '🔤' },
    { label: 'Math', icon: '🔢' },
    { label: 'Colors & Shapes', icon: '🎨' },
    { label: 'Logic', icon: '🧩' },
    { label: 'Observation', icon: '🔍' },
    { label: 'Motor', icon: '✍️' },
    { label: 'Free', icon: '⭐' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full px-4 py-3 bg-[#FDE047] border-b-8 border-[#EAB308] shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Home Button or Playroom Logo */}
        {currentActivity !== 'home' && currentActivity !== 'welcome' ? (
          <button
            id="home-btn-nav"
            type="button"
            onClick={handleHomeClick}
            className="flex items-center gap-2 bg-[#6BCB77] hover:bg-[#58B368] text-white font-black px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl border-b-4 border-[#16A34A] active:border-b-0 active:translate-y-1 shadow-md transition-all cursor-pointer text-base sm:text-lg tracking-wide uppercase"
          >
            <Home className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
            <span>HOME</span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white border-4 border-amber-400 flex items-center justify-center text-xl sm:text-2xl shadow-inner">
              🧸
            </div>
            <span className="text-xl sm:text-3xl font-black text-[#1D4ED8] tracking-tight uppercase drop-shadow-sm">
              PLAYROOM
            </span>
          </div>
        )}

        {/* Center: Current Activity Indicator if inside an activity */}
        {currentActivity !== 'home' && currentActivity !== 'welcome' && activityTitle && (
          <div className="hidden sm:flex items-center gap-2 bg-white/95 text-blue-900 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full border-4 border-white shadow-md font-black text-sm sm:text-base uppercase">
            <span className="text-lg sm:text-xl">{activityEmoji}</span>
            <span className="truncate max-w-[200px] md:max-w-[300px]">{activityTitle}</span>
          </div>
        )}

        {/* Right Controls: PRESCHOOL EDUCATORS HUB button, Search Icon, Lock (Premium), Arrow (Install), Stars & Sound Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Preschool Educators Hub Navigation Button */}
          {currentActivity !== 'welcome' && onOpenEducatorHub && (
            <button
              id="educators-hub-nav-btn"
              type="button"
              onClick={() => {
                soundManager.playPop();
                onOpenEducatorHub();
              }}
              className="flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-900 border-2 border-indigo-400 font-black text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer uppercase tracking-tight active:translate-y-0.5"
              title="Open Preschool Educators Hub"
            >
              <span className="text-sm">👩‍🏫</span>
              <span className="hidden sm:inline">PRESCHOOL EDUCATORS HUB</span>
              <span className="sm:hidden">EDUCATORS</span>
            </button>
          )}

          {/* 1. Search Icon Button */}
          {currentActivity !== 'welcome' && (
            <button
              id="search-toggle-btn-nav"
              type="button"
              onClick={toggleSearch}
              className={`p-2 sm:p-2.5 rounded-2xl border-b-4 shadow-md transition-all cursor-pointer flex items-center justify-center ${
                isSearchOpen
                  ? 'bg-[#2563EB] border-[#1D4ED8] text-white ring-2 ring-blue-300'
                  : 'bg-white hover:bg-blue-50 text-blue-700 border-slate-300 hover:border-slate-400 active:translate-y-1'
              }`}
              title="Search activities & games"
              aria-label="Search activities"
            >
              <Search className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* 2. Lock Icon Button (Premium / Parent Account) - Icon Only */}
          {onOpenPremiumModal && (
            <button
              id="parent-account-btn"
              type="button"
              onClick={() => {
                soundManager.playPop();
                onOpenPremiumModal();
              }}
              className={`p-2 sm:p-2.5 rounded-2xl border-b-4 shadow-md active:translate-y-1 transition-all cursor-pointer flex items-center justify-center ${
                userAccount?.isLoggedIn
                  ? 'bg-blue-100 hover:bg-blue-200 border-blue-400 text-blue-800'
                  : 'bg-amber-400 hover:bg-amber-300 border-amber-600 text-amber-950'
              }`}
              title={userAccount?.isLoggedIn ? 'Parent Account' : 'Unlock Premium'}
              aria-label={userAccount?.isLoggedIn ? 'Parent Account' : 'Unlock Premium'}
            >
              {userAccount?.isLoggedIn ? (
                <User className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <Lock className="w-5 h-5 stroke-[2.5]" />
              )}
            </button>
          )}

          {/* Admin Console Shortcut - ONLY visible to verified application admins (role: 'admin' | 'super_admin') */}
          {isAdminAccount(userAccount) && (onOpenAdminConsole || onOpenEducatorHub) && (
            <button
              id="navbar-admin-console-btn"
              type="button"
              onClick={() => {
                soundManager.playPop();
                if (onOpenAdminConsole) {
                  onOpenAdminConsole();
                } else if (onOpenEducatorHub) {
                  onOpenEducatorHub();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 border-2 border-amber-500 hover:border-amber-600 font-black text-xs shadow-sm hover:shadow-md active:translate-y-0.5 transition-all cursor-pointer select-none uppercase tracking-tight"
              title="Admin Management Console"
              aria-label="Admin Console"
            >
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">ADMIN</span>
            </button>
          )}

          {/* 3. Arrow Icon Button (Install App) - Icon Only */}
          <button
            id="pwa-install-btn"
            type="button"
            onClick={handleInstallClick}
            className="p-2 sm:p-2.5 rounded-2xl border-b-4 border-[#BE185D] bg-[#EC4899] hover:bg-[#DB2777] text-white shadow-md active:translate-y-1 transition-all cursor-pointer flex items-center justify-center"
            title="Install Playroom App"
            aria-label="Install App"
          >
            <ArrowDownToLine className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Star Counter - Main Menu Only */}
          {currentActivity === 'home' && (
            <div
              id="star-counter"
              className="flex items-center gap-1.5 bg-white text-amber-950 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl border-4 border-white shadow-md font-black text-sm sm:text-base"
              title="Stars collected"
            >
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-500 animate-pulse" />
              <span className="text-sm sm:text-base leading-none">{starsCount}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500 hidden sm:inline" />
            </div>
          )}

          {/* Mute/Sound Toggle */}
          <button
            id="sound-toggle-btn"
            type="button"
            onClick={toggleSound}
            className={`p-2 sm:p-2.5 rounded-2xl border-b-4 shadow-md transition-all cursor-pointer flex items-center justify-center ${
              soundEnabled
                ? 'bg-[#4D96FF] border-[#2563EB] text-white hover:bg-blue-500 active:translate-y-1'
                : 'bg-slate-300 border-slate-500 text-slate-700 hover:bg-slate-400 active:translate-y-1'
            }`}
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            aria-label={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <VolumeX className="w-5 h-5 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>

      {/* PWA Install Notification Toast */}
      {installToast && (
        <div className="max-w-md mx-auto mt-2 bg-amber-100 border-2 border-amber-400 text-amber-950 font-black text-xs px-4 py-2 rounded-2xl text-center shadow-md animate-fade-in">
          📱 To install Playroom on your device, tap your browser menu and select "Add to Home Screen" or "Install App"!
        </div>
      )}

      {/* Interactive Search Overlay & Dropdown */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            ref={searchContainerRef}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="max-w-3xl mx-auto mt-3 bg-white/95 backdrop-blur-md rounded-3xl border-4 border-blue-300 shadow-2xl p-4 sm:p-5 text-slate-800"
          >
            {/* Search Input Bar */}
            <div className="relative flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  id="activity-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search activities, games, rhymes, letters..."
                  className="w-full pl-11 pr-10 py-3 bg-slate-100 hover:bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-blue-500 rounded-2xl text-base font-bold text-slate-800 placeholder-slate-400 outline-none transition shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl transition cursor-pointer flex items-center justify-center"
                title="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
              {searchCategories.map((cat) => {
                const isActive = selectedSearchCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => {
                      soundManager.playPop();
                      setSelectedSearchCategory(cat.label);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 whitespace-nowrap transition cursor-pointer border ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Results List */}
            <div className="max-h-[50vh] sm:max-h-[380px] overflow-y-auto pr-1 space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition text-left cursor-pointer group shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200 shadow-inner flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        {item.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-800 text-sm sm:text-base group-hover:text-blue-700 transition-colors truncate">
                            {item.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              item.isFree
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {item.isFree ? '⭐ Free' : '🔒 Level ' + item.level}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold truncate">
                          {item.subtitle} • <span className="text-slate-400">{item.learningArea}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-600 transition pl-2 flex-shrink-0">
                      <span className="text-xs font-bold hidden sm:inline">Play</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <span className="text-3xl mb-2 block">🔍</span>
                  <p className="font-bold text-sm">No activities matching "{searchQuery}"</p>
                  <p className="text-xs text-slate-400 mt-1">Try searching for "letters", "math", "animals", or "shapes"</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
