import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  const { language } = useGacha();
  const t = getTranslation(language);

  if (!isOpen) return null;

  const resolvedTitle = title || t.modals.confirmDeleteCard.title;
  const resolvedConfirmLabel = confirmLabel || t.modals.confirmDeleteCard.confirmBtn;
  const resolvedCancelLabel = cancelLabel || t.common.cancel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.8)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 border border-black flex items-center justify-center text-red-600 dark:text-red-300">
              <AlertTriangle size={16} />
            </div>
            <h3 className="text-sm font-black font-['Mali']">{resolvedTitle}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-black bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 sketch-btn"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold rounded-xl border-2 border-black bg-red-500 hover:bg-red-600 text-white sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
