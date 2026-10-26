import React from 'react';
import { X, Store, ArrowLeftRight } from 'lucide-react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';

interface MarketsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MarketsModal: React.FC<MarketsModalProps> = ({ isOpen, onClose }) => {
  const { language } = useGacha();
  const t = getTranslation(language);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] text-center font-['Prompt']">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full border-2 border-black hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          <X size={18} />
        </button>

        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Store size={32} className="text-amber-600 dark:text-amber-400" />
        </div>

        <h3 className="text-2xl font-black font-['Mali'] text-zinc-900 dark:text-white mb-2">
          {t.markets.title}
        </h3>

        <div className="inline-block bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-500 font-bold text-xs px-3 py-1 rounded-full mb-4">
          {t.markets.status}
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
          {t.markets.desc}
        </p>

        <button
          onClick={onClose}
          className="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        >
          {t.markets.gotIt}
        </button>
      </div>
    </div>
  );
};
