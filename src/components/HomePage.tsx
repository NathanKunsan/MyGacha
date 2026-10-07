import React, { useState } from 'react';
import { useGacha } from '../context/GachaContext';
import { CardItem, PackSeries, ReportCategory } from '../types';
import { getTranslation } from '../i18n/translations';
import { getCardDisplayName, sortCardsByRarityOrder } from '../utils/cardName';
import {
  Sparkles,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Layers,
  Info,
  Edit2,
  Flag,
  Plus
} from 'lucide-react';
import { ModernImageLightbox } from './ModernImageLightbox';

interface HomePageProps {
  onOpenPack: (pack: PackSeries) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenPack }) => {
  const { packs, currentUser, searchQuery, language, navigate, addToast, setEditingPack, submitReport } = useGacha();
  const t = getTranslation(language);

  // Report Modal state
  const [reportTarget, setReportTarget] = useState<{
    packId: string;
    packName: string;
    franchiseName: string;
    cardId?: string;
    cardName?: string;
  } | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('franchise_name');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Lightbox zoom state (Item 5)
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  const handleSubmitReport = async () => {
    if (!reportTarget) return;
    if (!currentUser) {
      addToast(t.home.reportModal.loginRequired, 'warning');
      return;
    }
    setIsSubmittingReport(true);
    try {
      await submitReport({
        packId: reportTarget.packId,
        packName: reportTarget.packName,
        franchiseName: reportTarget.franchiseName,
        cardId: reportTarget.cardId,
        cardName: reportTarget.cardName,
        categoryKey: reportCategory,
        category: t.home.reportModal.categories[reportCategory] || reportCategory,
        details: reportDetails.trim(),
        reportedByUserId: currentUser.id,
        reportedByUsername: currentUser.username || currentUser.email || 'Anonymous',
      });
      addToast(t.home.reportModal.successToast, 'success');
      setReportTarget(null);
      setReportDetails('');
    } catch (err) {
      console.error('Failed to submit report:', err);
      addToast(language === 'th' ? 'เกิดข้อผิดพลาดในการส่งรายงาน' : 'Error submitting report', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Selected card for Card Detail Inspection Modal (Item 3: คลิกดูข้อมูลการ์ด ไม่ใช่เปิดสุ่ม)
  const [inspectedCard, setInspectedCard] = useState<CardItem | null>(null);

  // Selected pack for Expand All Cards Modal (Item 4: ปุ่ม ขยาย เพื่อดูการ์ดทั้งหมดในซอง)
  const [expandedPack, setExpandedPack] = useState<PackSeries | null>(null);

  // Filter rarity inside Expand All Cards Modal
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<string>('ALL');

  // Carousel offset index for each pack series (Item 4: มีการเคลื่อนของการ์ด เพื่อให้ดูการ์ดเพิ่มเติม)
  const [packCardOffsets, setPackCardOffsets] = useState<Record<string, number>>({});

  // Slide carousel for a specific pack
  const handleSlide = (packId: string, totalCards: number, direction: 'prev' | 'next') => {
    setPackCardOffsets((prev) => {
      const current = prev[packId] || 0;
      const step = 2; // Slide 2 cards at a time
      if (direction === 'prev') {
        const nextIdx = Math.max(0, current - step);
        return { ...prev, [packId]: nextIdx };
      } else {
        const maxOffset = Math.max(0, totalCards - 4);
        const nextIdx = Math.min(maxOffset, current + step);
        return { ...prev, [packId]: nextIdx };
      }
    });
  };

  // Filter packs based on published status and search query (Requirement 4: กดร่าง ให้ซ่อนจริง)
  const publishedPacks = (packs || []).filter((p) => p && p.isPublished === true);
  const filteredPacks = publishedPacks.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.franchiseName || '').toLowerCase().includes(q) ||
      (p.seriesName || '').toLowerCase().includes(q) ||
      (p.tag || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-['Prompt']">
      {/* Title Section matching Wireframe 1 & 2 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold font-['Mali'] text-zinc-900 dark:text-white">
          {t.home.ready}
        </h1>
      </div>

      {/* Packs Series List */}
      <div className="space-y-12">
        {filteredPacks.map((pack) => {
          const cards = sortCardsByRarityOrder(Array.isArray(pack.cards) ? pack.cards : [], pack.rarities || []);
          const totalCards = cards.length;
          const userOwnedUnique = cards.filter(
            (c) => (currentUser?.inventory?.[c.id] || 0) > 0
          ).length;

          const currentOffset = packCardOffsets[pack.id] || 0;
          const visibleCards = cards.slice(currentOffset, currentOffset + 4);
          const canPrev = currentOffset > 0;
          const canNext = currentOffset + 4 < totalCards;

          return (
            <div
              key={pack.id}
              className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl p-6 sm:p-8 shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.9)] space-y-6"
            >
              {/* Franchise Header & Tag (Wireframe 1 & 2: [Cards Name] [Tag]) */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-dashed border-zinc-200 dark:border-zinc-700 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl font-black font-['Mali'] text-zinc-900 dark:text-white">
                      {pack.franchiseName}
                    </h2>
                    {(() => {
                      const tagList = (pack.tags && pack.tags.length > 0)
                        ? pack.tags
                        : (pack.tag ? pack.tag.split(',').map(s => s.trim()).filter(Boolean) : []);
                      if (tagList.length === 0) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tagList.map((tItem, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 text-xs font-bold bg-yellow-300 text-black border border-black rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                            >
                              {tItem}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-zinc-500 font-semibold mt-0.5">
                    {pack.seriesName}
                  </p>
                </div>

                {/* Collection Summary & Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right text-xs mr-1">
                    <span className="text-zinc-500 font-medium block">{t.home.collectionProgress}</span>
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      {userOwnedUnique} / {totalCards} {t.home.cardsCountSuffix}
                    </span>
                  </div>

                  {/* Expand All Cards Button (Item 4) */}
                  <button
                    onClick={() => {
                      setSelectedRarityFilter('ALL');
                      setExpandedPack(pack);
                    }}
                    className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] flex items-center gap-1.5 text-xs font-['Mali']"
                    title={t.home.expandAllCards}
                  >
                    <Maximize2 size={15} />
                    <span>{t.home.expandAllCards}</span>
                  </button>

                  {/* Edit / Add Cards Button */}
                  {currentUser && (
                    (currentUser.id === pack.authorId || currentUser.role === 'Admin') ? (
                      <button
                        onClick={() => {
                          setEditingPack(pack);
                          navigate('/CreateCardsPack');
                        }}
                        className="px-3.5 py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.85)] flex items-center gap-1.5 text-xs font-['Mali']"
                        title={language === 'th' ? 'แก้ไขหรือเพิ่มการ์ดในชุดนี้' : 'Edit or add cards to this pack'}
                      >
                        <Edit2 size={14} />
                        <span>{language === 'th' ? 'แก้ไข / เพิ่มการ์ด' : 'Edit / Add Cards'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPack(pack);
                          navigate('/CreateCardsPack');
                        }}
                        className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.85)] flex items-center gap-1.5 text-xs font-['Mali']"
                        title={language === 'th' ? 'ร่วมเพิ่มการ์ดใหม่เข้าชุดนี้ (การ์ดเดิมของผู้สร้างจะไม่สูญหาย)' : 'Contribute new cards to this pack (author existing cards are preserved)'}
                      >
                        <Plus size={14} />
                        <span>{language === 'th' ? 'ร่วมเพิ่มการ์ด' : 'Contribute Cards'}</span>
                      </button>
                    )
                  )}

                  {/* Report Inappropriate Pack Button (Author cannot report own pack) */}
                  {(!currentUser || currentUser.id !== pack.authorId) && (
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          addToast(
                            language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนส่งรายงาน' : 'Please login before reporting',
                            'warning'
                          );
                          navigate('/Login');
                          return;
                        }
                        setReportTarget({
                          packId: pack.id,
                          packName: pack.seriesName,
                          franchiseName: pack.franchiseName,
                        });
                        setReportCategory('franchise_name');
                      }}
                      className="p-2.5 bg-zinc-100 hover:bg-red-100 dark:bg-zinc-700 dark:hover:bg-red-950/40 text-zinc-600 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.85)] flex items-center gap-1.5 text-xs"
                      title={language === 'th' ? 'รายงานความไม่เหมาะสม' : 'Report Inappropriate Content'}
                    >
                      <Flag size={14} />
                      <span className="hidden sm:inline">{language === 'th' ? 'รายงาน' : 'Report'}</span>
                    </button>
                  )}

                  {/* Open Pack Button - Requirement 11: Require login */}
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        addToast(
                          language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนเปิดซอง' : 'Please login to open pack',
                          'warning'
                        );
                        navigate('/Login');
                        return;
                      }
                      onOpenPack(pack);
                    }}
                    className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 text-sm font-['Mali']"
                  >
                    <Sparkles size={16} />
                    <span>{t.home.openThisPack.replace('{price}', String(pack.price))}</span>
                  </button>
                </div>
              </div>

              {/* Cards Carousel Section (Item 4: มีการเคลื่อนของการ์ด) */}
              <div className="relative">
                {/* Navigation Arrows & Counter */}
                <div className="flex items-center justify-between mb-3 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  <span>
                    {t.home.showingCards
                      .replace('{start}', String(Math.min(currentOffset + 1, totalCards)))
                      .replace('{end}', String(Math.min(currentOffset + 4, totalCards)))
                      .replace('{total}', String(totalCards))}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSlide(pack.id, totalCards, 'prev')}
                      disabled={!canPrev}
                      className={`p-1.5 rounded-lg border-2 border-black dark:border-white sketch-btn transition-opacity ${
                        canPrev
                          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-100'
                          : 'opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800'
                      }`}
                      title={t.home.prevCards}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => handleSlide(pack.id, totalCards, 'next')}
                      disabled={!canNext}
                      className={`p-1.5 rounded-lg border-2 border-black dark:border-white sketch-btn transition-opacity ${
                        canNext
                          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-100'
                          : 'opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800'
                      }`}
                      title={t.home.nextCards}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Cards Row (Item 3: คลิกที่การ์ดเพื่อดูข้อมูล ไม่ใช่เปิดสุ่ม) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 transition-all duration-300">
                  {visibleCards.map((card) => {
                    const countOwned = currentUser?.inventory?.[card.id] || 0;

                    return (
                      <div
                        key={card.id}
                        className="group flex flex-col items-center cursor-pointer"
                        onClick={() => setInspectedCard(card)}
                      >
                        {/* Box with X icon placeholder style matching user's sketch */}
                        <div className="w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-700/60 border-2 border-black dark:border-white rounded-2xl overflow-hidden relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.85)] group-hover:-translate-y-1.5 transition-transform flex items-center justify-center p-1">
                          {/* Rarity */}
                          <span
                            className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-black rounded border border-black shadow-sm"
                            style={{
                              backgroundColor:
                                pack.rarities?.find((r) => r.name === card.rarity)?.color || '#facc15',
                              color: '#000',
                            }}
                          >
                            {card.rarity}
                          </span>

                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt={card.name}
                              className="max-h-full max-w-full w-auto h-auto object-contain group-hover:scale-105 transition-transform duration-300 rounded-xl"
                            />
                          ) : (
                            // Exact wireframe X box wireframe style!
                            <div className="w-full h-full relative flex items-center justify-center">
                              <svg className="w-full h-full stroke-black dark:stroke-white stroke-2 opacity-40">
                                <line x1="0" y1="0" x2="100%" y2="100%" />
                                <line x1="100%" y1="0" x2="0" y2="100%" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Card Info matching sketch */}
                        <div className="mt-2.5 text-center w-full">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {getCardDisplayName(card.name) || t.home.unnamedCard}
                          </p>
                          <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {t.home.ownedCount.replace('{count}', String(countOwned))}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty slots if visibleCards < 4 */}
                  {visibleCards.length < 4 &&
                    Array.from({ length: 4 - visibleCards.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="flex flex-col items-center opacity-30">
                        <div className="w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-400 rounded-2xl relative flex items-center justify-center">
                          <svg className="w-full h-full stroke-zinc-400 stroke-1">
                            <line x1="0" y1="0" x2="100%" y2="100%" />
                            <line x1="100%" y1="0" x2="0" y2="100%" />
                          </svg>
                        </div>
                        <div className="mt-2 text-center text-xs text-zinc-400">
                          {t.common.empty}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}

        {filteredPacks.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-zinc-800 border-2 border-dashed border-zinc-400 rounded-3xl p-8">
            <p className="text-lg font-bold text-zinc-500 mb-2">
              {searchQuery.trim()
                ? t.home.searchNotFound.replace('{query}', searchQuery)
                : t.home.noPacks}
            </p>
            <p className="text-xs text-zinc-400">
              {searchQuery.trim()
                ? t.home.searchNotFoundDesc
                : t.home.noPacksDesc}
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: CARD DETAIL INSPECTION (Item 3: คลิกดูข้อมูลการ์ด) */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-['Prompt']"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectedCard(null);
            }
          }}
        >
          <div
            className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl max-w-2xl w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] flex flex-col md:flex-row gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setInspectedCard(null)}
              className="absolute top-4 right-4 p-1 rounded-full border-2 border-black dark:border-white bg-red-100 hover:bg-red-200 text-red-600 dark:text-red-400 sketch-btn"
              title={t.common.close}
            >
              <X size={18} />
            </button>

            {/* Card Visual Column */}
            <div className="flex flex-col items-center md:w-1/2">
              <div className="w-52 h-72 sm:w-60 sm:h-84 bg-white dark:bg-zinc-900 border-3 border-black dark:border-white rounded-2xl overflow-hidden shadow-lg relative flex flex-col">
                {(() => {
                  const cardPack = packs.find(p => p.cards.some(c => c.id === inspectedCard.id));
                  const rarityConfig = cardPack?.rarities?.find(r => r.name === inspectedCard.rarity);
                  const badgeColor = rarityConfig?.color || (inspectedCard.rarity === 'RR' ? '#f59e0b' : inspectedCard.rarity === 'R' ? '#38bdf8' : '#e2e8f0');

                  return (
                    <div
                      className="absolute top-2 left-2 z-10 px-2.5 py-0.5 text-xs font-black rounded border border-black shadow-sm"
                      style={{
                        backgroundColor: badgeColor,
                        color: '#000',
                      }}
                    >
                      {inspectedCard.rarity}
                    </div>
                  );
                })()}

                <div
                  onClick={() => {
                    if (inspectedCard.imageUrl) {
                      setLightboxImage({
                        url: inspectedCard.imageUrl,
                        title: getCardDisplayName(inspectedCard.name) || inspectedCard.name || '',
                      });
                    }
                  }}
                  className={`flex-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative group flex items-center justify-center p-2 ${
                    inspectedCard.imageUrl ? 'cursor-zoom-in' : ''
                  }`}
                >
                  {inspectedCard.imageUrl ? (
                    <img
                      src={inspectedCard.imageUrl}
                      alt={inspectedCard.name}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className="max-h-full max-w-full w-auto h-auto object-contain rounded-lg select-none pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-center">
                      <svg className="w-full h-full stroke-black dark:stroke-white stroke-2 opacity-30">
                        <line x1="0" y1="0" x2="100%" y2="100%" />
                        <line x1="100%" y1="0" x2="0" y2="100%" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-2.5 border-t-2 border-black dark:border-zinc-700 text-center bg-white dark:bg-zinc-800">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                    {getCardDisplayName(inspectedCard.name) || t.home.unnamedCard}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {t.home.ownedStatus.replace('{count}', String(currentUser?.inventory?.[inspectedCard.id] || 0))}
              </p>
            </div>

            {/* Card Information Column */}
            <div className="flex-1 flex flex-col justify-start space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.home.cardNameLabel}
                </label>
                <div className="text-lg font-black text-zinc-900 dark:text-white border-b-2 border-zinc-300 dark:border-zinc-700 pb-1">
                  {getCardDisplayName(inspectedCard.name) || t.home.unnamedCard}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.home.rarityLabel}
                </label>
                <div className="mt-1">
                  <span className="px-3 py-1 text-xs font-black rounded-lg border border-black bg-yellow-300 text-black shadow-sm inline-block">
                    {inspectedCard.rarity}
                  </span>
                </div>
              </div>

              {inspectedCard.description && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t.home.abilityLabel}
                  </label>
                  <div className="mt-1 p-3 bg-zinc-100 dark:bg-zinc-700/60 rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                    {inspectedCard.description}
                  </div>
                </div>
              )}

              {/* Custom Fields */}
              {inspectedCard.fields &&
                inspectedCard.fields.filter(
                  (f) => f.name !== 'ชื่อการ์ด' && f.name !== 'Card Name' && f.name !== 'ความสามารถการ์ด' && f.name !== 'Card Ability'
                ).length > 0 && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t.home.attributesLabel}
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {inspectedCard.fields
                        .filter(
                          (f) => f.name !== 'ชื่อการ์ด' && f.name !== 'Card Name' && f.name !== 'ความสามารถการ์ด' && f.name !== 'Card Ability'
                        )
                        .map((field) => (
                          <div
                            key={field.id}
                            className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                          >
                            <span className="font-bold text-zinc-600 dark:text-zinc-400">
                              {field.name}:{' '}
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                              {field.value}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Report Card Button */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
                <button
                  onClick={() => {
                    if (!currentUser) {
                      addToast(t.home.reportModal.loginRequired, 'warning');
                      return;
                    }
                    const associatedPack = packs.find((p) => p.cards.some((c) => c.id === inspectedCard.id));
                    setReportTarget({
                      packId: associatedPack?.id || '',
                      packName: associatedPack?.seriesName || '',
                      franchiseName: associatedPack?.franchiseName || '',
                      cardId: inspectedCard.id,
                      cardName: inspectedCard.name,
                    });
                    setReportCategory('card_image');
                    setReportDetails('');
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold border border-red-300 dark:border-red-700 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Flag size={13} />
                  <span>{language === 'th' ? 'รายงานการ์ดนี้' : 'Report Card'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EXPAND ALL CARDS IN PACK */}
      {expandedPack && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-['Prompt'] ${
            inspectedCard ? 'hidden' : ''
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setExpandedPack(null);
            }
          }}
        >
          <div
            className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black dark:border-white pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold font-['Mali'] text-zinc-900 dark:text-white flex items-center gap-2">
                  <Layers size={20} />
                  <span>{t.home.expandPackTitle.replace('{franchise}', expandedPack.franchiseName)}</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {t.home.expandPackSubtitle
                    .replace('{series}', expandedPack.seriesName)
                    .replace('{total}', String(expandedPack.cards.length))}
                </p>
              </div>

              <button
                onClick={() => setExpandedPack(null)}
                className="p-1 rounded-full border-2 border-black dark:border-white bg-red-100 hover:bg-red-200 text-red-600 dark:text-red-400 sketch-btn"
                title={t.common.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Rarity Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2">
              <button
                onClick={() => setSelectedRarityFilter('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
                  selectedRarityFilter === 'ALL'
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                {t.home.allFilter.replace('{total}', String(expandedPack.cards.length))}
              </button>
              {expandedPack.rarities.map((r) => {
                const countInRarity = expandedPack.cards.filter(
                  (c) => c.rarity === r.name
                ).length;
                const isSelected = selectedRarityFilter === r.name;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRarityFilter(r.name)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
                      isSelected
                        ? 'shadow-sm text-black'
                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                    }`}
                    style={isSelected ? { backgroundColor: r.color || '#facc15' } : {}}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black shrink-0"
                      style={{ backgroundColor: r.color || '#94a3b8' }}
                    />
                    <span>{r.name} ({countInRarity})</span>
                  </button>
                );
              })}
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortCardsByRarityOrder(expandedPack.cards || [], expandedPack.rarities || [])
                  .filter((card) =>
                    selectedRarityFilter === 'ALL'
                      ? true
                      : card.rarity === selectedRarityFilter
                  )
                  .map((card) => {
                    const countOwned = currentUser?.inventory?.[card.id] || 0;

                    return (
                      <div
                        key={card.id}
                        className="group flex flex-col items-center cursor-pointer"
                        onClick={() => setInspectedCard(card)}
                      >
                        <div className="w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-700/60 border-2 border-black dark:border-white rounded-xl overflow-hidden relative shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)] group-hover:-translate-y-1 transition-transform flex items-center justify-center p-1">
                          <span
                            className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 text-[10px] font-black rounded border border-black shadow-sm"
                            style={{
                              backgroundColor:
                                expandedPack.rarities?.find((r) => r.name === card.rarity)?.color || '#facc15',
                              color: '#000',
                            }}
                          >
                            {card.rarity}
                          </span>

                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt={card.name}
                              className="max-h-full max-w-full w-auto h-auto object-contain group-hover:scale-105 transition-transform duration-200 rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-full relative flex items-center justify-center">
                              <svg className="w-full h-full stroke-black dark:stroke-white stroke-2 opacity-30">
                                <line x1="0" y1="0" x2="100%" y2="100%" />
                                <line x1="100%" y1="0" x2="0" y2="100%" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 text-center w-full">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {getCardDisplayName(card.name) || t.home.unnamedCard}
                          </p>
                          <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {t.home.ownedCount.replace('{count}', String(countOwned))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {reportTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-['Prompt']"
          onClick={() => {
            if (!isSubmittingReport) setReportTarget(null);
          }}
        >
          <div
            className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black dark:border-white pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl border-2 border-black dark:border-white">
                  <Flag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-['Mali'] text-zinc-900 dark:text-white">
                    {t.home.reportModal.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {reportTarget.franchiseName} - {reportTarget.packName}
                    {reportTarget.cardName ? ` (${reportTarget.cardName})` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReportTarget(null)}
                disabled={isSubmittingReport}
                className="p-1 rounded-full border-2 border-black dark:border-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 sketch-btn"
                title={t.common.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Target info */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
              <span className="font-bold text-zinc-500 dark:text-zinc-400 block">
                {t.home.reportModal.targetLabel}:
              </span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {reportTarget.cardName ? (
                  <span>
                    {language === 'th' ? 'การ์ด: ' : 'Card: '}
                    <span className="text-red-600 dark:text-red-400">{reportTarget.cardName}</span>
                    {' '}({reportTarget.packName})
                  </span>
                ) : (
                  <span>
                    {language === 'th' ? 'ซองการ์ด: ' : 'Pack: '}
                    <span className="text-red-600 dark:text-red-400">{reportTarget.packName}</span>
                    {' '}({reportTarget.franchiseName})
                  </span>
                )}
              </p>
            </div>

            {/* Neo-Brutalist Category Dropdown (Item 4) */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {t.home.reportModal.categoryLabel}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl text-sm font-bold text-zinc-900 dark:text-white flex items-center justify-between shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.85)] sketch-btn"
                >
                  <span>{t.home.reportModal.categories[reportCategory] || reportCategory}</span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.85)] space-y-1 max-h-56 overflow-y-auto">
                    {[
                      { key: 'franchise_name', label: t.home.reportModal.categories.franchise_name },
                      { key: 'pack_name', label: t.home.reportModal.categories.pack_name },
                      { key: 'tag', label: t.home.reportModal.categories.tag },
                      { key: 'card_image', label: t.home.reportModal.categories.card_image },
                      { key: 'card_details', label: t.home.reportModal.categories.card_details },
                      { key: 'other', label: t.home.reportModal.categories.other },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setReportCategory(item.key as ReportCategory);
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between ${
                          reportCategory === item.key
                            ? 'bg-red-500 text-white'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        <span>{item.label}</span>
                        {reportCategory === item.key && <span className="text-[10px] uppercase font-black">SELECTED</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Details Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {t.home.reportModal.detailsLabel}
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder={t.home.reportModal.detailsPlaceholder}
                rows={3}
                className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-red-400 resize-none font-['Prompt']"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReportTarget(null);
                  setIsCategoryDropdownOpen(false);
                }}
                disabled={isSubmittingReport}
                className="px-4 py-2 border-2 border-black dark:border-white rounded-xl font-bold text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 sketch-btn"
              >
                {t.home.reportModal.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="px-5 py-2 border-2 border-black dark:border-white rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.85)] flex items-center gap-1.5 disabled:opacity-50"
              >
                <Flag size={14} />
                <span>
                  {isSubmittingReport
                    ? (language === 'th' ? 'กำลังส่ง...' : 'Submitting...')
                    : t.home.reportModal.submitBtn}
                </span>
              </button>
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
