import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivityId, ActivityInfo } from './types';
import { Navbar } from './components/Navbar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HomeScreen } from './components/HomeScreen';
import { ACTIVITIES, PREMIUM_ACTIVITIES } from './data/activitiesList';
import { ABCFun } from './components/activities/ABCFun';
import { ColorTime } from './components/activities/ColorTime';
import { FindObject } from './components/activities/FindObject';
import { CountingFun } from './components/activities/CountingFun';
import { ShapeMatch } from './components/activities/ShapeMatch';
import { RhymeTime } from './components/activities/RhymeTime';
import { FindTheDifference } from './components/activities/FindTheDifference';
import { AnimalFoodMatch } from './components/activities/AnimalFoodMatch';
import { BigSmallSort } from './components/activities/BigSmallSort';
import { MoreOrLess } from './components/activities/MoreOrLess';
import { PatternFun } from './components/activities/PatternFun';
import { MemoryMatch } from './components/activities/MemoryMatch';
import { FruitVegSort } from './components/activities/FruitVegSort';
import { OddOneOut } from './components/activities/OddOneOut';
import { CountAndTap } from './components/activities/CountAndTap';
import { ShapeBuilder } from './components/activities/ShapeBuilder';
import { ShadowMatch } from './components/activities/ShadowMatch';
import { NumberTrace } from './components/activities/NumberTrace';
import { LetterTrace } from './components/activities/LetterTrace';
import { NumberOrder } from './components/activities/NumberOrder';
import { ColorMixing } from './components/activities/ColorMixing';
import { BodyParts } from './components/activities/BodyParts';
import { DailyRoutine } from './components/activities/DailyRoutine';
import { HealthyFoodSort } from './components/activities/HealthyFoodSort';
import { BuildHealthyPlate } from './components/activities/BuildHealthyPlate';
import { BubblePop } from './components/activities/BubblePop';
import { BalloonCount } from './components/activities/BalloonCount';
import { FeedAnimal } from './components/activities/FeedAnimal';
import { CatchTheStars } from './components/activities/CatchTheStars';
import { CleanRoom } from './components/activities/CleanRoom';
import { SpyHiddenObjects } from './components/activities/SpyHiddenObjects';
import { BuildGarden } from './components/activities/BuildGarden';
import { WhatComesTogether } from './components/activities/WhatComesTogether';
import { SweetSourFun } from './components/activities/SweetSourFun';
import { AnimalParentsBabies } from './components/activities/AnimalParentsBabies';
import { ShapesCollectorFun } from './components/activities/ShapesCollectorFun';
import { FishHunting } from './components/activities/FishHunting';
import { ColorFun } from './components/activities/ColorFun';
import { KiteCountTakeAway } from './components/activities/KiteCountTakeAway';
import { TrafficLightFun } from './components/activities/TrafficLightFun';
import { IdentifyItems } from './components/activities/IdentifyItems';
import { AddCountFun } from './components/activities/AddCountFun';
import { SortItFun } from './components/activities/SortItFun';
import { IdentifyItemsCardIcon } from './components/common/IdentifyItemsCardIcon';
import { GenericPremiumActivity } from './components/activities/GenericPremiumActivity';
import { PreschoolEducatorHub } from './components/PreschoolEducatorHub';
import { SchoolAccessGate } from './components/educator/SchoolAccessGate';
import { CompletionScreen } from './components/CompletionScreen';
import { PremiumAccessModal } from './components/PremiumAccessModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { UserAccount } from './components/PremiumAuthModal';
import { DeveloperModeToggle } from './components/common/DeveloperModeToggle';
import { useDeveloperMode, setDeveloperMode } from './utils/devMode';
import { soundManager } from './utils/audio';
import { recordDailyCompletion, getCompletedAllTime, getGlobalStarsCount, addGlobalStars, recordLastPlayedActivity } from './utils/dailyProgress';
import { getSupabaseClient } from './utils/supabaseClient';
import { PaymentServiceManager } from './services/payment/PaymentServiceManager';
import {
  trackAppOpen,
  trackPageView,
  trackActivityOpen,
  trackActivityComplete,
  trackStarEarned,
  setAnalyticsUserId,
} from './utils/analytics';
import { updateSEOForActivity } from './utils/seo';
import {
  getOrCreateUserAccount,
  signInWithGoogle,
  getCurrentUserAccountLocal,
  isAdminAccount,
} from './utils/userAuthService';
import { ArrowLeft, Lock, LogOut, ShieldCheck } from 'lucide-react';

