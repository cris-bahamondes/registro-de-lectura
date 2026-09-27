import React, { useState } from 'react';
import { UserProfile } from '../types';
import { LogIn, LogOut, Sparkles, User, X, AlertCircle, Download, Cloud, RefreshCw, Database, RotateCcw } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, signOut } from '../lib/firebase';
import { TypewriterAppIcon } from './TypewriterAppIcon';

interface AuthModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onLoginAsUser: (user: UserProfile) => void;
  onOpenInstall?: () => void;
  onOpenBackupRestore?: () => void;
  onOpenBackupModal?: () => void;
  isSyncing?: boolean;
  onManualSync?: () => void;
  totalBooks?: number;
  totalWishes?: number;
  lastSyncTime?: Date | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onLoginAsUser,
  onOpenInstall,
  onOpenBackupRestore,
  onOpenBackupModal,
  isSyncing = false,
  onManualSync,
  totalBooks = 0,
  totalWishes = 0,
  lastSyncTime,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  if (!isOpen) return null;

  const handlePurgeCacheAndReload = async () => {
    setClearingCache(true);
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    } catch {
      window.location.reload();
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profile: UserProfile = {
        name: user.displayName || 'Lector Google',
        email: user.email || 'usuario@google.com',
        avatar: user.photoURL || '',
        isGuest: false,
      };
      onLoginAsUser(profile);
      onClose();
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        // Fall back to redirect on mobile devices where popups are blocked
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          console.error('Redirect sign in error:', redirectErr);
          setErrorMessage('No se pudo abrir la ventana de Google. Por favor intenta permitir emergentes.');
        }
      } else if (code === 'auth/network-request-failed') {
        console.warn('Error de red al iniciar sesión.');
        setErrorMessage('Comprueba tu conexión a internet e inténtalo de nuevo.');
      } else {
        console.error('Error signing in with Google:', err);
        // Attempt redirect fallback for mobile webviews
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          setErrorMessage(err?.message || 'Ocurrió un error al iniciar sesión con Google.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    onLoginAsUser({
      name: 'Usuario Invitado',
      email: 'invitado@registrolectura.app',
      avatar: '',
      isGuest: true,
    });
    onClose();
  };

  const handleSelectGuest = () => {
    onLoginAsUser({
      name: 'Usuario Invitado',
      email: 'invitado@registrolectura.app',
      avatar: '',
      isGuest: true,
    });
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onLoginAsUser({
      name: customName.trim(),
      email: `${customName.toLowerCase().replace(/\s+/g, '.')}@lectura.app`,
      avatar: '',
      isGuest: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Typewriter Icon */}
        <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center p-1 bg-white rounded-2xl border border-zinc-200 shadow-2xs">
          <TypewriterAppIcon className="w-full h-full object-contain" />
        </div>

        <h2 className="text-xl font-black text-zinc-900 mb-1">
          {currentUser.isGuest ? 'Iniciar Sesión' : 'Tu Cuenta'}
        </h2>

        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
          {currentUser.isGuest
            ? 'Conecta tu cuenta de Google para sincronizar y respaldar tus lecturas en la nube.'
            : `Sesión iniciada como ${currentUser.name}`}
        </p>

        {/* Cloud Sync Status Card for logged-in user */}
        {!currentUser.isGuest && (
          <div className="mb-4 p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-xs">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <span>Nube y sincronización</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {isSyncing ? 'Sincronizando...' : 'Activo'}
              </span>
            </div>

            <p className="text-[11px] text-zinc-600 leading-snug">
              Tus libros, lecturas en curso y desafíos se sincronizan para estar idénticos en tus dispositivos.
            </p>

            <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-200/80">
              <span>Libros en la nube: <strong className="text-zinc-800">{totalBooks}</strong></span>
              {lastSyncTime && (
                <span className="text-[10px] text-zinc-400">
                  Última vez: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {totalBooks === 0 && !currentUser.isGuest && (
              <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-snug">
                <span className="font-bold">¿Agregaste libros en otra pestaña o dispositivo?</span>
                <p className="mt-0.5 text-amber-800">
                  Abre la pestaña donde los ingresaste (por ej. en AI Studio) para que se transfieran automáticamente a tu nuevo Firebase Blaze.
                </p>
              </div>
            )}

            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="w-full mt-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando ahora...' : 'Sincronizar dispositivos ahora'}</span>
              </button>
            )}

            {(onOpenBackupRestore || onOpenBackupModal) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  (onOpenBackupRestore || onOpenBackupModal)?.();
                }}
                className="w-full mt-1.5 py-2 px-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-2xs"
              >
                <Database className="w-3.5 h-3.5 text-cyan-700" />
                <span>Copia de seguridad, exportar / importar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePurgeCacheAndReload}
              disabled={clearingCache}
              className="w-full mt-1.5 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${clearingCache ? 'animate-spin' : ''}`} />
              <span>{clearingCache ? 'Limpiando y recargando...' : 'Limpiar caché y recargar versión más reciente'}</span>
            </button>
          </div>
        )}

        {/* Guest Mode Explanatory Notice */}
        {currentUser.isGuest && (
          <div className="mb-4 p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-left space-y-1.5 text-amber-950 text-xs">
            <div className="flex items-center gap-2 font-black text-amber-900">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 animate-pulse" />
              <span>Modo Invitado</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-snug">
              Este dispositivo trabaja localmente. Inicia sesión con Google para sincronizar automáticamente tus libros entre todos tus dispositivos.
            </p>
          </div>
        )}

        {/* Error alert if any */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-left flex items-start gap-2 text-red-700 text-xs animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1">{errorMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Real Google Account Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full p-3 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-300 shadow-2xs hover:shadow-xs flex items-center justify-center gap-3 transition-all active:scale-98 group disabled:opacity-50"
          >
            {/* Official Google G SVG Icon */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            </div>
            <span className="text-xs font-bold text-zinc-900">
              {loading ? 'Conectando con Google...' : 'Continuar con Google'}
            </span>
          </button>

          {!currentUser.isGuest && (
            <button
              type="button"
              onClick={handleSignOutGoogle}
              className="w-full py-2.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          )}

          {currentUser.isGuest && (
            <button
              type="button"
              onClick={handleSelectGuest}
              className="w-full py-2.5 px-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 text-zinc-600 font-semibold text-xs border border-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <User className="w-3.5 h-3.5" />
              <span>Continuar en modo local / invitado</span>
            </button>
          )}

          {onOpenInstall && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInstall();
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-bold text-xs border border-cyan-200 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Download className="w-3.5 h-3.5 text-cyan-700" />
              <span>Instalar aplicación en tu dispositivo</span>
            </button>
          )}

          {/* Custom Name toggle */}
          {showCustomInput ? (
            <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-zinc-100">
              <label className="block text-[11px] font-bold text-zinc-700 text-left mb-1">
                Nombre de perfil local:
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ej: Cristóbal Bahamondes"
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900 mb-2 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800"
                >
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="text-[11px] text-zinc-500 hover:text-zinc-900 font-semibold underline pt-1 block mx-auto transition-colors"
            >
              Personalizar nombre localmente
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
