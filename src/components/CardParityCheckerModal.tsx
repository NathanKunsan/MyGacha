import React, { useState, useEffect, useMemo } from 'react';
import { CardItem, CardRarity } from '../types';
import { checkRarityCardParity } from '../utils/cardName';
import { X, Check, AlertTriangle, Scale } from 'lucide-react';

interface CardParityCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  allRarities: CardRarity[];
  allCards: CardItem[];
  initialSelectedRarities?: string[];
  language?: 'th' | 'en';
}

export const CardParityCheckerModal: React.FC<CardParityCheckerModalProps> = ({
  isOpen,
  onClose,
  allRarities,
  allCards,
  initialSelectedRarities = [],
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

  // User-selected rarities to compare (NO auto-selection, user explicitly chooses)
  const [selectedRarities, setSelectedRarities] = useState<string[]>(initialSelectedRarities);

  // Sync when modal opens or initial selection changes
  useEffect(() => {
    if (isOpen) {
      setSelectedRarities(initialSelectedRarities);
    }
  }, [isOpen, initialSelectedRarities]);

  // Run parity check whenever user selections change
  const parityReport = useMemo(() => {
    if (selectedRarities.length < 2) return null;
    return checkRarityCardParity(selectedRarities, allCards, colorMap);
  }, [selectedRarities, allCards, colorMap]);

  if (!isOpen) return null;

  const toggleRarity = (name: string) => {
    setSelectedRarities(prev => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
      }
      return [...prev, name];
    });
  };

  const clearSelection = () => {
    setSelectedRarities([]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in font-['Prompt']"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-900 border-3 border-black dark:border-white rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.85)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black dark:border-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-300 dark:bg-cyan-500 border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Scale size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black font-['Mali'] text-zinc-900 dark:text-white">
                {language === 'th' ? 'ตรวจสอบความครบถ้วนของการ์ดระหว่างเรท' : 'Check Card Parity Between Rates'}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold">
                {language === 'th'
                  ? 'เลือกระดับที่ต้องการเทียบด้วยตัวเอง เพื่อตรวจดูว่าเรทไหนขาดใบชื่ออะไร'
                  : 'Select the rarities you want to compare to find missing cards'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-black dark:border-white hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 sketch-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* User Rarity Selector (User clicks to choose) */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 border-2 border-black dark:border-white rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                {language === 'th'
                  ? 'คลิกเลือกระดับที่คุณต้องการตรวจสอบเปรียบเทียบ:'
                  : 'Click to select the rarities you want to compare:'}
              </span>
              {selectedRarities.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-black bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 sketch-btn"
                >
                  {language === 'th' ? 'ล้างการเลือก' : 'Clear'}
                </button>
              )}
            </div>

            {/* Rarity Selector Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {allRarities.map(r => {
                const isSelected = selectedRarities.includes(r.name);
                const count = allCards.filter(
                  c => c.rarity && c.rarity.trim().toLowerCase() === r.name.trim().toLowerCase()
                ).length;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRarity(r.name)}
                    className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all sketch-btn ${
                      isSelected
                        ? 'border-black dark:border-white bg-white dark:bg-zinc-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)] text-black dark:text-white ring-2 ring-black dark:ring-white'
                        : 'border-zinc-300 dark:border-zinc-700 opacity-60 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:opacity-100'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black shrink-0"
                      style={{ background: r.color }}
                    />
                    <span>{r.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 font-bold">
                      {count} ใบ
                    </span>
                    {isSelected && <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guide when fewer than 2 rarities selected */}
          {selectedRarities.length < 2 ? (
            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-800/40 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6">
              <Scale size={32} className="mx-auto text-zinc-400 mb-2" />
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {language === 'th'
                  ? 'กรุณาคลิกเลือกระดับความแรร์ด้านบนอย่างน้อย 2 ระดับที่คุณต้องการตรวจสอบ'
                  : 'Please select at least 2 rarities above to compare.'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {language === 'th'
                  ? 'ตัวอย่าง: คลิกเลือกเรท C และเรท A (หรือเพิ่มเรท T) เพื่อเทียบจำนวนและการ์ดที่ขาด'
                  : 'Example: Click C and A (or add T) to check matching cards'}
              </p>
            </div>
          ) : parityReport ? (
            <>
              {/* Summary Banner */}
              <div
                className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 flex-wrap ${
                  parityReport.isBalanced
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-100 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center shrink-0 ${
                      parityReport.isBalanced ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'
                    }`}
                  >
                    {parityReport.isBalanced ? <Check size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black">
                      {parityReport.isBalanced
                        ? (language === 'th'
                            ? 'จำนวนการ์ดตรงกันครบถ้วนสมบูรณ์ 100%'
                            : 'All Card Counts & Names Match 100%')
                        : (language === 'th'
                            ? 'พบจำนวนการ์ดไม่เท่ากัน: มีบางเรทที่ขาดการ์ด'
                            : 'Card Count Mismatch: Missing Cards Found')}
                    </h3>
                    <p className="text-[11px] opacity-85 font-medium">
                      {language === 'th'
                        ? `เปรียบเทียบ ${selectedRarities.join(', ')} (พบการ์ดทั้งหมด ${parityReport.totalDistinctKeys} แบบ)`
                        : `Comparing ${selectedRarities.join(', ')}`}
                    </p>
                  </div>
                </div>

                {/* Counts List */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {parityReport.reports.map(r => (
                    <span
                      key={r.rarityName}
                      className="px-2 py-0.5 rounded-lg border border-black text-[11px] font-bold bg-white dark:bg-zinc-800 text-black dark:text-white"
                      style={{ borderLeftColor: r.rarityColor || '#000', borderLeftWidth: 4 }}
                    >
                      {r.rarityName}: {r.cardCount} ใบ
                    </span>
                  ))}
                </div>
              </div>

              {/* Breakdown per selected rarity */}
              <div className="space-y-3">
                {parityReport.reports.map(r => {
                  const isMissing = r.missingCards.length > 0;

                  return (
                    <div
                      key={r.rarityName}
                      className="p-3.5 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.7)] space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b pb-2 border-zinc-200 dark:border-zinc-700 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black shrink-0"
                            style={{ background: r.rarityColor }}
                          />
                          <span className="font-black text-sm text-zinc-900 dark:text-white">
                            {language === 'th' ? `เรท ${r.rarityName}` : `Rate ${r.rarityName}`}
                          </span>
                          <span className="text-xs font-bold text-zinc-500">
                            (มี {r.cardCount} ใบ)
                          </span>
                        </div>

                        <div>
                          {isMissing ? (
                            <span className="px-2.5 py-0.5 rounded-lg border border-red-500 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 text-xs font-bold">
                              {language === 'th' ? `ขาด ${r.missingCards.length} ใบ` : `Missing ${r.missingCards.length} cards`}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg border border-emerald-500 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1">
                              <Check size={12} />
                              <span>{language === 'th' ? 'มีครบทุกใบตามเรทที่เลือกเทียบ' : 'Complete'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Missing cards list */}
                      {isMissing ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                            {language === 'th'
                              ? `การ์ดที่ยังไม่มีในเรท ${r.rarityName} (แต่พบในเรทอื่นที่เลือก):`
                              : `Cards missing in ${r.rarityName}:`}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {r.missingCards.map(m => (
                              <div
                                key={m.key}
                                className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-lg flex items-center gap-2.5"
                              >
                                {m.exampleCard?.imageUrl ? (
                                  <img
                                    src={m.exampleCard.imageUrl}
                                    alt={m.displayName}
                                    className="w-8 h-10 object-contain rounded border border-black shrink-0 bg-white"
                                  />
                                ) : (
                                  <div className="w-8 h-10 rounded border border-black bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
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
                                    {language === 'th' ? `พบใน: ${m.foundInRarities.join(', ')}` : `Found in: ${m.foundInRarities.join(', ')}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {language === 'th'
                            ? `เรท ${r.rarityName} มีการ์ดครบถ้วนทุกใบเทียบเท่ากับเรทอื่น ๆ ที่คุณเลือก`
                            : `All cards in ${r.rarityName} are fully accounted for.`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-zinc-100 dark:bg-zinc-800 border-t-2 border-black dark:border-white flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 text-black dark:text-white sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            {language === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
