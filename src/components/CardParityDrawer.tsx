import React, { useState, useMemo, useEffect } from 'react';
import { CardItem, CardRarity } from '../types';
import {
  checkRarityCardParity,
  ParityReport,
} from '../utils/cardName';
import {
  X,
  Check,
  AlertTriangle,
  Scale,
  Play,
} from 'lucide-react';

export interface CardParityDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  allRarities: CardRarity[];
  allCards: CardItem[];
  selectedRarities: string[];
  onToggleRarity: (rarityName: string) => void;
  onClearSelection: () => void;
  language?: 'th' | 'en';
}

export const CardParityDrawer: React.FC<CardParityDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  allRarities,
  allCards,
  selectedRarities,
  onToggleRarity,
  onClearSelection,
  language = 'th',
}) => {
  // Map of rarity name to color
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    allRarities.forEach(r => {
      if (r.name) map[r.name] = r.color;
    });
    return map;
  }, [allRarities]);

  const [parityReport, setParityReport] = useState<ParityReport | null>(null);
  const [hasExecuted, setHasExecuted] = useState(false);

  // Smooth slide-in and slide-out transition states
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      setParityReport(null);
      setHasExecuted(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset results whenever selected rarities change or are cleared
  useEffect(() => {
    setParityReport(null);
    setHasExecuted(false);
  }, [selectedRarities]);

  // Execute the parity check
  const handleExecuteCheck = () => {
    if (selectedRarities.length < 2) return;
    const report = checkRarityCardParity(selectedRarities, allCards, colorMap);
    setParityReport(report);
    setHasExecuted(true);
  };

  return (
    <>
      {/* Horizontal Floating Trigger Button (วางในพื้นที่ว่างมุมขวาล่างตามตำแหน่งกรอบสีแดง) */}
      {!isOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-40 bg-cyan-300 dark:bg-cyan-600 hover:bg-cyan-400 dark:hover:bg-cyan-500 text-black dark:text-white border-2 border-black dark:border-white rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.85)] flex items-center gap-2 cursor-pointer font-black text-xs sm:text-sm sketch-btn transition-transform hover:-translate-y-0.5 active:translate-y-0.5 select-none"
          title={language === 'th' ? 'ตรวจสอบจำนวนการ์ดข้ามเรท' : 'Check Card Parity'}
        >
          <Scale size={18} className="shrink-0" />
          <span className="font-black whitespace-nowrap">
            {language === 'th' ? 'ตรวจสอบจำนวนการ์ดข้ามเรท' : 'Check Card Parity'}
          </span>
          {selectedRarities.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-black text-white text-[10px] sm:text-xs flex items-center justify-center font-mono font-black border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0">
              {selectedRarities.length}
            </span>
          )}
        </button>
      )}

      {/* Docked Drawer Panel (Slide-over with Smooth Animation เลื่อนเปิด เลื่อนปิด) */}
      {isRendered && (
        <div className="fixed inset-0 z-50 flex justify-end font-['Prompt'] overflow-hidden">
          {/* Backdrop overlay with smooth fade in/out */}
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-in-out ${
              isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => {
              setParityReport(null);
              setHasExecuted(false);
              onClose();
            }}
          />

          {/* Drawer Panel with smooth slide in/out */}
          <div
            className={`relative w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl h-full max-h-[100dvh] bg-white dark:bg-zinc-900 border-l-3 border-black dark:border-white shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out ${
              isVisible ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Header */}
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black dark:border-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-cyan-300 dark:bg-cyan-600 border-2 border-black flex items-center justify-center text-black dark:text-white shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Scale size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-black font-['Mali'] text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                    <span className="truncate">{language === 'th' ? 'ตรวจสอบจำนวนการ์ดข้ามเรท' : 'Check Card Parity Between Rates'}</span>
                    {selectedRarities.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-black text-white text-[10px] font-mono font-black shrink-0">
                        {selectedRarities.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold truncate">
                    {language === 'th'
                      ? 'คลิกเลือกระดับที่ต้องการเปรียบเทียบ แล้วกดปุ่มเพื่อเริ่มตรวจสอบ'
                      : 'Select rarities to compare and click run to inspect'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParityReport(null);
                  setHasExecuted(false);
                  onClose();
                }}
                className="p-1.5 sm:p-2 rounded-xl border-2 border-black dark:border-white hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 sketch-btn shrink-0 ml-2"
                title={language === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 sm:space-y-4">
              {/* SECTION 1: Rarity Selector */}
              <div className="p-3 sm:p-3.5 bg-zinc-50 dark:bg-zinc-800/60 border-2 border-black dark:border-white rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Scale size={14} className="shrink-0" />
                    <span>{language === 'th' ? 'คลิกเลือกระดับที่ต้องการเปรียบเทียบ:' : 'Select Rarities to Compare:'}</span>
                  </span>
                  {selectedRarities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearSelection();
                        setParityReport(null);
                        setHasExecuted(false);
                      }}
                      className="px-2 py-0.5 text-[11px] font-bold rounded-lg border border-black bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 sketch-btn shrink-0"
                    >
                      {language === 'th' ? 'ล้างการเลือก' : 'Clear'}
                    </button>
                  )}
                </div>

                {/* Rarity Selector Chips */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                  {allRarities.map(r => {
                    const isSelected = selectedRarities.includes(r.name);
                    const count = allCards.filter(
                      c => c.rarity && c.rarity.trim().toLowerCase() === r.name.trim().toLowerCase()
                    ).length;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onToggleRarity(r.name)}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 sm:gap-2 transition-all sketch-btn ${
                          isSelected
                            ? 'border-black dark:border-white bg-white dark:bg-zinc-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.8)] text-black dark:text-white ring-2 ring-black dark:ring-white'
                            : 'border-zinc-300 dark:border-zinc-700 opacity-60 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:opacity-100'
                        }`}
                      >
                        <span
                          className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-black shrink-0"
                          style={{ background: r.color }}
                        />
                        <span className="truncate max-w-[120px] sm:max-w-none">{r.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 font-bold shrink-0">
                          {count} ใบ
                        </span>
                        {isSelected && <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: Action Button */}
              <div>
                <button
                  type="button"
                  disabled={selectedRarities.length < 2}
                  onClick={handleExecuteCheck}
                  className={`w-full py-2.5 sm:py-3 px-4 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all sketch-btn ${
                    selectedRarities.length >= 2
                      ? 'border-black dark:border-white bg-yellow-300 hover:bg-yellow-400 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5'
                      : 'border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Play size={16} className={`shrink-0 ${selectedRarities.length >= 2 ? 'fill-current' : ''}`} />
                  <span>
                    {language === 'th'
                      ? 'เริ่มตรวจสอบความครบถ้วน'
                      : 'Run Parity Check'}
                  </span>
                </button>
                {selectedRarities.length < 2 && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-1.5 font-medium">
                    {language === 'th'
                      ? 'กรุณาเลือกระดับอย่างน้อย 2 ระดับเพื่อเริ่มตรวจสอบ'
                      : 'Please select at least 2 rarities to run check.'}
                  </p>
                )}
              </div>

              {/* SECTION 3: Inspection Results */}
              {hasExecuted && parityReport && selectedRarities.length >= 2 && (
                <div className="space-y-3 pt-1">
                  {/* Summary Status Banner */}
                  <div
                    className={`p-2.5 sm:p-3 rounded-xl border-2 flex items-center justify-between gap-2.5 sm:gap-3 ${
                      parityReport.isBalanced
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border-2 border-black flex items-center justify-center shrink-0 ${
                          parityReport.isBalanced ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'
                        }`}
                      >
                        {parityReport.isBalanced ? <Check size={14} /> : <AlertTriangle size={14} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black truncate">
                          {parityReport.isBalanced
                            ? (language === 'th'
                                ? 'ตรงกันครบถ้วนสมบูรณ์ 100%'
                                : 'All Cards Match 100%')
                            : (language === 'th'
                                ? 'พบจำนวนการ์ดไม่เท่ากัน: มีบางเรทที่ขาดการ์ด'
                                : 'Mismatch Found')}
                        </h3>
                        <p className="text-[10px] sm:text-[11px] opacity-85 font-medium truncate">
                          {language === 'th'
                            ? `เทียบ ${selectedRarities.join(', ')} (พบการ์ดทั้งหมด ${parityReport.totalDistinctKeys} แบบ)`
                            : `Comparing ${selectedRarities.join(', ')}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Missing Cards Breakdown per Rarity */}
                  <div className="space-y-2.5 sm:space-y-3 pt-1">
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">
                      {language === 'th' ? 'สรุปรายละเอียดรายเรท:' : 'Per-Rarity Breakdown:'}
                    </span>

                    {parityReport.reports.map(r => {
                      const isMissing = r.missingCards.length > 0;

                      return (
                        <div
                          key={r.rarityName}
                          className="p-2.5 sm:p-3 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        >
                          <div className="flex items-center justify-between border-b pb-1.5 border-zinc-200 dark:border-zinc-700 gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <span
                                className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-black shrink-0"
                                style={{ background: r.rarityColor }}
                              />
                              <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                                {language === 'th' ? `เรท ${r.rarityName}` : `Rate ${r.rarityName}`}
                              </span>
                              <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500">
                                ({r.cardCount} ใบ)
                              </span>
                            </div>

                            <div>
                              {isMissing ? (
                                <span className="px-2 py-0.5 rounded-md border border-red-500 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 text-[10px] font-bold">
                                  {language === 'th' ? `ขาด ${r.missingCards.length} ใบ` : `Missing ${r.missingCards.length}`}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md border border-emerald-500 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold flex items-center gap-1">
                                  <Check size={11} />
                                  <span>{language === 'th' ? 'ครบทุกใบ' : 'Complete'}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Missing cards list */}
                          {isMissing ? (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[10px] sm:text-[11px] font-bold text-red-600 dark:text-red-400">
                                {language === 'th'
                                  ? `การ์ดที่ยังไม่มีในเรท ${r.rarityName}:`
                                  : `Cards missing in ${r.rarityName}:`}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                {r.missingCards.map(m => (
                                  <div
                                    key={m.key}
                                    className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg flex items-center gap-2"
                                  >
                                    {m.exampleCard?.imageUrl ? (
                                      <img
                                        src={m.exampleCard.imageUrl}
                                        alt={m.displayName}
                                        className="w-8 h-10 object-contain rounded border border-black shrink-0 bg-white"
                                      />
                                    ) : (
                                      <div className="w-8 h-10 rounded border border-black bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-500 shrink-0">
                                        -
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-black truncate text-zinc-900 dark:text-white" title={m.displayName}>
                                        {m.displayName}
                                      </p>
                                      {m.exampleCard?.fileName && (
                                        <p className="text-[10px] text-zinc-500 font-mono truncate" title={m.exampleCard.fileName}>
                                          ไฟล์: {m.exampleCard.fileName}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">
                                        {language === 'th' ? `พบในเรท: ${m.foundInRarities.join(', ')}` : `Found in: ${m.foundInRarities.join(', ')}`}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              {language === 'th'
                                ? `เรท ${r.rarityName} มีการ์ดตรงกับเรทอื่นที่เลือกครบทุกใบ`
                                : `All cards accounted for.`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with responsive safe-area padding */}
            <div className="px-4 py-2.5 sm:py-3 bg-zinc-100 dark:bg-zinc-800 border-t-2 border-black dark:border-white flex items-center justify-between shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <span className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">
                {language === 'th'
                  ? `เลือกระดับ: ${selectedRarities.length} ระดับ`
                  : `Selected: ${selectedRarities.length} rates`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setParityReport(null);
                  setHasExecuted(false);
                  onClose();
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 text-black dark:text-white sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {language === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
