import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Application Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      localStorage.removeItem('mygacha_packs_v2');
      localStorage.removeItem('mygacha_creator_draft');
      localStorage.removeItem('mygacha_franchise_templates');
      localStorage.removeItem('mygacha_dont_ask_delete');
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('mygacha_language')) || 'th';
      const isTh = lang === 'th';

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 p-6 text-zinc-900 dark:text-zinc-100 font-['Prompt',sans-serif]">
          <div className="max-w-md w-full bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-3xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.9)] text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 border-2 border-black dark:border-white flex items-center justify-center font-black text-2xl text-amber-600">
              !
            </div>
            
            <h1 className="text-2xl font-black font-['Mali']">
              {isTh ? 'พบข้อผิดพลาดในการแสดงผล' : 'Something went wrong'}
            </h1>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {isTh
                ? 'ระบบกำลังคืนค่าความสมบูรณ์ของหน้าเว็บ กรุณากดปุ่มด้านล่างเพื่อโหลดใหม่อีกครั้ง'
                : 'An unexpected error occurred. Please try reloading the page.'}
            </p>

            {this.state.error && (
              <div className="text-left text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 font-mono text-rose-500 max-h-24 overflow-y-auto break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-yellow-300 hover:bg-yellow-400 text-black font-bold rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all sketch-btn"
              >
                {isTh ? 'โหลดหน้าเว็บใหม่' : 'Reload Page'}
              </button>
              <button
                onClick={this.handleResetAndReload}
                className="flex-1 py-3 px-4 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all sketch-btn text-xs"
              >
                {isTh ? 'ล้างข้อมูลชั่วคราว' : 'Reset Temporary Data'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
