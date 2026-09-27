import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronUp, ChevronDown, X, ArrowRight, Plus } from 'lucide-react';
import { Book, TabType } from '../types';

interface ReadingWidgetProps {
  activeBook: Book | null;
  activeTab: TabType;
  onGoToReading: () => void;
  onUpdatePages?: (bookId: string, newPages: number) => void;
  onViewBookDetail?: (book: Book) => void;
}

export const ReadingWidget: React.FC<ReadingWidgetProps> = ({
  activeBook,
  activeTab,
  onGoToReading,
  onUpdatePages,
  onViewBookDetail,
}) => {
  // Widget visibility state
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('registro_lectura_widget_visible_v1');
    return saved !== null ? saved === 'true' : true;
  });

  // Collapsed / Minimized pill mode
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    const saved = localStorage.getItem('registro_lectura_widget_minimized_v1');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('registro_lectura_widget_visible_v1', String(isVisible));
  }, [isVisible]);

  useEffect(() => {
    localStorage.setItem('registro_lectura_widget_minimized_v1', String(isMinimized));
  }, [isMinimized]);

  if (!activeBook || !isVisible) {
    return null;
  }

  // Reading progress percentage calculation
  const percentage =
    activeBook.totalPages > 0
      ? Math.min(100, Math.round(((activeBook.currentPage || 0) / activeBook.totalPages) * 100))
      : 0;

  const progressLabel = `pág. ${activeBook.currentPage || 0} de ${activeBook.totalPages || 0}`;

  const handleQuickAddPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdatePages) return;
    const nextPg = Math.min((activeBook.currentPage || 0) + 1, activeBook.totalPages || 9999);
    onUpdatePages(activeBook.id, nextPg);
  };

  return (
    <aside
      aria-label="Widget de lectura activa"
      className="fixed bottom-[74px] sm:bottom-[78px] left-0 right-0 z-30 pointer-events-none flex justify-center px-3.5 sm:px-4 transition-all duration-300"
    >
      <div className="w-full max-w-lg pointer-events-auto">
        {/* Minimized Pill Mode */}
        {isMinimized ? (
          <div
            id="reading-widget-minimized"
            onClick={() => setIsMinimized(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsMinimized(false);
              }
            }}
            className="group flex items-center justify-between gap-2.5 bg-white/95 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/90 shadow-[0_6px_20px_rgba(0,0,0,0.14)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.18)] hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all"
            title="Toca para expandir el widget de lectura"
          >
            {/* Left: Thumbnail / Icon */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeBook.coverImage ? (
                <img
                  src={activeBook.coverImage}
                  alt={activeBook.title}
                  referrerPolicy="no-referrer"
                  className="w-7 h-9 object-cover rounded-md shadow-2xs shrink-0"
                />
              ) : (
                <div
                  className="w-7 h-9 rounded-md flex items-center justify-center shrink-0 text-white font-bold shadow-2xs text-[10px]"
                  style={{ backgroundColor: activeBook.coverColor || '#18181b' }}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900 truncate leading-tight">
                  {activeBook.title}
                </p>
                <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                  {progressLabel}
                </p>
              </div>
            </div>

            {/* Right: Percentage Badge & Expand */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-black px-2 py-0.5 rounded-full text-white bg-zinc-900 tracking-tight shadow-2xs">
                {percentage}%
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(false);
                }}
                className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
                title="Expandir widget"
                aria-label="Expandir widget"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Card Mode (iOS/Android Widget Card) */
          <div
            id="reading-widget-card"
            className="bg-white/95 backdrop-blur-md rounded-2xl border border-zinc-200/90 shadow-[0_10px_32px_rgba(0,0,0,0.16)] p-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {/* Top Row: Mini Tag, Title, Actions */}
            <div className="flex items-start justify-between gap-2">
              {/* Cover Image & Details */}
              <div
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                onClick={() => {
                  if (activeTab !== 'leyendo') {
                    onGoToReading();
                  } else if (onViewBookDetail) {
                    onViewBookDetail(activeBook);
                  }
                }}
                title="Ir al libro en lectura"
              >
                {/* Book Thumbnail */}
                <div className="relative shrink-0">
                  {activeBook.coverImage ? (
                    <img
                      src={activeBook.coverImage}
                      alt={activeBook.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-14 object-cover rounded-lg shadow-sm group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div
                      className="w-10 h-14 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                      style={{ backgroundColor: activeBook.coverColor || '#18181b' }}
                    >
                      <BookOpen className="w-5 h-5 text-white/90" />
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-black/80 text-white tracking-wider">
                    {activeBook.format === 'digital' ? 'DIG' : 'FÍS'}
                  </span>
                </div>

                {/* Title & Author */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-zinc-900 text-white leading-tight">
                      Widget de Lectura
                    </span>
                    <span className="text-[10px] text-zinc-500 font-medium truncate">
                      {progressLabel}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-black text-zinc-950 truncate leading-snug group-hover:underline underline-offset-2">
                    {activeBook.title}
                  </h4>

                  <p className="text-[11px] text-zinc-600 truncate leading-tight font-medium">
                    {activeBook.author}
                  </p>
                </div>
              </div>

              {/* Top Right Controls: Percentage Badge, Minimize, Close */}
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                {/* Percentage Badge */}
                <div className="flex items-center justify-center px-2 py-0.5 rounded-full text-white bg-zinc-900 text-xs font-black tracking-tight shadow-2xs">
                  {percentage}%
                </div>

                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="w-6 h-6 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                  title="Minimizar widget a barra compacta"
                  aria-label="Minimizar widget"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsVisible(false)}
                  className="w-6 h-6 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  title="Ocultar widget (puedes reactivarlo desde el encabezado)"
                  aria-label="Cerrar widget"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Middle Row: Slim Progress Bar */}
            <div className="mt-2.5">
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-zinc-900 rounded-full transition-all duration-300"
                  style={{
                    width: `${percentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Bottom Row: Quick Actions */}
            <div className="mt-2 pt-1.5 border-t border-zinc-100/90 flex items-center justify-between gap-2 text-[11px]">
              {/* Quick +1 page */}
              {onUpdatePages ? (
                <button
                  type="button"
                  onClick={handleQuickAddPage}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Sumar 1 página leída"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>+1 pág</span>
                </button>
              ) : (
                <span />
              )}

              {/* Go to Reading View Button */}
              <button
                type="button"
                onClick={onGoToReading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <span>{activeTab === 'leyendo' ? 'Ver detalles' : 'Continuar leyendo'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
