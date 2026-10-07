import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';
import {
  X,
  Upload,
  Image as ImageIcon,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Package,
} from 'lucide-react';
import { PackSeries } from '../types';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = 'choose-source' | 'gallery' | 'crop';

// Diameter of circular crop frame in pixels
const CIRCLE_DIAMETER = 220;

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, packs, updateUserAvatar, language, addToast } = useGacha();
  const t = getTranslation(language);

  const [step, setStep] = useState<ModalStep>('choose-source');
  const [selectedRawImage, setSelectedRawImage] = useState<string | null>(null);

  // Natural image dimensions
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Cropping transform
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Canvases for pixel-perfect live preview
  const largePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const miniPreviewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setStep('choose-source');
      setSelectedRawImage(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      loadedImageRef.current = null;
    }
  }, [isOpen]);

  // Base scale calculation: image must cover circle diameter at zoom = 1.0
  const baseScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return 1;
    return Math.max(
      CIRCLE_DIAMETER / naturalSize.width,
      CIRCLE_DIAMETER / naturalSize.height
    );
  }, [naturalSize]);

  // Current rendered dimensions of image in the crop viewport
  const renderedDimensions = useMemo(() => {
    const w = naturalSize.width * baseScale * zoom;
    const h = naturalSize.height * baseScale * zoom;
    return { width: w, height: h };
  }, [naturalSize, baseScale, zoom]);

  // Clamping helper: ensures the image NEVER reveals void/empty background inside the circle
  const clampPan = useCallback(
    (curPan: { x: number; y: number }, curZoom: number) => {
      if (!naturalSize.width || !naturalSize.height) return curPan;
      const w = naturalSize.width * baseScale * curZoom;
      const h = naturalSize.height * baseScale * curZoom;

      const maxPanX = Math.max(0, (w - CIRCLE_DIAMETER) / 2);
      const maxPanY = Math.max(0, (h - CIRCLE_DIAMETER) / 2);

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, curPan.x)),
        y: Math.min(maxPanY, Math.max(-maxPanY, curPan.y)),
      };
    },
    [naturalSize, baseScale]
  );

  // Load natural dimensions whenever an image is selected
  useEffect(() => {
    if (!selectedRawImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = selectedRawImage;
  }, [selectedRawImage]);

  // Render live pixel-perfect circle preview to canvases
  const updatePreviewCanvases = useCallback(() => {
    const img = loadedImageRef.current;
    if (!img || !naturalSize.width || !naturalSize.height) return;

    const canvases = [
      { canvas: largePreviewCanvasRef.current, size: 72 },
      { canvas: miniPreviewCanvasRef.current, size: 40 },
    ];

    const dispW = renderedDimensions.width;
    const dispH = renderedDimensions.height;

    canvases.forEach(({ canvas, size }) => {
      if (!canvas) return;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      // Clip canvas strictly to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Map crop viewport coordinates to preview canvas
      const scaleMultiplier = size / CIRCLE_DIAMETER;
      const drawX = ((CIRCLE_DIAMETER - dispW) / 2 + pan.x) * scaleMultiplier;
      const drawY = ((CIRCLE_DIAMETER - dispH) / 2 + pan.y) * scaleMultiplier;
      const drawW = dispW * scaleMultiplier;
      const drawH = dispH * scaleMultiplier;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    });
  }, [renderedDimensions, pan, naturalSize]);

  // Update preview whenever transform changes
  useEffect(() => {
    updatePreviewCanvases();
  }, [updatePreviewCanvases]);

  // ISSUE 3 FIX: Only show packs that the user has actually opened / owns cards from
  const openedPacks = useMemo(() => {
    return packs.filter((p) => {
      const ownedCardsCount = (p.cards || []).filter(
        (c) => (currentUser?.inventory?.[c.id] || 0) > 0
      ).length;
      return ownedCardsCount > 0;
    });
  }, [packs, currentUser]);

  // Group opened packs by Franchise
  const franchiseGroups = useMemo(() => {
    const groups: Record<string, PackSeries[]> = {};
    openedPacks.forEach((p) => {
      const fName = (p.franchiseName || '').trim() || (language === 'th' ? 'ทั่วไป' : 'General');
      if (!groups[fName]) groups[fName] = [];
      groups[fName].push(p);
    });
    return groups;
  }, [openedPacks, language]);

  if (!isOpen) return null;

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        addToast(language === 'th' ? 'กรุณาเลือกไฟล์รูปภาพ' : 'Please select an image file', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedRawImage(reader.result);
          setStep('crop');
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // ISSUE 1 FIX: Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => {
      const nextZoom = Math.min(3.5, Math.max(1.0, Math.round(prev * factor * 100) / 100));
      setPan((curPan) => clampPan(curPan, nextZoom));
      return nextZoom;
    });
  };

  // Drag handlers for mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const proposed = {
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    };
    setPan(clampPan(proposed, zoom));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // ISSUE 1 FIX: Touch handlers (1 finger = pan, 2 fingers = pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      initialPanRef.current = { ...pan };
      pinchStartDistRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      const proposed = {
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy,
      };
      setPan(clampPan(proposed, zoom));
    } else if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scaleFactor = dist / pinchStartDistRef.current;
      const nextZoom = Math.min(3.5, Math.max(1.0, Math.round(pinchStartZoomRef.current * scaleFactor * 100) / 100));
      setZoom(nextZoom);
      setPan((curPan) => clampPan(curPan, nextZoom));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    pinchStartDistRef.current = null;
  };

  // Confirm crop and save
  const handleConfirmCrop = async () => {
    if (!selectedRawImage) return;

    try {
      const outputSize = 400; // High-res avatar output
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        updateUserAvatar(selectedRawImage);
        onClose();
        return;
      }

      const img = loadedImageRef.current || new Image();
      if (!loadedImageRef.current) {
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image failed to load'));
          img.src = selectedRawImage;
        });
      }

      const dispW = renderedDimensions.width;
      const dispH = renderedDimensions.height;

      const scaleMultiplier = outputSize / CIRCLE_DIAMETER;
      const drawX = ((CIRCLE_DIAMETER - dispW) / 2 + pan.x) * scaleMultiplier;
      const drawY = ((CIRCLE_DIAMETER - dispH) / 2 + pan.y) * scaleMultiplier;
      const drawW = dispW * scaleMultiplier;
      const drawH = dispH * scaleMultiplier;

      // Clear & clip to circular avatar
      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      const croppedUrl = canvas.toDataURL('image/png', 0.95);
      updateUserAvatar(croppedUrl);
      onClose();
    } catch (err) {
      console.warn('Canvas crop export fallback:', err);
      updateUserAvatar(selectedRawImage);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-zinc-800 border-3 border-black dark:border-white rounded-3xl shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] dark:shadow-[7px_7px_0px_0px_rgba(255,255,255,0.85)] max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b-2 border-black dark:border-white bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            {step !== 'choose-source' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'crop' && selectedRawImage && !selectedRawImage.startsWith('data:')) {
                    setStep('gallery');
                  } else {
                    setStep('choose-source');
                  }
                }}
                className="p-1.5 rounded-lg border-2 border-black dark:border-white hover:bg-zinc-200 dark:hover:bg-zinc-700 sketch-btn"
                title={t.avatarModal.back}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-base sm:text-lg font-black font-['Mali'] text-zinc-900 dark:text-white">
              {step === 'choose-source' && t.avatarModal.title}
              {step === 'gallery' && t.avatarModal.selectCardTitle}
              {step === 'crop' && t.avatarModal.cropTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border-2 border-black dark:border-white hover:bg-red-500 hover:text-white sketch-btn transition-colors"
            title={t.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* STEP 1: CHOOSE SOURCE (2 BUTTONS) */}
          {step === 'choose-source' && (
            <div className="py-4 space-y-4 max-w-md mx-auto">
              {/* Current avatar preview */}
              <div className="flex flex-col items-center justify-center gap-2 mb-6">
                <div className="w-24 h-24 rounded-full border-3 border-black dark:border-white bg-zinc-100 dark:bg-zinc-700 overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center font-black text-2xl">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.username}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <span>{currentUser?.username?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <span className="text-xs font-bold text-zinc-500">{currentUser?.username}</span>
              </div>

              {/* Button 1: เลือกจากภายในเครื่อง */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-3 border-black dark:border-white bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 dark:hover:bg-sky-900/60 sketch-btn shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)] text-left transition-all"
              >
                <div className="w-12 h-12 rounded-xl border-2 border-black bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm text-sky-600 dark:text-sky-400">
                  <Upload size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base text-zinc-900 dark:text-white font-['Mali']">
                    {t.avatarModal.uploadFromDevice}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {language === 'th' ? 'เลือกไฟล์รูปภาพจากอุปกรณ์ของคุณ' : 'Upload photo from your device'}
                  </p>
                </div>
              </button>

              {/* Button 2: เลือกจากแกลเลอรี่การ์ด */}
              <button
                type="button"
                onClick={() => setStep('gallery')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-3 border-black dark:border-white bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/60 sketch-btn shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)] text-left transition-all"
              >
                <div className="w-12 h-12 rounded-xl border-2 border-black bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm text-amber-600 dark:text-amber-400">
                  <ImageIcon size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base text-zinc-900 dark:text-white font-['Mali']">
                    {t.avatarModal.chooseFromGallery}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {language === 'th' ? 'เลือกจากการ์ดและหน้าปกของซองสุ่มที่คุณเคยเปิด' : 'Choose from your opened packs and collected cards'}
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: CARD & PACK GALLERY PICKER (ONLY OPENED PACKS) */}
          {step === 'gallery' && (
            <div className="space-y-6">
              {Object.keys(franchiseGroups).length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-xs space-y-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6">
                  <Package className="mx-auto text-zinc-400" size={36} />
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    {language === 'th'
                      ? 'ยังไม่มีชุดการ์ดที่เปิดในบัญชีของคุณ'
                      : 'No opened packs in your account yet'}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {language === 'th'
                      ? 'กรุณาเปิดซองการ์ดในหน้าหลักเพื่อสะสมการ์ดและปลดล็อกรูปภาพโปรไฟล์'
                      : 'Open card packs from the home page to collect cards and unlock avatars'}
                  </p>
                </div>
              ) : (
                Object.entries(franchiseGroups).map(([franchiseName, seriesPacks], fIdx) => (
                  <div
                    key={franchiseName}
                    className={`space-y-4 ${
                      fIdx > 0 ? 'pt-6 border-t-3 border-black dark:border-white' : ''
                    }`}
                  >
                    {/* Clear Franchise Header with Divider */}
                    <div className="flex items-center gap-2.5 pb-2 border-b-2 border-dashed border-zinc-300 dark:border-zinc-700">
                      <div className="px-3 py-1 rounded-xl border-2 border-black dark:border-white bg-purple-200 dark:bg-purple-900/60 font-black text-xs text-zinc-900 dark:text-white shadow-sm font-['Mali']">
                        {t.avatarModal.franchiseLabel}
                      </div>
                      <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white font-['Mali'] truncate">
                        {franchiseName}
                      </h3>
                    </div>

                    {/* Pack Series Sections */}
                    <div className="space-y-5">
                      {seriesPacks.map((pack) => {
                        // Pulled cards in this pack owned by user
                        const ownedCards = (pack.cards || []).filter(
                          (c) => (currentUser?.inventory?.[c.id] || 0) > 0 && Boolean(c.imageUrl)
                        );

                        return (
                          <div
                            key={pack.id}
                            className="bg-zinc-50 dark:bg-zinc-900/40 border-2 border-black dark:border-zinc-700 rounded-2xl p-3 sm:p-4 space-y-3"
                          >
                            {/* Series Name Badge */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500">
                                {t.avatarModal.packLabel}:
                              </span>
                              <span className="font-black text-sm text-zinc-900 dark:text-white font-['Mali']">
                                {pack.seriesName}
                              </span>
                            </div>

                            {/* Grid: Pack Cover First, then Unlocked Cards */}
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                              {/* 1. Pack Cover Option (Only for opened packs) */}
                              {pack.coverImageUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRawImage(pack.coverImageUrl);
                                    setStep('crop');
                                  }}
                                  className="group relative flex flex-col items-center bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl overflow-hidden p-1.5 text-center hover:ring-2 hover:ring-yellow-400 hover:scale-[1.02] transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                  title={`${t.avatarModal.packCover} - ${pack.seriesName}`}
                                >
                                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 border border-black mb-1 flex items-center justify-center">
                                    <img
                                      src={pack.coverImageUrl}
                                      alt={pack.seriesName}
                                      className="w-full h-full object-cover select-none pointer-events-none"
                                      draggable={false}
                                    />
                                  </div>
                                  <span className="w-full text-[10px] font-black bg-yellow-300 text-black border border-black rounded px-1 py-0.5 truncate shadow-xs">
                                    {t.avatarModal.packCover}
                                  </span>
                                </button>
                              )}

                              {/* 2. Unlocked Cards */}
                              {ownedCards.map((card) => {
                                const count = currentUser?.inventory?.[card.id] || 0;
                                const rarityConfig = pack.rarities?.find((r) => r.name === card.rarity);
                                const badgeColor = rarityConfig?.color || '#e2e8f0';

                                return (
                                  <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedRawImage(card.imageUrl);
                                      setStep('crop');
                                    }}
                                    className="group relative flex flex-col items-center bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-xl overflow-hidden p-1.5 text-center hover:ring-2 hover:ring-yellow-400 hover:scale-[1.02] transition-all sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    title={card.name || 'Card'}
                                  >
                                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-700 border border-black mb-1 relative flex items-center justify-center">
                                      <img
                                        src={card.imageUrl}
                                        alt={card.name}
                                        className="w-full h-full object-cover select-none pointer-events-none"
                                        draggable={false}
                                      />
                                      {/* Rarity badge */}
                                      <span
                                        style={{ backgroundColor: badgeColor }}
                                        className="absolute top-1 left-1 text-[9px] font-black text-black border border-black px-1 rounded shadow-xs"
                                      >
                                        {card.rarity}
                                      </span>
                                      {/* Owned count badge */}
                                      <span className="absolute bottom-1 right-1 text-[9px] font-black bg-black/80 text-white px-1 rounded">
                                        x{count}
                                      </span>
                                    </div>
                                    <span className="w-full text-[10px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                      {card.name || 'Card'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* STEP 3: CIRCULAR CROPPER VIEW (WITH CLAMPING & PIXEL-PERFECT PREVIEW) */}
          {step === 'crop' && selectedRawImage && (
            <div className="space-y-4 flex flex-col items-center">
              {/* Interactive Crop Viewport with Wheel Zoom & Pinch Zoom */}
              <div
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`relative w-[270px] h-[270px] sm:w-[290px] sm:h-[290px] bg-zinc-950 border-3 border-black dark:border-white rounded-3xl overflow-hidden touch-none select-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.8)] ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                {/* Scaled & Panned Image (Clamped inside bounds) */}
                {naturalSize.width > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: `${renderedDimensions.width}px`,
                      height: `${renderedDimensions.height}px`,
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                      transformOrigin: 'center center',
                    }}
                    className="pointer-events-none select-none flex items-center justify-center will-change-transform"
                  >
                    <img
                      src={selectedRawImage}
                      alt="Crop Source"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className="w-full h-full object-fill pointer-events-none select-none block"
                    />
                  </div>
                )}

                {/* PROMINENT CIRCLE CROP INDICATOR (วงกลม) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    style={{
                      width: `${CIRCLE_DIAMETER}px`,
                      height: `${CIRCLE_DIAMETER}px`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
                    }}
                    className="rounded-full border-3 border-yellow-400 dark:border-yellow-300 relative"
                  >
                    {/* Circle crosshairs */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-yellow-400/40" />
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-yellow-400/40" />
                  </div>
                </div>
              </div>

              {/* Subtitle instructions for modern controls */}
              <p className="text-[11px] font-bold text-zinc-500 text-center">
                {language === 'th'
                  ? 'เลื่อนเมาส์หรือใช้นิ้วจีบเพื่อซูม • ลากเพื่อเลื่อนตำแหน่ง'
                  : 'Scroll or pinch to zoom • Drag to pan inside circle'}
              </p>

              {/* Controls bar & Real-time Canvas Previews */}
              <div className="w-full max-w-sm flex flex-col gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3.5 rounded-2xl border-2 border-black dark:border-zinc-700">
                {/* Zoom Controls */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setZoom((z) => {
                        const next = Math.max(1.0, Math.round((z - 0.15) * 100) / 100);
                        setPan((curPan) => clampPan(curPan, next));
                        return next;
                      });
                    }}
                    className="p-1.5 rounded-xl border border-black bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn"
                    title={t.avatarModal.zoom}
                  >
                    <ZoomOut size={16} />
                  </button>

                  <input
                    type="range"
                    min="1.0"
                    max="3.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      setZoom(next);
                      setPan((curPan) => clampPan(curPan, next));
                    }}
                    className="flex-1 accent-yellow-400 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setZoom((z) => {
                        const next = Math.min(3.5, Math.round((z + 0.15) * 100) / 100);
                        setPan((curPan) => clampPan(curPan, next));
                        return next;
                      });
                    }}
                    className="p-1.5 rounded-xl border border-black bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn"
                    title={t.avatarModal.zoom}
                  >
                    <ZoomIn size={16} />
                  </button>

                  {/* Re-center button */}
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-xl border border-black bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-1 shrink-0 sketch-btn"
                    title={t.avatarModal.center}
                  >
                    <RotateCcw size={12} />
                    <span>{t.avatarModal.center}</span>
                  </button>
                </div>

                {/* ISSUE 2 FIX: Real-time Live Canvas Previews (100% pixel-perfect match) */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs font-bold text-zinc-500">
                    {t.avatarModal.preview}:
                  </span>
                  <div className="flex items-center gap-3">
                    {/* Mini avatar canvas preview */}
                    <canvas
                      ref={miniPreviewCanvasRef}
                      className="w-8 h-8 rounded-full border-2 border-black dark:border-white shadow-xs block bg-zinc-200"
                    />
                    {/* Large avatar canvas preview */}
                    <canvas
                      ref={largePreviewCanvasRef}
                      className="w-14 h-14 rounded-full border-2 border-black dark:border-white shadow-sm block bg-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t-2 border-black dark:border-white bg-zinc-50 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-zinc-900 dark:text-white"
          >
            {t.avatarModal.cancel}
          </button>

          {step === 'crop' && (
            <button
              type="button"
              onClick={handleConfirmCrop}
              className="px-5 py-2 text-sm font-bold rounded-xl border-2 border-black bg-emerald-300 hover:bg-emerald-400 text-black sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
            >
              <Check size={16} />
              <span>{t.avatarModal.confirmCrop}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