// =========================================================================
// DEMO CONFIGURATION FLAG:
// Set to `false` so the Education Hub is locked unless a valid active
// 30-day school license key is entered or verified in Supabase.
// =========================================================================
export const TEMPORARY_DEMO_PAGE2_UNLOCK = false;

export default function App() {
  // Always mount and start on 'welcome' as the initial app entry route
  const [currentActivity, setCurrentActivity] = useState<ActivityId>('welcome');
  const [globalStars, setGlobalStars] = useState<number>(() => getGlobalStarsCount());
  const { isDeveloperMode: isDev } = useDeveloperMode();
  const [completedActivities, setCompletedActivities] = useState<Set<ActivityId>>(() => {
    return new Set(getCompletedAllTime());
  });

  // Account & Premium Modal state
  const [userAccount, setUserAccount] = useState<UserAccount | null>(() => {
    return getCurrentUserAccountLocal();
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hubInitialSection, setHubInitialSection] = useState<'overview' | 'admin_portal'>('overview');
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [selectedPremiumTitle, setSelectedPremiumTitle] = useState<string | undefined>(undefined);
  const [selectedPremiumLevel, setSelectedPremiumLevel] = useState<number | undefined>(undefined);
  const [selectedPremiumActivityId, setSelectedPremiumActivityId] = useState<string | undefined>(undefined);

  const activeActivityInfo = ACTIVITIES.find((a) => a.id === currentActivity);

  // Handle role-based destination routing:
  // 1. School/Educator user: role = 'school_admin' -> Educator Hub (Page 2)
  // 2. Application Admin: role = 'admin' | 'super_admin' -> Educator Hub (Page 2 with Admin Console)
  // 3. Individual user: role = 'parent' (default) -> Playroom Home (Page 1)
  const handleRoleBasedLoginSuccess = (account: UserAccount) => {
    setUserAccount(account);

    if (account.role === 'admin' || account.role === 'super_admin') {
      soundManager.playSuccess();
      setHubInitialSection('admin_portal');
      setCurrentActivity('educator_hub');
      return;
    }

    if (account.role === 'school_admin') {
      soundManager.playSuccess();
      setHubInitialSection('overview');
      setCurrentActivity('educator_hub');
      return;
    }

    soundManager.playSuccess();
    setCurrentActivity('home');
  };

  // Sync Supabase OAuth changes & maintain user session in state with authenticated session as source of truth
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Initial Session Restoration from Supabase Auth
    const restoreSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth Error] OAuth callback/session error:', error.message || error);
        }

        if (session?.user?.email) {
          const account = await getOrCreateUserAccount(
            session.user.email,
            session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            session.user.id
          );
          if (isMounted) {
            setUserAccount(account);
          }
        }
      } catch (err) {
        console.error('[Auth Error] Session restore exception:', err);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    restoreSession();

    // 2. Realtime Auth State Listener for OAuth returns, login, and logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        try {
          const account = await getOrCreateUserAccount(
            session.user.email,
            session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            session.user.id
          );
          if (isMounted) {
            setUserAccount(account);
            setIsAuthLoading(false);
          }

          // Transition from Welcome to Page 1 (or Page 2 if school) upon successful Google authentication
          if (event === 'SIGNED_IN') {
            handleRoleBasedLoginSuccess(account);
            setIsPremiumModalOpen(false);
          }
        } catch (profileErr) {
          console.error('[Auth Error] profile fetch/creation error on auth state change:', profileErr);
          if (isMounted) setIsAuthLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        PaymentServiceManager.getInstance().clearAllUserAndSchoolAccessState();
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('playroom_user');
            localStorage.removeItem('playroom_active_school_license');
            localStorage.removeItem('playroom_current_user');
            sessionStorage.clear();
          } catch {
            // ignore
          }
          window.dispatchEvent(new CustomEvent('playroom_license_update'));
          window.dispatchEvent(new CustomEvent('playroom_auth_change'));
        }
        if (isMounted) {
          setUserAccount(null);
          setIsAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sync analytics user ID with non-identifying account ID only
  useEffect(() => {
    if (userAccount?.isLoggedIn && userAccount?.id) {
      setAnalyticsUserId(userAccount.id);
    } else {
      setAnalyticsUserId(undefined);
    }
  }, [userAccount]);

  // Track app_open on mount
  useEffect(() => {
    trackAppOpen();
  }, []);

  // Track page_view, SEO metadata, and activity_open whenever view/activity changes
  useEffect(() => {
    updateSEOForActivity(currentActivity);

    const pagePath = `/${currentActivity}`;
    const pageTitle = activeActivityInfo?.title || (currentActivity === 'welcome' ? 'Welcome' : currentActivity === 'home' ? 'Home' : 'Playroom');
    
    trackPageView(pagePath, pageTitle);

    if (
      currentActivity !== 'welcome' &&
      currentActivity !== 'home' &&
      currentActivity !== 'completion'
    ) {
      trackActivityOpen(currentActivity);
    }
  }, [currentActivity, activeActivityInfo]);

  const handleWelcomeStart = async () => {
    soundManager.playPop();

    // 1. Check in-memory userAccount or localStorage account
    let account = userAccount;
    if (!account || !account.isLoggedIn) {
      account = getCurrentUserAccountLocal();
    }

    // 2. Check active Supabase session if account is not yet loaded in state
    if (!account || !account.isLoggedIn) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[Auth Error] OAuth callback/session error:', error.message || error);
          } else if (data?.session?.user?.email) {
            account = await getOrCreateUserAccount(
              data.session.user.email,
              data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name,
              data.session.user.id
            );
            setUserAccount(account);
          }
        } catch (err) {
          console.error('[Auth Error] Session check error in handleWelcomeStart:', err);
        }
      }
    }

    // 3. If valid authenticated session exists with specific role -> Route based on role
    if (account && account.isLoggedIn && (account.role === 'school_admin' || account.role === 'admin' || account.role === 'super_admin')) {
      handleRoleBasedLoginSuccess(account);
    } else {
      // 4. Enter Playroom Home activity menu directly (Page 1)
      setCurrentActivity('home');
    }
  };

  const handleNavigateHome = () => {
    // Refresh global stars when navigating home to ensure real-time consistency
    setGlobalStars(getGlobalStarsCount());
    setCurrentActivity('home');
  };

  const handleSelectActivity = (id: ActivityId) => {
    recordLastPlayedActivity(id);
    setCurrentActivity(id);
  };

  const handleOpenPremiumModal = (title?: string, level?: number, activityId?: string) => {
    setSelectedPremiumTitle(title);
    setSelectedPremiumLevel(level);
    setSelectedPremiumActivityId(activityId);
    setIsPremiumModalOpen(true);
  };

  const handleLoginSuccess = async (email: string) => {
    let userId: string | undefined;
    const supabase = getSupabaseClient();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      }
    }
    const account = await getOrCreateUserAccount(email, undefined, userId);
    setUserAccount(account);
    handleRoleBasedLoginSuccess(account);
  };

  const handleAdminLoginSuccess = (adminAccount: UserAccount) => {
    setUserAccount(adminAccount);
    setHubInitialSection('admin_portal');
    setCurrentActivity('educator_hub');
    setIsAdminLoginModalOpen(false);
  };

  const handleLogout = (options?: { stayOnHub?: boolean }) => {
    soundManager.playPop();
    setUserAccount(null);
    setHubInitialSection('overview');
    PaymentServiceManager.getInstance().clearAllUserAndSchoolAccessState();
    try {
      setDeveloperMode(false);
    } catch (e) {
      console.warn('Error resetting developer mode on logout:', e);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('playroom_user');
        localStorage.removeItem('playroom_active_school_license');
        localStorage.removeItem('playroom_current_user');
        localStorage.removeItem('playroom_parent_pin');
        sessionStorage.clear();
      } catch (e) {
        console.warn('Error clearing storage on logout:', e);
      }
      window.dispatchEvent(new CustomEvent('playroom_license_update'));
      window.dispatchEvent(new CustomEvent('playroom_auth_change'));
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    setIsPremiumModalOpen(false);

    // If logging out while in the educator hub, stay on educator_hub so it immediately becomes the App Lock (SchoolAccessGate)
    if (currentActivity === 'educator_hub' && options?.stayOnHub !== false) {
      // Stay on educator_hub, which immediately re-renders locked with SchoolAccessGate
    } else {
      setCurrentActivity('home');
    }
  };

  // Keep userAccount synchronized on auth or license updates
  useEffect(() => {
    const handleSyncState = () => {
      setUserAccount(getCurrentUserAccountLocal());
    };
    window.addEventListener('playroom_auth_change', handleSyncState);
    window.addEventListener('playroom_license_update', handleSyncState);
    return () => {
      window.removeEventListener('playroom_auth_change', handleSyncState);
      window.removeEventListener('playroom_license_update', handleSyncState);
    };
  }, []);

  const handleCollectStar = (starsEarned: number = 3) => {
    if (currentActivity !== 'welcome' && currentActivity !== 'home' && currentActivity !== 'completion') {
      const result = recordDailyCompletion(currentActivity, starsEarned);
      setGlobalStars(result.totalStars);
      if (!completedActivities.has(currentActivity)) {
        trackStarEarned(currentActivity);
        trackActivityComplete(currentActivity);
      }
      setCompletedActivities((prev) => {
        const next = new Set(prev);
        next.add(currentActivity);
        return next;
      });
    }
  };

  const handleResetProgress = () => {
    setCompletedActivities(new Set());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#BAE6FD] via-[#E0F2FE] to-[#FEF08A] text-slate-800 font-sans flex flex-col selection:bg-amber-200">
      {/* Top Bar / Navigation */}
      <Navbar
        currentActivity={currentActivity}
        onNavigateHome={handleNavigateHome}
        onSelectActivity={handleSelectActivity}
        starsCount={globalStars}
        activityTitle={activeActivityInfo?.title}
        activityEmoji={activeActivityInfo?.emoji}
        onOpenPremiumModal={handleOpenPremiumModal}
        userAccount={userAccount}
        onOpenEducatorHub={() => {
          setHubInitialSection('overview');
          setCurrentActivity('educator_hub');
        }}
        onOpenAdminConsole={() => {
          setHubInitialSection('admin_portal');
          setCurrentActivity('educator_hub');
        }}
        onLogout={handleLogout}
      />

      {/* Main Activity Viewport with Smooth Animated Transitions */}
      <main className="flex-1 w-full py-4 px-2 sm:px-4">
        <AnimatePresence mode="wait">
          {(() => {
            switch (currentActivity) {
              case 'welcome':
                return (
                  <motion.div
                    key="activity-welcome"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                  >
                    <WelcomeScreen
                      onStart={handleWelcomeStart}
                      userAccount={userAccount}
                      onContinueWithGoogle={async () => {
                        const result = await signInWithGoogle();
                        if (result?.error) {
                          throw result.error;
                        }
                      }}
                    />
                  </motion.div>
                );

              case 'home':
                return (
                  <motion.div
                    key="activity-home"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                  >
                    <HomeScreen
                      onSelectActivity={handleSelectActivity}
                      onOpenPremiumModal={handleOpenPremiumModal}
                      completedCount={globalStars}
                      totalStars={globalStars}
                      userAccount={userAccount}
                    />
                  </motion.div>
                );

              case 'abc':
                return (
                  <motion.div
                    key="activity-abc"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ABCFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('color')}
                      onNavigatePrev={() => setCurrentActivity('home')}
                      isActivityCompleted={completedActivities.has('abc')}
                    />
                  </motion.div>
                );

              case 'color':
                return (
                  <motion.div
                    key="activity-color"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ColorTime
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('counting')}
                      onNavigatePrev={() => setCurrentActivity('abc')}
                      isActivityCompleted={completedActivities.has('color')}
                    />
                  </motion.div>
                );

              case 'counting':
                return (
                  <motion.div
                    key="activity-counting"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <CountingFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('shape_match')}
                      onNavigatePrev={() => setCurrentActivity('color')}
                      isActivityCompleted={completedActivities.has('counting')}
                    />
                  </motion.div>
                );

              case 'shape_match':
                return (
                  <motion.div
                    key="activity-shape_match"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ShapeMatch
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('rhyme_time')}
                      onNavigatePrev={() => setCurrentActivity('counting')}
                      isActivityCompleted={completedActivities.has('shape_match')}
                    />
                  </motion.div>
                );

              case 'rhyme_time':
                return (
                  <motion.div
                    key="activity-rhyme_time"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <FindTheDifference
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('animal_food_match')}
                      onNavigatePrev={() => setCurrentActivity('shape_match')}
                      isActivityCompleted={completedActivities.has('rhyme_time')}
                    />
                  </motion.div>
                );

              case 'animal_food_match':
                return (
                  <motion.div
                    key="activity-animal_food_match"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AnimalFoodMatch
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('identify_items')}
                      onNavigatePrev={() => setCurrentActivity('rhyme_time')}
                      isActivityCompleted={completedActivities.has('animal_food_match')}
                    />
                  </motion.div>
                );

              case 'identify_items':
                return (
                  <motion.div
                    key="activity-identify_items"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <IdentifyItems
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('completion')}
                      onNavigatePrev={() => setCurrentActivity('animal_food_match')}
                      isActivityCompleted={completedActivities.has('identify_items')}
                    />
                  </motion.div>
                );

              case 'big_small_sort':
                return (
                  <motion.div
                    key="activity-big_small_sort"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <BigSmallSort
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('more_less')}
                      onNavigatePrev={() => setCurrentActivity('home')}
                      isActivityCompleted={completedActivities.has('big_small_sort')}
                    />
                  </motion.div>
                );

              case 'more_less':
                return (
                  <motion.div
                    key="activity-more_less"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <MoreOrLess
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('pattern_fun')}
                      onNavigatePrev={() => setCurrentActivity('big_small_sort')}
                      isActivityCompleted={completedActivities.has('more_less')}
                    />
                  </motion.div>
                );

              case 'pattern_fun':
                return (
                  <motion.div
                    key="activity-pattern_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <PatternFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('memory_match')}
                      onNavigatePrev={() => setCurrentActivity('more_less')}
                      isActivityCompleted={completedActivities.has('pattern_fun')}
                    />
                  </motion.div>
                );

              case 'memory_match':
                return (
                  <motion.div
                    key="activity-memory_match"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <MemoryMatch
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('fruit_veg_sort')}
                      onNavigatePrev={() => setCurrentActivity('pattern_fun')}
                      isActivityCompleted={completedActivities.has('memory_match')}
                    />
                  </motion.div>
                );

              case 'fruit_veg_sort':
                return (
                  <motion.div
                    key="activity-fruit_veg_sort"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <FruitVegSort
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('odd_one_out')}
                      onNavigatePrev={() => setCurrentActivity('memory_match')}
                      isActivityCompleted={completedActivities.has('fruit_veg_sort')}
                    />
                  </motion.div>
                );

              case 'odd_one_out':
                return (
                  <motion.div
                    key="activity-odd_one_out"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <OddOneOut
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('count_tap')}
                      onNavigatePrev={() => setCurrentActivity('fruit_veg_sort')}
                      isActivityCompleted={completedActivities.has('odd_one_out')}
                    />
                  </motion.div>
                );

              case 'count_tap':
                return (
                  <motion.div
                    key="activity-count_tap"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <CountAndTap
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('shape_builder')}
                      onNavigatePrev={() => setCurrentActivity('odd_one_out')}
                      isActivityCompleted={completedActivities.has('count_tap')}
                    />
                  </motion.div>
                );

              case 'shape_builder':
                return (
                  <motion.div
                    key="activity-shape_builder"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ShapeBuilder
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('shadow_match')}
                      onNavigatePrev={() => setCurrentActivity('count_tap')}
                      isActivityCompleted={completedActivities.has('shape_builder')}
                    />
                  </motion.div>
                );

              case 'shadow_match':
                return (
                  <motion.div
                    key="activity-shadow_match"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ShadowMatch
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('number_trace')}
                      onNavigatePrev={() => setCurrentActivity('shape_builder')}
                      isActivityCompleted={completedActivities.has('shadow_match')}
                    />
                  </motion.div>
                );

              case 'number_trace':
                return (
                  <motion.div
                    key="activity-number_trace"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <NumberTrace
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('letter_trace')}
                      onNavigatePrev={() => setCurrentActivity('shadow_match')}
                      isActivityCompleted={completedActivities.has('number_trace')}
                    />
                  </motion.div>
                );

              case 'letter_trace':
                return (
                  <motion.div
                    key="activity-letter_trace"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <LetterTrace
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('number_order')}
                      onNavigatePrev={() => setCurrentActivity('number_trace')}
                      isActivityCompleted={completedActivities.has('letter_trace')}
                    />
                  </motion.div>
                );

              case 'number_order':
                return (
                  <motion.div
                    key="activity-number_order"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <NumberOrder
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('color_mixing')}
                      onNavigatePrev={() => setCurrentActivity('letter_trace')}
                      isActivityCompleted={completedActivities.has('number_order')}
                    />
                  </motion.div>
                );

              case 'color_mixing':
                return (
                  <motion.div
                    key="activity-color_mixing"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ColorMixing
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('body_parts')}
                      onNavigatePrev={() => setCurrentActivity('number_order')}
                      isActivityCompleted={completedActivities.has('color_mixing')}
                    />
                  </motion.div>
                );

              case 'body_parts':
                return (
                  <motion.div
                    key="activity-body_parts"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <BodyParts
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('daily_routine')}
                      onNavigatePrev={() => setCurrentActivity('color_mixing')}
                      isActivityCompleted={completedActivities.has('body_parts')}
                    />
                  </motion.div>
                );

              case 'daily_routine':
                return (
                  <motion.div
                    key="activity-daily_routine"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <DailyRoutine
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('healthy_food_sort')}
                      onNavigatePrev={() => setCurrentActivity('body_parts')}
                      isActivityCompleted={completedActivities.has('daily_routine')}
                    />
                  </motion.div>
                );

              case 'healthy_food_sort':
                return (
                  <motion.div
                    key="activity-healthy_food_sort"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <HealthyFoodSort
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('healthy_plate')}
                      onNavigatePrev={() => setCurrentActivity('daily_routine')}
                      isActivityCompleted={completedActivities.has('healthy_food_sort')}
                    />
                  </motion.div>
                );

              case 'healthy_plate':
                return (
                  <motion.div
                    key="activity-healthy_plate"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <BuildHealthyPlate
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('bubble_pop')}
                      onNavigatePrev={() => setCurrentActivity('healthy_food_sort')}
                      isActivityCompleted={completedActivities.has('healthy_plate')}
                    />
                  </motion.div>
                );

              case 'bubble_pop':
                return (
                  <motion.div
                    key="activity-bubble_pop"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <BubblePop
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('balloon_count')}
                      onNavigatePrev={() => setCurrentActivity('healthy_plate')}
                      isActivityCompleted={completedActivities.has('bubble_pop')}
                    />
                  </motion.div>
                );

              case 'balloon_count':
                return (
                  <motion.div
                    key="activity-balloon_count"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <BalloonCount
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('feed_animal')}
                      onNavigatePrev={() => setCurrentActivity('bubble_pop')}
                      isActivityCompleted={completedActivities.has('balloon_count')}
                    />
                  </motion.div>
                );

              case 'feed_animal':
                return (
                  <motion.div
                    key="activity-feed_animal"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <FeedAnimal
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('catch_star')}
                      onNavigatePrev={() => setCurrentActivity('balloon_count')}
                      isActivityCompleted={completedActivities.has('feed_animal')}
                    />
                  </motion.div>
                );

              case 'catch_star':
                return (
                  <motion.div
                    key="activity-catch_star"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <CatchTheStars
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('clean_room')}
                      onNavigatePrev={() => setCurrentActivity('feed_animal')}
                      isActivityCompleted={completedActivities.has('catch_star')}
                    />
                  </motion.div>
                );

              case 'clean_room':
                return (
                  <motion.div
                    key="activity-clean_room"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <CleanRoom
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('build_garden')}
                      onNavigatePrev={() => setCurrentActivity('catch_star')}
                      isActivityCompleted={completedActivities.has('clean_room')}
                    />
                  </motion.div>
                );

              case 'spy_hidden_objects':
                return (
                  <motion.div
                    key="activity-spy_hidden_objects"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <SpyHiddenObjects
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('build_garden')}
                      onNavigatePrev={() => setCurrentActivity('clean_room')}
                      isActivityCompleted={completedActivities.has('spy_hidden_objects')}
                    />
                  </motion.div>
                );

              case 'build_garden':
                return (
                  <motion.div
                    key="activity-build_garden"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <BuildGarden
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('what_comes_together')}
                      onNavigatePrev={() => setCurrentActivity('spy_hidden_objects')}
                      isActivityCompleted={completedActivities.has('build_garden')}
                    />
                  </motion.div>
                );

              case 'what_comes_together':
                return (
                  <motion.div
                    key="activity-what_comes_together"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <WhatComesTogether
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('sweet_sour_fun')}
                      onNavigatePrev={() => setCurrentActivity('build_garden')}
                      isActivityCompleted={completedActivities.has('what_comes_together')}
                    />
                  </motion.div>
                );

              case 'sweet_sour_fun':
                return (
                  <motion.div
                    key="activity-sweet_sour_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <SweetSourFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('animal_parents_babies')}
                      onNavigatePrev={() => setCurrentActivity('what_comes_together')}
                      isActivityCompleted={completedActivities.has('sweet_sour_fun')}
                    />
                  </motion.div>
                );

              case 'animal_parents_babies':
                return (
                  <motion.div
                    key="activity-animal_parents_babies"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AnimalParentsBabies
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('shapes_collector_fun')}
                      onNavigatePrev={() => setCurrentActivity('sweet_sour_fun')}
                      isActivityCompleted={completedActivities.has('animal_parents_babies')}
                    />
                  </motion.div>
                );

              case 'shapes_collector_fun':
                return (
                  <motion.div
                    key="activity-shapes_collector_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ShapesCollectorFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('fish_hunting')}
                      onNavigatePrev={() => setCurrentActivity('animal_parents_babies')}
                      isActivityCompleted={completedActivities.has('shapes_collector_fun')}
                    />
                  </motion.div>
                );

              case 'fish_hunting':
                return (
                  <motion.div
                    key="activity-fish_hunting"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <FishHunting
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('color_fun')}
                      onNavigatePrev={() => setCurrentActivity('shapes_collector_fun')}
                      isActivityCompleted={completedActivities.has('fish_hunting')}
                    />
                  </motion.div>
                );

              case 'color_fun':
                return (
                  <motion.div
                    key="activity-color_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ColorFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('kite_take_away')}
                      onNavigatePrev={() => setCurrentActivity('fish_hunting')}
                      isActivityCompleted={completedActivities.has('color_fun')}
                    />
                  </motion.div>
                );

              case 'kite_take_away':
                return (
                  <motion.div
                    key="activity-kite_take_away"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <KiteCountTakeAway
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('traffic_light_fun')}
                      onNavigatePrev={() => setCurrentActivity('color_fun')}
                      isActivityCompleted={completedActivities.has('kite_take_away')}
                    />
                  </motion.div>
                );

              case 'traffic_light_fun':
                return (
                  <motion.div
                    key="activity-traffic_light_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <TrafficLightFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('find_object')}
                      onNavigatePrev={() => setCurrentActivity('kite_take_away')}
                      isActivityCompleted={completedActivities.has('traffic_light_fun')}
                    />
                  </motion.div>
                );

              case 'find_object':
                return (
                  <motion.div
                    key="activity-find_object"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <SpyHiddenObjects
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('add_and_count_fun')}
                      onNavigatePrev={() => setCurrentActivity('traffic_light_fun')}
                      isActivityCompleted={completedActivities.has('find_object')}
                    />
                  </motion.div>
                );

              case 'add_and_count_fun':
                return (
                  <motion.div
                    key="activity-add_and_count_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AddCountFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('sort_it_fun')}
                      onNavigatePrev={() => setCurrentActivity('find_object')}
                      isActivityCompleted={completedActivities.has('add_and_count_fun')}
                    />
                  </motion.div>
                );

              case 'sort_it_fun':
                return (
                  <motion.div
                    key="activity-sort_it_fun"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <SortItFun
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => setCurrentActivity('completion')}
                      onNavigatePrev={() => setCurrentActivity('add_and_count_fun')}
                      isActivityCompleted={completedActivities.has('sort_it_fun')}
                    />
                  </motion.div>
                );

              case 'educator_hub': {
                const paymentManager = PaymentServiceManager.getInstance();
                const activeLicense = paymentManager.getActiveSchoolLicense();
                const hasValidActiveLicense = Boolean(
                  activeLicense &&
                  activeLicense.status === 'ACTIVE' &&
                  new Date(activeLicense.expiryDate).getTime() > Date.now()
                );

                const isConfirmedSchoolAdmin = Boolean(
                  userAccount?.isLoggedIn &&
                  userAccount.role === 'school_admin' &&
                  userAccount.hasPage2SchoolAccess
                );

                const isConfirmedAdmin = Boolean(
                  userAccount?.isLoggedIn &&
                  (userAccount.role === 'admin' || userAccount.role === 'super_admin')
                );

                const schoolCheck = (userAccount?.email || userAccount?.licenseKey)
                  ? paymentManager.checkSchoolAccess(userAccount.email || userAccount.licenseKey!)
                  : { hasAccess: false, isExpired: false };

                const hasSchoolAccess =
                  TEMPORARY_DEMO_PAGE2_UNLOCK ||
                  isDev ||
                  isConfirmedAdmin ||
                  hasValidActiveLicense ||
                  isConfirmedSchoolAdmin ||
                  Boolean(schoolCheck.hasAccess);

                return (
                  <motion.div
                    key={`activity-educator_hub-${userAccount?.id || 'anon'}-${userAccount?.role || 'guest'}-${hubInitialSection}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <PreschoolEducatorHub
                      onBackToPlayroom={handleNavigateHome}
                      isLocked={!hasSchoolAccess}
                      isAuthLoading={isAuthLoading && !TEMPORARY_DEMO_PAGE2_UNLOCK}
                      userAccount={userAccount}
                      activeSchoolLicense={activeLicense}
                      initialSection={hubInitialSection}
                      onSchoolLoginSuccess={(schoolAcc) => {
                        setUserAccount(schoolAcc);
                      }}
                      onLogout={handleLogout}
                    />
                  </motion.div>
                );
              }

              case 'completion':
                return (
                  <motion.div
                    key="activity-completion"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                  >
                    <CompletionScreen
                      onPlayAgain={() => {
                        handleResetProgress();
                        setCurrentActivity('abc');
                      }}
                      onGoHome={handleNavigateHome}
                    />
                  </motion.div>
                );

              default:
                return (
                  <motion.div
                    key={`activity-${currentActivity}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    <GenericPremiumActivity
                      activityId={currentActivity}
                      onCollectStar={handleCollectStar}
                      onNavigateHome={handleNavigateHome}
                      onNavigateNext={() => {
                        const pIdx = PREMIUM_ACTIVITIES.findIndex((a) => a.id === currentActivity);
                        const nextId = (pIdx >= 0 && pIdx < PREMIUM_ACTIVITIES.length - 1 ? PREMIUM_ACTIVITIES[pIdx + 1].id : 'completion') as ActivityId;
                        setCurrentActivity(nextId);
                      }}
                      onNavigatePrev={() => {
                        const pIdx = PREMIUM_ACTIVITIES.findIndex((a) => a.id === currentActivity);
                        const prevId = (pIdx > 0 ? PREMIUM_ACTIVITIES[pIdx - 1].id : 'home') as ActivityId;
                        setCurrentActivity(prevId);
                      }}
                    />
                  </motion.div>
                );
            }
          })()}
        </AnimatePresence>
      </main>

      {/* Premium & Login Modal */}
      <PremiumAccessModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        selectedLevel={selectedPremiumLevel}
        selectedActivityTitle={selectedPremiumTitle}
        selectedActivityId={selectedPremiumActivityId}
        userAccount={userAccount}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />

      {/* Dedicated Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onAdminLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Global Branding Footer with Permanent Admin Entry Point */}
      <footer
        id="app-branding-footer"
        className="w-full bg-slate-950 text-slate-100 py-3.5 px-4 sm:px-6 border-t-2 border-amber-400/40 shrink-0 select-none relative z-30 shadow-2xl"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          {/* Left/Middle branding & authorship info */}
          <div className="flex items-center gap-2 flex-wrap justify-center text-xs sm:text-sm font-semibold text-slate-300">
            <span className="text-slate-400 font-normal">Developed by</span>
            <span className="font-extrabold text-white tracking-wide">Ramsha Shaikh</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-amber-300/90 text-xs font-bold uppercase tracking-wider hidden sm:inline">Playroom Early Learning</span>
          </div>

          {/* Right: Unmissable Bright Golden Admin Button */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdminAccount(userAccount) ? (
              <button
                id="footer-admin-console-btn"
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  setHubInitialSection('admin_portal');
                  setCurrentActivity('educator_hub');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer select-none border-2 border-white ring-2 ring-amber-400"
                title="Open Admin Console"
                aria-label="Admin Console"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Admin Console</span>
              </button>
            ) : (
              <button
                id="footer-admin-login-btn"
                type="button"
                onClick={() => {
                  soundManager.playPop();
                  setIsAdminLoginModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer select-none border-2 border-white ring-2 ring-amber-400"
                title="Administrator Portal Login"
                aria-label="Admin Login"
              >
                <Lock className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Discrete Developer Mode Switcher */}
      <DeveloperModeToggle />
    </div>
  );
}

