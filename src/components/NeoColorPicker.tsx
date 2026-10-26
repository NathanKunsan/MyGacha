import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  X,
  Palette,
  Sparkles,
  ArrowRight,
  ArrowDown,
  ArrowDownRight,
  CircleDot,
  ArrowLeftRight,
  Circle,
} from 'lucide-react';

interface NeoColorPickerProps {
  color: string;
  onChange: (newColor: string) => void;
  title?: string;
  language?: 'th' | 'en';
}

// 30 Curated Gacha Card Rarity Presets for Solid Color
const PRESET_COLORS = [
  // Row 1: Common / Metallics
  '#94A3B8', '#CBD5E1', '#64748B', '#F1F5F9', '#334155', '#1E293B',
  // Row 2: Radiant Gold / Amber / Bronze
  '#FACC15', '#EAB308', '#CA8A04', '#F59E0B', '#D97706', '#B45309',
  // Row 3: Sapphire Blue & Sky Blue
  '#38BDF8', '#0EA5E9', '#0284C7', '#60A5FA', '#3B82F6', '#1D4ED8',
  // Row 4: Royal Purple & Mythic Violet
  '#C084FC', '#A855F7', '#9333EA', '#7E22CE', '#818CF8', '#6366F1',
  // Row 5: Crimson Red & Ruby
  '#F87171', '#EF4444', '#DC2626', '#B91C1C', '#FB7185', '#F43F5E',
  // Row 6: Emerald Green & Magenta
  '#4ADE80', '#22C55E', '#16A34A', '#2DD4BF', '#06B6D4', '#EC4899',
];

// 5 Popular Gradient Modes (ตามพิมพ์นิยม)
export type GradientMode = 'horizontal' | 'vertical' | 'diagonal' | 'radial' | 'holographic';

interface GradientModeConfig {
  id: GradientMode;
  nameTh: string;
  nameEn: string;
  descTh: string;
  descEn: string;
  stopsCount: 2 | 3;
}

const GRADIENT_MODES: GradientModeConfig[] = [
  {
    id: 'horizontal',
    nameTh: 'แนวนอน',
    nameEn: 'Horizontal',
    descTh: 'ซ้ายไปขวา (90°)',
    descEn: 'Left to Right (90°)',
    stopsCount: 2,
  },
  {
    id: 'vertical',
    nameTh: 'แนวตั้ง',
    nameEn: 'Vertical',
    descTh: 'บนลงล่าง (180°)',
    descEn: 'Top to Bottom (180°)',
    stopsCount: 2,
  },
  {
    id: 'diagonal',
    nameTh: 'แนวทแยง',
    nameEn: 'Diagonal',
    descTh: 'เฉียง 45° (135°)',
    descEn: 'Diagonal 45° (135°)',
    stopsCount: 2,
  },
  {
    id: 'radial',
    nameTh: 'รัศมีวงกลม',
    nameEn: 'Radial',
    descTh: 'กระจายตรงกลาง',
    descEn: 'Center Glow',
    stopsCount: 2,
  },
  {
    id: 'holographic',
    nameTh: 'โฮโลแกรม 3 เฉด',
    nameEn: '3-Stop Prism',
    descTh: 'ประกายรุ้ง 3 สี',
    descEn: '3-Color Prism Effect',
    stopsCount: 3,
  },
];

