import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PackSeries, CardItem } from '../types';
import { getCardDisplayName, sortCardsByRarityOrder } from '../utils/cardName';
import { NeoDropdown } from './NeoDropdown';
import { ModernImageLightbox } from './ModernImageLightbox';
import {
  X,
  Search,
  Check,
  Sparkles,
  Layers,
  ZoomIn,
  Package,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export interface SelectedCardReward {
  card: CardItem;
  pack: PackSeries;
}

export interface CardPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  packs: PackSeries[];
  selectedPackId?: string;
  selectedCardId?: string;
  initialSelectedCards?: SelectedCardReward[];
  onConfirmSelection?: (selectedCards: SelectedCardReward[]) => void;
  onSelect?: (card: CardItem, pack: PackSeries) => void;
  language?: 'th' | 'en';
  isFoilPreview?: boolean;
}

export const CardPickerModal: React.FC<CardPickerModalProps> = ({
  isOpen,
  onClose,
  packs,
  selectedPackId = '',
  selectedCardId = '',
  initialSelectedCards,
  onConfirmSelection,
  onSelect,
  language = 'th',
  isFoilPreview = false,
}) => {
  const [activeFranchise, setActiveFranchise] = useState<string>('ALL');
  const [activePackId, setActivePackId] = useState<string>(selectedPackId || packs[0]?.id || '');
  const [selectedCards, setSelectedCards] = useState<SelectedCardReward[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // All unique franchises available in packs
  const franchiseList = useMemo(() => {
    const set = new Set<string>();
    packs.forEach((p) => {
      const f = (p.franchiseName || '').trim();
      if (f) set.add(f);
    });
    return Array.from(set);
  }, [packs]);

  // Packs available filtered by activeFranchise
  const availablePacks = useMemo(() => {
    if (activeFranchise === 'ALL') return packs;
    return packs.filter((p) => (p.franchiseName || '').trim() === activeFranchise);
  }, [packs, activeFranchise]);

  // Sync internal state ONLY when modal transitions from closed to open (prevents 1s polling reset loop)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      if (initialSelectedCards && initialSelectedCards.length > 0) {
        setSelectedCards([...initialSelectedCards]);
        const firstPack = initialSelectedCards[0].pack;
        if (firstPack) {
          setActiveFranchise(firstPack.franchiseName?.trim() || 'ALL');
          setActivePackId(firstPack.id);
        }
      } else if (selectedCardId) {
        let foundCard: CardItem | undefined;
        let foundPack: PackSeries | undefined;
        for (const p of packs) {
          const c = p.cards?.find((item) => item.id === selectedCardId);
          if (c) {
            foundCard = c;
            foundPack = p;
            break;
          }
        }
        if (foundCard && foundPack) {
          setSelectedCards([{ card: foundCard, pack: foundPack }]);
          setActiveFranchise(foundPack.franchiseName?.trim() || 'ALL');
          setActivePackId(foundPack.id);
        } else {
          setSelectedCards([]);
          const initPack = packs.find((p) => p.id === selectedPackId) || packs[0];
          setActiveFranchise(initPack?.franchiseName ? initPack.franchiseName.trim() : 'ALL');
          setActivePackId(selectedPackId || initPack?.id || '');
        }
      } else {
        setSelectedCards([]);
        const initPack = packs.find((p) => p.id === selectedPackId) || packs[0];
        setActiveFranchise(initPack?.franchiseName ? initPack.franchiseName.trim() : 'ALL');
        setActivePackId(selectedPackId || initPack?.id || '');
      }

      setSearchQuery('');
      setSelectedRarity('ALL');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, selectedPackId, selectedCardId, initialSelectedCards, packs]);

  const handleFranchiseChange = (newFranchise: string) => {
    setActiveFranchise(newFranchise);
    const filtered = newFranchise === 'ALL'
      ? packs
      : packs.filter((p) => (p.franchiseName || '').trim() === newFranchise);

    if (filtered.length > 0) {
      if (!filtered.some((p) => p.id === activePackId)) {
        setActivePackId(filtered[0].id);
      }
    } else {
      setActivePackId('');
    }
  };

  const handlePackChange = (newPackId: string) => {
    setActivePackId(newPackId);
  };

  // Lock background body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !lightboxImage) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lightboxImage, onClose]);

  // Current active pack object
  const activePack = useMemo(() => {
    return packs.find((p) => p.id === activePackId) || packs[0];
  }, [packs, activePackId]);

  // Sorted cards in active pack
  const sortedCards = useMemo(() => {
    if (!activePack?.cards) return [];
    return sortCardsByRarityOrder(activePack.cards, activePack.rarities || []);
  }, [activePack]);

  // Available unique rarities in current pack for filter pills
  const availableRarities = useMemo(() => {
    const set = new Set<string>();
    sortedCards.forEach((c) => {
      if (c.rarity) set.add(c.rarity);
    });
    return Array.from(set);
  }, [sortedCards]);

  // Filtered cards based on search and rarity
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedCards.filter((c) => {
      if (selectedRarity !== 'ALL' && c.rarity !== selectedRarity) {
        return false;
      }
      if (q) {
        const cleanName = getCardDisplayName(c.name).toLowerCase();
        const rawName = c.name.toLowerCase();
        const rarityMatch = c.rarity.toLowerCase().includes(q);
        if (!cleanName.includes(q) && !rawName.includes(q) && !rarityMatch) {
          return false;
        }
      }
      return true;
    });
  }, [sortedCards, selectedRarity, searchQuery]);

  // Helper for rarity background color
  const getRarityColor = (rarityName: string) => {
    const found = activePack?.rarities?.find((r) => r.name === rarityName);
    return found?.color || '#facc15';
  };

  // Toggle single card selection (Click to select, click again to deselect)
  const handleToggleCard = (card: CardItem) => {
    if (!activePack) return;
    setSelectedCards((prev) => {
      const exists = prev.some((sc) => sc.card.id === card.id);
      if (exists) {
        return prev.filter((sc) => sc.card.id !== card.id);
      } else {
        return [...prev, { card, pack: activePack }];
      }
    });
  };

  // Remove individual card by ID
  const handleRemoveCard = (cardId: string) => {
    setSelectedCards((prev) => prev.filter((sc) => sc.card.id !== cardId));
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedCards([]);
  };

  // Confirm selection
  const handleConfirm = () => {
    if (selectedCards.length > 0) {
      if (onConfirmSelection) {
        onConfirmSelection(selectedCards);
      }
      if (onSelect) {
        onSelect(selectedCards[0].card, selectedCards[0].pack);
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[88vh] max-h-[820px] bg-white dark:bg-zinc-900 border-3 border-black dark:border-white rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] flex flex-col overflow-hidden font-['Prompt'] animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="shrink-0 flex items-center justify-between p-3.5 sm:p-4 border-b-2 border-black dark:border-zinc-700 bg-yellow-400 text-black">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black font-['Mali'] leading-tight">
                  {language === 'th' ? 'เลือกการ์ดของรางวัล' : 'Select Reward Cards'}
                </h2>
                {selectedCards.length > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-black bg-black text-yellow-300 rounded-full border border-black shadow-xs">
                    {language === 'th'
                      ? `เลือกแล้ว ${selectedCards.length} ใบ`
                      : `${selectedCards.length} selected`}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-yellow-950">
                {language === 'th'
                  ? 'เลือกการ์ดของรางวัลสำหรับโค้ดนี้'
                  : 'Select reward cards for this gift code'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-red-400 hover:text-white transition-colors cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5"
            title={language === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTROLS BAR: FRANCHISE + PACK + SEARCH */}
        <div className="shrink-0 p-3 sm:p-4 border-b-2 border-black dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            {/* Franchise Selector */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1">
                <Package size={12} className="text-purple-500" />
                <span>{language === 'th' ? 'เลือกแฟรนไชส์' : 'Select Franchise'}</span>
              </label>
              <NeoDropdown
                value={activeFranchise}
                onChange={handleFranchiseChange}
                options={[
                  {
                    value: 'ALL',
                    label: language === 'th' ? 'ทุกแฟรนไชส์' : 'All Franchises',
                    badge: `${packs.length} ${language === 'th' ? 'ชุด' : 'packs'}`,
                  },
                  ...franchiseList.map((f) => {
                    const count = packs.filter((p) => (p.franchiseName || '').trim() === f).length;
                    return {
                      value: f,
                      label: f,
                      badge: `${count} ${language === 'th' ? 'ชุด' : 'packs'}`,
                    };
                  }),
                ]}
              />
            </div>

            {/* Pack Selector */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1">
                <Layers size={12} className="text-yellow-500" />
                <span>{language === 'th' ? 'เลือกชุดการ์ด' : 'Select Pack'}</span>
              </label>
              <NeoDropdown
                value={activePackId}
                onChange={handlePackChange}
                options={availablePacks.map((p) => ({
                  value: p.id,
                  label: activeFranchise === 'ALL' && p.franchiseName ? `[${p.franchiseName}] ${p.seriesName}` : p.seriesName,
                  badge: `${p.cards?.length || 0} ${language === 'th' ? 'ใบ' : 'cards'}`,
                }))}
              />
            </div>

            {/* Search Box */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1">
                <Search size={12} className="text-yellow-500" />
                <span>{language === 'th' ? 'ค้นหาชื่อการ์ด' : 'Search Card Name'}</span>
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'th' ? 'พิมพ์ค้นหาชื่อการ์ด...' : 'Type to search card...'}
                  className="w-full pl-8 pr-8 py-2 text-xs sm:text-sm font-bold bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rarity Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none border-t border-zinc-200 dark:border-zinc-700/60 pt-2">
            <span className="text-[10px] font-black text-zinc-400 shrink-0 uppercase mr-1">
              {language === 'th' ? 'ระดับ:' : 'Rarity:'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedRarity('ALL')}
              className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 transition-all shrink-0 cursor-pointer ${
                selectedRarity === 'ALL'
                  ? 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-black'
              }`}
            >
              {language === 'th' ? 'ทั้งหมด' : 'All'} ({sortedCards.length})
            </button>

            {availableRarities.map((rName) => {
              const count = sortedCards.filter((c) => c.rarity === rName).length;
              const rColor = getRarityColor(rName);
              const isSelected = selectedRarity === rName;
              return (
                <button
                  key={rName}
                  type="button"
                  onClick={() => setSelectedRarity(rName)}
                  className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-105'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-black'
                  }`}
                  style={
                    isSelected
                      ? { background: rColor, color: '#000000' }
                      : {}
                  }
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/40 inline-block shrink-0"
                    style={{ background: rColor }}
                  />
                  <span>{rName}</span>
                  <span className="text-[10px] opacity-75 font-normal">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CARD GRID GALLERY (flex-1 min-h-0: scrolls independently without expanding modal) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 bg-zinc-100 dark:bg-zinc-900">
          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 flex items-center justify-center text-zinc-400">
                <AlertCircle size={24} />
              </div>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-['Mali']">
                {language === 'th'
                  ? 'ไม่พบการ์ดที่ตรงกับเงื่อนไขการค้นหา'
                  : 'No cards found matching criteria'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRarity('ALL');
                }}
                className="px-3 py-1 text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
              >
                {language === 'th' ? 'ล้างตัวกรองทั้งหมด' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredCards.map((card) => {
                const isSelected = selectedCards.some((sc) => sc.card.id === card.id);
                const rColor = getRarityColor(card.rarity);
                const displayName = getCardDisplayName(card.name) || card.name;

                return (
                  <div
                    key={card.id}
                    onClick={() => handleToggleCard(card)}
                    className={`relative group aspect-[2.5/3.5] rounded-xl border-2 transition-all flex flex-col justify-between overflow-hidden cursor-pointer select-none ${
                      isSelected
                        ? 'border-black dark:border-white ring-4 ring-yellow-400 bg-yellow-100/60 dark:bg-yellow-950/40 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] scale-[1.02] z-10'
                        : 'border-black dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-black hover:scale-[1.02] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    } ${isFoilPreview ? 'foil-card ring-2 ring-yellow-400' : ''}`}
                  >
                    {/* Top Left: Rarity Badge */}
                    <span
                      className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded border border-black text-black shadow-xs pointer-events-none"
                      style={{ background: rColor }}
                    >
                      {card.rarity}
                    </span>

                    {/* Top Right: Selected Checkmark / Foil Badge */}
                    <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 pointer-events-none">
                      {isFoilPreview && (
                        <span className="px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded foil-badge flex items-center gap-0.5 shadow-xs">
                          <Sparkles size={8} />
                          <span>FOIL</span>
                        </span>
                      )}
                      {isSelected && (
                        <span className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-black text-black flex items-center justify-center font-black shadow-sm animate-in zoom-in-75 duration-150">
                          <Check size={14} strokeWidth={3.5} />
                        </span>
                      )}
                    </div>

                    {/* Card Image Thumbnail */}
                    <div className="w-full h-full p-1.5 flex items-center justify-center relative overflow-hidden">
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        draggable={false}
                        className="w-full h-full object-contain rounded-lg pointer-events-none transition-transform group-hover:scale-105"
                      />
                    </div>

                    {/* Zoom / Lightbox inspect button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxImage({
                          url: card.imageUrl,
                          title: `${displayName} (${card.rarity})`,
                        });
                      }}
                      className="absolute bottom-9 right-1.5 z-20 w-6 h-6 rounded-lg bg-black/60 hover:bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-zoom-in"
                      title={language === 'th' ? 'ดูภาพขนาดใหญ่' : 'Inspect Card'}
                    >
                      <ZoomIn size={12} />
                    </button>

                    {/* Bottom: Card Name Footer Bar */}
                    <div className="relative z-20 bg-black/80 dark:bg-black/90 backdrop-blur-xs px-2 py-1.5 border-t border-black/20 text-center">
                      <p className="text-[10px] sm:text-[11px] font-black text-white truncate leading-tight">
                        {displayName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM TRAY: LIVE SELECTED CARDS LIST + ACTION BAR */}
        <div className="shrink-0 p-3.5 sm:p-4 border-t-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-850 space-y-3">
          {/* Horizontal scrollable selected cards tray (if any selected) */}
          {selectedCards.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {selectedCards.map(({ card, pack }, idx) => {
                const displayName = getCardDisplayName(card.name) || card.name;
                const rColor = getRarityColor(card.rarity);
                return (
                  <div
                    key={`${card.id}_${idx}`}
                    className="relative group shrink-0 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl p-1 pr-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <div className="w-8 h-10 rounded border border-black overflow-hidden bg-white shrink-0 relative">
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-contain"
                      />
                      <span
                        className="absolute bottom-0 inset-x-0 text-[7px] font-black text-center text-black"
                        style={{ background: rColor }}
                      >
                        {card.rarity}
                      </span>
                    </div>

                    <div className="flex flex-col max-w-[100px] truncate text-left">
                      <span className="text-[9px] font-bold text-zinc-400 truncate">
                        {pack?.seriesName}
                      </span>
                      <span className="text-[11px] font-black text-zinc-900 dark:text-white truncate">
                        {displayName}
                      </span>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCard(card.id)}
                      className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-black ml-1 cursor-pointer shadow-xs transition-transform hover:scale-110"
                      title={language === 'th' ? 'ลบออกจากการเลือก' : 'Remove card'}
                    >
                      <X size={11} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Row: Status on left, buttons on right */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-black text-zinc-900 dark:text-white">
                {selectedCards.length > 0
                  ? (language === 'th' ? `การ์ดที่เลือก (${selectedCards.length} ใบ)` : `Selected Cards (${selectedCards.length})`)
                  : (language === 'th' ? 'ยังไม่ได้เลือกการ์ด' : 'No cards selected')}
              </span>

              {selectedCards.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                >
                  {language === 'th' ? 'ล้างที่เลือก' : 'Clear All'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-xs active:translate-x-0.5 active:translate-y-0.5"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={selectedCards.length === 0}
                onClick={handleConfirm}
                className={`px-5 py-2 rounded-xl border-2 border-black dark:border-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedCards.length > 0
                    ? 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700 cursor-not-allowed opacity-50'
                }`}
              >
                <Check size={16} strokeWidth={2.5} />
                <span>
                  {language === 'th'
                    ? `ยืนยันเลือกการ์ด (${selectedCards.length} ใบ)`
                    : `Confirm Selection (${selectedCards.length} cards)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox when inspecting card image */}
      {lightboxImage && (
        <ModernImageLightbox
          isOpen={true}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
        />
      )}
    </div>
  );
};
