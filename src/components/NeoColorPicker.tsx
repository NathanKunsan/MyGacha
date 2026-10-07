import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Palette } from 'lucide-react';

interface NeoColorPickerProps {
  color: string;
  onChange: (newColor: string) => void;
  title?: string;
  language?: 'th' | 'en';
}

// 30 Curated Gacha Card Rarity Presets
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

export const NeoColorPicker: React.FC<NeoColorPickerProps> = ({
  color,
  onChange,
  title,
  language = 'th',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Normalize initial color
  const safeColor = color && color.startsWith('#') && (color.length === 7 || color.length === 4)
    ? color.toUpperCase()
    : '#94A3B8';

  const [hsl, setHsl] = useState(() => hexToHsl(safeColor));
  const [hexInput, setHexInput] = useState(safeColor);

  // Synchronize when external color changes
  useEffect(() => {
    if (color && color.toUpperCase() !== hexInput.toUpperCase()) {
      const normalized = color.startsWith('#') ? color.toUpperCase() : `#${color.toUpperCase()}`;
      setHexInput(normalized);
      setHsl(hexToHsl(normalized));
    }
  }, [color]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle Preset Pick
  const handleSelectPreset = (presetColor: string) => {
    setHexInput(presetColor);
    setHsl(hexToHsl(presetColor));
    onChange(presetColor);
  };

  // Handle Hue slider change
  const handleHueChange = (newHue: number) => {
    const nextHsl = { ...hsl, h: newHue };
    setHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    setHexInput(newHex);
    onChange(newHex);
  };

  // Handle Lightness slider change
  const handleLightnessChange = (newLightness: number) => {
    const nextHsl = { ...hsl, l: newLightness };
    setHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    setHexInput(newHex);
    onChange(newHex);
  };

  // Handle Saturation slider change
  const handleSaturationChange = (newSat: number) => {
    const nextHsl = { ...hsl, s: newSat };
    setHsl(nextHsl);
    const newHex = hslToHex(nextHsl.h, nextHsl.s, nextHsl.l);
    setHexInput(newHex);
    onChange(newHex);
  };

  // Handle Hex manual typing
  const handleHexInputChange = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    setHexInput(clean);
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      setHsl(hexToHsl(clean));
      onChange(clean.toUpperCase());
    }
  };

  return (
    <div className="relative inline-block neo-color-picker" ref={popoverRef} data-no-drag="true">
      {/* Trigger Button: Neo-brutalist Swatch */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        data-no-drag="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-7 h-7 rounded-lg border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.9)] cursor-pointer overflow-hidden shrink-0 group hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative"
        style={{ backgroundColor: safeColor }}
        title={title || (language === 'th' ? 'เลือกสีระดับการ์ด' : 'Choose rarity color')}
      >
        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white p-0.5 rounded">
          <Palette size={12} />
        </span>
      </button>

      {/* Custom Neo-Brutalist Color Popover */}
      {isOpen && (
        <div
          data-no-drag="true"
          draggable={false}
          onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 top-full mt-2 w-72 sm:w-80 p-4 bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.9)] animate-in fade-in zoom-in-95 space-y-3 font-['Prompt']"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header: Title & Close Button */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-white">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                style={{ backgroundColor: safeColor }}
              />
              <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                {language === 'th' ? 'เลือกสีระดับการ์ด' : 'Rarity Color Picker'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg border border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>

          {/* Section 1: Presets Grid (30 Colors) */}
          <div>
            <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 flex justify-between items-center">
              <span>{language === 'th' ? 'สียอดนิยมประจำระดับ' : 'Preset Colors'}</span>
              <span className="text-[10px] text-zinc-400 font-mono">{safeColor}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 p-1.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
              {PRESET_COLORS.map((preset) => {
                const isSelected = safeColor.toUpperCase() === preset.toUpperCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full aspect-square rounded-lg border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,0.8)] transition-transform hover:scale-110 active:scale-95 flex items-center justify-center relative ${
                      isSelected ? 'ring-2 ring-yellow-400 scale-105' : ''
                    }`}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  >
                    {isSelected && (
                      <Check
                        size={12}
                        strokeWidth={3}
                        className={preset === '#F1F5F9' || preset === '#CBD5E1' || preset === '#FACC15' ? 'text-black' : 'text-white'}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Smooth Sliders (Hue & Brightness) with High Contrast Stroked Thumbs */}
          <div className="space-y-2 pt-1 border-t border-dashed border-zinc-200 dark:border-zinc-700">
            <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              {language === 'th' ? 'ปรับแต่งเฉดสีละเอียด' : 'Custom Tone'}
            </div>

            {/* Rainbow Hue Slider */}
            <div>
              <input
                type="range"
                min={0}
                max={360}
                value={hsl.h}
                draggable={false}
                onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onChange={(e) => handleHueChange(Number(e.target.value))}
                className="neo-color-slider w-full h-4 rounded-lg appearance-none cursor-pointer border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                style={{
                  background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
            </div>

            {/* Brightness (Lightness) Slider */}
            <div>
              <input
                type="range"
                min={10}
                max={90}
                value={hsl.l}
                draggable={false}
                onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onChange={(e) => handleLightnessChange(Number(e.target.value))}
                className="neo-color-slider w-full h-3 rounded-lg appearance-none cursor-pointer border-2 border-black dark:border-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                style={{
                  background: `linear-gradient(to right, #000000 0%, ${hslToHex(hsl.h, hsl.s, 50)} 50%, #ffffff 100%)`,
                }}
              />
            </div>
          </div>

          {/* Section 3: Hex Code Input with Quick Preview */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">HEX:</span>
            <input
              type="text"
              value={hexInput}
              draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleHexInputChange(e.target.value)}
              placeholder="#A855F7"
              maxLength={7}
              className="flex-1 px-2.5 py-1 text-xs font-mono font-bold uppercase bg-zinc-50 dark:bg-zinc-700 border-2 border-black dark:border-white rounded-lg focus:outline-none shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-center"
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs font-bold bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-lg sketch-btn shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
            >
              {language === 'th' ? 'เลือกสีนี้' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
