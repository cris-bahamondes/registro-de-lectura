import React from 'react';
import { LogOut, RefreshCw, Cloud, Database } from 'lucide-react';
import { UserProfile } from '../types';
import { TypewriterAppIcon } from './TypewriterAppIcon';

interface HeaderProps {
  user: UserProfile;
  onOpenAuthModal: () => void;
  onOpenInstallBanner: () => void;
  onOpenBackupModal?: () => void;
  isSyncing?: boolean;
  onManualSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenAuthModal,
  onOpenInstallBanner,
  onOpenBackupModal,
  isSyncing = false,
  onManualSync,
}) => {
  return (
    <header className="w-full max-w-full pt-3 pb-2 px-3 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Typewriter App Icon */}
        <button
          onClick={onOpenInstallBanner}
          className="w-10 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/95 border border-zinc-200/90 shadow-2xs flex items-center justify-center shrink-0 p-1 group hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400"
          title="Instalar aplicación en tu dispositivo"
          aria-label="Abrir panel de instalación"
        >
          <TypewriterAppIcon className="w-full h-full object-contain pointer-events-none drop-shadow-2xs" />
        </button>

        <div className="flex flex-col">
          <span className="font-['Playfair_Display',serif] font-black text-[1.05rem] sm:text-[1.3rem] leading-none text-zinc-900 tracking-tight">
            REGISTRO DE
          </span>
          <span className="font-['Playfair_Display',serif] font-black text-[1.05rem] sm:text-[1.3rem] leading-none text-zinc-600 tracking-tight mt-0.5">
            LECTURA
          </span>
        </div>
      </div>

      {/* Right Controls: Sync, Backup & User Bar */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {onOpenBackupModal && (
          <button
            onClick={onOpenBackupModal}
            className="flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1.5 sm:py-1.5 sm:px-2.5 rounded-full border border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-all active:scale-95 cursor-pointer text-zinc-700 hover:text-zinc-900"
            title="Copia de seguridad, exportar e importar JSON"
            aria-label="Copia de seguridad y recuperación"
          >
            <Database className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[11px] font-bold hidden xl:inline">Respaldo</span>
          </button>
        )}

        {/* Sync Status & Force Sync Button */}
        {onManualSync && (
          <button
            onClick={user.isGuest ? onOpenAuthModal : onManualSync}
            disabled={isSyncing}
            className={`flex items-center gap-1 py-1.5 px-2 sm:px-3 rounded-full border shadow-2xs transition-all active:scale-95 cursor-pointer ${
              isSyncing
                ? 'bg-cyan-50/90 border-cyan-300 text-cyan-800 cursor-wait'
                : user.isGuest
                ? 'bg-amber-50/80 border-amber-200 text-amber-800 hover:border-amber-300'
                : 'bg-white/95 border-zinc-200/90 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900'
            }`}
            title={
              user.isGuest
                ? 'Modo local (Invitado). Toca para conectar Google y sincronizar en la nube.'
                : 'Sincronizar ahora con la nube y otros dispositivos'
            }
            aria-label={user.isGuest ? 'Iniciar sesión para sincronizar' : 'Forzar sincronización manual'}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-cyan-600 animate-spin shrink-0" />
            ) : user.isGuest ? (
              <Cloud className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600 group-hover:rotate-180 transition-transform shrink-0" />
            )}
            <span className="text-[11px] font-bold whitespace-nowrap">
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </span>
          </button>
        )}

        {/* User Bar */}
        <button
          onClick={onOpenAuthModal}
          className={`flex items-center gap-1.5 py-1 px-1.5 sm:py-1.5 sm:px-3 rounded-full border shadow-xs hover:shadow-md transition-all active:scale-95 group cursor-pointer ${
            user.isGuest
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-white/90 border-zinc-200 text-zinc-900'
          }`}
          title={
            user.isGuest
              ? 'Punto Amarillo: Modo Invitado. Toca para Iniciar Sesión con Google'
              : 'Punto Verde: Sincronizado en la nube con Google'
          }
        >
          <div className="relative shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover ring-2 ring-zinc-300"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0)}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                user.isGuest ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
          </div>

          <div className="hidden md:flex flex-col text-left max-w-[100px] sm:max-w-[150px]">
            <span className="text-[12px] font-bold text-zinc-900 truncate leading-none">
              {user.isGuest ? 'Iniciar Sesión' : user.name.split(' ')[0]}
            </span>
            <span
              className={`text-[10px] truncate leading-tight font-semibold mt-0.5 ${
                user.isGuest ? 'text-amber-800' : 'text-emerald-700'
              }`}
            >
              {user.isGuest ? 'Modo Invitado' : 'Sincronizado'}
            </span>
          </div>

          <LogOut className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 transition-colors hidden sm:block ml-0.5" />
        </button>
      </div>
    </header>
  );
};

