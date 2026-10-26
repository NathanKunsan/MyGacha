import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';
import { Eye, EyeOff, Moon, Sun, X, ArrowLeft, Camera } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const { register, navigate, theme, toggleTheme, language, toggleLanguage, addToast } = useGacha();
  const t = getTranslation(language);

  const [username, setUsername] = useState('');
  const [gmail, setGmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSavePasswordModal, setShowSavePasswordModal] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      addToast(language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill required fields', 'warning');
      return;
    }

    const success = await register(username.trim(), gmail.trim(), password.trim(), avatarUrl || undefined);
    if (!success) {
      return;
    }
    setShowSavePasswordModal(true);
  };

  const handleFinish = () => {
    setShowSavePasswordModal(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-['Prompt']">
      {/* Clean Top Bar without fake URL bar */}
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

      {/* Center Box matching Wireframe 3 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)]">
          <h2 className="text-2xl font-black text-center mb-6 font-['Mali']">
            {t.auth.signInTitle}
          </h2>

          <form onSubmit={handleConfirm} className="space-y-4">
            {/* Optional Avatar Picker */}
            <div className="flex flex-col items-center pb-2">
              <label className="relative cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-full border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] group-hover:bg-zinc-200 dark:group-hover:bg-zinc-600 transition-colors">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={22} className="text-zinc-500 dark:text-zinc-400 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black text-white dark:bg-white dark:text-black rounded-full p-1 border border-black dark:border-white">
                  <Camera size={10} />
                </div>
              </label>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">
                {t.auth.avatarOptional}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                {t.auth.username}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                required
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                {t.auth.email}
              </label>
              <input
                type="email"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                {t.auth.password}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 pr-10 text-sm bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-xl focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-600 dark:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-3 text-center">
              <button
                type="submit"
                className="px-8 py-2 bg-white dark:bg-zinc-700 hover:bg-zinc-100 font-bold border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] sketch-btn"
              >
                {t.auth.confirm}
              </button>
            </div>

            <div className="text-center space-y-1.5 pt-4 text-xs font-medium">
              <p className="text-zinc-700 dark:text-zinc-300">
                {t.auth.haveAccount}{' '}
                <button
                  type="button"
                  onClick={() => navigate('/Login')}
                  className="text-blue-500 hover:underline font-bold"
                >
                  {t.auth.loginLink}
                </button>
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">
                {t.auth.forgotPassword}
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* "Want to save password" Modal centered on screen */}
      {showSavePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-6 max-w-xs w-full text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.9)]">
            <button
              onClick={handleFinish}
              className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-black dark:hover:text-white"
            >
              <X size={16} />
            </button>
            <p className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">
              {t.auth.savePasswordTitle}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleFinish}
                className="px-4 py-1.5 text-xs font-bold border-2 border-black dark:border-white rounded-lg bg-white dark:bg-zinc-700 hover:bg-zinc-100 sketch-btn"
              >
                {t.auth.no}
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-1.5 text-xs font-bold border-2 border-black dark:border-white rounded-lg bg-emerald-200 dark:bg-emerald-600 hover:bg-emerald-300 sketch-btn"
              >
                {t.auth.yes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
