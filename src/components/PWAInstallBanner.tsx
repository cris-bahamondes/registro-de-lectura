import React, { useState } from 'react';
import {
  Download,
  X,
  Share,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Laptop,
  Check
} from 'lucide-react';
import { TypewriterAppIcon } from './TypewriterAppIcon';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen && !showInstructionsModal) {
    return null;
  }

  const handleInstallClick = async () => {
    // 1. If inside an iframe (like AI Studio preview), native prompt is blocked by browser security
    if (isInIframe) {
      setShowInstructionsModal(true);
      return;
    }

    // 2. If browser provided native install prompt, trigger it directly
    if (isInstallable) {
      const result = await install();
      if (result.outcome === 'accepted') {
        onClose();
        return;
      }
      if (result.outcome === 'dismissed') {
        // User clicked cancel on native dialog
        return;
      }
    }

    // 3. If iOS Safari or browser requires manual steps, show friendly visual guide modal
    setShowInstructionsModal(true);
  };

  const handleOpenInNewTab = () => {
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = window.location.href;
    }
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="px-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-2xl p-3.5 shadow-xl border border-zinc-700/80 flex items-center justify-between gap-3 relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-cyan-500/15 rounded-full blur-xl pointer-events-none" />

            {/* Icon & Message */}
            <div className="flex items-center gap-3 min-w-0 z-10">
              <div className="w-11 h-11 rounded-xl bg-white/10 p-0.5 flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                <TypewriterAppIcon className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5 truncate">
                  {isInstalled ? 'Aplicación Instalada' : 'Instalar en tu dispositivo'}
                </span>
                <span className="text-[11px] text-zinc-300 font-medium leading-tight line-clamp-1">
                  {isInstalled
                    ? 'Estás disfrutando de la versión nativa'
                    : 'Accede en 1 toque y lee sin conexión'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0 z-10">
              {!isInstalled ? (
                <button
                  id="btn-pwa-install-action"
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Instalar</span>
                </button>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Instalada
                </span>
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                aria-label="Cerrar banner de instalación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Installation Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-zinc-800 relative animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setShowInstructionsModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>

            {/* App Icon Header */}
            <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center p-1 bg-white rounded-2xl border border-zinc-200 shadow-2xs">
              <TypewriterAppIcon className="w-full h-full object-contain" />
            </div>

            <h3 className="text-lg font-black text-zinc-900 text-center mb-1">
              Instalar Mi Registro de Lectura
            </h3>

            <p className="text-xs text-zinc-500 text-center mb-4 leading-relaxed">
              Instala la aplicación en tu pantalla de inicio para abrirla como app nativa, a pantalla completa y sin conexión.
            </p>

            {/* Iframe Notice & Direct Open Action */}
            {isInIframe && (
              <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <p className="font-bold mb-1.5 flex items-center gap-1.5 text-amber-800">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir en pestaña completa
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800/90 mb-2.5">
                  Estás usando el visor embebido. Para permitir la instalación automática en tu teléfono o computadora, abre la app en una pestaña directa:
                </p>
                <button
                  onClick={handleOpenInNewTab}
                  className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en nueva pestaña para instalar</span>
                </button>
              </div>
            )}

            {/* OS Specific Instructions */}
            <div className="space-y-3 mb-5">
              {isIOS ? (
                /* iOS Safari Steps */
                <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200/80 text-xs text-zinc-700">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 mb-2">
                    <Smartphone className="w-4 h-4 text-cyan-600" />
                    <span>En iPhone o iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-600 pl-1 leading-relaxed">
                    <li>
                      Toca el botón <strong>Compartir</strong>{' '}
                      <Share className="w-3.5 h-3.5 inline text-cyan-600 mx-0.5" /> en la barra inferior de Safari.
                    </li>
                    <li>
                      Desliza el menú hacia abajo y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
                    </li>
                    <li>
                      Toca <strong>"Añadir"</strong> en la esquina superior derecha.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                /* Android Chrome Steps */
                <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200/80 text-xs text-zinc-700">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 mb-2">
                    <Smartphone className="w-4 h-4 text-cyan-600" />
                    <span>En Android (Google Chrome):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-600 pl-1 leading-relaxed">
                    <li>
                      Toca el menú de opciones (los <strong>3 puntos verticales ⋮</strong> arriba a la derecha).
                    </li>
                    <li>
                      Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla principal"</strong>.
                    </li>
                    <li>
                      Confirma la instalación para añadir el ícono a tus aplicaciones.
                    </li>
                  </ol>
                </div>
              ) : (
                /* Desktop Chrome / Edge Steps */
                <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-200/80 text-xs text-zinc-700">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 mb-2">
                    <Laptop className="w-4 h-4 text-cyan-600" />
                    <span>En Computadora (Chrome o Edge):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-600 pl-1 leading-relaxed">
                    <li>
                      Haz clic en el ícono de <strong>Instalar</strong> en la barra de direcciones (a la derecha de la URL).
                    </li>
                    <li>
                      O abre el menú (<strong>⋮</strong>) y selecciona <strong>"Instalar Mi Registro de Lectura..."</strong>.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">¡Enlace copiado!</span>
                  </>
                ) : (
                  <>
                    <Share className="w-3.5 h-3.5" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
