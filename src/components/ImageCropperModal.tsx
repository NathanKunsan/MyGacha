import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, Crop } from 'lucide-react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
}

type AspectRatioMode = 'free' | 'original' | '3:4' | '1:1' | '16:9';

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageUrl,
  onClose,
  onCropComplete,
  title,
}) => {
  const { language } = useGacha();
  const t = getTranslation(language);
  const resolvedTitle = title || t.modals.cropper.title;
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Natural image dimensions
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Displayed image layout inside container
  const [displayedLayout, setDisplayedLayout] = useState<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Crop Box in normalized percentages (0 to 100) relative to displayed image
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });

  const [aspectMode, setAspectMode] = useState<AspectRatioMode>('free');

  // Drag state
  const dragRef = useRef<{
    isDragging: boolean;
    dragType: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null;
    startX: number;
    startY: number;
    startCrop: { x: number; y: number; width: number; height: number };
  }>({
    isDragging: false,
    dragType: null,
    startX: 0,
    startY: 0,
    startCrop: { x: 10, y: 10, width: 80, height: 80 },
  });

  // Calculate layout of image when it loads or resizes
  const updateDisplayedLayout = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDisplayedLayout({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', updateDisplayedLayout);
      return () => window.removeEventListener('resize', updateDisplayedLayout);
    }
  }, [isOpen, updateDisplayedLayout]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      const w = imageRef.current.naturalWidth;
      const h = imageRef.current.naturalHeight;
      setNaturalSize({ width: w, height: h });
      updateDisplayedLayout();
      // Initialize crop box to 80% centered
      setCropBox({ x: 10, y: 10, width: 80, height: 80 });
    }
  };

  // Set aspect ratio preset
  const handleSetAspectMode = (mode: AspectRatioMode) => {
    setAspectMode(mode);
    if (!displayedLayout.width || !displayedLayout.height) return;

    if (mode === 'free') return;

    let targetRatio = 1;
    if (mode === 'original' && naturalSize.height > 0) {
      targetRatio = naturalSize.width / naturalSize.height;
    } else if (mode === '3:4') {
      targetRatio = 3 / 4;
    } else if (mode === '1:1') {
      targetRatio = 1;
    } else if (mode === '16:9') {
      targetRatio = 16 / 9;
    }

    // Convert target ratio into percentage width & height of the displayed image box
    const imgAspect = displayedLayout.width / displayedLayout.height;
    let newW = 80;
    let newH = 80;

    if (targetRatio > imgAspect) {
      newW = 80;
      newH = (80 / targetRatio) * imgAspect;
    } else {
      newH = 80;
      newW = 80 * targetRatio / imgAspect;
    }

    newW = Math.min(96, Math.max(20, newW));
    newH = Math.min(96, Math.max(20, newH));

    setCropBox({
      x: (100 - newW) / 2,
      y: (100 - newH) / 2,
      width: newW,
      height: newH,
    });
  };

  // Pointer Down handler
  const handlePointerDown = (
    e: React.PointerEvent,
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      isDragging: true,
      dragType: type,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropBox },
    };
  };

  // Global pointer move and up listener for buttery smooth 9-point dragging
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.isDragging || !displayedLayout.width || !displayedLayout.height) return;
      e.preventDefault();

      const { startX, startY, startCrop, dragType } = dragRef.current;
      const deltaX = ((e.clientX - startX) / displayedLayout.width) * 100;
      const deltaY = ((e.clientY - startY) / displayedLayout.height) * 100;

      let { x, y, width, height } = startCrop;

      if (dragType === 'move') {
        x = Math.max(0, Math.min(100 - width, x + deltaX));
        y = Math.max(0, Math.min(100 - height, y + deltaY));
      } else {
        // Resizing handles (8 perimeter points)
        if (dragType?.includes('e')) {
          width = Math.max(10, Math.min(100 - x, width + deltaX));
        }
        if (dragType?.includes('s')) {
          height = Math.max(10, Math.min(100 - y, height + deltaY));
        }
        if (dragType?.includes('w')) {
          const potentialW = width - deltaX;
          if (potentialW >= 10 && x + deltaX >= 0) {
            x += deltaX;
            width = potentialW;
          }
        }
        if (dragType?.includes('n')) {
          const potentialH = height - deltaY;
          if (potentialH >= 10 && y + deltaY >= 0) {
            y += deltaY;
            height = potentialH;
          }
        }
      }

      setCropBox({ x, y, width, height });
    };

    const handleGlobalPointerUp = () => {
      if (dragRef.current.isDragging) {
        dragRef.current.isDragging = false;
        dragRef.current.dragType = null;
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [displayedLayout]);

  const handlePointerMove = (e: React.PointerEvent) => {
    // Retained for container compatibility
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      dragRef.current.dragType = null;
    }
  };

  // Reset crop to full
  const handleReset = () => {
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    setAspectMode('free');
  };

  // Perform actual crop using offscreen canvas
  const handleApplyCrop = () => {
    if (!naturalSize.width || !naturalSize.height) {
      onCropComplete(imageUrl);
      onClose();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const sourceX = (cropBox.x / 100) * img.naturalWidth;
      const sourceY = (cropBox.y / 100) * img.naturalHeight;
      const sourceW = (cropBox.width / 100) * img.naturalWidth;
      const sourceH = (cropBox.height / 100) * img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceW));
      canvas.height = Math.max(1, Math.round(sourceH));

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceW,
          sourceH,
          0,
          0,
          canvas.width,
          canvas.height
        );
        const croppedData = canvas.toDataURL('image/png', 0.95);
        onCropComplete(croppedData);
        onClose();
      }
    };
    img.src = imageUrl;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-['Prompt']"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-white dark:bg-zinc-900 border-3 border-black dark:border-white rounded-3xl p-5 sm:p-6 max-w-3xl w-full flex flex-col max-h-[95vh] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black dark:border-white mb-3">
          <div className="flex items-center gap-2">
            <Crop size={20} className="text-yellow-500" />
            <h3 className="text-base sm:text-lg font-bold font-['Mali'] text-zinc-900 dark:text-white">
              {resolvedTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full border-2 border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-800 sketch-btn"
            title={t.common.close}
          >
            <X size={16} />
          </button>
        </div>

        {/* Aspect Ratio Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs font-bold">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-zinc-500 mr-1">{t.modals.cropper.aspectRatio}</span>
            {[
              { id: 'free', label: t.modals.cropper.free },
              { id: '3:4', label: t.modals.cropper.ratio34 },
              { id: '1:1', label: t.modals.cropper.ratio11 },
              { id: '16:9', label: t.modals.cropper.ratio169 },
              { id: 'original', label: t.modals.cropper.original },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSetAspectMode(mode.id as AspectRatioMode)}
                className={`px-2.5 py-1 rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
                  aspectMode === mode.id
                    ? 'bg-yellow-300 text-black shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 border-2 border-black dark:border-white rounded-lg flex items-center gap-1 text-xs sketch-btn"
            title={t.modals.cropper.reset}
          >
            <RotateCcw size={12} />
            <span>{t.modals.cropper.reset}</span>
          </button>
        </div>

        {/* Crop Viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[300px] max-h-[55vh] bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center p-2 border-2 border-black"
        >
          <div className="relative inline-block max-w-full max-h-full">
            {/* The Image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="To Crop"
              onLoad={handleImageLoad}
              className="max-h-[50vh] max-w-full w-auto h-auto object-contain block pointer-events-none select-none"
            />

            {/* OVERLAY & 9-GRID CROP BOX */}
            {displayedLayout.width > 0 && (
              <div
                className="absolute inset-0 pointer-events-auto"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {/* Darkened backdrop surrounding the crop box */}
                {/* Top mask */}
                <div
                  className="absolute bg-black/60 pointer-events-none"
                  style={{ top: 0, left: 0, right: 0, height: `${cropBox.y}%` }}
                />
                {/* Bottom mask */}
                <div
                  className="absolute bg-black/60 pointer-events-none"
                  style={{ top: `${cropBox.y + cropBox.height}%`, left: 0, right: 0, bottom: 0 }}
                />
                {/* Left mask */}
                <div
                  className="absolute bg-black/60 pointer-events-none"
                  style={{
                    top: `${cropBox.y}%`,
                    left: 0,
                    width: `${cropBox.x}%`,
                    height: `${cropBox.height}%`,
                  }}
                />
                {/* Right mask */}
                <div
                  className="absolute bg-black/60 pointer-events-none"
                  style={{
                    top: `${cropBox.y}%`,
                    left: `${cropBox.x + cropBox.width}%`,
                    right: 0,
                    height: `${cropBox.height}%`,
                  }}
                />

                {/* THE 9-GRID CROP BOX (ตาราง 9 ช่อง) */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'move')}
                  className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)] cursor-move select-none"
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.width}%`,
                    height: `${cropBox.height}%`,
                  }}
                >
                  {/* Rule of Thirds - 9 Cells Grid Lines */}
                  {/* Horizontal Line 1 (at 33.33%) */}
                  <div className="absolute top-[33.33%] left-0 right-0 h-0 border-t border-dashed border-white/80 shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none" />
                  {/* Horizontal Line 2 (at 66.66%) */}
                  <div className="absolute top-[66.66%] left-0 right-0 h-0 border-t border-dashed border-white/80 shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none" />
                  {/* Vertical Line 1 (at 33.33%) */}
                  <div className="absolute left-[33.33%] top-0 bottom-0 w-0 border-l border-dashed border-white/80 shadow-[1px_0_1px_rgba(0,0,0,0.8)] pointer-events-none" />
                  {/* Vertical Line 2 (at 66.66%) */}
                  <div className="absolute left-[66.66%] top-0 bottom-0 w-0 border-l border-dashed border-white/80 shadow-[1px_0_1px_rgba(0,0,0,0.8)] pointer-events-none" />

                  {/* Corner Handles */}
                  {/* Top-Left */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'nw')}
                    className="absolute -top-2 -left-2 w-4 h-4 bg-yellow-400 border-2 border-black rounded-sm cursor-nwse-resize z-20 shadow-md"
                  />
                  {/* Top-Right */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'ne')}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 border-2 border-black rounded-sm cursor-nesw-resize z-20 shadow-md"
                  />
                  {/* Bottom-Left */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'sw')}
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-yellow-400 border-2 border-black rounded-sm cursor-nesw-resize z-20 shadow-md"
                  />
                  {/* Bottom-Right */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'se')}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-yellow-400 border-2 border-black rounded-sm cursor-nwse-resize z-20 shadow-md"
                  />

                  {/* Edge Handles */}
                  {/* Top */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'n')}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-white border border-black rounded-sm cursor-ns-resize z-10"
                  />
                  {/* Bottom */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 's')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-white border border-black rounded-sm cursor-ns-resize z-10"
                  />
                  {/* Left */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'w')}
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white border border-black rounded-sm cursor-ew-resize z-10"
                  />
                  {/* Right */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'e')}
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white border border-black rounded-sm cursor-ew-resize z-10"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-black dark:border-white mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 font-bold border-2 border-black dark:border-white rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 sketch-btn text-xs"
          >
            {t.modals.cropper.cancel}
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            className="px-6 py-2 font-bold border-2 border-black rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black sketch-btn text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
          >
            <Check size={16} />
            <span>{t.modals.cropper.confirm}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
