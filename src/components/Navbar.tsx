import React, { useState, useRef, useEffect } from 'react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';
import { Search, Moon, Sun, Coins, Gift, LogOut, Camera, Settings, ShieldAlert } from 'lucide-react';
import { AvatarPickerModal } from './AvatarPickerModal';

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
    navigate,
    canClaimDailyReward,
    claimDailyReward,
    logout,
    startNewPackCreation,
    reports,
  } = useGacha();

  const t = getTranslation(language);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  return (
    <>
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b-2 border-zinc-900 dark:border-zinc-100 px-6 py-3.5 sm:py-4 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand / Logo + Search bar matching Wireframe 1 & 2 */}
        <div className="flex items-center gap-5 flex-1 min-w-[300px]">
          <button
            onClick={() => navigate('/')}
            className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white font-['Mali']"
          >
            MyGacha
          </button>

          {/* Search Bar matching mockup 1 & 2 */}
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.navbar.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 text-base bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] text-zinc-800 dark:text-zinc-100 font-medium"
            />
          </div>
        </div>

        {/* Action Buttons matching Wireframe 1 & 2 */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* + Create Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                navigate('/Login');
              } else {
                startNewPackCreation();
              }
            }}
            className="px-4 py-2 text-base font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-emerald-200 dark:bg-emerald-700 text-zinc-900 dark:text-white hover:bg-emerald-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.navbar.create}
          </button>

          {/* Gallery Button */}
          <button
            onClick={() => navigate('/Gallery')}
            className="px-4 py-2 text-base font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.navbar.gallery}
          </button>

          {/* Markets Button */}
          <button
            onClick={onOpenMarkets}
            className="px-4 py-2 text-base font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {t.navbar.markets}
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
                navigate('/Admin');
              }}
              className="px-4 py-2 text-base font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn bg-amber-300 dark:bg-amber-400 text-black hover:bg-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] flex items-center gap-1.5 relative"
            >
              <ShieldAlert size={18} />
              <span>{t.navbar.adminConsole}</span>
              {unreadReportsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[11px] font-black bg-red-600 text-white border-2 border-black rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] animate-pulse leading-none">
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
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
                canClaimDailyReward
                  ? 'bg-yellow-300 text-black hover:bg-yellow-400'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-70'
              }`}
            >
              <Gift size={16} />
              <span>{t.navbar.dailyReward}</span>
              {canClaimDailyReward && <span className="font-extrabold">+2K</span>}
            </button>
          )}

          {/* Coin Counter */}
          {currentUser && (
            <div className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-2 border-black dark:border-white rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]">
              <Coins size={16} className="text-amber-600" />
              <span>{(currentUser.coins ?? 5000).toLocaleString()}</span>
            </div>
          )}

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
            title="Theme Toggle"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
          >
            {language === 'th' ? 'TH' : 'ENG'}
          </button>

          {/* Auth: Not logged in (Wireframe 1) vs Logged in (Wireframe 2) */}
          {currentUser ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 px-3 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-black dark:border-white flex items-center justify-center font-bold text-xs text-black dark:text-white overflow-hidden shrink-0 shadow-sm">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.username || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-black">{(currentUser.username || 'U')[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <span className="text-sm font-bold max-w-[120px] truncate">{currentUser.username}</span>
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
                          navigate('/Admin');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl flex items-center gap-2 font-bold transition-colors"
                      >
                        <ShieldAlert size={15} />
                        <span>{t.navbar.adminConsole}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigate(`/${currentUser.username}/Setting`);
                        setIsUserMenuOpen(false);
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
            <div className="flex items-center gap-2.5">
              {/* Sign In Button (white) matching Wireframe 1 */}
              <button
                onClick={() => navigate('/Login')}
                className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                {t.navbar.signIn}
              </button>
              {/* Sign up Button (grey) matching Wireframe 1 */}
              <button
                onClick={() => navigate('/SignIn')}
                className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 sketch-btn text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                {t.navbar.signUp}
              </button>
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
