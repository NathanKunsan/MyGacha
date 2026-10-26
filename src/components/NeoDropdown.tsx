import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface NeoDropdownOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  color?: string;
  badge?: string;
}

export interface NeoDropdownProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: NeoDropdownOption<T>[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  maxHeight?: string;
}

export function NeoDropdown<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  disabled = false,
  size = 'md',
  fullWidth = true,
  maxHeight = 'max-h-60',
}: NeoDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-xs',
    md: 'py-2 px-3 text-xs sm:text-sm',
    lg: 'py-2.5 px-4 text-sm sm:text-base',
  }[size];

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 font-bold font-['Prompt'] text-left transition-all ${sizeClasses} ${
          disabled
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-2 border-zinc-300 dark:border-zinc-700 cursor-not-allowed opacity-60 rounded-xl'
            : isOpen
            ? 'bg-yellow-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border-2 border-black dark:border-white rounded-xl ring-2 ring-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.85)]'
            : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.85)] hover:bg-yellow-50 dark:hover:bg-zinc-750'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.color && (
            <span
              className="w-3.5 h-3.5 rounded-full border border-black shrink-0"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-zinc-600 dark:text-zinc-300">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded font-black shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform duration-200 text-zinc-600 dark:text-zinc-400 ${
            isOpen ? 'rotate-180 text-yellow-600 dark:text-yellow-400' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 mt-1.5 ${maxHeight} overflow-y-auto bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.85)] animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
          style={{ minWidth: '100%' }}
        >
          {options.length === 0 ? (
            <div className="py-2.5 px-3 text-xs text-zinc-400 text-center font-medium">
              ไม่มีตัวเลือก
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs sm:text-sm font-bold font-['Prompt'] text-left rounded-lg transition-colors my-0.5 ${
                    isSelected
                      ? 'bg-yellow-400 text-black border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] font-black'
                      : 'text-zinc-800 dark:text-zinc-200 hover:bg-yellow-200 dark:hover:bg-zinc-700 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.color && (
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    {opt.icon && (
                      <span className="shrink-0">{opt.icon}</span>
                    )}
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                        ({opt.sublabel})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                          isSelected
                            ? 'bg-black text-yellow-300'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check size={14} className="text-black shrink-0" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