// Curated Gradient Presets for Instant Selection
const GRADIENT_PRESETS = [
  {
    nameTh: 'ทองเปล่งประกาย',
    nameEn: 'Radiant Gold',
    mode: 'diagonal' as GradientMode,
    stops: ['#FDE047', '#CA8A04'],
    css: 'linear-gradient(135deg, #FDE047, #CA8A04)',
  },
  {
    nameTh: 'รุ้งโฮโลแกรม',
    nameEn: 'Prism Rainbow',
    mode: 'holographic' as GradientMode,
    stops: ['#F43F5E', '#8B5CF6', '#06B6D4'],
    css: 'linear-gradient(135deg, #F43F5E, #8B5CF6, #06B6D4)',
  },
  {
    nameTh: 'ม่วงเวทมนตร์',
    nameEn: 'Mythic Violet',
    mode: 'diagonal' as GradientMode,
    stops: ['#C084FC', '#4F46E5'],
    css: 'linear-gradient(135deg, #C084FC, #4F46E5)',
  },
  {
    nameTh: 'เพลิงสุริยัน',
    nameEn: 'Sunfire Crimson',
    mode: 'diagonal' as GradientMode,
    stops: ['#F97316', '#DC2626'],
    css: 'linear-gradient(135deg, #F97316, #DC2626)',
  },
  {
    nameTh: 'ไซเบอร์นีออน',
    nameEn: 'Cyber Neon',
    mode: 'horizontal' as GradientMode,
    stops: ['#38BDF8', '#22C55E'],
    css: 'linear-gradient(90deg, #38BDF8, #22C55E)',
  },
  {
    nameTh: 'มุกเงินพรีเมียม',
    nameEn: 'Platinum Silver',
    mode: 'vertical' as GradientMode,
    stops: ['#F8FAFC', '#64748B'],
    css: 'linear-gradient(180deg, #F8FAFC, #64748B)',
  },
  {
    nameTh: 'รัศมีสุริยะ',
    nameEn: 'Solar Flare',
    mode: 'radial' as GradientMode,
    stops: ['#FEF08A', '#EA580C'],
    css: 'radial-gradient(circle, #FEF08A, #EA580C)',
  },
  {
    nameTh: 'มรกตสวรรค์',
    nameEn: 'Heavenly Emerald',
    mode: 'diagonal' as GradientMode,
    stops: ['#34D399', '#059669'],
    css: 'linear-gradient(135deg, #34D399, #059669)',
  },
];

// Helper: HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  const normL = l / 100;
  const a = (s * Math.min(normL, 1 - normL)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const col = normL - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * col).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Helper: Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return { h: 270, s: 80, l: 60 };
  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Helper: Build CSS gradient string
function buildGradientCss(mode: GradientMode, stops: string[]): string {
  const s1 = stops[0] || '#F59E0B';
  const s2 = stops[1] || '#DC2626';
  const s3 = stops[2] || '#38BDF8';

  switch (mode) {
    case 'horizontal':
      return `linear-gradient(90deg, ${s1}, ${s2})`;
    case 'vertical':
      return `linear-gradient(180deg, ${s1}, ${s2})`;
    case 'diagonal':
      return `linear-gradient(135deg, ${s1}, ${s2})`;
    case 'radial':
      return `radial-gradient(circle, ${s1}, ${s2})`;
    case 'holographic':
      return `linear-gradient(135deg, ${s1}, ${s2}, ${s3})`;
    default:
      return `linear-gradient(135deg, ${s1}, ${s2})`;
  }
}

// Helper: Check if string is gradient
function isGradientString(val: string): boolean {
  if (!val) return false;
  return val.includes('gradient');
}

// Helper: Parse gradient string
function parseGradient(css: string): { mode: GradientMode; stops: string[] } {
  if (!isGradientString(css)) {
    return { mode: 'diagonal', stops: ['#FACC15', '#EA580C', '#38BDF8'] };
  }
  const hexMatches = css.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g);
  const raw = hexMatches && hexMatches.length >= 2
    ? hexMatches.map(h => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toUpperCase())
    : ['#FACC15', '#EA580C'];

  let mode: GradientMode = 'diagonal';
  if (css.includes('radial-gradient')) {
    mode = 'radial';
  } else if (css.includes('90deg') || css.includes('to right')) {
    mode = raw.length >= 3 && css.split(',').length > 3 ? 'holographic' : 'horizontal';
  } else if (css.includes('180deg') || css.includes('to bottom')) {
    mode = 'vertical';
  } else if (raw.length >= 3 && css.split(',').length > 3) {
    mode = 'holographic';
  } else {
    mode = 'diagonal';
  }

  const s0 = raw[0] || '#FACC15';
  const s1 = raw[1] || '#EA580C';
  // Distinct default 3rd stop for holographic, never duplicate s1!
  const s2 = raw[2] || (s1 !== '#38BDF8' ? '#38BDF8' : '#8B5CF6');
  return { mode, stops: [s0, s1, s2] };
}

