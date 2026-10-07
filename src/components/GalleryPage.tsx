import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { CardItem } from '../types';
import { getTranslation } from '../i18n/translations';
import { getCardDisplayName, sortCardsByRarityOrder } from '../utils/cardName';
import { Lock, Sparkles, X, Layers, CheckCircle, ChevronDown, ArrowUpDown, Coins, Package } from 'lucide-react';
import { ModernImageLightbox } from './ModernImageLightbox';

type GallerySortMode = 'name_asc' | 'name_desc' | 'date_desc' | 'date_asc' | 'price_asc' | 'price_desc';

export const GalleryPage: React.FC = () => {
  const { currentUser, packs, language } = useGacha();
  const t = getTranslation(language);

  // Only display published packs in gallery (Requirement 4: ซ่อนชุดการ์ดที่เป็นฉบับร่าง)
  const publishedPacks = packs.filter(p => p.isPublished === true);
  const [selectedPackId, setSelectedPackId] = useState<string>(publishedPacks[0]?.id || '');
  const [inspectedCard, setInspectedCard] = useState<CardItem | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Pack sorting state (Item 2)
  const [sortMode, setSortMode] = useState<GallerySortMode>('date_desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

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

  // Calculate owned counts for active pack
  const packCards = sortCardsByRarityOrder(activePack?.cards || [], activePack?.rarities || []);
  const totalCardsInPack = packCards.length;
  const ownedCardsInPack = packCards.filter(c => (currentUser?.inventory?.[c.id] || 0) > 0).length;
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
              const pOwned = pCards.filter(c => (currentUser?.inventory?.[c.id] || 0) > 0).length;
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
            const countOwned = currentUser?.inventory?.[card.id] || 0;
            const isUnlocked = countOwned > 0;

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (isUnlocked) setInspectedCard(card);
                }}
                className={`relative flex flex-col items-center group transition-all duration-200 ${
                  isUnlocked ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-not-allowed opacity-60'
                }`}
              >
                {/* Card Container */}
                <div
                  className={`w-full aspect-[2/3] bg-white dark:bg-zinc-800 border-2 rounded-xl overflow-hidden flex flex-col relative transition-all ${
                    isUnlocked
                      ? 'border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.9)]'
                      : 'border-zinc-400 grayscale bg-zinc-200 dark:bg-zinc-900 border-dashed'
                  }`}
                >
                  {/* Rarity Pill */}
                  <span
                    className={`absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 text-[10px] font-black rounded border border-black ${
                      !isUnlocked && 'grayscale'
                    }`}
                    style={{
                      backgroundColor:
                        activePack?.rarities?.find((r) => r.name === card.rarity)?.color ||
                        (card.rarity === 'RR' ? '#f59e0b' : card.rarity === 'R' ? '#38bdf8' : '#e2e8f0'),
                      color: card.rarity === 'C' ? '#334155' : '#000',
                    }}
                  >
                    {card.rarity}
                  </span>

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
                    {isUnlocked && card.rarity === 'RR' && (
                      <div className="holo-card absolute inset-0" />
                    )}
                  </div>

                  {/* Bottom Name Strip */}
                  <div className="p-1.5 border-t-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center">
                    <p className="text-[11px] font-bold truncate">
                      {isUnlocked ? getCardDisplayName(card.name) : '???'}
                    </p>
                  </div>
                </div>

                {/* Owned Count Badge */}
                <div className="mt-1.5">
                  {isUnlocked ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500">
                      {language === 'th' ? `มีจำนวน ${countOwned} ใบ` : `Owned: ${countOwned}`}
                    </span>
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
      {inspectedCard && (
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
                    title: getCardDisplayName(inspectedCard.name) || inspectedCard.name,
                  });
                }
              }}
              className="w-44 h-64 mx-auto border-2 border-black dark:border-white rounded-xl overflow-hidden shadow-md flex-shrink-0 relative flex items-center justify-center p-2 bg-zinc-100 dark:bg-zinc-800 cursor-zoom-in group"
            >
              <span
                className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 text-[10px] font-black rounded border border-black text-black shadow-sm"
                style={{
                  backgroundColor:
                    activePack?.rarities?.find((r) => r.name === inspectedCard.rarity)?.color || '#facc15',
                }}
              >
                {inspectedCard.rarity}
              </span>
              <img
                src={inspectedCard.imageUrl}
                alt={inspectedCard.name}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-lg select-none pointer-events-none group-hover:scale-105 transition-transform"
              />
              <div className="absolute bottom-2 left-2 right-2 z-20 px-2 py-0.5 text-[9px] font-bold bg-black/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity text-center">
                {language === 'th' ? 'คลิกเพื่อดูภาพขยาย' : 'Click to zoom'}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t.home.cardNameLabel}</span>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                  {getCardDisplayName(inspectedCard.name)}
                </h3>
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

              <div className="pt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {language === 'th'
                  ? `คุณถือครองการ์ดใบนี้อยู่ ${currentUser?.inventory?.[inspectedCard.id] || 0} ใบ`
                  : `You own ${currentUser?.inventory?.[inspectedCard.id] || 0} cards`}
              </div>
            </div>
          </div>
        </div>
      )}

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
