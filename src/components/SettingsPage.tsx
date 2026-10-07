import React, { useState, useEffect } from 'react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';
import { ArrowLeft, Moon, Sun, Camera, Check } from 'lucide-react';
import { getUsernameChangeStatus } from '../utils/thaiTime';
import { AvatarPickerModal } from './AvatarPickerModal';

export const SettingsPage: React.FC = () => {
  const {
    currentUser,
    navigate,
    theme,
    toggleTheme,
    language,
    toggleLanguage,
    updateUsername,
    addToast,
  } = useGacha();

  const t = getTranslation(language);

  const [usernameInput, setUsernameInput] = useState('');
  const [canEditUsername, setCanEditUsername] = useState(true);
  const [remainingDays, setRemainingDays] = useState(0);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/Login');
      return;
    }

    setUsernameInput(currentUser.username);

    // Check 15-day restriction (advances each day after 12:00 PM Thailand noon)
    const updateStatus = () => {
      const status = getUsernameChangeStatus(currentUser.lastUsernameChangeDate, 15);
      setCanEditUsername(status.canChange);
      setRemainingDays(status.remainingDays);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  if (!currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (canEditUsername && usernameInput.trim() && usernameInput.trim() !== currentUser.username) {
      const success = await updateUsername(usernameInput.trim());
      if (success) {
        navigate(`/${usernameInput.trim()}/Setting`);
      }
    } else {
      addToast(t.settings.savedSuccess, 'success');
    }
  };

  const isAdmin = currentUser.role === 'Admin';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-['Prompt']">
      {/* Top Header */}
      <div className="w-full bg-white dark:bg-zinc-900 border-b-2 border-black dark:border-white px-4 py-2.5 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="p-1 rounded-lg border-2 border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-800 sketch-btn"
          title={language === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-1 rounded-lg border-2 border-black dark:border-white bg-white dark:bg-zinc-800 sketch-btn"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={toggleLanguage}
            className="px-2 py-0.5 text-xs font-bold rounded-lg border-2 border-black dark:border-white bg-white dark:bg-zinc-800 sketch-btn"
          >
            {language.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Main Settings Card Matching Image 1 (Wireframe 10) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)]">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-2">
              {/* Round Avatar Container */}
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="w-20 h-20 rounded-full border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-700 overflow-hidden flex items-center justify-center shadow-sm relative group hover:opacity-90 transition-opacity"
                title={t.settings.changeAvatar}
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <span className="text-2xl font-black">{currentUser.username[0]?.toUpperCase() || 'U'}</span>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <Camera size={20} />
                </div>
              </button>

              {/* Pill Role Badge: User (light blue) vs Admin (yellow) */}
              <span
                className={`px-4 py-0.5 text-xs font-bold border-2 border-black rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                  isAdmin
                    ? 'bg-yellow-300 text-black'
                    : 'bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100'
                }`}
              >
                {isAdmin ? 'Admin' : 'User'}
              </span>

              {/* Change Avatar Button */}
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="px-3.5 py-1 text-xs font-bold bg-white dark:bg-zinc-700 hover:bg-zinc-100 border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-center text-zinc-900 dark:text-white"
              >
                {t.settings.changeAvatar}
              </button>
            </div>

            {/* Username Input Field */}
            <div className="space-y-1">
              <label className="block text-sm font-bold font-['Mali'] text-zinc-900 dark:text-white">
                {t.settings.username}
              </label>
              <input
                type="text"
                value={usernameInput}
                disabled={!canEditUsername}
                onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className={`w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none ${
                  !canEditUsername ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' : ''
                }`}
              />
              {!canEditUsername ? (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1">
                  {t.settings.usernameCooldown.replace('{days}', String(remainingDays))}
                </p>
              ) : (
                <p className="text-[11px] text-zinc-400 mt-1">
                  {t.settings.usernameRule}
                </p>
              )}
            </div>

            {/* Gmail Input Field (Read-Only) */}
            <div className="space-y-1">
              <label className="block text-sm font-bold font-['Mali'] text-zinc-900 dark:text-white">
                {t.settings.email}
              </label>
              <input
                type="email"
                value={currentUser.email}
                disabled
                className="w-full px-3.5 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-2 border-black dark:border-white rounded-xl cursor-not-allowed focus:outline-none"
              />
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {language === 'th' ? 'ไม่สามารถแก้ไขอีเมลได้' : 'Email cannot be changed'}
              </p>
            </div>

            {/* Bottom Actions: Save Button (light green sketch button in bottom right) */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-1.5 text-sm font-bold bg-[#a7f3d0] hover:bg-[#86efac] text-black border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] sketch-btn"
              >
                {t.common.save}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Avatar Picker Modal (Device Upload or Card Gallery + Circular Crop) */}
      <AvatarPickerModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
      />
    </div>
  );
};
