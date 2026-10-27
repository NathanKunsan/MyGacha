import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';
import { Search, Moon, Sun, Coins, Gift, LogOut, Camera, Settings, ShieldAlert, Ticket, X, Loader2, Menu } from 'lucide-react';
import { AvatarPickerModal } from './AvatarPickerModal';
import { getSharedRealtimeChannel, localBroadcastChannel } from '../lib/supabase';

interface NavbarProps {
  onOpenMarkets: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMarkets }) => {
  const {
    currentUser,
    theme,
    toggleTheme,
    language,
    toggleLanguage,
    searchQuery,
    setSearchQuery,
    currentPath,
    navigate,
    canClaimDailyReward,
    claimDailyReward,
    logout,
    startNewPackCreation,
    reports,
    redeemCode,
    addToast,
  } = useGacha();

  const t = getTranslation(language);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Market unread badge calculation (LINE-style notification)
  const MARKET_LAST_VIEWED_KEY = 'mygacha_market_last_viewed';
  const isMarketPage = currentPath.toLowerCase() === '/markets' || currentPath.toLowerCase() === '/marketplace';

  const [lastViewedMarketTime, setLastViewedMarketTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(MARKET_LAST_VIEWED_KEY);
      if (saved) return Number(saved);
      const now = Date.now();
      localStorage.setItem(MARKET_LAST_VIEWED_KEY, now.toString());
      return now;
    } catch {
      return Date.now();
    }
  });

  const [unreadMarketCount, setUnreadMarketCount] = useState<number>(0);

  const calculateUnreadMarketCount = useCallback((viewTime: number) => {
    if (isMarketPage) return 0;
    try {
      const stored = localStorage.getItem('mygacha_market_listings');
      if (!stored) return 0;
      const listings = JSON.parse(stored);
      if (!Array.isArray(listings)) return 0;
      const unread = listings.filter((l: any) => {
        if (!l?.createdAt) return false;
        const createdTime = new Date(l.createdAt).getTime();
        return createdTime > viewTime;
      });
      return unread.length;
    } catch {
      return 0;
    }
  }, [isMarketPage]);

  // Recalculate or clear whenever route changes
  useEffect(() => {
    if (isMarketPage) {
      const now = Date.now();
      try {
        localStorage.setItem(MARKET_LAST_VIEWED_KEY, now.toString());
        localBroadcastChannel?.postMessage({ event: 'market_viewed', timestamp: now });
      } catch {}
      setLastViewedMarketTime(now);
      setUnreadMarketCount(0);
    } else {
      setUnreadMarketCount(calculateUnreadMarketCount(lastViewedMarketTime));
    }
  }, [isMarketPage, lastViewedMarketTime, calculateUnreadMarketCount]);

  // Listen to realtime & local broadcast events for market updates
  useEffect(() => {
    const handleLocalBroadcast = (e: MessageEvent) => {
      const { event, payload, timestamp } = e.data || {};
      if (event === 'market_viewed' && timestamp) {
        setLastViewedMarketTime(timestamp);
        setUnreadMarketCount(0);
      } else if (event === 'market_listing_created') {
        if (isMarketPage) {
          const now = Date.now();
          try {
            localStorage.setItem(MARKET_LAST_VIEWED_KEY, now.toString());
          } catch {}
          setLastViewedMarketTime(now);
          setUnreadMarketCount(0);
        } else {
          setUnreadMarketCount(prev => prev + 1);
        }
      } else if (event === 'market_card_bought' || event === 'market_listing_cancelled') {
        if (!isMarketPage) {
          setUnreadMarketCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    if (localBroadcastChannel) {
      localBroadcastChannel.addEventListener('message', handleLocalBroadcast);
    }

    const sharedChannel = getSharedRealtimeChannel();
    if (sharedChannel) {
      sharedChannel.on('broadcast', { event: 'market_listing_created' }, (payload: any) => {
        if (isMarketPage) {
          const now = Date.now();
          try {
            localStorage.setItem(MARKET_LAST_VIEWED_KEY, now.toString());
          } catch {}
          setLastViewedMarketTime(now);
          setUnreadMarketCount(0);
        } else {
          setUnreadMarketCount(prev => prev + 1);
        }
      });
    }

    return () => {
      if (localBroadcastChannel) {
        localBroadcastChannel.removeEventListener('message', handleLocalBroadcast);
      }
    };
  }, [isMarketPage]);

  const handleNav = (path: string) => {
    setIsMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
    setIsUserMenuOpen(false);
    if (path.toLowerCase() === '/markets' || path.toLowerCase() === '/marketplace') {
      const now = Date.now();
      try {
        localStorage.setItem(MARKET_LAST_VIEWED_KEY, now.toString());
        localBroadcastChannel?.postMessage({ event: 'market_viewed', timestamp: now });
      } catch {}
      setLastViewedMarketTime(now);
      setUnreadMarketCount(0);
    }
    navigate(path);
  };

  const handleRedeemCode = async () => {
    if (isSubmittingCode) return;
    const clean = codeValue.trim();
    if (!clean) {
      addToast(language === 'th' ? 'กรุณากรอกรหัสโค้ด' : 'Please enter code', 'warning');
      return;
    }
    if (!currentUser) {
      addToast(language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนแลกรับโค้ด' : 'Please login to redeem codes', 'warning');
      handleNav('/Login');
      return;
    }
    setIsSubmittingCode(true);
    try {
      const res = await redeemCode(clean);
      if (res.success) {
        setCodeValue('');
      }
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Per-admin unread reports badge calculation (Item 7)
  const adminId = currentUser?.role === 'Admin' ? (currentUser.id || currentUser.username.toLowerCase()) : '';
  const adminStorageKey = adminId ? `mygacha_admin_last_read_${adminId}` : '';
  
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    if (!adminStorageKey) return 0;
    try {
      const saved = localStorage.getItem(adminStorageKey);
      return saved ? new Date(saved).getTime() : 0;
    } catch {
      return 0;
    }
  });

  // Keep lastReadTimestamp synced when route or window storage changes
  useEffect(() => {
    if (!adminStorageKey) return;
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath === '/admin' || currentPath.startsWith('/admin')) {
      const now = Date.now();
      try {
        localStorage.setItem(adminStorageKey, new Date(now).toISOString());
      } catch {}
      setLastReadTimestamp(now);
    } else {
      try {
        const saved = localStorage.getItem(adminStorageKey);
        setLastReadTimestamp(saved ? new Date(saved).getTime() : 0);
      } catch {}
    }
  }, [adminStorageKey, window.location.pathname]);

  const unreadReportsCount = currentUser?.role === 'Admin'
    ? (reports || []).filter(r => r.status === 'pending' && new Date(r.createdAt).getTime() > lastReadTimestamp).length
    : 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
        setIsMobileSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen, isMobileMenuOpen]);

  return (
    <>
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b-2 border-zinc-900 dark:border-zinc-100 px-3 sm:px-6 py-2 shadow-sm transition-colors" ref={mobileMenuRef}>
      <div className="w-full max-w-[1700px] mx-auto">
        {/* ========================================================= */}
        {/* 1. DESKTOP VIEW (Visible on lg: 1024px and up)            */}
        {/* ========================================================= */}
        <div className="hidden lg:flex flex-col gap-2 w-full py-0.5">
          {/* Row 1: Logo + Long Search Bar (ตามภาพ Mockup) */}
          <div className="flex items-center gap-3 xl:gap-4 w-full">
            <button
              onClick={() => handleNav('/')}
              className="text-2xl xl:text-3xl font-black tracking-tight text-zinc-900 dark:text-white font-['Mali'] shrink-0"
            >
              MyGacha
            </button>

            {/* Long Search Bar */}
            <div className="relative flex-1 max-w-md xl:max-w-xl 2xl:max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (window.location.pathname !== '/') {
                      handleNav('/');
                    }
                  }
                }}
                placeholder={t.navbar.searchPlaceholder}
                className="w-full pl-9 pr-8 py-1.5 text-xs xl:text-sm bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-zinc-800 dark:text-zinc-100 font-medium"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  title={language === 'th' ? 'ล้างข้อความค้นหา' : 'Clear search'}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: All Action & Navigation Buttons (ตามภาพ Mockup) */}
          <div className="flex items-center gap-1.5 xl:gap-2 flex-wrap">
            {/* + Create Button */}
            <button
              onClick={() => {
                if (!currentUser) {
                  handleNav('/Login');
                } else {
                  startNewPackCreation();
                }
              }}
              className="px-3.5 py-1.5 text-xs xl:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-emerald-200 dark:bg-emerald-700 text-zinc-900 dark:text-white hover:bg-emerald-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
            >
              {t.navbar.create}
            </button>

            {/* Gallery Button */}
            <button
              onClick={() => handleNav('/Gallery')}
              className="px-3 py-1.5 text-xs xl:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
            >
              {t.navbar.gallery}
            </button>

            {/* Markets Button */}
            <button
              onClick={() => handleNav('/Markets')}
              className="relative px-3 py-1.5 text-xs xl:text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
            >
              <span>{t.navbar.markets}</span>
              {unreadMarketCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-red-600 text-white text-[11px] font-black rounded-full flex items-center justify-center px-1 border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] leading-none animate-bounce">
                  {unreadMarketCount > 99 ? '99+' : unreadMarketCount}
                </span>
              )}
            </button>

            {/* Admin Console Button (เฉพาะ Admin เท่านั้น) */}
            {currentUser?.role === 'Admin' && (
              <button
                onClick={() => {
                  if (adminStorageKey) {
                    const now = Date.now();
                    try {
                      localStorage.setItem(adminStorageKey, new Date(now).toISOString());
                    } catch {}
                    setLastReadTimestamp(now);
                  }
                  handleNav('/Admin');
                }}
                className="px-3 py-1.5 text-xs xl:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-amber-300 dark:bg-amber-400 text-black hover:bg-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] flex items-center gap-1.5 relative shrink-0"
              >
                <ShieldAlert size={16} />
                <span>{t.navbar.adminConsole}</span>
                {unreadReportsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black bg-red-600 text-white border border-black rounded-full shadow animate-pulse leading-none">
                    {unreadReportsCount > 99 ? '99+' : unreadReportsCount}
                  </span>
                )}
              </button>
            )}

            {/* Daily Reward Button for members */}
            {currentUser && (
              <button
                onClick={claimDailyReward}
                title={canClaimDailyReward ? (language === 'th' ? 'รับเหรียญรายวัน +2,000 Coin' : 'Claim daily reward +2,000 Coins') : t.navbar.claimed}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0 ${
                  canClaimDailyReward
                    ? 'bg-yellow-300 text-black hover:bg-yellow-400'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-70'
                }`}
              >
                <Gift size={15} />
                <span>{t.navbar.dailyReward}</span>
                {canClaimDailyReward && <span className="font-extrabold">+2K</span>}
              </button>
            )}

            {/* Coin Counter */}
            {currentUser && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0">
                <Coins size={15} className="text-amber-600" />
                <span>{(currentUser.coins ?? 5000).toLocaleString()}</span>
              </div>
            )}

            {/* Redeem Code Input ("ช่องใส่ โค้ด" / "Code") */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRedeemCode();
              }}
              className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-0.5 xl:p-1 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
            >
              <div className="relative flex items-center">
                <Ticket size={15} className="absolute left-2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={codeValue}
                  onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRedeemCode();
                    }
                  }}
                  disabled={isSubmittingCode}
                  placeholder={language === 'th' ? 'กรอกโค้ด...' : 'Code...'}
                  className="w-28 xl:w-36 2xl:w-44 pl-7 pr-1 py-1 text-xs font-bold bg-transparent text-zinc-900 dark:text-white uppercase focus:outline-none placeholder:normal-case placeholder:font-medium placeholder:text-zinc-400"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingCode}
                className="px-2.5 py-1 text-xs font-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black border border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-['Mali'] shrink-0 flex items-center gap-1"
              >
                {isSubmittingCode ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>{language === 'th' ? 'โค้ด' : 'Code'}</span>
              </button>
            </form>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
              title="Theme Toggle"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
            >
              {language === 'th' ? 'TH' : 'ENG'}
            </button>

            {/* Auth: Not logged in vs Logged in */}
            {currentUser ? (
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 px-2.5 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
                >
                  <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-black dark:border-white flex items-center justify-center font-bold text-xs text-black dark:text-white overflow-hidden shrink-0 shadow-sm">
                    {currentUser.avatarUrl ? (
                      <img
                        key={currentUser.avatarUrl}
                        src={currentUser.avatarUrl}
                        alt={currentUser.username || 'User'}
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />
                    ) : (
                      <span className="text-xs font-black">{(currentUser.username || 'U')[0]?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <span className="text-xs xl:text-sm font-bold max-w-[120px] truncate">{currentUser.username}</span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl shadow-xl py-2 z-50 p-2.5">
                    <div className="flex items-center gap-3 p-2 border-b border-zinc-200 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAvatarModalOpen(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="relative cursor-pointer group shrink-0"
                        title={language === 'th' ? 'คลิกเพื่อเปลี่ยนรูปภาพโปรไฟล์' : 'Click to change profile picture'}
                      >
                        <div className="w-12 h-12 rounded-full border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden shadow-sm group-hover:opacity-80 transition-opacity">
                          {currentUser.avatarUrl ? (
                            <img
                              key={currentUser.avatarUrl}
                              src={currentUser.avatarUrl}
                              alt={currentUser.username}
                              className="w-full h-full object-cover select-none pointer-events-none"
                              draggable={false}
                            />
                          ) : (
                            <span className="text-base font-black">{currentUser.username[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-black text-white dark:bg-white dark:text-black rounded-full p-1 border border-black shadow">
                          <Camera size={11} />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{currentUser.username}</p>
                        <p className="text-xs text-zinc-500 truncate">{currentUser.email}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAvatarModalOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="text-xs text-blue-500 hover:underline cursor-pointer block mt-0.5 font-bold text-left"
                        >
                          {language === 'th' ? 'เปลี่ยนรูปโปรไฟล์' : 'Change Avatar'}
                        </button>
                      </div>
                    </div>
                    <div className="pt-1.5 space-y-1">
                      {currentUser.role === 'Admin' && (
                        <button
                          onClick={() => {
                            handleNav('/Admin');
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl flex items-center gap-2 font-bold transition-colors"
                        >
                          <ShieldAlert size={15} />
                          <span>{t.navbar.adminConsole}</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleNav(`/${currentUser.username}/Setting`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl flex items-center gap-2 font-bold transition-colors"
                      >
                        <Settings size={15} className="text-zinc-500" />
                        <span>{t.navbar.settings}</span>
                      </button>
                      <button
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl flex items-center gap-2 font-bold transition-colors"
                      >
                        <LogOut size={15} />
                        <span>{t.navbar.signOut}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNav('/Login')}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
                >
                  {t.navbar.signIn}
                </button>
                <button
                  onClick={() => handleNav('/SignIn')}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 sketch-btn text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] shrink-0"
                >
                  {t.navbar.signUp}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. MOBILE / TABLET VIEW (Visible below lg: < 1024px)       */}
        {/* ========================================================= */}
        <div className="lg:hidden flex flex-col gap-2">
          {/* Top Compact Row: Logo | Coins | Quick Search | Hamburger */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <button
              onClick={() => handleNav('/')}
              className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white font-['Mali'] shrink-0"
            >
              MyGacha
            </button>

            {/* Top Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Coin Counter */}
              {currentUser && (
                <div className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-2 border-black dark:border-white rounded-xl shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  <Coins size={14} className="text-amber-600" />
                  <span>{(currentUser.coins ?? 5000).toLocaleString()}</span>
                </div>
              )}

              {/* Quick Search Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(!isMobileSearchOpen);
                  if (isMobileMenuOpen) setIsMobileMenuOpen(false);
                }}
                className={`p-2 rounded-xl border-2 border-black dark:border-white transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
                  isMobileSearchOpen || searchQuery.trim()
                    ? 'bg-yellow-300 text-black'
                    : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                }`}
                title={language === 'th' ? 'ค้นหา' : 'Search'}
              >
                <Search size={18} />
              </button>

              {/* Hamburger Menu Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                  if (isMobileSearchOpen) setIsMobileSearchOpen(false);
                }}
                className={`p-2 rounded-xl border-2 border-black dark:border-white transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] relative ${
                  isMobileMenuOpen
                    ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white'
                }`}
                title={language === 'th' ? 'เมนู' : 'Menu'}
              >
                {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                {/* Red badge for Admin unread reports or Market unread */}
                {(unreadReportsCount > 0 || unreadMarketCount > 0) && !isMobileMenuOpen && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 border border-black dark:border-white rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Search Bar (When Search icon is clicked on mobile/tablet) */}
          {isMobileSearchOpen && (
            <div className="pt-1 pb-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  autoFocus
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (window.location.pathname !== '/') {
                        handleNav('/');
                      }
                    }
                  }}
                  placeholder={t.navbar.searchPlaceholder}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-zinc-800 dark:text-zinc-100 font-medium"
                />
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    title={language === 'th' ? 'ล้างข้อความค้นหา' : 'Clear search'}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Expanded Drawer Menu */}
          {isMobileMenuOpen && (
            <div className="mt-2 pt-3 border-t-2 border-dashed border-zinc-300 dark:border-zinc-700 space-y-3 max-h-[calc(100vh-80px)] overflow-y-auto pb-4 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* 1. Search Bar inside Drawer */}
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (window.location.pathname !== '/') {
                        handleNav('/');
                      }
                    }
                  }}
                  placeholder={t.navbar.searchPlaceholder}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-zinc-800 dark:text-zinc-100 font-medium"
                />
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    title={language === 'th' ? 'ล้างข้อความค้นหา' : 'Clear search'}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* 2. Redeem Code Form (Full width) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRedeemCode();
                }}
                className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 p-1 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                <div className="relative flex-1 flex items-center min-w-0">
                  <Ticket size={16} className="absolute left-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRedeemCode();
                      }
                    }}
                    disabled={isSubmittingCode}
                    placeholder={language === 'th' ? 'กรอกโค้ด...' : 'Code...'}
                    className="w-full pl-8 pr-2 py-1.5 text-sm font-bold bg-transparent text-zinc-900 dark:text-white uppercase focus:outline-none placeholder:normal-case placeholder:font-medium placeholder:text-zinc-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingCode}
                  className="px-3.5 py-1.5 text-xs font-black bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black border border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-['Mali'] shrink-0 flex items-center gap-1"
                >
                  {isSubmittingCode ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>{language === 'th' ? 'โค้ด' : 'Code'}</span>
                </button>
              </form>

              {/* 3. Navigation Buttons Grid */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    if (!currentUser) {
                      handleNav('/Login');
                    } else {
                      setIsMobileMenuOpen(false);
                      startNewPackCreation();
                    }
                  }}
                  className="px-2 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-emerald-200 dark:bg-emerald-700 text-zinc-900 dark:text-white hover:bg-emerald-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-center"
                >
                  {t.navbar.create}
                </button>
                <button
                  onClick={() => handleNav('/Gallery')}
                  className="px-2 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-center"
                >
                  {t.navbar.gallery}
                </button>
                <button
                  onClick={() => handleNav('/Markets')}
                  className="relative px-2 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-center"
                >
                  <span>{t.navbar.markets}</span>
                  {unreadMarketCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-red-600 text-white text-[11px] font-black rounded-full flex items-center justify-center px-1 border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] leading-none animate-bounce">
                      {unreadMarketCount > 99 ? '99+' : unreadMarketCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Admin Console Button (Mobile - full width if admin) */}
              {currentUser?.role === 'Admin' && (
                <button
                  onClick={() => {
                    if (adminStorageKey) {
                      const now = Date.now();
                      try {
                        localStorage.setItem(adminStorageKey, new Date(now).toISOString());
                      } catch {}
                      setLastReadTimestamp(now);
                    }
                    handleNav('/Admin');
                  }}
                  className="w-full px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-amber-300 dark:bg-amber-400 text-black hover:bg-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={18} />
                    <span>{t.navbar.adminConsole}</span>
                  </div>
                  {unreadReportsCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-black bg-red-600 text-white border border-black rounded-full shadow animate-pulse">
                      {unreadReportsCount > 99 ? '99+' : unreadReportsCount}
                    </span>
                  )}
                </button>
              )}

              {/* 4. Controls: Daily Reward, Theme, Language */}
              <div className="grid grid-cols-3 gap-2">
                {currentUser && (
                  <button
                    onClick={claimDailyReward}
                    disabled={!canClaimDailyReward}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
                      canClaimDailyReward
                        ? 'bg-yellow-300 text-black hover:bg-yellow-400'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-70'
                    }`}
                  >
                    <Gift size={14} />
                    <span>{canClaimDailyReward ? '+2K' : t.navbar.claimed}</span>
                  </button>
                )}

                <button
                  onClick={toggleTheme}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
                    !currentUser ? 'col-span-1' : ''
                  }`}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === 'dark' ? 'สว่าง' : 'มืด'}</span>
                </button>

                <button
                  onClick={toggleLanguage}
                  className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
                    !currentUser ? 'col-span-2' : ''
                  }`}
                >
                  <span>{language === 'th' ? 'TH (ไทย)' : 'ENG'}</span>
                </button>
              </div>

              {/* 5. User Profile Card / Auth Section on Mobile */}
              {currentUser ? (
                <div className="bg-zinc-50 dark:bg-zinc-800/90 border-2 border-black dark:border-white rounded-2xl p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-black dark:border-white flex items-center justify-center font-bold text-xs text-black dark:text-white overflow-hidden shrink-0 shadow-sm">
                      {currentUser.avatarUrl ? (
                        <img
                          key={currentUser.avatarUrl}
                          src={currentUser.avatarUrl}
                          alt={currentUser.username}
                          className="w-full h-full object-cover select-none pointer-events-none"
                        />
                      ) : (
                        <span className="text-sm font-black">{currentUser.username[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{currentUser.username}</p>
                        {currentUser.role === 'Admin' && (
                          <span className="px-1.5 py-0.2 text-[10px] font-black bg-amber-400 text-black border border-black rounded">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{currentUser.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAvatarModalOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="px-2 py-1.5 text-xs font-bold rounded-lg border border-black dark:border-white bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-center hover:bg-zinc-100"
                    >
                      {language === 'th' ? 'รูปโปรไฟล์' : 'Avatar'}
                    </button>
                    <button
                      onClick={() => handleNav(`/${currentUser.username}/Setting`)}
                      className="px-2 py-1.5 text-xs font-bold rounded-lg border border-black dark:border-white bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-center hover:bg-zinc-100"
                    >
                      {t.navbar.settings}
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="px-2 py-1.5 text-xs font-bold rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-center hover:bg-red-100"
                    >
                      {t.navbar.signOut}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleNav('/Login')}
                    className="w-full px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-center"
                  >
                    {t.navbar.signIn}
                  </button>
                  <button
                    onClick={() => handleNav('/SignIn')}
                    className="w-full px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 sketch-btn text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] text-center"
                  >
                    {t.navbar.signUp}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Avatar Picker Modal (Device Upload or Card Gallery + Circular Crop) */}
    <AvatarPickerModal
      isOpen={isAvatarModalOpen}
      onClose={() => setIsAvatarModalOpen(false)}
    />
    </>
  );
};