export const NeoColorPicker: React.FC<NeoColorPickerProps> = ({
  color,
  onChange,
  title,
  language = 'th',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const initialColorRef = useRef<string>(color);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Determine initial mode
  const initialIsGradient = isGradientString(color);
  const [tab, setTab] = useState<'solid' | 'gradient'>(initialIsGradient ? 'gradient' : 'solid');

  // Solid State
  const initialSolid = !initialIsGradient && color && color.startsWith('#')
    ? color.toUpperCase()
    : '#94A3B8';
  const [solidHsl, setSolidHsl] = useState(() => hexToHsl(initialSolid));
  const [solidHexInput, setSolidHexInput] = useState(initialSolid);

  // Gradient State
  const parsedGrad = parseGradient(color);
  const [gradientMode, setGradientMode] = useState<GradientMode>(parsedGrad.mode);
  const [gradientStops, setGradientStops] = useState<string[]>(parsedGrad.stops);
  const [activeStopIdx, setActiveStopIdx] = useState<number>(0);

  // Active stop HSL and hex input
  const currentStopColor = gradientStops[activeStopIdx] || '#FACC15';
  const [stopHsl, setStopHsl] = useState(() => hexToHsl(currentStopColor));
  const [stopHexInput, setStopHexInput] = useState(currentStopColor);

  // Synchronize when external color prop changes
  useEffect(() => {
    if (!color) return;
    const isGrad = isGradientString(color);
    if (isGrad) {
      setTab('gradient');
      const p = parseGradient(color);
      setGradientMode(p.mode);
      setGradientStops(p.stops);
      const curr = p.stops[activeStopIdx] || p.stops[0];
      setStopHexInput(curr);
      setStopHsl(hexToHsl(curr));
    } else {
      setTab('solid');
      const norm = color.startsWith('#') ? color.toUpperCase() : `#${color.toUpperCase()}`;
      setSolidHexInput(norm);
      setSolidHsl(hexToHsl(norm));
    }
  }, [color]);

  // Update stop hex/hsl when active stop index changes
  useEffect(() => {
    const col = gradientStops[activeStopIdx] || '#FACC15';
    setStopHexInput(col);
    setStopHsl(hexToHsl(col));
  }, [activeStopIdx, gradientStops]);

  // Open/Toggle Color Picker with initial color snapshot
  const handleToggleOpen = () => {
    if (!isOpen) {
      initialColorRef.current = color;
    }
    setIsOpen(!isOpen);
  };

  // Revert color back to snapshot and close
  const handleCancel = () => {
    onChange(initialColorRef.current);
    setIsOpen(false);
  };

  // Commit current color and close
  const handleConfirm = () => {
    const finalColor = tab === 'solid' ? solidHexInput : buildGradientCss(gradientMode, gradientStops);
    onChange(finalColor);
    initialColorRef.current = finalColor;
    setIsOpen(false);
  };

  // ESC key: Reverts back to initial color before closing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onChange(initialColorRef.current);
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onChange]);

  // -------------------------------------------------------------
  // TAB SWITCHING
  // -------------------------------------------------------------
  const handleTabChange = (newTab: 'solid' | 'gradient') => {
    setTab(newTab);
    if (newTab === 'solid') {
      const solid = gradientStops[0] || solidHexInput;
      setSolidHexInput(solid);
      setSolidHsl(hexToHsl(solid));
      onChange(solid);
    } else {
      const newGradCss = buildGradientCss(gradientMode, gradientStops);
      onChange(newGradCss);
    }
  };

  // -------------------------------------------------------------
  // SOLID COLOR HANDLERS
  // -------------------------------------------------------------
  const handleSelectSolidPreset = (presetColor: string) => {
    setSolidHexInput(presetColor);
    setSolidHsl(hexToHsl(presetColor));
    onChange(presetColor);
  };

  const handleSolidHueChange = (newHue: number) => {
    const nextHsl = { ...solidHsl, h: newHue };
    setSolidHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    setSolidHexInput(newHex);
    onChange(newHex);
  };

  const handleSolidLightnessChange = (newLightness: number) => {
    const nextHsl = { ...solidHsl, l: newLightness };
    setSolidHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    setSolidHexInput(newHex);
    onChange(newHex);
  };

  const handleSolidHexInputChange = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    setSolidHexInput(clean);
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      setSolidHsl(hexToHsl(clean));
      onChange(clean.toUpperCase());
    }
  };

  // -------------------------------------------------------------
  // GRADIENT HANDLERS
  // -------------------------------------------------------------
  const handleSelectGradientMode = (newMode: GradientMode) => {
    setGradientMode(newMode);
    const newCss = buildGradientCss(newMode, gradientStops);
    onChange(newCss);
  };

  const handleUpdateStopColor = (stopHex: string) => {
    const clean = stopHex.toUpperCase();
    const updated = [...gradientStops];
    updated[activeStopIdx] = clean;
    setGradientStops(updated);
    setStopHexInput(clean);
    setStopHsl(hexToHsl(clean));
    const newCss = buildGradientCss(gradientMode, updated);
    onChange(newCss);
  };

  const handleStopHueChange = (newHue: number) => {
    const nextHsl = { ...stopHsl, h: newHue };
    setStopHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    handleUpdateStopColor(newHex);
  };

  const handleStopLightnessChange = (newLightness: number) => {
    const nextHsl = { ...stopHsl, l: newLightness };
    setStopHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    handleUpdateStopColor(newHex);
  };

  const handleReverseStops = () => {
    let newStops: string[];
    if (gradientMode === 'holographic') {
      newStops = [
        gradientStops[2] || '#38BDF8',
        gradientStops[1] || '#DC2626',
        gradientStops[0] || '#F59E0B',
      ];
    } else {
      newStops = [
        gradientStops[1] || '#DC2626',
        gradientStops[0] || '#F59E0B',
        gradientStops[2] || '#38BDF8',
      ];
    }
    setGradientStops(newStops);
    const curr = newStops[activeStopIdx] || newStops[0];
    setStopHexInput(curr);
    setStopHsl(hexToHsl(curr));
    const newCss = buildGradientCss(gradientMode, newStops);
    onChange(newCss);
  };

  const handleSelectGradientPreset = (preset: typeof GRADIENT_PRESETS[0]) => {
    setGradientMode(preset.mode);
    setGradientStops(preset.stops);
    setActiveStopIdx(0);
    setStopHexInput(preset.stops[0]);
    setStopHsl(hexToHsl(preset.stops[0]));
    onChange(preset.css);
  };

  // Current live preview color
  const currentDisplayColor = tab === 'solid' ? solidHexInput : buildGradientCss(gradientMode, gradientStops);
  // Trigger button background (live when open, committed when closed)
  const triggerBackground = isOpen ? currentDisplayColor : (color || currentDisplayColor);

  return (
    <div className="relative inline-block neo-color-picker" data-no-drag="true">
      {/* Trigger Button: Neo-brutalist Swatch */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleOpen}
        data-no-drag="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-7 h-7 rounded-lg border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.9)] cursor-pointer overflow-hidden shrink-0 group hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative"
        style={{ background: triggerBackground }}
        title={title || (language === 'th' ? 'เลือกสีระดับการ์ด' : 'Choose rarity color')}
      >
        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white p-0.5 rounded">
          <Palette size={12} />
        </span>
      </button>

      {/* Centered Modal rendered via Portal into document.body */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none"
          onClick={handleCancel}
        >
          <div
            ref={popoverRef}
            data-no-drag="true"
            draggable={false}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] p-3.5 space-y-2.5 font-['Prompt'] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Fixed Section: Header & Mode Switcher */}
            <div className="space-y-1.5 shrink-0">
              {/* Header: Title & Close/Cancel Button */}
              <div className="flex items-center justify-between pb-1 border-b-2 border-black dark:border-white">
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-md border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0"
                    style={{ background: currentDisplayColor }}
                  />
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                    {language === 'th' ? 'เลือกสีระดับการ์ด' : 'Rarity Color Picker'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1 rounded-lg border border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  title={language === 'th' ? 'ยกเลิก' : 'Cancel'}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Mode Switcher Tabs: Solid vs Gradient */}
              <div className="flex border-2 border-black dark:border-white rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 p-0.5">
                <button
                  type="button"
                  onClick={() => handleTabChange('solid')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'solid'
                      ? 'bg-yellow-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Circle size={10} className={tab === 'solid' ? 'fill-current' : ''} />
                  <span>{language === 'th' ? 'สีเต็ม' : 'Solid'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('gradient')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'gradient'
                      ? 'bg-yellow-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Sparkles size={11} />
                  <span>{language === 'th' ? 'ไล่เฉดสี' : 'Gradient'}</span>
                </button>
              </div>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: SOLID COLOR                                             */}
            {/* ============================================================== */}
            {tab === 'solid' && (
              <div className="space-y-2.5">
                {/* Presets Grid (36 Square Swatches) */}
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 flex justify-between items-center">
                    <span>{language === 'th' ? 'สียอดนิยมประจำระดับ' : 'Preset Colors'}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-400 font-bold">{language === 'th' ? 'รหัสสี:' : 'Hex:'}</span>
                      <input
                        type="text"
                        value={solidHexInput}
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => handleSolidHexInputChange(e.target.value)}
                        placeholder="#FACC15"
                        maxLength={7}
                        className="w-20 px-1 py-0.5 text-[10px] font-mono font-bold uppercase bg-zinc-50 dark:bg-zinc-700 border border-black dark:border-white rounded text-center shadow-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border-2 border-black dark:border-white">
                    {PRESET_COLORS.map((preset) => {
                      const isSelected = solidHexInput.toUpperCase() === preset.toUpperCase();
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSelectSolidPreset(preset)}
                          className={`w-full aspect-square rounded-lg border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105 active:scale-95 flex items-center justify-center relative ${
                            isSelected ? 'ring-2 ring-yellow-400 scale-105 z-10' : ''
                          }`}
                          style={{ backgroundColor: preset }}
                          title={preset}
                        >
                          {isSelected && (
                            <Check
                              size={14}
                              strokeWidth={3}
                              className={preset === '#F1F5F9' || preset === '#CBD5E1' || preset === '#FACC15' ? 'text-black' : 'text-white'}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sliders: Hue & Lightness */}
                <div className="space-y-1.5 pt-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                  <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                    {language === 'th' ? 'ปรับแต่งเฉดสี' : 'Custom Tone'}
                  </div>

                  {/* Rainbow Hue Slider */}
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={solidHsl.h}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => handleSolidHueChange(Number(e.target.value))}
                    className="neo-color-slider w-full h-2.5 rounded-lg appearance-none cursor-pointer border border-black dark:border-white shadow-xs"
                    style={{
                      background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                    }}
                  />

                  {/* Brightness Slider */}
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={solidHsl.l}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => handleSolidLightnessChange(Number(e.target.value))}
                    className="neo-color-slider w-full h-2.5 rounded-lg appearance-none cursor-pointer border border-black dark:border-white shadow-xs"
                    style={{
                      background: `linear-gradient(to right, #000000 0%, ${hslToHex(solidHsl.h, solidHsl.s, 50)} 50%, #ffffff 100%)`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: GRADIENT COLOR                                          */}
            {/* ============================================================== */}
            {tab === 'gradient' && (
              <div className="space-y-2.5">
                {/* Section 1: 5 Gradient Modes Selector */}
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 flex justify-between items-center">
                    <span>{language === 'th' ? 'รูปแบบการไล่เฉด' : 'Gradient Style'}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 bg-zinc-50 dark:bg-zinc-900/60 p-1.5 rounded-xl border-2 border-black dark:border-white">
                    {GRADIENT_MODES.map((m) => {
                      const isSelected = gradientMode === m.id;
                      const sampleCss = buildGradientCss(m.id, gradientStops);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectGradientMode(m.id)}
                          className={`flex flex-col items-center justify-center p-1.5 rounded-lg border-2 text-center transition-all ${
                            isSelected
                              ? 'bg-yellow-200 dark:bg-yellow-950/60 border-black dark:border-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold text-black dark:text-yellow-300'
                              : 'border-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                          title={`${language === 'th' ? m.nameTh : m.nameEn}: ${language === 'th' ? m.descTh : m.descEn}`}
                        >
                          <div
                            className="w-full h-5 rounded-md border border-black/70 mb-1 flex items-center justify-center shadow-xs"
                            style={{ background: sampleCss }}
                          >
                            {m.id === 'horizontal' && <ArrowRight size={11} className="text-white drop-shadow" />}
                            {m.id === 'vertical' && <ArrowDown size={11} className="text-white drop-shadow" />}
                            {m.id === 'diagonal' && <ArrowDownRight size={11} className="text-white drop-shadow" />}
                            {m.id === 'radial' && <CircleDot size={11} className="text-white drop-shadow" />}
                            {m.id === 'holographic' && <Sparkles size={11} className="text-white drop-shadow" />}
                          </div>
                          <span className="text-[10px] font-bold leading-tight truncate w-full">
                            {language === 'th' ? m.nameTh : m.nameEn}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Color Stops Selector & Color Adjuster */}
                <div className="pt-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                      {language === 'th' ? 'จุดสีในเฉด' : 'Color Stops'}
                    </span>
                    <button
                      type="button"
                      onClick={handleReverseStops}
                      className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-lg border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-200 transition-colors"
                      title={language === 'th' ? 'สลับทิศทางสี' : 'Reverse colors'}
                    >
                      <ArrowLeftRight size={10} />
                      <span>{language === 'th' ? 'สลับทิศ' : 'Reverse'}</span>
                    </button>
                  </div>

                  {/* Stops Swatches */}
                  <div className="flex items-center gap-2">
                    {/* Stop 1 */}
                    <button
                      type="button"
                      onClick={() => setActiveStopIdx(0)}
                      className={`flex-1 p-1.5 rounded-xl border-2 flex items-center gap-2 transition-all ${
                        activeStopIdx === 0
                          ? 'border-black dark:border-white ring-2 ring-yellow-400 bg-zinc-100 dark:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-lg border-2 border-black shrink-0 shadow-xs"
                        style={{ backgroundColor: gradientStops[0] || '#F59E0B' }}
                      />
                      <div className="text-left leading-tight overflow-hidden">
                        <div className="text-[9px] font-bold text-zinc-400 uppercase">
                          {language === 'th' ? 'จุดเริ่ม' : 'Stop 1'}
                        </div>
                        <div className="text-xs font-mono font-bold truncate">
                          {gradientStops[0] || '#F59E0B'}
                        </div>
                      </div>
                    </button>

                    {/* Stop 2 */}
                    <button
                      type="button"
                      onClick={() => setActiveStopIdx(1)}
                      className={`flex-1 p-1.5 rounded-xl border-2 flex items-center gap-2 transition-all ${
                        activeStopIdx === 1
                          ? 'border-black dark:border-white ring-2 ring-yellow-400 bg-zinc-100 dark:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-lg border-2 border-black shrink-0 shadow-xs"
                        style={{ backgroundColor: gradientStops[1] || '#DC2626' }}
                      />
                      <div className="text-left leading-tight overflow-hidden">
                        <div className="text-[9px] font-bold text-zinc-400 uppercase">
                          {gradientMode === 'holographic' ? (language === 'th' ? 'จุดกลาง' : 'Stop 2') : (language === 'th' ? 'จุดปลาย' : 'Stop 2')}
                        </div>
                        <div className="text-xs font-mono font-bold truncate">
                          {gradientStops[1] || '#DC2626'}
                        </div>
                      </div>
                    </button>

                    {/* Stop 3 (Only in holographic mode) */}
                    {gradientMode === 'holographic' && (
                      <button
                        type="button"
                        onClick={() => setActiveStopIdx(2)}
                        className={`flex-1 p-1.5 rounded-xl border-2 flex items-center gap-2 transition-all ${
                          activeStopIdx === 2
                            ? 'border-black dark:border-white ring-2 ring-yellow-400 bg-zinc-100 dark:bg-zinc-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-lg border-2 border-black shrink-0 shadow-xs"
                          style={{ backgroundColor: gradientStops[2] || '#38BDF8' }}
                        />
                        <div className="text-left leading-tight overflow-hidden">
                          <div className="text-[9px] font-bold text-zinc-400 uppercase">
                            {language === 'th' ? 'จุดปลาย' : 'Stop 3'}
                          </div>
                          <div className="text-xs font-mono font-bold truncate">
                            {gradientStops[2] || '#38BDF8'}
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Active Stop Sliders & Quick Swatches */}
                  <div className="space-y-1 bg-zinc-50 dark:bg-zinc-900/60 p-1.5 rounded-xl border-2 border-black dark:border-white">
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={stopHsl.h}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => handleStopHueChange(Number(e.target.value))}
                      className="neo-color-slider w-full h-2.5 rounded-lg appearance-none cursor-pointer border border-black dark:border-white shadow-xs"
                      style={{
                        background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                      }}
                    />

                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={stopHsl.l}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => handleStopLightnessChange(Number(e.target.value))}
                      className="neo-color-slider w-full h-2.5 rounded-lg appearance-none cursor-pointer border border-black dark:border-white shadow-xs"
                      style={{
                        background: `linear-gradient(to right, #000000 0%, ${hslToHex(stopHsl.h, stopHsl.s, 50)} 50%, #ffffff 100%)`,
                      }}
                    />

                    {/* Active Stop HEX Input + 6 Key Rarity Color Tiles */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300 shrink-0">{language === 'th' ? 'รหัสสี:' : 'Hex:'}</span>
                      <input
                        type="text"
                        value={stopHexInput}
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          let clean = e.target.value.trim();
                          if (!clean.startsWith('#')) clean = `#${clean}`;
                          setStopHexInput(clean);
                          if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
                            handleUpdateStopColor(clean);
                          }
                        }}
                        placeholder="#EA580C"
                        maxLength={7}
                        className="w-20 px-1 py-0.5 text-xs font-mono font-bold uppercase bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg text-center shadow-xs"
                      />
                      <div className="flex-1 grid grid-cols-6 gap-1">
                        {['#94A3B8', '#FACC15', '#38BDF8', '#C084FC', '#EF4444', '#22C55E'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleUpdateStopColor(preset)}
                            className="w-full h-5 rounded-md border-2 border-black hover:scale-110 transition-transform shadow-xs"
                            style={{ backgroundColor: preset }}
                            title={preset}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Curated Popular Gradient Presets */}
                <div className="pt-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                  <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                    {language === 'th' ? 'ชุดสีไล่เฉดยอดนิยม' : 'Popular Presets'}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {GRADIENT_PRESETS.map((p) => {
                      const isSelected = currentDisplayColor === p.css;
                      return (
                        <button
                          key={p.nameEn}
                          type="button"
                          onClick={() => handleSelectGradientPreset(p)}
                          className={`p-1 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-black dark:border-white ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 shadow-xs'
                              : 'border-zinc-300 dark:border-zinc-700 hover:border-black'
                          }`}
                          title={language === 'th' ? p.nameTh : p.nameEn}
                        >
                          <div
                            className="w-full h-3.5 rounded-md border border-black/50 mb-0.5 shadow-xs"
                            style={{ background: p.css }}
                          />
                          <div className="text-[8px] font-bold text-zinc-700 dark:text-zinc-300 truncate leading-tight">
                            {language === 'th' ? p.nameTh : p.nameEn}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Fixed Footer: Preview & Confirm/Cancel Buttons (Common to both tabs) */}
            <div className="pt-2 border-t-2 border-black dark:border-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-400 shrink-0">
                  {language === 'th' ? 'ตัวอย่าง:' : 'Preview:'}
                </span>
                <div
                  className="px-2.5 py-0.5 text-xs font-black rounded-lg border-2 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0"
                  style={{ background: currentDisplayColor }}
                >
                  {language === 'th' ? 'ระดับการ์ด' : 'RARITY'}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-1.5 text-xs font-bold bg-white hover:bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-1.5 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0"
                >
                  {language === 'th' ? 'ตกลง' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
