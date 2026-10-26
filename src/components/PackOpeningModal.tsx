import React, { useState, useRef, useEffect } from 'react';
import { CardItem, CardRarity, PackSeries } from '../types';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';
import { sound } from '../utils/sound';
import confetti from 'canvas-confetti';
import { X, RefreshCw, ArrowLeft, Scissors, Sparkles, Maximize2, ZoomIn, ZoomOut, Film } from 'lucide-react';
import { ModernImageLightbox } from './ModernImageLightbox';
import { getCardDisplayName, sortCardsByRarityOrder } from '../utils/cardName';

interface PackOpeningModalProps {
  pack: PackSeries;
  isTestMode?: boolean;
  onClose: () => void;
}

export const PackOpeningModal: React.FC<PackOpeningModalProps> = ({
  pack,
  isTestMode = false,
  onClose,
}) => {
  const {
    currentUser,
    spendCoins,
    addCardsToInventory,
    language,
    addToast,
    navigate,
  } = useGacha();

  const t = getTranslation(language);

  const [stage, setStage] = useState<'ready' | 'tearing' | 'opening' | 'revealed'>('ready');
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [drawnCards, setDrawnCards] = useState<CardItem[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);

  // Requirement 2: 10s cooldown guard for outside click after pack cards are revealed
  const [backdropLockRemaining, setBackdropLockRemaining] = useState<number>(0);

  // Requirement 3: Skip animation preference per pack
  const [skipAnimation, setSkipAnimation] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`mygacha_anim_skip_${pack.id}`) === 'true';
    } catch {
      return false;
    }
  });
  const [showAnimationPrompt, setShowAnimationPrompt] = useState<boolean>(false);

  useEffect(() => {
    if (stage === 'revealed') {
      setBackdropLockRemaining(10);
      const timer = setInterval(() => {
        setBackdropLockRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setBackdropLockRemaining(0);
    }
  }, [stage]);

  // Natural image ratio and Lightbox state
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const [isCoverLightboxOpen, setIsCoverLightboxOpen] = useState(false);

  const tearBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pack.coverImageUrl) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setNaturalRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = pack.coverImageUrl;
    }
  }, [pack.coverImageUrl]);

  // Drop Rate calculation using Cubic Pyramid weighting based on rarity list order (Top = Rarest, Bottom = Most Common)
  const rollCards = (): CardItem[] => {
    const results: CardItem[] = [];
    const count = pack.cardsPerPack || 5;

    const allRarities: CardRarity[] = pack.rarities && pack.rarities.length > 0
      ? pack.rarities
      : [{ id: 'c', name: 'C', color: '#94a3b8', cardCount: 0, hasConfetti: false }];

    // Filter to rarities that actually have cards attached in this pack
    const validRarities = allRarities.filter(r =>
      pack.cards.some(c => c.rarity?.trim().toLowerCase() === r.name?.trim().toLowerCase())
    );
    const activeRarities = validRarities.length > 0 ? validRarities : allRarities;

    // Helper to resolve effective ladder depth, honoring equalRateWith
    const getEffectiveDepth = (r: (typeof activeRarities)[0], visited = new Set<string>()): number => {
      const selfIndex = activeRarities.findIndex(ar => ar.id === r.id || ar.name === r.name);
      if (!r.equalRateWith || visited.has(r.id || r.name)) {
        return selfIndex >= 0 ? selfIndex : 0;
      }
      visited.add(r.id || r.name);
      const target = activeRarities.find(
        ar => (ar.id && ar.id === r.equalRateWith) || ar.name?.trim().toLowerCase() === r.equalRateWith?.trim().toLowerCase()
      );
      if (target) {
        return getEffectiveDepth(target, visited);
      }
      return selfIndex >= 0 ? selfIndex : 0;
    };

    // Physical TCG Booster Collation:
    // Determine high-tier rarities (Foil Hits):
    // 1. Any rarity with hasConfetti === true
    // 2. In packs with 3+ rarities, top 35-40% (at least Rank 1) are high-tier hits
    const isHighTier = (idx: number, r: (typeof activeRarities)[0]) => {
      if (Boolean(r.hasConfetti)) return true;
      if (activeRarities.length <= 2) return false;
      const effectiveDepth = getEffectiveDepth(r);
      const highTierCount = Math.max(1, Math.floor(activeRarities.length * 0.4));
      return effectiveDepth < highTierCount;
    };

    let highTierHitDrawn = false;
    const drawnCardKeys = new Set<string>();

    for (let i = 0; i < count; i++) {
      // Single High-Tier Hit Quota per Pack:
      // Once a high-tier hit is drawn in this 5-card pack, subsequent slots
      // must roll from middle and base tiers, matching real-life physical TCG packs.
      const availableRarities = (highTierHitDrawn && activeRarities.length > 1)
        ? activeRarities.filter((r, idx) => !isHighTier(idx, r))
        : activeRarities;

      const currentPool = availableRarities.length > 0 ? availableRarities : activeRarities;

      // Base weights with steep pyramid (power of 4) for realistic TCG distribution (85-90% base pool)
      const weights = currentPool.map((r) => {
        const depth = getEffectiveDepth(r);
        return {
          rarityName: r.name,
          weight: Math.pow(depth + 1, 4),
        };
      });

      const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
      const roll = Math.random() * totalWeight;
      let cumulative = 0;
      let chosenRarity = currentPool[currentPool.length - 1].name;

      for (const item of weights) {
        cumulative += item.weight;
        if (roll <= cumulative) {
          chosenRarity = item.rarityName;
          break;
        }
      }

      // If this roll landed on a high-tier foil, flag it so no further high-tier hits occur in this pack
      const chosenIdx = activeRarities.findIndex(ar => ar.name === chosenRarity);
      const chosenObj = activeRarities[chosenIdx];
      if (chosenObj && isHighTier(chosenIdx, chosenObj)) {
        highTierHitDrawn = true;
      }

      const pool = pack.cards.filter(c => c.rarity?.trim().toLowerCase() === chosenRarity.trim().toLowerCase());
      if (pool.length > 0) {
        // Group cards by clean display name so duplicate copies NEVER stack drop rate!
        // Every unique card in this rarity has an equal probability.
        const uniqueCardMap = new Map<string, CardItem[]>();
        pool.forEach(c => {
          const key = getCardDisplayName(c.name).toLowerCase() || c.id;
          if (!uniqueCardMap.has(key)) uniqueCardMap.set(key, []);
          uniqueCardMap.get(key)!.push(c);
        });

        const uniqueKeys = Array.from(uniqueCardMap.keys());
        // Avoid duplicate identical cards in the same pack if enough variety exists
        const unpickedKeys = uniqueKeys.filter(k => !drawnCardKeys.has(k));
        const candidateKeys = unpickedKeys.length > 0 ? unpickedKeys : uniqueKeys;
        const chosenKey = candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
        drawnCardKeys.add(chosenKey);

        const matchingCards = uniqueCardMap.get(chosenKey)!;
        const picked = matchingCards[0];

        // TCG Foil Upgrade Probability:
        // Foil cards are extremely rare collector items (harder to pull than the hardest rarity):
        // - No guaranteed handouts or pack guarantees.
        // - High-tier / confetti card: ~2.5% chance to roll as Foil
        // - Standard / middle tier card: ~0.6% chance to roll as Parallel Foil
        // Overall foil rate is ~0.8% - 1.0% per card drawn.
        const isHighHit = isHighTier(chosenIdx, chosenObj || {});
        const isFoil = isHighHit ? (Math.random() < 0.025) : (Math.random() < 0.006);

        results.push({
          ...picked,
          isFoil,
        });
      } else if (pack.cards.length > 0) {
        const uniqueAllMap = new Map<string, CardItem[]>();
        pack.cards.forEach(c => {
          const key = getCardDisplayName(c.name).toLowerCase() || c.id;
          if (!uniqueAllMap.has(key)) uniqueAllMap.set(key, []);
          uniqueAllMap.get(key)!.push(c);
        });
        const allKeys = Array.from(uniqueAllMap.keys());
        const unpickedAllKeys = allKeys.filter(k => !drawnCardKeys.has(k));
        const candidateAllKeys = unpickedAllKeys.length > 0 ? unpickedAllKeys : allKeys;
        const chosenKey = candidateAllKeys[Math.floor(Math.random() * candidateAllKeys.length)];
        drawnCardKeys.add(chosenKey);

        const matchingCards = uniqueAllMap.get(chosenKey)!;
        const picked = matchingCards[0];
        const isFoil = Math.random() < 0.008;
        results.push({
          ...picked,
          isFoil,
        });
      }
    }

    return results;
  };

  const startOpeningSequence = () => {
    if (!isTestMode) {
      const price = pack.price || 500;
      const success = spendCoins(price);
      if (!success) {
        onClose();
        return;
      }
    }

    sound.playTearSound();
    setStage('tearing');

    const pulled = sortCardsByRarityOrder(rollCards(), pack.rarities || []);
    setDrawnCards(pulled);

    setTimeout(() => {
      sound.playSlideSound();
      setStage('revealed');
      if (!isTestMode) {
        addCardsToInventory(pack.id, pulled);
      }
      const hasRare = pulled.some(c => {
        const rarityObj = pack.rarities?.find(r => r.name === c.rarity);
        return Boolean(rarityObj?.hasConfetti);
      });
      const hasFoil = pulled.some(c => c.isFoil);

      if (hasRare || hasFoil) {
        sound.playRareFanfare();
        confetti({
          particleCount: hasFoil ? 90 : 70,
          spread: 80,
          origin: { y: 0.6 },
          colors: hasFoil
            ? ['#ffd700', '#ff69b4', '#00ffff', '#a855f7', '#ffffff']
            : undefined,
        });
      }
    }, 500);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (stage !== 'ready') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateDrag(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      updateDrag(e.clientX, e.clientY);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      setDragProgress((prev) => {
        if (prev >= 65) {
          startOpeningSequence();
          return 100;
        }
        return 0;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging]);

  const updateDrag = (clientX: number, clientY: number) => {
    if (!tearBarRef.current) return;
    const rect = tearBarRef.current.getBoundingClientRect();
    const isCustom =
      pack.tearConfig?.direction === 'custom' &&
      pack.tearConfig.customStart &&
      pack.tearConfig.customEnd;

    let progress = 0;
    if (isCustom) {
      const p1 = pack.tearConfig!.customStart!;
      const p2 = pack.tearConfig!.customEnd!;
      const p1x = (p1.x / 100) * rect.width;
      const p1y = (p1.y / 100) * rect.height;
      const p2x = (p2.x / 100) * rect.width;
      const p2y = (p2.y / 100) * rect.height;
      const dx = p2x - p1x;
      const dy = p2y - p1y;
      const lenSq = dx * dx + dy * dy;
      const curX = clientX - rect.left;
      const curY = clientY - rect.top;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((curX - p1x) * dx + (curY - p1y) * dy) / lenSq)) : 0;
      progress = t * 100;
    } else {
      const isVertical = pack.tearConfig?.direction === 'left' || pack.tearConfig?.direction === 'right';
      progress = isVertical
        ? Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100))
        : Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    }

    setDragProgress(progress);
    if (progress >= 65) {
      setIsDragging(false);
      setDragProgress(100);
      startOpeningSequence();
    }
  };

  const handleCardClick = (card: CardItem) => {
    sound.playCardClick();
    setSelectedCard(card);
  };

  const executeDrawAgain = (skip: boolean) => {
    if (skip) {
      if (!isTestMode) {
        const price = pack.price || 500;
        const success = spendCoins(price);
        if (!success) {
          onClose();
          return;
        }
      }

      sound.playTearSound();
      sound.playSlideSound();

      const pulled = sortCardsByRarityOrder(rollCards(), pack.rarities || []);
      setDrawnCards(pulled);
      setSelectedCard(null);
      setStage('revealed');
      setBackdropLockRemaining(10);

      if (!isTestMode) {
        addCardsToInventory(pack.id, pulled);
      }

      const hasRare = pulled.some(c => {
        const rarityObj = pack.rarities?.find(r => r.name === c.rarity);
        return Boolean(rarityObj?.hasConfetti);
      });
      const hasFoil = pulled.some(c => c.isFoil);

      if (hasRare || hasFoil) {
        sound.playRareFanfare();
        confetti({
          particleCount: hasFoil ? 90 : 70,
          spread: 80,
          origin: { y: 0.6 },
          colors: hasFoil
            ? ['#ffd700', '#ff69b4', '#00ffff', '#a855f7', '#ffffff']
            : undefined,
        });
      }
    } else {
      setStage('ready');
      setDragProgress(0);
      setDrawnCards([]);
      setSelectedCard(null);
    }
  };

  const handleResetOpenAgain = () => {
    if (!isTestMode) {
      const price = pack.price || 500;
      if (currentUser && currentUser.coins < price) {
        addToast(language === 'th' ? 'Coin ไม่เพียงพอ' : 'Not enough coins', 'error');
        return;
      }
    }

    // Requirement 3: Ask once per pack whether to disable animation
    let hasAsked = false;
    try {
      hasAsked = localStorage.getItem(`mygacha_anim_asked_${pack.id}`) === 'true';
    } catch {}

    if (!hasAsked) {
      setShowAnimationPrompt(true);
      return;
    }

    executeDrawAgain(skipAnimation);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (isDragging) return; // Requirement 12: Do not close when dragging
    if (e.target !== e.currentTarget) return;

    // Silent 10s protection against accidental dismiss
    if (stage === 'revealed' && backdropLockRemaining > 0) {
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 overflow-y-auto font-['Prompt']"
      onClick={handleBackdropClick}
    >
      {/* Top Header */}
      <div
        className="w-full bg-white dark:bg-zinc-900 border-b-2 border-black dark:border-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shadow-sm shrink-0 z-40 sticky top-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="p-1 rounded-lg border-2 border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-800 sketch-btn shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="text-xs sm:text-sm font-bold font-['Mali'] text-zinc-900 dark:text-white flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="truncate max-w-[100px] sm:max-w-[180px] md:max-w-none">{pack.franchiseName}</span>
            <span className="text-zinc-500 font-normal truncate max-w-[80px] sm:max-w-[140px] md:max-w-none">/ {pack.seriesName}</span>
            {isTestMode && (
              <span className="bg-yellow-300 text-black text-[9px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-lg border border-black uppercase shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] tracking-wide shrink-0">
                {language === 'th' ? 'ทดสอบ (ฟรี)' : 'TEST (FREE)'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {stage === 'revealed' && (
            <button
              onClick={handleResetOpenAgain}
              className="hidden sm:flex px-3 py-1 text-xs font-bold bg-yellow-400 text-black border-2 border-black rounded-lg sketch-btn items-center gap-1.5"
            >
              <RefreshCw size={14} />
              <span>
                {isTestMode
                  ? (language === 'th' ? 'ทดสอบเปิดอีกครั้ง (ฟรี)' : 'Test Open Again (Free)')
                  : (language === 'th' ? 'เปิดอีกครั้ง' : 'Open Again')}
              </span>
            </button>
          )}
          {/* Animation Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !skipAnimation;
              setSkipAnimation(next);
              try {
                localStorage.setItem(`mygacha_anim_skip_${pack.id}`, String(next));
                localStorage.setItem(`mygacha_anim_asked_${pack.id}`, 'true');
              } catch {}
              addToast(
                language === 'th'
                  ? (next ? 'ปิด Animation สำหรับแพ็คนี้แล้ว (เปิดการ์ดทันที)' : 'เปิด Animation สำหรับแพ็คนี้แล้ว')
                  : (next ? 'Animation disabled for this pack' : 'Animation enabled for this pack'),
                'info'
              );
            }}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg border border-black dark:border-white sketch-btn flex items-center gap-1 shrink-0 ${
              skipAnimation
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                : 'bg-amber-300 dark:bg-amber-400 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
            title={language === 'th' ? 'สลับเปิด/ปิด Animation สำหรับแพ็คนี้' : 'Toggle animation for this pack'}
          >
            <Film size={12} />
            <span className="hidden xs:inline">
              {skipAnimation
                ? (language === 'th' ? 'ปิด Animation' : 'Skip Anim')
                : (language === 'th' ? 'มี Animation' : 'With Anim')}
            </span>
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded-lg border-2 border-black dark:border-white hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 sketch-btn shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 w-full overflow-y-auto"
        onClick={handleBackdropClick}
      >
        {/* STAGE 1: PACK WITH DASHED LINE (Wireframe 8-1 & 9-1) */}
        {(stage === 'ready' || stage === 'tearing' || stage === 'opening') && (
          <div
            className="relative flex flex-col items-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Foil Pack Wrapper */}
            <div
              style={
                (pack.coverAspectRatio === 'auto' || !pack.coverAspectRatio) && naturalRatio
                  ? { aspectRatio: `${naturalRatio}` }
                  : undefined
              }
              className={`relative ${
                pack.coverAspectRatio === '1:1'
                  ? 'w-72 sm:w-80 aspect-square'
                  : pack.coverAspectRatio === '9:16'
                  ? 'w-60 sm:w-64 aspect-[9/16]'
                  : pack.coverAspectRatio === '3:4'
                  ? 'w-72 sm:w-80 aspect-[3/4]'
                  : naturalRatio && naturalRatio > 1.2
                  ? 'w-80 sm:w-96 max-w-full'
                  : 'w-64 h-96 sm:w-72 sm:h-[420px]'
              } rounded-2xl border-4 border-black dark:border-zinc-200 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-zinc-950`}
            >
              {pack.coverImageUrl && (
                <img
                  src={pack.coverImageUrl}
                  alt={pack.seriesName}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Floating Expand button on pack cover */}
              {pack.coverImageUrl && (
                <button
                  type="button"
                  onClick={() => setIsCoverLightboxOpen(true)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-yellow-400 text-white hover:text-black border border-white/40 flex items-center justify-center shadow z-40 transition-transform hover:scale-110"
                  title={language === 'th' ? 'ขยายดูภาพหน้าปกขนาดใหญ่' : 'Enlarge pack cover'}
                >
                  <Maximize2 size={13} />
                </button>
              )}

              <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none">
                <div className="text-center pt-2">
                  <h3 className="text-lg font-black text-white mt-1 drop-shadow-md">
                    {pack.franchiseName}
                  </h3>
                </div>

                <div className="text-center pb-2">
                  <p className="text-xs text-zinc-300 font-semibold">{pack.seriesName}</p>
                  <p className="text-[11px] text-amber-400 font-bold mt-1">
                    {pack.cardsPerPack} CARDS
                  </p>
                </div>
              </div>

              {/* Dashed Tear Line */}
              {stage === 'ready' && (
                (() => {
                  const dir = pack.tearConfig?.direction || 'up';

                  // Custom vector cut line
                  if (dir === 'custom' && pack.tearConfig?.customStart && pack.tearConfig.customEnd) {
                    const p1 = pack.tearConfig.customStart;
                    const p2 = pack.tearConfig.customEnd;
                    const curX = p1.x + (p2.x - p1.x) * (dragProgress / 100);
                    const curY = p1.y + (p2.y - p1.y) * (dragProgress / 100);
                    return (
                      <div
                        ref={tearBarRef}
                        onPointerDown={handlePointerDown}
                        className="absolute inset-0 z-30 touch-none group select-none cursor-grab active:cursor-grabbing"
                      >
                        <svg className="w-full h-full pointer-events-none">
                          <line
                            x1={`${p1.x}%`}
                            y1={`${p1.y}%`}
                            x2={`${p2.x}%`}
                            y2={`${p2.y}%`}
                            stroke="#facc15"
                            strokeWidth="4"
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                          />
                        </svg>
                        <div
                          style={{ left: `${curX}%`, top: `${curY}%` }}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center shadow-lg text-black hover:scale-110 transition-transform pointer-events-none"
                        >
                          <Scissors size={15} />
                        </div>
                      </div>
                    );
                  }

                  if (dir === 'left') {
                    return (
                      <div
                        ref={tearBarRef}
                        onPointerDown={handlePointerDown}
                        className="absolute top-0 bottom-0 left-[20%] w-12 -ml-6 flex items-center justify-center cursor-ns-resize touch-none z-30 group select-none"
                      >
                        <div className="h-full w-0 border-l-4 border-dashed border-yellow-300 dark:border-yellow-400 relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                          <div
                            className="absolute -left-3.5 transform -translate-y-1/2 w-8 h-8 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing text-black hover:scale-110 transition-transform"
                            style={{ top: `${Math.max(6, Math.min(94, dragProgress))}%` }}
                          >
                            <Scissors size={15} />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (dir === 'right') {
                    return (
                      <div
                        ref={tearBarRef}
                        onPointerDown={handlePointerDown}
                        className="absolute top-0 bottom-0 right-[20%] w-12 -mr-6 flex items-center justify-center cursor-ns-resize touch-none z-30 group select-none"
                      >
                        <div className="h-full w-0 border-r-4 border-dashed border-yellow-300 dark:border-yellow-400 relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                          <div
                            className="absolute -right-3.5 transform -translate-y-1/2 w-8 h-8 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing text-black hover:scale-110 transition-transform"
                            style={{ top: `${Math.max(6, Math.min(94, dragProgress))}%` }}
                          >
                            <Scissors size={15} />
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      ref={tearBarRef}
                      onPointerDown={handlePointerDown}
                      className={`absolute left-0 right-0 h-12 -mt-2 flex items-center cursor-ew-resize touch-none z-30 group select-none ${
                        dir === 'down' ? 'top-[78%]' : 'top-[22%]'
                      }`}
                    >
                      <div className="w-full h-0 border-t-4 border-dashed border-yellow-300 dark:border-yellow-400 relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        <div
                          className="absolute -top-3.5 transform -translate-x-1/2 w-8 h-8 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing text-black hover:scale-110 transition-transform"
                          style={{ left: `${Math.max(6, Math.min(94, dragProgress))}%` }}
                        >
                          <Scissors size={15} />
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Peeling Flap (Req 15) */}
              {(stage === 'tearing' || stage === 'opening') && (
                (() => {
                  const dir = pack.tearConfig?.direction || 'up';
                  let flapClass = 'absolute top-0 left-0 right-0 h-[22%] z-30 pointer-events-none origin-bottom-left transition-all duration-700 ease-out';
                  let transformClass = stage === 'tearing'
                    ? '-translate-y-8 -translate-x-3 rotate-[-16deg] opacity-95'
                    : '-translate-y-28 -translate-x-12 rotate-[-45deg] opacity-0 scale-90';

                  if (dir === 'down') {
                    flapClass = 'absolute bottom-0 left-0 right-0 h-[22%] z-30 pointer-events-none origin-top-left transition-all duration-700 ease-out';
                    transformClass = stage === 'tearing'
                      ? 'translate-y-8 -translate-x-3 rotate-[16deg] opacity-95'
                      : 'translate-y-28 -translate-x-12 rotate-[45deg] opacity-0 scale-90';
                  } else if (dir === 'left') {
                    flapClass = 'absolute top-0 bottom-0 left-0 w-[22%] z-30 pointer-events-none origin-top-right transition-all duration-700 ease-out';
                    transformClass = stage === 'tearing'
                      ? '-translate-x-8 -translate-y-3 rotate-[-16deg] opacity-95'
                      : '-translate-x-28 -translate-y-12 rotate-[-45deg] opacity-0 scale-90';
                  } else if (dir === 'right') {
                    flapClass = 'absolute top-0 bottom-0 right-0 w-[22%] z-30 pointer-events-none origin-top-left transition-all duration-700 ease-out';
                    transformClass = stage === 'tearing'
                      ? 'translate-x-8 -translate-y-3 rotate-[16deg] opacity-95'
                      : 'translate-x-28 -translate-y-12 rotate-[45deg] opacity-0 scale-90';
                  }

                  return (
                    <div className={`${flapClass} ${transformClass}`}>
                      <div className="w-full h-full rounded-2xl border-2 border-black dark:border-zinc-200 bg-gradient-to-br from-zinc-700 via-zinc-800 to-black overflow-hidden shadow-2xl relative">
                        {pack.coverImageUrl && (
                          <img
                            src={pack.coverImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/60 pointer-events-none" />
                        <div className="absolute bottom-0 inset-x-0 h-[1px] bg-white/40" />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* STAGE 2: CARDS REVEALED FACE-UP (Wireframe 8-2 frame 3, 9-2 frame 3) */}
        {stage === 'revealed' && (
          <div
            className="w-full max-w-7xl flex flex-col items-center my-auto py-2 sm:py-4 px-2"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
            <div
              className="w-full flex flex-wrap justify-center items-center gap-2 sm:gap-2.5 md:gap-3.5 lg:gap-5 py-2 sm:py-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  onClose();
                }
              }}
            >
              {drawnCards.map((card, idx) => {
                const sameCards = (pack.cards || []).filter(c =>
                  c.id === card.id ||
                  (c.rarity === card.rarity && getCardDisplayName(c.name).toLowerCase() === getCardDisplayName(card.name).toLowerCase())
                );
                const sameCardIds = new Set(sameCards.map(c => c.id));
                sameCardIds.add(card.id);

                let totalCount = 0;
                let foilCount = 0;
                sameCardIds.forEach(cId => {
                  totalCount += (currentUser?.inventory?.[cId] || 0);
                  foilCount += (currentUser?.inventory?.[`${cId}_foil`] || 0);
                });
                const normalCount = Math.max(0, totalCount - foilCount);
                const isSelected = selectedCard?.id === card.id;

                return (
                  <div
                    key={`${card.id}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(card);
                    }}
                    className={`group cursor-pointer flex flex-col items-center transition-all duration-200 transform hover:-translate-y-1.5 shrink-0 ${
                      isSelected ? 'ring-3 ring-black dark:ring-white rounded-xl scale-105' : ''
                    }`}
                  >
                    <div className={`relative w-28 sm:w-32 md:w-34 lg:w-44 xl:w-48 h-40 sm:h-46 md:h-50 lg:h-64 xl:h-72 bg-white dark:bg-zinc-800 border-2 sm:border-3 border-black dark:border-white rounded-xl overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)] flex flex-col ${
                      card.isFoil ? 'foil-card ring-2 ring-amber-300' : ''
                    }`}>
                      {/* Rarity Badge */}
                      <div className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5 z-20 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-xs font-black rounded border border-black shadow-xs"
                        style={{
                          background:
                            pack.rarities?.find(r => r.name === card.rarity)?.color ||
                            (card.rarity === 'RR' ? '#f59e0b' :
                             card.rarity === 'R' ? '#38bdf8' : '#e2e8f0'),
                          color: card.rarity === 'C' ? '#334155' : '#000',
                        }}
                      >
                        {card.rarity}
                      </div>

                      {/* Foil Badge */}
                      {card.isFoil && (
                        <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 z-20 px-1.5 py-0.5 text-[8px] sm:text-[10px] font-black rounded foil-badge flex items-center gap-0.5 tracking-wider animate-pulse">
                          <Sparkles size={10} className="text-yellow-950" />
                          <span>FOIL</span>
                        </div>
                      )}

                      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative flex items-center justify-center p-1">
                        {card.imageUrl && (
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="max-h-full max-w-full w-auto h-auto object-contain group-hover:scale-105 transition-transform duration-300 rounded"
                          />
                        )}
                      </div>

                      <div className="p-1 sm:p-2 border-t sm:border-t-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-800 relative z-20">
                        <p className="text-[10px] sm:text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {getCardDisplayName(card.name) || (language === 'th' ? 'ไม่มีชื่อการ์ด' : 'Unnamed Card')}
                        </p>
                      </div>
                    </div>

                    <div className={`mt-1 sm:mt-1.5 text-[9px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 rounded-full border ${
                      card.isFoil
                        ? 'bg-amber-300 text-black border-black font-black shadow-xs flex items-center gap-1'
                        : 'text-zinc-200 bg-black/60 border-zinc-700'
                    }`}>
                      {card.isFoil && <Sparkles size={11} className="text-yellow-800" />}
                      <span>
                        {card.isFoil
                          ? (language === 'th' ? `ฟอยล์โฮโลแกรม!` : `Holo Foil!`)
                          : (language === 'th' ? `ปกติ ${normalCount} ใบ` : `Normal x${normalCount}`)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 sm:mt-4 flex flex-wrap justify-center gap-2.5 sm:gap-3 px-3 pb-6" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleResetOpenAgain}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs sm:text-sm font-bold border-2 border-black rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 sm:gap-2 font-['Mali']"
              >
                <RefreshCw size={15} />
                <span>
                  {isTestMode
                    ? (language === 'th' ? 'ทดสอบเปิดอีกครั้ง (ฟรี)' : 'Test Open Again (Free)')
                    : (language === 'th' ? 'เปิดซองอีกครั้ง' : 'Open Another Pack')}
                </span>
              </button>
              <button
                onClick={onClose}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-900 dark:text-white text-xs sm:text-sm font-bold border-2 border-black dark:border-white rounded-xl sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.9)]"
              >
                {language === 'th' ? 'กลับหน้าหลัก' : 'Finish & Return'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INSPECTION DETAIL DRAWER ON CLICK (Wireframe 8-2 frame 4 & 9-2 frame 4) */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedCard(null);
            }
          }}
        >
          <div
            className="relative bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl max-w-2xl w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)] flex flex-col md:flex-row gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-3 right-3 p-1 rounded-full border-2 border-black dark:border-white bg-red-100 hover:bg-red-200 text-red-600 dark:text-red-400 sketch-btn"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center md:w-1/2">
              <div className={`w-52 h-72 sm:w-60 sm:h-84 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white rounded-xl overflow-hidden shadow-lg relative flex flex-col ${
                selectedCard.isFoil ? 'foil-card ring-2 ring-yellow-400' : ''
              }`}>
                <div className="absolute top-2 left-2 z-20 px-2.5 py-0.5 text-xs font-black rounded border border-black shadow-sm"
                  style={{
                    background:
                      pack.rarities?.find(r => r.name === selectedCard.rarity)?.color ||
                      (selectedCard.rarity === 'RR' ? '#f59e0b' :
                       selectedCard.rarity === 'R' ? '#38bdf8' : '#e2e8f0'),
                    color: selectedCard.rarity === 'C' ? '#334155' : '#000',
                  }}
                >
                  {selectedCard.rarity}
                </div>

                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative flex items-center justify-center p-2">
                  {selectedCard.imageUrl && (
                    <img
                      src={selectedCard.imageUrl}
                      alt={selectedCard.name}
                      className="max-h-full max-w-full w-auto h-auto object-contain rounded"
                    />
                  )}
                </div>

                <div className="p-2.5 border-t-2 border-black dark:border-zinc-700 text-center relative z-20 bg-white dark:bg-zinc-900">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">
                    {getCardDisplayName(selectedCard.name)}
                  </p>
                </div>
              </div>

              {(() => {
                const sameCards = (pack.cards || []).filter(c =>
                  c.id === selectedCard.id ||
                  (c.rarity === selectedCard.rarity && getCardDisplayName(c.name).toLowerCase() === getCardDisplayName(selectedCard.name).toLowerCase())
                );
                const sameCardIds = new Set(sameCards.map(c => c.id));
                sameCardIds.add(selectedCard.id);

                let totalCount = 0;
                let foilCount = 0;
                sameCardIds.forEach(cId => {
                  totalCount += (currentUser?.inventory?.[cId] || 0);
                  foilCount += (currentUser?.inventory?.[`${cId}_foil`] || 0);
                });
                const normalCount = Math.max(0, totalCount - foilCount);

                return (
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
                    {foilCount > 0 && normalCount > 0 ? (
                      <>
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700">
                          {language === 'th' ? `ปกติ ${normalCount} ใบ` : `Normal x${normalCount}`}
                        </span>
                        <span className="text-[11px] font-black text-black bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 px-2.5 py-0.5 rounded-full border border-black shadow-xs flex items-center gap-1">
                          <Sparkles size={11} className="text-yellow-900" />
                          <span>Foil x{foilCount}</span>
                        </span>
                      </>
                    ) : foilCount > 0 ? (
                      <span className="text-[11px] font-black text-black bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 px-2.5 py-0.5 rounded-full border border-black shadow-xs flex items-center gap-1">
                        <Sparkles size={11} className="text-yellow-900" />
                        <span>{language === 'th' ? `ฟอยล์ ${foilCount} ใบ` : `Foil x${foilCount}`}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700">
                        {language === 'th' ? `ปกติ ${normalCount} ใบ` : `Normal x${normalCount}`}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex-1 flex flex-col justify-start space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.home.cardNameLabel}
                </label>
                <div className="text-lg font-black text-zinc-900 dark:text-white border-b-2 border-zinc-300 dark:border-zinc-700 pb-1 flex items-center justify-between">
                  <span>{getCardDisplayName(selectedCard.name) || t.home.unnamedCard}</span>
                  {selectedCard.isFoil && (
                    <span className="text-[11px] font-black foil-badge px-2 py-0.5 rounded flex items-center gap-1">
                      <Sparkles size={12} />
                      <span>FOIL</span>
                    </span>
                  )}
                </div>
              </div>

              {selectedCard.description && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t.home.abilityLabel}
                  </label>
                  <div className="mt-1 p-3 bg-zinc-100 dark:bg-zinc-700/60 rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                    {selectedCard.description}
                  </div>
                </div>
              )}

              {selectedCard.fields && selectedCard.fields.filter(f => f.name !== 'ชื่อการ์ด' && f.name !== 'Card Name' && f.name !== 'ความสามารถการ์ด' && f.name !== 'Card Ability').length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t.home.attributesLabel}
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {selectedCard.fields
                      .filter(f => f.name !== 'ชื่อการ์ด' && f.name !== 'Card Name' && f.name !== 'ความสามารถการ์ด' && f.name !== 'Card Ability')
                      .map((field) => (
                      <div
                        key={field.id}
                        className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs"
                      >
                        <span className="font-bold text-zinc-600 dark:text-zinc-400">{field.name}: </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modern Pack Cover Lightbox (Wheel Zoom, Touch Pinch, Drag-to-Pan, Zero Scrollbars) */}
      <ModernImageLightbox
        isOpen={isCoverLightboxOpen && Boolean(pack.coverImageUrl)}
        imageUrl={pack.coverImageUrl}
        title={`${pack.franchiseName} - ${pack.seriesName}`}
        onClose={() => setIsCoverLightboxOpen(false)}
      />

      {/* Animation Prompt Modal (Ask Once Per Pack - Requirement 3) */}
      {showAnimationPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.85)] space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-300 dark:bg-amber-400 border-2 border-black flex items-center justify-center text-black shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Film size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Mali'] text-zinc-900 dark:text-white">
                  {language === 'th' ? 'อนิเมชันเปิดซอง' : 'Opening Animation'}
                </h3>
                <p className="text-[11px] text-zinc-500 font-bold truncate max-w-[200px]">
                  {pack.franchiseName} - {pack.seriesName}
                </p>
              </div>
            </div>

            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {language === 'th'
                ? 'ต้องการปิด Animation การเปิดซองสำหรับแพ็คนี้หรือไม่? เมื่อกดสุ่มอีกครั้งระบบจะแสดงการ์ดทันทีโดยไม่ต้องเลื่อนฉีกซอง'
                : 'Do you want to skip the opening animation for this pack? Cards will be revealed immediately when drawn.'}
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(`mygacha_anim_asked_${pack.id}`, 'true');
                    localStorage.setItem(`mygacha_anim_skip_${pack.id}`, 'false');
                  } catch {}
                  setSkipAnimation(false);
                  setShowAnimationPrompt(false);
                  executeDrawAgain(false);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl border-2 border-black dark:border-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                {language === 'th' ? 'เปิดตามปกติ' : 'Keep Animation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(`mygacha_anim_asked_${pack.id}`, 'true');
                    localStorage.setItem(`mygacha_anim_skip_${pack.id}`, 'true');
                  } catch {}
                  setSkipAnimation(true);
                  setShowAnimationPrompt(false);
                  executeDrawAgain(true);
                }}
                className="px-4 py-2 text-xs font-black rounded-xl border-2 border-black dark:border-white bg-amber-400 hover:bg-amber-300 text-black sketch-btn shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                {language === 'th' ? 'ปิด Animation' : 'Skip Animation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
