import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown, X, Check, Sparkles, ArrowLeft } from 'lucide-react';

export interface NeoDateTimePickerProps {
  value: string; // Format: 'YYYY-MM-DDTHH:mm' or ISO
  onChange: (value: string) => void;
  placeholder?: string;
  language?: 'th' | 'en';
  className?: string;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
}

const MONTH_NAMES_FULL_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const MONTH_NAMES_SHORT_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const MONTH_NAMES_FULL_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_HEADER_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DAYS_HEADER_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const NeoDateTimePicker: React.FC<NeoDateTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'เลือกวันและเวลา...',
  language = 'th',
  className = '',
  disabled = false,
  minYear,
  maxYear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'months' | 'years'>('calendar');

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Parse initial or default date
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const effectiveMinYear = useMemo(() => {
    if (minYear !== undefined) return Math.max(0, minYear);
    if (parsedDate && parsedDate.getFullYear() < currentYear) {
      return Math.max(0, parsedDate.getFullYear());
    }
    return currentYear;
  }, [minYear, parsedDate, currentYear]);

  const effectiveMaxYear = useMemo(() => {
    if (maxYear !== undefined) return Math.max(effectiveMinYear, maxYear);
    return currentYear + 20;
  }, [maxYear, effectiveMinYear, currentYear]);

  // Current calendar view (year & month)
  const [viewYear, setViewYear] = useState<number>(() => {
    const raw = parsedDate ? parsedDate.getFullYear() : currentYear;
    return Math.max(effectiveMinYear, Math.min(effectiveMaxYear, raw));
  });
  const [viewMonth, setViewMonth] = useState<number>(() => parsedDate ? parsedDate.getMonth() : new Date().getMonth());

  // Decade start year for year picker view (aligned to effectiveMinYear)
  const [decadeStart, setDecadeStart] = useState<number>(() => {
    const raw = parsedDate ? parsedDate.getFullYear() : currentYear;
    const clamped = Math.max(effectiveMinYear, Math.min(effectiveMaxYear, raw));
    const pageOffset = Math.max(0, Math.floor((clamped - effectiveMinYear) / 12));
    return effectiveMinYear + pageOffset * 12;
  });

  // Selected components
  const [selectedDay, setSelectedDay] = useState<number | null>(() => parsedDate ? parsedDate.getDate() : null);
  const [selectedHour, setSelectedHour] = useState<number>(() => parsedDate ? parsedDate.getHours() : 23);
  const [selectedMinute, setSelectedMinute] = useState<number>(() => parsedDate ? parsedDate.getMinutes() : 59);

  // Text inputs for direct custom time typing
  const [hourStr, setHourStr] = useState<string>(() => String(selectedHour).padStart(2, '0'));
  const [minuteStr, setMinuteStr] = useState<string>(() => String(selectedMinute).padStart(2, '0'));

  // Sync internal state when external value changes
  useEffect(() => {
    if (parsedDate) {
      const clampedYear = Math.max(effectiveMinYear, Math.min(effectiveMaxYear, parsedDate.getFullYear()));
      setViewYear(clampedYear);
      setViewMonth(parsedDate.getMonth());
      setSelectedDay(parsedDate.getDate());
      setSelectedHour(parsedDate.getHours());
      setSelectedMinute(parsedDate.getMinutes());
      setHourStr(String(parsedDate.getHours()).padStart(2, '0'));
      setMinuteStr(String(parsedDate.getMinutes()).padStart(2, '0'));
      const pageOffset = Math.max(0, Math.floor((clampedYear - effectiveMinYear) / 12));
      setDecadeStart(effectiveMinYear + pageOffset * 12);
    }
  }, [parsedDate, effectiveMinYear, effectiveMaxYear]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setViewMode('calendar');
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Compute days in current month
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  // First day of month (0 = Sunday, 1 = Monday, ...)
  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  const canPrevMonth = viewYear > effectiveMinYear || viewMonth > 0;
  const canNextMonth = viewYear < effectiveMaxYear || viewMonth < 11;

  const handlePrevMonth = () => {
    if (!canPrevMonth) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(v => Math.max(effectiveMinYear, v - 1));
    } else {
      setViewMonth(v => v - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canNextMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(v => Math.min(effectiveMaxYear, v + 1));
    } else {
      setViewMonth(v => v + 1);
    }
  };

  const emitValue = (year: number, month: number, day: number, hour: number, minute: number) => {
    const d = new Date(year, month, day, hour, minute, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const minStr = String(d.getMinutes()).padStart(2, '0');
    onChange(`${y}-${m}-${dayStr}T${h}:${minStr}`);
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    emitValue(viewYear, viewMonth, day, selectedHour, selectedMinute);
  };

  // Direct Month Pick
  const handleSelectMonth = (monthIndex: number) => {
    setViewMonth(monthIndex);
    setViewMode('calendar');
    if (selectedDay) {
      const maxDaysInNewMonth = new Date(viewYear, monthIndex + 1, 0).getDate();
      const adjustedDay = Math.min(selectedDay, maxDaysInNewMonth);
      setSelectedDay(adjustedDay);
      emitValue(viewYear, monthIndex, adjustedDay, selectedHour, selectedMinute);
    }
  };

  // Direct Year Pick
  const handleSelectYear = (yearNum: number) => {
    const clampedYear = Math.max(effectiveMinYear, Math.min(effectiveMaxYear, yearNum));
    setViewYear(clampedYear);
    setViewMode('calendar');
    if (selectedDay) {
      const maxDaysInNewYear = new Date(clampedYear, viewMonth + 1, 0).getDate();
      const adjustedDay = Math.min(selectedDay, maxDaysInNewYear);
      setSelectedDay(adjustedDay);
      emitValue(clampedYear, viewMonth, adjustedDay, selectedHour, selectedMinute);
    }
  };

  // Direct Custom Time Typing Handlers
  const handleHourChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    setHourStr(cleaned);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num >= 0 && num <= 23) {
      setSelectedHour(num);
      if (selectedDay) emitValue(viewYear, viewMonth, selectedDay, num, selectedMinute);
    }
  };

  const handleHourBlur = () => {
    let num = parseInt(hourStr, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 23) num = 23;
    setSelectedHour(num);
    setHourStr(String(num).padStart(2, '0'));
    if (selectedDay) emitValue(viewYear, viewMonth, selectedDay, num, selectedMinute);
  };

  const handleMinuteChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 2);
    setMinuteStr(cleaned);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setSelectedMinute(num);
      if (selectedDay) emitValue(viewYear, viewMonth, selectedDay, selectedHour, num);
    }
  };

  const handleMinuteBlur = () => {
    let num = parseInt(minuteStr, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 59) num = 59;
    setSelectedMinute(num);
    setMinuteStr(String(num).padStart(2, '0'));
    if (selectedDay) emitValue(viewYear, viewMonth, selectedDay, selectedHour, num);
  };

  // Adjust hour by 1
  const adjustHour = (delta: number) => {
    const newH = (selectedHour + delta + 24) % 24;
    setSelectedHour(newH);
    setHourStr(String(newH).padStart(2, '0'));
    if (selectedDay) emitValue(viewYear, viewMonth, selectedDay, newH, selectedMinute);
  };

  // Adjust minute by 1 (1-minute precision)
  const adjustMinute = (delta: number) => {
    const newM = (selectedMinute + delta + 60) % 60;
    setSelectedMinute(newM);
    setMinuteStr(String(newM).padStart(2, '0'));
    if (selectedDay) emitValue(viewYear, viewMonth, selectedDay, selectedHour, newM);
  };

  const handleApplyPreset = (offsetHours: number) => {
    const target = new Date(Date.now() + offsetHours * 3600 * 1000);
    const clampedYear = Math.max(effectiveMinYear, Math.min(effectiveMaxYear, target.getFullYear()));
    setViewYear(clampedYear);
    setViewMonth(target.getMonth());
    setSelectedDay(target.getDate());
    setSelectedHour(target.getHours());
    setSelectedMinute(target.getMinutes());
    setHourStr(String(target.getHours()).padStart(2, '0'));
    setMinuteStr(String(target.getMinutes()).padStart(2, '0'));
    emitValue(clampedYear, target.getMonth(), target.getDate(), target.getHours(), target.getMinutes());
  };

  const handleSelectToday = () => {
    const now = new Date();
    const clampedYear = Math.max(effectiveMinYear, Math.min(effectiveMaxYear, now.getFullYear()));
    setViewYear(clampedYear);
    setViewMonth(now.getMonth());
    setSelectedDay(now.getDate());
    const h = selectedHour !== null ? selectedHour : now.getHours();
    const m = selectedMinute !== null ? selectedMinute : now.getMinutes();
    setSelectedHour(h);
    setSelectedMinute(m);
    setHourStr(String(h).padStart(2, '0'));
    setMinuteStr(String(m).padStart(2, '0'));
    emitValue(clampedYear, now.getMonth(), now.getDate(), h, m);
    setViewMode('calendar');
  };

  const handleClear = () => {
    setSelectedDay(null);
    onChange('');
    setIsOpen(false);
    setViewMode('calendar');
  };

  // Formatted display text for the input box
  const formattedDisplay = useMemo(() => {
    if (!parsedDate) return '';
    const day = parsedDate.getDate();
    const month = language === 'th' ? MONTH_NAMES_FULL_TH[parsedDate.getMonth()] : MONTH_NAMES_FULL_EN[parsedDate.getMonth()];
    const year = parsedDate.getFullYear();
    const hours = String(parsedDate.getHours()).padStart(2, '0');
    const mins = String(parsedDate.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins} น.`;
  }, [parsedDate, language]);

  const monthNamesFull = language === 'th' ? MONTH_NAMES_FULL_TH : MONTH_NAMES_FULL_EN;
  const monthNamesShort = language === 'th' ? MONTH_NAMES_SHORT_TH : MONTH_NAMES_SHORT_EN;
  const dayHeaders = language === 'th' ? DAYS_HEADER_TH : DAYS_HEADER_EN;

  const today = new Date();
  const isCurrentMonthView = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  // Decade bounds
  const canPrevDecade = decadeStart > effectiveMinYear;
  const canNextDecade = decadeStart + 12 <= effectiveMaxYear;
  const decadeEnd = Math.min(effectiveMaxYear, decadeStart + 11);

  // Years array for year picker (strictly within effectiveMinYear and effectiveMaxYear)
  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < 12; i++) {
      const y = decadeStart + i;
      if (y >= effectiveMinYear && y <= effectiveMaxYear) {
        list.push(y);
      }
    }
    return list;
  }, [decadeStart, effectiveMinYear, effectiveMaxYear]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Input Box */}
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm font-bold font-['Prompt'] border-2 rounded-xl transition-all cursor-pointer ${
          disabled
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700 cursor-not-allowed opacity-60'
            : isOpen
            ? 'bg-yellow-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border-black dark:border-white ring-2 ring-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-black dark:border-white sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-50'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
          {formattedDisplay ? (
            <span className="truncate text-zinc-900 dark:text-white font-bold">
              {formattedDisplay}
            </span>
          ) : (
            <span className="text-zinc-400 font-normal">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {formattedDisplay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="ล้างค่า"
            >
              <X size={13} />
            </button>
          )}
          <Clock size={15} className="text-zinc-400" />
        </div>
      </div>

      {/* Centered Neo-Brutalist Modal Overlay (Never cut off, perfectly positioned without any page scroll!) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => {
            setIsOpen(false);
            setViewMode('calendar');
          }}
        >
          <div
            className="relative w-full max-w-sm bg-white dark:bg-zinc-850 border-3 border-black dark:border-white rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] p-4 font-['Prompt'] space-y-3.5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-400 border border-black flex items-center justify-center text-black font-black">
                  <Calendar size={15} />
                </div>
                <h3 className="text-sm font-black font-['Mali'] text-zinc-900 dark:text-white">
                  {language === 'th' ? 'เลือกวันและเวลาหมดอายุ' : 'Select Date & Time'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setViewMode('calendar');
                }}
                className="p-1 rounded-lg border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 hover:bg-red-400 hover:text-white transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* VIEW 1: DIRECT MONTH SELECTION GRID */}
            {viewMode === 'months' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-yellow-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 rounded-xl p-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className="px-2.5 py-1 rounded-lg border border-black bg-white dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <ArrowLeft size={13} />
                    <span>{language === 'th' ? 'กลับ' : 'Back'}</span>
                  </button>
                  <div className="text-xs font-black font-['Mali']">
                    {language === 'th' ? 'เลือกเดือน' : 'Select Month'} ({viewYear})
                  </div>
                  <div className="w-14" />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {monthNamesShort.map((mName, idx) => {
                    const isCurrent = viewMonth === idx;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => handleSelectMonth(idx)}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all ${
                          isCurrent
                            ? 'bg-yellow-400 text-black border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-105'
                            : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-black hover:bg-yellow-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {monthNamesFull[idx]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 2: DIRECT YEAR SELECTION GRID */}
            {viewMode === 'years' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-yellow-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 rounded-xl p-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className="px-2.5 py-1 rounded-lg border border-black bg-white dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <ArrowLeft size={13} />
                    <span>{language === 'th' ? 'กลับ' : 'Back'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!canPrevDecade}
                      onClick={() => setDecadeStart(d => Math.max(effectiveMinYear, d - 12))}
                      className={`p-1 rounded border border-black transition-colors ${
                        canPrevDecade
                          ? 'hover:bg-yellow-300 bg-white dark:bg-zinc-700 cursor-pointer shadow-xs'
                          : 'opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800'
                      }`}
                      title={canPrevDecade ? (language === 'th' ? '12 ปีก่อนหน้า' : 'Previous 12 years') : ''}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-black font-['Mali'] px-1.5 text-zinc-900 dark:text-white">
                      {decadeStart} - {decadeEnd}
                    </span>
                    <button
                      type="button"
                      disabled={!canNextDecade}
                      onClick={() => setDecadeStart(d => Math.min(effectiveMaxYear, d + 12))}
                      className={`p-1 rounded border border-black transition-colors ${
                        canNextDecade
                          ? 'hover:bg-yellow-300 bg-white dark:bg-zinc-700 cursor-pointer shadow-xs'
                          : 'opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800'
                      }`}
                      title={canNextDecade ? (language === 'th' ? '12 ปีถัดไป' : 'Next 12 years') : ''}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {yearsList.map((yNum) => {
                    const isCurrent = viewYear === yNum;
                    return (
                      <button
                        key={yNum}
                        type="button"
                        onClick={() => handleSelectYear(yNum)}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all ${
                          isCurrent
                            ? 'bg-yellow-400 text-black border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-105'
                            : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-black hover:bg-yellow-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {yNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 3: MAIN CALENDAR & CUSTOM TIME */}
            {viewMode === 'calendar' && (
              <>
                {/* Header Month & Year Direct Selector Buttons */}
                <div className="flex items-center justify-between gap-1 border-b-2 border-black dark:border-zinc-700 pb-2.5">
                  <button
                    type="button"
                    disabled={!canPrevMonth}
                    onClick={handlePrevMonth}
                    className={`p-1.5 rounded-lg border-2 border-black dark:border-white sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-colors ${
                      canPrevMonth
                        ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black cursor-pointer'
                        : 'opacity-30 cursor-not-allowed bg-zinc-200 dark:bg-zinc-850'
                    }`}
                    title={canPrevMonth ? (language === 'th' ? 'เดือนก่อนหน้า' : 'Previous month') : ''}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Direct Month & Year Tap Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('months')}
                      className="px-2.5 py-1 rounded-lg border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black font-black text-xs sm:text-sm font-['Mali'] text-zinc-900 dark:text-white sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 transition-all cursor-pointer"
                      title={language === 'th' ? 'เลือกเดือน' : 'Select Month'}
                    >
                      <span>{monthNamesFull[viewMonth]}</span>
                      <ChevronDown size={12} className="text-zinc-500" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const pageOffset = Math.max(0, Math.floor((viewYear - effectiveMinYear) / 12));
                        setDecadeStart(effectiveMinYear + pageOffset * 12);
                        setViewMode('years');
                      }}
                      className="px-2.5 py-1 rounded-lg border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black font-black text-xs sm:text-sm font-['Mali'] text-zinc-900 dark:text-white sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 transition-all cursor-pointer"
                      title={language === 'th' ? 'เลือกปี' : 'Select Year'}
                    >
                      <span>{viewYear}</span>
                      <ChevronDown size={12} className="text-zinc-500" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!canNextMonth}
                    onClick={handleNextMonth}
                    className={`p-1.5 rounded-lg border-2 border-black dark:border-white sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-colors ${
                      canNextMonth
                        ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black cursor-pointer'
                        : 'opacity-30 cursor-not-allowed bg-zinc-200 dark:bg-zinc-850'
                    }`}
                    title={canNextMonth ? (language === 'th' ? 'เดือนถัดไป' : 'Next month') : ''}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Days Grid */}
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {dayHeaders.map((d, idx) => (
                      <div
                        key={d}
                        className={`text-[10px] sm:text-xs font-black ${
                          idx === 0 || idx === 6 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="w-8 h-7" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const isSelected =
                        selectedDay === dayNum &&
                        parsedDate?.getFullYear() === viewYear &&
                        parsedDate?.getMonth() === viewMonth;
                      const isToday = isCurrentMonthView && today.getDate() === dayNum;

                      return (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => handleSelectDay(dayNum)}
                          className={`w-8 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center relative ${
                            isSelected
                              ? 'bg-yellow-400 text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-105'
                              : isToday
                              ? 'bg-yellow-100 dark:bg-yellow-950/60 border-2 border-yellow-500 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200'
                              : 'hover:bg-yellow-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border hover:border-black'
                          }`}
                        >
                          {dayNum}
                          {isToday && !isSelected && (
                            <span className="absolute bottom-0.5 w-1 h-1 bg-yellow-600 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Custom Time Typing & Stepper (1-minute precision) */}
                <div className="border-t-2 border-black dark:border-zinc-700 pt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Clock size={13} className="text-yellow-600" />
                      <span>{language === 'th' ? 'เวลา' : 'Time'} (24h)</span>
                    </span>

                    <div className="flex items-center gap-1">
                      {[
                        { label: '12:00', h: 12, m: 0 },
                        { label: '18:00', h: 18, m: 0 },
                        { label: '23:59', h: 23, m: 59 },
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setSelectedHour(preset.h);
                            setSelectedMinute(preset.m);
                            setHourStr(String(preset.h).padStart(2, '0'));
                            setMinuteStr(String(preset.m).padStart(2, '0'));
                            if (selectedDay) {
                              emitValue(viewYear, viewMonth, selectedDay, preset.h, preset.m);
                            }
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-black/40 bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 bg-zinc-50 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 rounded-xl p-1.5">
                    {/* Hour: - button, Direct Editable Input, + button */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustHour(-1)}
                        className="w-6 h-6 rounded border border-black bg-white dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black text-xs font-black"
                        title="ลด 1 ชั่วโมง"
                      >
                        -
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={hourStr}
                        onChange={(e) => handleHourChange(e.target.value)}
                        onBlur={handleHourBlur}
                        className="w-11 text-center font-mono font-black text-xs bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg py-0.5 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                        title="พิมพ์ชั่วโมงได้โดยตรง (00-23)"
                      />

                      <button
                        type="button"
                        onClick={() => adjustHour(1)}
                        className="w-6 h-6 rounded border border-black bg-white dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black text-xs font-black"
                        title="เพิ่ม 1 ชั่วโมง"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-mono font-black text-xs">:</span>

                    {/* Minute: - button (1 min), Direct Editable Input, + button (1 min) */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustMinute(-1)}
                        className="w-6 h-6 rounded border border-black bg-white dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black text-xs font-black"
                        title="ลด 1 นาที"
                      >
                        -
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={minuteStr}
                        onChange={(e) => handleMinuteChange(e.target.value)}
                        onBlur={handleMinuteBlur}
                        className="w-11 text-center font-mono font-black text-xs bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-lg py-0.5 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                        title="พิมพ์นาทีได้โดยตรง (00-59)"
                      />

                      <button
                        type="button"
                        onClick={() => adjustMinute(1)}
                        className="w-6 h-6 rounded border border-black bg-white dark:bg-zinc-700 hover:bg-yellow-300 hover:text-black text-xs font-black"
                        title="เพิ่ม 1 นาที"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Presets (Today, +24h, +7d, +30d) */}
                <div className="border-t-2 border-black dark:border-zinc-700 pt-2.5">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                    <Sparkles size={11} className="text-yellow-500" />
                    <span>{language === 'th' ? 'ปุ่มลัดระยะเวลา' : 'Quick Presets'}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      className="py-1 px-1.5 text-xs font-black bg-yellow-200 dark:bg-yellow-900/50 hover:bg-yellow-300 text-black dark:text-yellow-200 rounded-lg border border-black dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      {language === 'th' ? 'วันนี้' : 'Today'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(24)}
                      className="py-1 px-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black rounded-lg border border-black dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      +24h
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(7 * 24)}
                      className="py-1 px-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black rounded-lg border border-black dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      +7 {language === 'th' ? 'วัน' : 'days'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(30 * 24)}
                      className="py-1 px-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black rounded-lg border border-black dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      +30 {language === 'th' ? 'วัน' : 'days'}
                    </button>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between border-t-2 border-black dark:border-zinc-700 pt-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      className="px-2.5 py-1 text-xs font-black bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-300 hover:text-black rounded-lg border border-black dark:border-zinc-700 transition-colors cursor-pointer shadow-xs"
                    >
                      {language === 'th' ? 'เลือกวันนี้' : 'Select Today'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                    >
                      {language === 'th' ? 'ล้างค่า' : 'Clear'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedDay) {
                        const now = new Date();
                        handleSelectDay(now.getDate());
                      }
                      setIsOpen(false);
                      setViewMode('calendar');
                    }}
                    className="px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold rounded-xl border-2 border-black sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{language === 'th' ? 'ตกลง' : 'Done'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
