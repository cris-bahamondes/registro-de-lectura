import React from 'react';
import { BookOpen } from 'lucide-react';
import { TabType } from '../types';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onReclickTab?: (tab: TabType) => void;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onReclickTab,
  className = '',
}) => {
  const indicatorColor = '#18181b';

  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab) {
      if (onReclickTab) onReclickTab(tab);
    } else {
      onTabChange(tab);
    }
  };

  return (
    <nav className={`w-full ${className}`} aria-label="Navegación de pantallas">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-zinc-200/90 p-1.5 flex items-center justify-between">
        {/* Tab 1: Biblioteca */}
        <button
          onClick={() => handleTabClick('biblioteca')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'biblioteca'
              ? 'text-zinc-950 font-bold'
              : 'text-zinc-400 hover:text-zinc-700 font-medium'
          }`}
        >
          {/* 3 Sleek Vertical Books Icon */}
          <div className="flex items-center justify-center gap-0.5 h-6 mb-1">
            <span className={`w-1.5 h-5 rounded-xs transition-colors ${activeTab === 'biblioteca' ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
            <span className={`w-1.5 h-5.5 rounded-xs transition-colors ${activeTab === 'biblioteca' ? 'bg-zinc-600' : 'bg-zinc-300'}`} />
            <span className={`w-1.5 h-5 rounded-xs transition-colors ${activeTab === 'biblioteca' ? 'bg-zinc-400' : 'bg-zinc-300'}`} />
          </div>
          <span className="text-[11px] sm:text-[13px] tracking-tight">Biblioteca</span>
          {activeTab === 'biblioteca' && (
            <span
              className="absolute bottom-0 w-8 h-0.5 rounded-full transition-all"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
        </button>

        {/* Tab 2: Deseos */}
        <button
          onClick={() => handleTabClick('deseos')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'deseos'
              ? 'text-zinc-950 font-bold'
              : 'text-zinc-400 hover:text-zinc-700 font-medium'
          }`}
        >
          {/* Bookmark & Heart Wishlist Icon */}
          <div className="relative mb-1 flex items-center justify-center">
            <svg
              className={`w-6 h-6 transition-transform ${activeTab === 'deseos' ? 'scale-110' : 'opacity-70'}`}
              viewBox="0 0 24 24"
              fill="none"
            >
              {/* Bookmark Ribbon */}
              <path
                d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-4-7 4V4z"
                stroke={activeTab === 'deseos' ? indicatorColor : '#a1a1aa'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={activeTab === 'deseos' ? '#f4f4f5' : 'none'}
              />
              {/* Heart inside bookmark */}
              <path
                d="M12 7.8c-.8-1.2-2.3-1.4-3.3-.4-.9.9-.9 2.4 0 3.3L12 14l3.3-3.3c.9-.9.9-2.4 0-3.3-1-1-2.5-.8-3.3.4z"
                fill={activeTab === 'deseos' ? '#3f3f46' : '#a1a1aa'}
                stroke={activeTab === 'deseos' ? '#3f3f46' : '#a1a1aa'}
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-[11px] sm:text-[13px] tracking-tight">Deseos</span>
          {activeTab === 'deseos' && (
            <span
              className="absolute bottom-0 w-8 h-0.5 rounded-full transition-all"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
        </button>

        {/* Tab 3: Leyendo (En Medio) */}
        <button
          onClick={() => handleTabClick('leyendo')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'leyendo'
              ? 'text-zinc-950 font-bold'
              : 'text-zinc-400 hover:text-zinc-700 font-medium'
          }`}
        >
          {/* Open Book Icon */}
          <div className="relative mb-1 flex items-center justify-center">
            <BookOpen
              className={`w-6 h-6 transition-transform ${
                activeTab === 'leyendo' ? 'scale-110' : 'opacity-70'
              }`}
              style={{
                color: activeTab === 'leyendo' ? indicatorColor : '#a1a1aa',
                strokeWidth: activeTab === 'leyendo' ? 2.3 : 1.8,
              }}
            />
          </div>
          <span className="text-[11px] sm:text-[13px] tracking-tight">Leyendo</span>
          {activeTab === 'leyendo' && (
            <span
              className="absolute bottom-0 w-8 h-0.5 rounded-full transition-all"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
        </button>

        {/* Tab 4: Desafío */}
        <button
          onClick={() => handleTabClick('desafio')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-0.5 sm:px-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'desafio'
              ? 'text-zinc-950 font-bold'
              : 'text-zinc-400 hover:text-zinc-700 font-medium'
          }`}
        >
          {/* Target / Trophy Challenge Icon */}
          <div className="relative mb-1 flex items-center justify-center">
            <svg
              className={`w-6 h-6 transition-transform ${activeTab === 'desafio' ? 'scale-110' : 'opacity-70'}`}
              viewBox="0 0 24 24"
              fill="none"
            >
              {/* Trophy base and cup */}
              <path
                d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3m12 5h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3"
                stroke={activeTab === 'desafio' ? indicatorColor : '#a1a1aa'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 4h12v6a6 6 0 0 1-12 0V4z"
                stroke={activeTab === 'desafio' ? indicatorColor : '#a1a1aa'}
                strokeWidth="1.8"
                fill={activeTab === 'desafio' ? '#f4f4f5' : 'none'}
              />
              <path
                d="M12 16v3m-3 2h6"
                stroke={activeTab === 'desafio' ? indicatorColor : '#a1a1aa'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Star inside cup */}
              <path
                d="M12 6.5l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z"
                fill={activeTab === 'desafio' ? '#3f3f46' : '#a1a1aa'}
                stroke={activeTab === 'desafio' ? '#71717a' : '#a1a1aa'}
                strokeWidth="0.5"
              />
            </svg>
          </div>
          <span className="text-[11px] sm:text-[13px] tracking-tight">Desafío</span>
          {activeTab === 'desafio' && (
            <span
              className="absolute bottom-0 w-8 h-0.5 rounded-full transition-all"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
        </button>

        {/* Tab 5: Estadísticas */}
        <button
          onClick={() => handleTabClick('estadisticas')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-0.5 sm:px-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'estadisticas'
              ? 'text-zinc-950 font-bold'
              : 'text-zinc-400 hover:text-zinc-700 font-medium'
          }`}
        >
          {/* Pie Chart Icon */}
          <div className="relative mb-1 flex items-center justify-center">
            <svg
              className={`w-6 h-6 transition-transform ${activeTab === 'estadisticas' ? 'scale-110' : 'opacity-70'}`}
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21.21 15.89A10 10 0 1 1 8 2.83"
                stroke={activeTab === 'estadisticas' ? indicatorColor : '#a1a1aa'}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M22 12A10 10 0 0 0 12 2v10z"
                fill={activeTab === 'estadisticas' ? '#d4d4d8' : '#a1a1aa'}
                stroke={activeTab === 'estadisticas' ? indicatorColor : '#a1a1aa'}
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <span className="text-[11px] sm:text-[13px] tracking-tight">Estadísticas</span>
          {activeTab === 'estadisticas' && (
            <span
              className="absolute bottom-0 w-8 h-0.5 rounded-full transition-all"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
        </button>
      </div>
    </nav>
  );
};

