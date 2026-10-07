import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useGacha } from '../context/GachaContext';
import { getTranslation } from '../i18n/translations';

interface ModernImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  children?: React.ReactNode;
}

export const ModernImageLightbox: React.FC<ModernImageLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  children,
}) => {
  const { language } = useGacha();
  const t = getTranslation(language);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const hasMovedRef = useRef(false);

  // Body scroll lock (Item 6)
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Reset transform when opened with a new image
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
      hasMovedRef.current = false;
    }
  }, [isOpen, imageUrl]);

  // Keyboard navigation (ESC to close, + / - to zoom, 0 to reset)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
      } else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => {
      const next = Math.round(prev * factor * 100) / 100;
      return Math.min(5, Math.max(0.5, next));
    });
  }, []);

  // Double click to toggle zoom (1x <-> 2.5x)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      if (prev <= 1.1) {
        return 2.5;
      } else {
        setPan({ x: 0, y: 0 });
        return 1;
      }
    });
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Left mouse button only
    if (e.button !== 0) return;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    // If not dragged, close when clicking anywhere outside the image
    if (!hasMovedRef.current) {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        const isInsideImage = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
        if (!isInsideImage) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  // Touch handlers (1 finger = pan, 2 fingers = pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    hasMovedRef.current = false;
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
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMovedRef.current = true;
      }
      setPan({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && pinchStartDistRef.current) {
      hasMovedRef.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scaleFactor = dist / pinchStartDistRef.current;
      const nextZoom = Math.round(pinchStartZoomRef.current * scaleFactor * 100) / 100;
      setZoom(Math.min(5, Math.max(0.5, nextZoom)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    pinchStartDistRef.current = null;
    if (!hasMovedRef.current && e.changedTouches && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        const isInsideImage = (
          touch.clientX >= rect.left &&
          touch.clientX <= rect.right &&
          touch.clientY >= rect.top &&
          touch.clientY <= rect.bottom
        );
        if (!isInsideImage) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      className={`fixed inset-0 w-screen h-screen z-[999] flex items-center justify-center bg-black/90 backdrop-blur-md select-none overflow-hidden touch-none animate-in fade-in duration-200 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Top Floating Neo-Brutalist Toolbar */}
      <div
        className="absolute top-4 inset-x-4 z-50 flex items-center justify-between gap-3 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title badge */}
        <div className="pointer-events-auto bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)] max-w-sm sm:max-w-md truncate">
          <h3 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white font-['Mali'] truncate">
            {title || t.modals.lightbox.title}
          </h3>
        </div>

        {/* Controls */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white dark:bg-zinc-800 border-2 border-black dark:border-white rounded-2xl p-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)]">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
            className="p-1.5 rounded-xl border border-black hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 sketch-btn"
            title={t.modals.lightbox.zoomOut}
          >
            <ZoomOut size={16} />
          </button>

          {/* Reset to 100% */}
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="px-2.5 py-1 text-xs font-black rounded-xl border border-black hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 sketch-btn"
            title={t.modals.lightbox.reset}
          >
            <RotateCcw size={13} />
            <span>{Math.round(zoom * 100)}%</span>
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100))}
            className="p-1.5 rounded-xl border border-black hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 sketch-btn"
            title={t.modals.lightbox.zoomIn}
          >
            <ZoomIn size={16} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-black bg-red-500 hover:bg-red-600 text-white sketch-btn ml-1"
            title={t.modals.lightbox.close}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Image Viewport (NO SCROLLBARS, Smooth GPU pan & scale) */}
      <div
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0.2, 1)',
        }}
        className="relative max-w-[88vw] max-h-[82vh] flex items-center justify-center pointer-events-none will-change-transform"
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt={title || 'Inspect Image'}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="max-w-[85vw] max-h-[80vh] w-auto h-auto object-contain rounded-2xl border-3 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.8)] pointer-events-none select-none block bg-zinc-900"
        />

        {/* Optional Overlays (e.g., tear line preview in PackCoverConfigurator) */}
        {children && (
          <div className="absolute inset-0 pointer-events-none">
            {children}
          </div>
        )}
      </div>

      {/* Bottom Hint Banner (Unobtrusive) */}
      <div className="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none">
        <div className="bg-black/70 backdrop-blur-md text-white/90 text-[11px] font-bold px-4 py-1.5 rounded-full border border-white/20 shadow-lg text-center">
          {language === 'th'
            ? 'เลื่อนเมาส์หรือใช้นิ้วจีบเพื่อซูม • ลากเพื่อเลื่อน • ดับเบิลคลิกเพื่อสลับขนาด'
            : 'Scroll or pinch to zoom • Drag to pan • Double click to toggle size'}
        </div>
      </div>
    </div>
  );
};
