import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { CardItem } from '../types';
import { getTranslation } from '../i18n/translations';
import { getCardDisplayName, sortCardsByRarityOrder } from '../utils/cardName';
import { Lock, Sparkles, X, Layers, CheckCircle, ChevronDown, ArrowUpDown, Coins, Package } from 'lucide-react';
import { ModernImageLightbox } from './ModernImageLightbox';

type GallerySortMode = 'name_asc' | 'name_desc' | 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';

export const GalleryPage: React.FC = () => {
  const { currentUser, packs, language, refreshUserInventory } = useGacha();
  const t = getTranslation(language);

  // Auto-sync inventory from Supabase on mount
  React.useEffect(() => {
    if (currentUser?.id) {
      refreshUserInventory();
    }
  }, [currentUser?.id, refreshUserInventory]);

  // Only display published packs in gallery (Requirement 4: ซ่อนชุดการ์ดที่เป็นฉบับร่าง)
  const publishedPacks = packs.filter(p => p.isPublished === true);
  const [selectedPackId, setSelectedPackId] = useState<string>(publishedPacks[0]?.id || '');
  const [inspectedCard, setInspectedCard] = useState<CardItem | null>(null);
  const [inspectedVariant, setInspectedVariant] = useState<'normal' | 'foil'>('normal');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Pack sorting state (Item 2)
  const [sortMode, setSortMode] = useState<GallerySortMode>('date_desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Map of all known cards across packs for robust inventory matching
  const allKnownCards = React.useMemo(() => {
    const map = new Map<string, CardItem>();
    packs.forEach(p => {
      (p.cards || []).forEach(c => {
        if (c.id && !map.has(c.id)) {
          map.set(c.id, c);
        }
      });
    });
    return map;
  }, [packs]);

  // Sort options config
  const sortOptions: { mode: GallerySortMode; labelTh: string; labelEn: string }[] = [
    { mode: 'name_asc', labelTh: 'เรียงตามชื่อ a-z', labelEn: 'Name (A to Z)' },
    { mode: 'name_desc', labelTh: 'เรียงตามชื่อ z-a', labelEn: 'Name (Z to A)' },
    { mode: 'date_desc', labelTh: 'เรียงจากใหม่ไปเก่า', labelEn: 'Newest to Oldest' },
    { mode: 'date_asc', labelTh: 'เรียงจากเก่าไปใหม่', labelEn: 'Oldest to Newest' },
    { mode: 'price_asc', labelTh: 'เรียงจากถูกไปแพง', labelEn: 'Price: Low to High' },
    { mode: 'price_desc', labelTh: 'เรียงจากแพงไปถูก', labelEn: 'Price: High to Low' },
  ];

  const currentSortOption = sortOptions.find(o => o.mode === sortMode) || sortOptions[2];

  // Sorted packs
  const sortedPacks = [...publishedPacks].sort((a, b) => {
    switch (sortMode) {
      case 'name_asc':
        return (a.seriesName || '').localeCompare(b.seriesName || '');
      case 'name_desc':
        return (b.seriesName || '').localeCompare(a.seriesName || '');
      case 'date_desc':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'date_asc':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'price_asc':
        return (a.price || 0) - (b.price || 0);
      case 'price_desc':
        return (b.price || 0) - (a.price || 0);
      default:
        return 0;
    }
  });

  const activePack = sortedPacks.find(p => p.id === selectedPackId) || sortedPacks[0];

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <Lock size={48} className="mx-auto text-amber-500 mb-3" />
          <h2 className="text-xl font-bold font-['Mali'] mb-2">
            {t.gallery.loginRequired}
          </h2>
          <p className="text-sm text-zinc-500">
            {t.gallery.loginRequiredDesc}
          </p>
        </div>
      </div>
    );
  }

  if (publishedPacks.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <Layers size={48} className="mx-auto text-yellow-500 mb-3" />
          <h2 className="text-xl font-bold font-['Mali'] mb-2">
            {t.gallery.noPacksPublished}
          </h2>
          <p className="text-sm text-zinc-500">
            {t.gallery.noPacksPublishedDesc}
          </p>
        </div>
      </div>
    );
  }

  // Helper to aggregate inventory across cards with same name & rarity within active pack
  const getCardInventoryCounts = (targetCard: CardItem, packCardsList?: CardItem[]) => {
    const cardsList = packCardsList || activePack?.cards || [];
    const cleanTargetName = getCardDisplayName(targetCard.name).trim().toLowerCase();
    const cleanTargetRarity = (targetCard.rarity || '').trim().toLowerCase();

    // 1. Matching card IDs within current pack
    const matchingInPack = cardsList.filter(c =>
      c.id === targetCard.id ||
      ((c.rarity || '').trim().toLowerCase() === cleanTargetRarity &&
       getCardDisplayName(c.name).trim().toLowerCase() === cleanTargetName)
    );
    const matchingIds = new Set(matchingInPack.map(c => c.id));

    let total = 0;
    let foil = 0;

    matchingIds.forEach(cId => {
      total += (currentUser?.inventory?.[cId] || 0);
      foil += (currentUser?.inventory?.[`${cId}_foil`] || 0);
    });

    // 2. Fallback: check all keys in currentUser.inventory that might belong to this card
    if (currentUser?.inventory) {
      Object.entries(currentUser.inventory).forEach(([invKey, qty]) => {
        if (!qty || qty <= 0) return;
        const isFoilKey = invKey.endsWith('_foil');
        const baseId = isFoilKey ? invKey.slice(0, -5) : invKey;

        // Skip if already counted in matchingIds
        if (matchingIds.has(baseId)) return;

        // Check if this baseId matches targetCard
        const knownCard = allKnownCards.get(baseId);
        if (knownCard) {
          const matchName = getCardDisplayName(knownCard.name).trim().toLowerCase() === cleanTargetName;
          const matchRarity = (knownCard.rarity || '').trim().toLowerCase() === cleanTargetRarity;
          if (matchName && matchRarity) {
            if (isFoilKey) {
              foil += qty;
            } else {
              total += qty;
            }
          }
        }
      });
    }

    const normal = Math.max(0, total - foil);
    return { total, foil, normal, isUnlocked: total > 0 || foil > 0, hasFoil: foil > 0 };
  };

  // Calculate owned counts for active pack
  const packCards = sortCardsByRarityOrder(activePack?.cards || [], activePack?.rarities || []);
  const totalCardsInPack = packCards.length;
  const ownedCardsInPack = packCards.filter(c => getCardInventoryCounts(c).isUnlocked).length;
  const progressPercent = totalCardsInPack > 0 ? Math.round((ownedCardsInPack / totalCardsInPack) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-['Prompt']">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.9)] mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-['Mali'] text-zinc-900 dark:text-white">
              {t.gallery.title}
            </h1>
            <p className="text-xs text-zinc-500 font-semibold mt-1">
              {language === 'th'
                ? `เลือกดูคอลเลกชันการ์ดที่ครอบครอง แยกตามซองและแฟรนไชส์ (${publishedPacks.length} ชุด)`
                : `Inspect your owned cards collection separated by packs and franchises (${publishedPacks.length} packs)`}
            </p>
          </div>

          {/* Sort Dropdown (Item 2) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 border-2 border-black dark:border-white rounded-xl text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sketch-btn"
            >
              <ArrowUpDown size={14} />
              <span>{language === 'th' ? currentSortOption.labelTh : currentSortOption.labelEn}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-40 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.85)] w-56 space-y-1">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => {
                      setSortMode(opt.mode);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between ${
                      sortMode === opt.mode
                        ? 'bg-yellow-300 text-black'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    <span>{language === 'th' ? opt.labelTh : opt.labelEn}</span>
                    {sortMode === opt.mode && <CheckCircle size={13} className="text-black" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Separated Pack Selection Cards (Item 2: แยก ซองสุ่ม และ แฟรนไชส์ ออกจากกันอย่างชัดเจน) */}
        <div className="mt-5 pt-4 border-t-2 border-zinc-200 dark:border-zinc-700">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center gap-1.5">
            <Package size={14} />
            <span>{language === 'th' ? 'เลือกซองสุ่มการ์ด' : 'Select Card Pack'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedPacks.map((p) => {
              const pCards = p.cards || [];
              const pOwned = pCards.filter(c => getCardInventoryCounts(c, pCards).isUnlocked).length;
              const isSelected = (activePack?.id === p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPackId(p.id)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer sketch-btn flex items-center gap-3 ${
                    isSelected
                      ? 'bg-yellow-100 dark:bg-yellow-950/40 border-black dark:border-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ring-2 ring-yellow-400'
                      : 'bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {/* Pack Cover thumbnail */}
                  <div className="w-12 h-16 rounded-lg border border-black overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                    {p.coverImageUrl ? (
                      <img src={p.coverImageUrl} alt={p.seriesName} className="w-full h-full object-cover" />
                    ) : (
                      <Layers size={18} className="text-zinc-400" />
                    )}
                  </div>

                  {/* Pack Details */}
                  <div className="flex-1 min-w-0">
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-200 truncate inline-block max-w-full">
                      {p.franchiseName}
                    </span>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-white truncate mt-0.5 font-['Mali']">
                      {p.seriesName}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {pOwned}/{pCards.length}
                      </span>
                      <span className="flex items-center gap-0.5 font-semibold">
                        <Coins size={11} className="text-amber-500" />
                        {(p.price || 500).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Collection Progress Bar */}
        {activePack && (
          <div className="mt-5 pt-4 border-t-2 border-zinc-200 dark:border-zinc-700">
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span>{t.gallery.progress.replace('{owned}', String(ownedCardsInPack)).replace('{total}', String(totalCardsInPack))}</span>
              <span className="text-emerald-600 dark:text-emerald-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden border border-black">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      {activePack ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {packCards.map((card) => {
            const { total: countOwned, foil: foilCount, normal: normalCount, isUnlocked, hasFoil } = getCardInventoryCounts(card);

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (isUnlocked) {
                    setInspectedCard(card);
                    setInspectedVariant(hasFoil ? 'foil' : 'normal');
                  }
                }}
                className={`relative flex flex-col items-center group transition-all duration-200 ${
                  isUnlocked ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-not-allowed opacity-60'
                }`}
              >
                {/* Card Container */}
                <div
                  className={`w-full aspect-[2/3] bg-white dark:bg-zinc-800 border-2 rounded-xl overflow-hidden flex flex-col relative transition-all ${
                    isUnlocked
                      ? hasFoil
                        ? 'border-amber-400 foil-card ring-1 ring-amber-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.9)]'
                      : 'border-zinc-400 grayscale bg-zinc-200 dark:bg-zinc-900 border-dashed'
                  }`}
                >
                  {/* Rarity Pill */}
                  <span
                    className={`absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 text-[10px] font-black rounded border border-black ${
                      !isUnlocked && 'grayscale'
                    }`}
                    style={{
                      background:
                        activePack?.rarities?.find((r) => r.name === card.rarity)?.color ||
                        (card.rarity === 'RR' ? '#f59e0b' : card.rarity === 'R' ? '#38bdf8' : '#e2e8f0'),
                      color: card.rarity === 'C' ? '#334155' : '#000',
                    }}
                  >
                    {card.rarity}
                  </span>

                  {/* Foil Badge */}
                  {hasFoil && (
                    <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded foil-badge flex items-center gap-0.5 shadow-xs">
                      <Sparkles size={9} className="text-yellow-950" />
                      <span>FOIL</span>
                    </span>
                  )}

                  {/* Lock Watermark for Locked Cards */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 text-white font-bold text-xs p-2 text-center pointer-events-none">
                      <Lock size={24} className="mb-1 text-zinc-300" />
                      <span>{language === 'th' ? 'ยังไม่ปลดล็อก' : 'Locked'}</span>
                    </div>
                  )}

                  {/* Card Image */}
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-700 overflow-hidden relative flex items-center justify-center p-1">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className={`max-h-full max-w-full w-auto h-auto object-contain rounded ${!isUnlocked && 'grayscale filter'}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Bottom Name Strip */}
                  <div className="p-1.5 border-t-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center relative z-20">
                    <p className="text-[11px] font-bold truncate">
                      {isUnlocked ? getCardDisplayName(card.name) : '???'}
                    </p>
                  </div>
                </div>

                {/* Owned Count Badge */}
                <div className="mt-1.5 flex items-center gap-1 flex-wrap justify-center">
                  {isUnlocked ? (
                    hasFoil && normalCount > 0 ? (
                      <>
                        <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700">
                          {language === 'th' ? `ปกติ ${normalCount} ใบ` : `Normal x${normalCount}`}
                        </span>
                        <span className="text-[10px] font-black text-black bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 px-2 py-0.5 rounded-full border border-black shadow-xs flex items-center gap-0.5">
                          <Sparkles size={10} className="text-yellow-900" />
                          <span>Foil x{foilCount}</span>
                        </span>
                      </>
                    ) : hasFoil ? (
                      <span className="text-[10px] font-black text-black bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 px-2 py-0.5 rounded-full border border-black shadow-xs flex items-center gap-0.5">
                        <Sparkles size={10} className="text-yellow-900" />
                        <span>Foil x{foilCount}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500">
                        {language === 'th' ? `ปกติ ${normalCount} ใบ` : `Normal x${normalCount}`}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-semibold text-zinc-400">
                      {language === 'th' ? '0 ใบ' : '0 cards'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-500">
          {language === 'th' ? 'ไม่พบชุดการ์ด' : 'No pack found'}
        </div>
      )}

      {/* INSPECTION MODAL FOR GALLERY */}
      {inspectedCard && (() => {
        const { total: totalCount, foil: foilCount, normal: normalCount } = getCardInventoryCounts(inspectedCard);
        const isFoilActive = inspectedVariant === 'foil';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setInspectedCard(null);
            }}
          >
            <div
              className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setInspectedCard(null)}
                className="absolute top-3 right-3 p-1 rounded-full border-2 border-black bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200"
              >
                <X size={18} />
              </button>

              {/* Click to inspect in full Lightbox (Item 5) */}
              <div
                onClick={() => {
                  if (inspectedCard.imageUrl) {
                    setLightboxImage({
                      url: inspectedCard.imageUrl,
                      title: isFoilActive
                        ? `${getCardDisplayName(inspectedCard.name) || inspectedCard.name} (Foil)`
                        : (getCardDisplayName(inspectedCard.name) || inspectedCard.name),
                    });
                  }
                }}
                className={`w-44 h-64 mx-auto border-2 border-black dark:border-white rounded-xl overflow-hidden shadow-md flex-shrink-0 relative flex items-center justify-center p-2 bg-zinc-100 dark:bg-zinc-800 cursor-zoom-in group ${
                  isFoilActive ? 'foil-card ring-2 ring-yellow-400' : ''
                }`}
              >
                <span
                  className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 text-[10px] font-black rounded border border-black text-black shadow-sm"
                  style={{
                    background:
                      activePack?.rarities?.find((r) => r.name === inspectedCard.rarity)?.color || '#facc15',
                  }}
                >
                  {inspectedCard.rarity}
                </span>
                {isFoilActive && (
                  <span className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded foil-badge flex items-center gap-0.5 shadow-sm">
                    <Sparkles size={9} className="text-yellow-950" />
                    <span>FOIL</span>
                  </span>
                )}
                <img
                  src={inspectedCard.imageUrl}
                  alt={inspectedCard.name}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="max-h-full max-w-full w-auto h-auto object-contain rounded-lg select-none pointer-events-none group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t.home.cardNameLabel}</span>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center justify-between">
                    <span>{getCardDisplayName(inspectedCard.name)}</span>
                    {isFoilActive && (
                      <span className="text-[10px] font-black foil-badge px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
                        <Sparkles size={11} />
                        <span>FOIL</span>
                      </span>
                    )}
                  </h3>
                </div>

                {/* Edition Variant Switcher Tabs */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setInspectedVariant('normal')}
                    disabled={normalCount === 0 && foilCount > 0}
                    className={`flex-1 py-1.5 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      !isFoilActive
                        ? 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : normalCount > 0
                        ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-black'
                        : 'border-zinc-200 dark:border-zinc-800 opacity-40 cursor-not-allowed text-zinc-400'
                    }`}
                  >
                    <span>{language === 'th' ? 'ธรรมดา' : 'Standard'}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      !isFoilActive
                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                        : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}>
                      x{normalCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (foilCount > 0) setInspectedVariant('foil');
                    }}
                    disabled={foilCount === 0}
                    className={`flex-1 py-1.5 px-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isFoilActive
                        ? 'border-black foil-badge ring-2 ring-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black'
                        : foilCount > 0
                        ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:border-amber-500'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-400 cursor-not-allowed opacity-40'
                    }`}
                  >
                    <Sparkles size={12} className={isFoilActive ? 'text-yellow-950' : 'text-amber-500'} />
                    <span>{language === 'th' ? 'ฟอยล์' : 'Foil'}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-black/10 dark:bg-white/10">
                      x{foilCount}
                    </span>
                  </button>
                </div>

                {inspectedCard.description && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t.home.abilityLabel}</span>
                    <p className="text-xs bg-zinc-50 dark:bg-zinc-700/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-600">
                      {inspectedCard.description}
                    </p>
                  </div>
                )}

                {inspectedCard.fields && inspectedCard.fields.filter(f => f.name !== 'ชื่อการ์ด' && f.name !== 'Card Name' && f.name !== 'ความสามารถการ์ด' && f.name !== 'Card Ability').length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t.home.attributesLabel}</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {inspectedCard.fields
                        .filter(f => f.name !== 'ชื่อการ์ด' && f.name !== 'Card Name' && f.name !== 'ความสามารถการ์ด' && f.name !== 'Card Ability')
                        .map((field) => (
                        <div key={field.id} className="p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded text-[11px]">
                          <span className="font-bold">{field.name}: </span>
                          <span className="whitespace-pre-wrap">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modern Lightbox for Fullscreen Zoom and Pan (Item 5 & 6) */}
      <ModernImageLightbox
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || ''}
        title={lightboxImage?.title}
      />
    </div>
  );
};
