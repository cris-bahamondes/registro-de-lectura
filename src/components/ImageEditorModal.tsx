import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, RotateCw, RotateCcw, ZoomIn, ZoomOut, Move, Check, RefreshCw, Crop } from 'lucide-react';

interface ImageEditorModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onSave: (editedDataUrl: string) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);

  // Target output dimensions for high quality, lightweight book cover (approx 15-20KB)
  const TARGET_WIDTH = 280;
  const TARGET_HEIGHT = 380;

  // Load the image whenever imageSrc changes
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    setIsLoadingImage(true);
    setImageLoadError(false);

    let isSubscribed = true;
    const img = new Image();

    // If data URL or blob, do not set crossOrigin
    const isDataOrBlob = imageSrc.startsWith('data:') || imageSrc.startsWith('blob:');
    if (!isDataOrBlob) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (!isSubscribed) return;
      setLoadedImage(img);
      setIsLoadingImage(false);
      setImageLoadError(false);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };

    img.onerror = () => {
      // If anonymous CORS failed, retry without crossOrigin as fallback
      if (img.crossOrigin) {
        console.warn('[ImageEditor] Retrying image without crossOrigin...');
        const retryImg = new Image();
        retryImg.onload = () => {
          if (!isSubscribed) return;
          setLoadedImage(retryImg);
          setIsLoadingImage(false);
          setImageLoadError(false);
          setZoom(1);
          setRotation(0);
          setOffset({ x: 0, y: 0 });
        };
        retryImg.onerror = () => {
          if (!isSubscribed) return;
          setIsLoadingImage(false);
          setImageLoadError(true);
        };
        retryImg.src = imageSrc;
      } else {
        if (!isSubscribed) return;
        setIsLoadingImage(false);
        setImageLoadError(true);
      }
    };

    img.src = imageSrc;

    return () => {
      isSubscribed = false;
    };
  }, [imageSrc, isOpen]);

  // Redraw canvas whenever parameters change
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    // Clear background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    ctx.save();

    // Center of canvas
    ctx.translate(TARGET_WIDTH / 2 + offset.x, TARGET_HEIGHT / 2 + offset.y);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Apply zoom
    ctx.scale(zoom, zoom);

    // Calculate base scale to fit into cover
    const imgWidth = loadedImage.naturalWidth || loadedImage.width;
    const imgHeight = loadedImage.naturalHeight || loadedImage.height;

    const scaleFactor = Math.max(TARGET_WIDTH / imgWidth, TARGET_HEIGHT / imgHeight);
    const drawW = imgWidth * scaleFactor;
    const drawH = imgHeight * scaleFactor;

    ctx.drawImage(loadedImage, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();
  }, [loadedImage, zoom, rotation, offset]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  if (!isOpen || !imageSrc) return null;

  // Mouse & Touch Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4, +(prev + 0.2).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.4, +(prev - 0.2).toFixed(2)));
  };

  // Rotate handlers
  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  // Reset
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Save edited image
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/webp', 0.80);
      onSave(dataUrl);
      onClose();
    } catch {
      try {
        const fallbackUrl = canvas.toDataURL('image/jpeg', 0.80);
        onSave(fallbackUrl);
        onClose();
      } catch {
        // If canvas is tainted or toDataURL blocked, safely save the original imageSrc
        console.warn('[ImageEditor] Canvas tainted by cross-origin resource; preserving raw imageSrc');
        onSave(imageSrc);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-zinc-900 text-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-800 flex flex-col my-auto text-left animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-100 flex items-center justify-center shadow-2xs border border-zinc-700">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                EDITAR PORTADA
              </h2>
              <p className="text-[10px] text-zinc-400 font-medium">
                Ajusta el zoom, gira y encuadra la imagen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Canvas Container */}
        <div className="p-4 sm:p-5 flex flex-col items-center bg-zinc-950">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-700/80 bg-zinc-900 aspect-[3/4] w-52 sm:w-60 flex items-center justify-center group cursor-grab active:cursor-grabbing select-none touch-none">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full object-cover"
            />

            {isLoadingImage && (
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
                <RefreshCw className="w-6 h-6 text-zinc-300 animate-spin" />
                <span className="text-[11px] font-bold text-zinc-300">Cargando imagen...</span>
              </div>
            )}

            {imageLoadError && (
              <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-4 text-center z-10">
                <p className="text-xs text-amber-400 font-bold mb-2">No se pudo cargar la imagen externa</p>
                <p className="text-[10px] text-zinc-400 mb-3">La URL podría tener restricciones de origen.</p>
                <button
                  type="button"
                  onClick={() => {
                    onSave(imageSrc);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 border border-zinc-700"
                >
                  Usar URL directamente
                </button>
              </div>
            )}

            {/* Grid overlay for framing assistance */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/10">
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-white/10" />
              <div className="border-r border-white/10" />
              <div />
            </div>

            {/* Helper label */}
            <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
              <span className="inline-flex items-center gap-1 bg-black/75 backdrop-blur-xs text-[10px] font-bold text-zinc-300 px-2 py-0.5 rounded-full border border-white/10">
                <Move className="w-2.5 h-2.5" /> Arrastra para encuadrar
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="px-5 py-4 space-y-4 bg-zinc-900 border-t border-zinc-800 text-xs">
          {/* Zoom Slider & Buttons */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-zinc-400" />
                <span>Zoom / Escala</span>
              </span>
              <span className="text-[11px] font-mono text-zinc-400">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-white bg-zinc-800 h-2 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rotate & Reset Controls */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handleRotateLeft}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Girar -90°</span>
            </button>

            <button
              type="button"
              onClick={handleRotateRight}
              className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Girar +90°</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="py-2 px-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/60 font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-950 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-black text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Aplicar y Guardar Portada</span>
          </button>
        </div>
      </div>
    </div>
  );
};
