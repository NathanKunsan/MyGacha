import React, { useState, useRef, useEffect } from 'react';
import { PackTearConfig, TearDirection, TearLinePoint } from '../types';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Scissors,
  RotateCcw,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  Crop,
} from 'lucide-react';
import { ImageCropperModal } from './ImageCropperModal';
import { ModernImageLightbox } from './ModernImageLightbox';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';

interface PackCoverConfiguratorProps {
  coverImageUrl: string;
  originalCoverImageUrl?: string;
  coverAspectRatio?: string;
  tearConfig?: PackTearConfig;
  onChangeCover: (url: string, originalUrl?: string) => void;
  onChangeAspectRatio: (ratio: string) => void;
  onChangeTearConfig: (config: PackTearConfig) => void;
  franchiseName?: string;
  seriesName?: string;
}

export const PackCoverConfigurator: React.FC<PackCoverConfiguratorProps> = ({
  coverImageUrl,
  originalCoverImageUrl,
  coverAspectRatio = 'auto',
  tearConfig = { direction: 'up' },
  onChangeCover,
  onChangeAspectRatio,
  onChangeTearConfig,
  franchiseName = '',
  seriesName = '',
}) => {
  const { language } = useGacha();
  const t = getTranslation(language);
  const containerRef = useRef<HTMLDivElement>(null);

  // Preserve raw uncropped original image so presets and resets always recover the original file
  const [rawOriginalUrl, setRawOriginalUrl] = useState<string>(
    () => originalCoverImageUrl || coverImageUrl || ''
  );

  useEffect(() => {
    if (originalCoverImageUrl) {
      setRawOriginalUrl(originalCoverImageUrl);
    } else if (coverImageUrl && !rawOriginalUrl) {
      setRawOriginalUrl(coverImageUrl);
    }
  }, [originalCoverImageUrl, coverImageUrl]);

  // Natural image dimensions tracking
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  // Lightbox Expand Modal state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // 9-Grid Image Cropper Modal state
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  // Custom click points for freeform cut line
  const [customPoints, setCustomPoints] = useState<TearLinePoint[]>(() => {
    const pts: TearLinePoint[] = [];
    if (tearConfig.direction === 'custom') {
      if (tearConfig.customStart) pts.push(tearConfig.customStart);
      if (tearConfig.customEnd) pts.push(tearConfig.customEnd);
    }
    return pts;
  });

  // Calculate natural aspect ratio when image loads
  useEffect(() => {
    if (coverImageUrl) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setNaturalRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = coverImageUrl;
    } else {
      setNaturalRatio(null);
    }
  }, [coverImageUrl]);

  // Synchronize customPoints when tearConfig changes externally
  useEffect(() => {
    if (tearConfig.direction === 'custom') {
      const pts: TearLinePoint[] = [];
      if (tearConfig.customStart) pts.push(tearConfig.customStart);
      if (tearConfig.customEnd) pts.push(tearConfig.customEnd);
      setCustomPoints(pts);
    } else {
      setCustomPoints([]);
    }
  }, [tearConfig.direction, tearConfig.customStart, tearConfig.customEnd]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const uploadedUrl = reader.result;
          setRawOriginalUrl(uploadedUrl);
          onChangeCover(uploadedUrl, uploadedUrl);
          onChangeAspectRatio('auto');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Aspect Ratio preset handler - ALWAYS restores the full original uncropped image!
  const handleSelectAspectRatio = (ratio: string) => {
    const baseOriginal = rawOriginalUrl || originalCoverImageUrl || coverImageUrl;
    if (baseOriginal && coverImageUrl !== baseOriginal) {
      onChangeCover(baseOriginal, baseOriginal);
    }
    onChangeAspectRatio(ratio);
  };

  // Revert back to original uncropped file
  const handleResetToOriginal = () => {
    const baseOriginal = rawOriginalUrl || originalCoverImageUrl || coverImageUrl;
    if (baseOriginal) {
      onChangeCover(baseOriginal, baseOriginal);
      onChangeAspectRatio('auto');
    }
  };

  // Direction preset handler
  const handleSelectDirection = (dir: TearDirection) => {
    if (dir === 'custom') {
      onChangeTearConfig({
        direction: 'custom',
        customStart: customPoints[0],
        customEnd: customPoints[1],
      });
    } else {
      onChangeTearConfig({ direction: dir });
    }
  };

  // Click on image canvas to set custom cut line
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || tearConfig.direction !== 'custom') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (customPoints.length === 0) {
      const p1 = { x: Math.round(x), y: Math.round(y) };
      setCustomPoints([p1]);
      onChangeTearConfig({
        direction: 'custom',
        customStart: p1,
        customEnd: undefined,
      });
    } else if (customPoints.length === 1) {
      const p2 = { x: Math.round(x), y: Math.round(y) };
      const updated = [customPoints[0], p2];
      setCustomPoints(updated);
      onChangeTearConfig({
        direction: 'custom',
        customStart: updated[0],
        customEnd: updated[1],
      });
    } else {
      // If already has 2 points, clicking again starts over from new point 1
      const p1 = { x: Math.round(x), y: Math.round(y) };
      setCustomPoints([p1]);
      onChangeTearConfig({
        direction: 'custom',
        customStart: p1,
        customEnd: undefined,
      });
    }
  };

  // Undo point
  const handleUndoPoint = () => {
    if (customPoints.length === 2) {
      const updated = [customPoints[0]];
      setCustomPoints(updated);
      onChangeTearConfig({
        direction: 'custom',
        customStart: updated[0],
        customEnd: undefined,
      });
    } else if (customPoints.length === 1) {
      setCustomPoints([]);
      onChangeTearConfig({
        direction: 'custom',
        customStart: undefined,
        customEnd: undefined,
      });
    }
  };

  // Reset custom cut line
  const handleResetCustomLine = () => {
    setCustomPoints([]);
    onChangeTearConfig({
      direction: 'custom',
      customStart: undefined,
      customEnd: undefined,
    });
  };

  // Compute container aspect ratio style
  const getAspectRatioClass = () => {
    switch (coverAspectRatio) {
      case '3:4':
        return 'aspect-[3/4]';
      case '9:16':
        return 'aspect-[9/16]';
      case '1:1':
        return 'aspect-square';
      case 'custom':
      case 'auto':
      default:
        return naturalRatio ? '' : 'aspect-[3/4]';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. ขนาดของภาพ (Aspect Ratio Presets) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold block text-zinc-700 dark:text-zinc-300">
          {t.createPack.aspectRatio}
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectAspectRatio('auto')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
              coverAspectRatio === 'auto'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            {t.createPack.ratioAuto}
          </button>
          <button
            type="button"
            onClick={() => handleSelectAspectRatio('3:4')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
              coverAspectRatio === '3:4'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            {t.createPack.ratio34}
          </button>
          <button
            type="button"
            onClick={() => handleSelectAspectRatio('9:16')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
              coverAspectRatio === '9:16'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            {t.createPack.ratio916}
          </button>
          <button
            type="button"
            onClick={() => handleSelectAspectRatio('1:1')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn ${
              coverAspectRatio === '1:1'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            {t.createPack.ratio11}
          </button>
          {coverImageUrl && (
            <button
              type="button"
              onClick={() => {
                setIsCropperOpen(true);
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
                coverAspectRatio === 'custom'
                  ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-600'
              }`}
              title={t.createPack.ratioCrop9}
            >
              <Crop size={13} />
              <span>{t.createPack.ratioCrop9}</span>
            </button>
          )}
          {coverImageUrl && (coverAspectRatio === 'custom' || (rawOriginalUrl && coverImageUrl !== rawOriginalUrl)) && (
            <button
              type="button"
              onClick={handleResetToOriginal}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-black dark:border-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 transition-all sketch-btn flex items-center gap-1"
              title={t.createPack.resetOriginal}
            >
              <RotateCcw size={12} />
              <span>{t.createPack.resetOriginal}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. แนวการตัดซอง (Direction presets with arrow icons & custom) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold block text-zinc-700 dark:text-zinc-300">
          {t.createPack.tearDirection}
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* ตั้งขึ้น (Up) */}
          <button
            type="button"
            onClick={() => handleSelectDirection('up')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
              tearConfig.direction === 'up'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            <ArrowUp size={14} />
            <span>{t.createPack.dirUp}</span>
          </button>

          {/* นอนซ้าย (Left) */}
          <button
            type="button"
            onClick={() => handleSelectDirection('left')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
              tearConfig.direction === 'left'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            <ArrowLeft size={14} />
            <span>{t.createPack.dirLeft}</span>
          </button>

          {/* กลับหัว / ตั้งลง (Down) */}
          <button
            type="button"
            onClick={() => handleSelectDirection('down')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
              tearConfig.direction === 'down'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            <ArrowDown size={14} />
            <span>{t.createPack.dirDown}</span>
          </button>

          {/* นอนขวา (Right) */}
          <button
            type="button"
            onClick={() => handleSelectDirection('right')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
              tearConfig.direction === 'right'
                ? 'bg-yellow-300 dark:bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            <ArrowRight size={14} />
            <span>{t.createPack.dirRight}</span>
          </button>

          {/* กำหนดจุดเองแบบอิสระ (Custom) */}
          <button
            type="button"
            onClick={() => handleSelectDirection('custom')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-black dark:border-white transition-all sketch-btn flex items-center gap-1.5 ${
              tearConfig.direction === 'custom'
                ? 'bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            <Crosshair size={14} />
            <span>{t.createPack.dirCustom}</span>
          </button>
        </div>

        {/* Custom Point Controls */}
        {tearConfig.direction === 'custom' && (
          <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 text-xs">
            <div className="font-semibold text-amber-900 dark:text-amber-200">
              {customPoints.length === 0 && t.createPack.customPromptStart}
              {customPoints.length === 1 && t.createPack.customPromptEnd}
              {customPoints.length === 2 && t.createPack.customPromptDone}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndoPoint}
                disabled={customPoints.length === 0}
                className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-zinc-800 border border-black rounded-lg disabled:opacity-40 sketch-btn flex items-center gap-1"
                title={t.createPack.undoPoint}
              >
                <RotateCcw size={12} />
                <span>{t.createPack.undoPoint}</span>
              </button>
              <button
                type="button"
                onClick={handleResetCustomLine}
                disabled={customPoints.length === 0}
                className="px-2.5 py-1 text-[11px] font-bold bg-red-100 hover:bg-red-200 text-red-700 border border-black rounded-lg disabled:opacity-40 sketch-btn flex items-center gap-1"
                title={t.createPack.clearCutLine}
              >
                <Trash2 size={12} />
                <span>{t.createPack.clearCutLine}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Interactive Preview Canvas */}
      <div className="flex flex-col items-center">
        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          style={coverAspectRatio === 'auto' && naturalRatio ? { aspectRatio: `${naturalRatio}` } : undefined}
          className={`${
            coverAspectRatio === 'auto' && naturalRatio && naturalRatio > 1.2
              ? 'w-full max-w-sm sm:max-w-md md:max-w-lg min-h-[140px]'
              : 'w-56 sm:w-64 max-w-full'
          } bg-white dark:bg-zinc-700 border-2 border-black dark:border-white rounded-2xl overflow-hidden relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center select-none ${
            tearConfig.direction === 'custom' ? 'cursor-crosshair' : 'cursor-default'
          } ${getAspectRatioClass()}`}
        >
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Pack Cover"
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-zinc-400">
              <ImageIcon size={36} className="mb-2 opacity-50" />
              <span className="text-xs font-bold">{t.createPack.noCoverYet}</span>
            </div>
          )}

          {/* Floating Expand / Zoom Button on Canvas */}
          {coverImageUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLightboxOpen(true);
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/90 dark:bg-zinc-800/90 hover:bg-yellow-300 dark:hover:bg-yellow-400 text-black dark:text-white hover:text-black border-2 border-black flex items-center justify-center shadow z-30 transition-transform hover:scale-110"
              title={t.createPack.zoomCover}
            >
              <Maximize2 size={13} />
            </button>
          )}

          {/* SVG Overlay for Dashed Cut Line */}
          {coverImageUrl && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
              {/* Preset UP: horizontal dashed line near top (Y = 20%) */}
              {tearConfig.direction === 'up' && (
                <line
                  x1="0%"
                  y1="20%"
                  x2="100%"
                  y2="20%"
                  stroke="#facc15"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="drop-shadow(0 2px 2px rgba(0,0,0,0.8))"
                />
              )}

              {/* Preset DOWN: horizontal dashed line near bottom (Y = 80%) */}
              {tearConfig.direction === 'down' && (
                <line
                  x1="0%"
                  y1="80%"
                  x2="100%"
                  y2="80%"
                  stroke="#facc15"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="drop-shadow(0 2px 2px rgba(0,0,0,0.8))"
                />
              )}

              {/* Preset LEFT: vertical dashed line near left (X = 20%) */}
              {tearConfig.direction === 'left' && (
                <line
                  x1="20%"
                  y1="0%"
                  x2="20%"
                  y2="100%"
                  stroke="#facc15"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="drop-shadow(0 2px 2px rgba(0,0,0,0.8))"
                />
              )}

              {/* Preset RIGHT: vertical dashed line near right (X = 80%) */}
              {tearConfig.direction === 'right' && (
                <line
                  x1="80%"
                  y1="0%"
                  x2="80%"
                  y2="100%"
                  stroke="#facc15"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="drop-shadow(0 2px 2px rgba(0,0,0,0.8))"
                />
              )}

              {/* Custom Freeform Cut Line */}
              {tearConfig.direction === 'custom' && customPoints.length >= 2 && (
                <line
                  x1={`${customPoints[0].x}%`}
                  y1={`${customPoints[0].y}%`}
                  x2={`${customPoints[1].x}%`}
                  y2={`${customPoints[1].y}%`}
                  stroke="#facc15"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  filter="drop-shadow(0 2px 2px rgba(0,0,0,0.8))"
                />
              )}
            </svg>
          )}

          {/* Visual Cut Indicators / Scissors */}
          {coverImageUrl && (
            <>
              {tearConfig.direction === 'up' && (
                <div className="absolute top-[20%] left-6 -translate-y-1/2 w-6 h-6 rounded-full bg-yellow-400 border border-black flex items-center justify-center text-black shadow-md z-30">
                  <Scissors size={12} />
                </div>
              )}
              {tearConfig.direction === 'down' && (
                <div className="absolute top-[80%] left-6 -translate-y-1/2 w-6 h-6 rounded-full bg-yellow-400 border border-black flex items-center justify-center text-black shadow-md z-30">
                  <Scissors size={12} />
                </div>
              )}
              {tearConfig.direction === 'left' && (
                <div className="absolute left-[20%] top-6 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-400 border border-black flex items-center justify-center text-black shadow-md z-30">
                  <Scissors size={12} />
                </div>
              )}
              {tearConfig.direction === 'right' && (
                <div className="absolute left-[80%] top-6 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-400 border border-black flex items-center justify-center text-black shadow-md z-30">
                  <Scissors size={12} />
                </div>
              )}

              {/* Custom Points Markers */}
              {tearConfig.direction === 'custom' && (
                <>
                  {customPoints[0] && (
                    <div
                      style={{ left: `${customPoints[0].x}%`, top: `${customPoints[0].y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center text-[10px] font-black shadow z-30"
                    >
                      1
                    </div>
                  )}
                  {customPoints[1] && (
                    <div
                      style={{ left: `${customPoints[1].x}%`, top: `${customPoints[1].y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-[10px] font-black shadow z-30"
                    >
                      2
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Subtext overlay */}
          {(franchiseName || seriesName) && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-center text-white pointer-events-none z-10">
              <p className="text-xs font-black truncate">{franchiseName}</p>
              <p className="text-[10px] font-bold text-zinc-300 truncate">{seriesName}</p>
            </div>
          )}
        </div>

        {/* Change / Upload, Zoom & Clear Image Controls */}
        <div className="flex items-center gap-2.5 mt-3 flex-wrap justify-center sm:justify-start">
          <label
            className="px-3.5 py-2 rounded-xl bg-yellow-300 hover:bg-yellow-400 border-2 border-black flex items-center gap-1.5 text-xs font-bold text-black cursor-pointer sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            title={t.createPack.changeCover}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Edit2 size={13} />
            <span>{t.createPack.changeCover}</span>
          </label>

          {coverImageUrl && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsLightboxOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-yellow-300 dark:hover:bg-yellow-400 hover:text-black border-2 border-black dark:border-white flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title={t.common.zoom}
              >
                <Maximize2 size={13} />
                <span>{t.common.zoom}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawOriginalUrl('');
                  onChangeCover('', '');
                }}
                className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 border-2 border-black sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title={t.common.delete}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modern Lightbox with Overlaid Tear Cut Line (Wheel Zoom, Touch Pinch, Drag-to-Pan, Zero Scrollbars) */}
      <ModernImageLightbox
        isOpen={isLightboxOpen && Boolean(coverImageUrl)}
        imageUrl={coverImageUrl}
        title={t.modals.lightbox.title}
        onClose={() => setIsLightboxOpen(false)}
      >
        {/* Overlaid cut line on enlarged image */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          {tearConfig.direction === 'up' && (
            <line x1="0%" y1="20%" x2="100%" y2="20%" stroke="#facc15" strokeWidth="4" strokeDasharray="8 5" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.9))" />
          )}
          {tearConfig.direction === 'down' && (
            <line x1="0%" y1="80%" x2="100%" y2="80%" stroke="#facc15" strokeWidth="4" strokeDasharray="8 5" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.9))" />
          )}
          {tearConfig.direction === 'left' && (
            <line x1="20%" y1="0%" x2="20%" y2="100%" stroke="#facc15" strokeWidth="4" strokeDasharray="8 5" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.9))" />
          )}
          {tearConfig.direction === 'right' && (
            <line x1="80%" y1="0%" x2="80%" y2="100%" stroke="#facc15" strokeWidth="4" strokeDasharray="8 5" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.9))" />
          )}
          {tearConfig.direction === 'custom' && customPoints.length >= 2 && (
            <line x1={`${customPoints[0].x}%`} y1={`${customPoints[0].y}%`} x2={`${customPoints[1].x}%`} y2={`${customPoints[1].y}%`} stroke="#facc15" strokeWidth="4" strokeDasharray="8 5" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.9))" />
          )}
        </svg>

        {/* Indicators in enlarged view */}
        {tearConfig.direction === 'custom' && customPoints.length >= 2 && (
          <>
            <div
              style={{ left: `${customPoints[0].x}%`, top: `${customPoints[0].y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-xs font-black shadow z-30"
            >
              1
            </div>
            <div
              style={{ left: `${customPoints[1].x}%`, top: `${customPoints[1].y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-xs font-black shadow z-30"
            >
              2
            </div>
          </>
        )}
      </ModernImageLightbox>

      {/* 9-GRID PACK COVER CROPPER MODAL */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageUrl={rawOriginalUrl || coverImageUrl}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={(croppedData) => {
          onChangeCover(croppedData, rawOriginalUrl || coverImageUrl);
          onChangeAspectRatio('custom');
        }}
        title={t.modals.cropper.title}
      />
    </div>
  );
};
