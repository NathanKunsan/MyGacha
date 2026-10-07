import React from 'react';
import { useGacha } from '../context/GachaContext';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useGacha();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border-2 border-black dark:border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] animate-slide-in text-xs font-bold transition-all ${
              isSuccess
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100'
                : isWarning
                ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100'
                : isError
                ? 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-100'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {isSuccess && <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />}
              {isWarning && <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400" />}
              {isError && <XCircle size={16} className="text-red-600 dark:text-red-400" />}
              {!isSuccess && !isWarning && !isError && <Info size={16} />}
              <span>{toast.message}</span>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 hover:opacity-70"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
