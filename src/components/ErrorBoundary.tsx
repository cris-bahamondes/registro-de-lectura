import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      // Clear localStorage to fix QuotaExceededError
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.clear();
        } catch {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k) keysToRemove.push(k);
          }
          keysToRemove.forEach((k) => {
            try { window.localStorage.removeItem(k); } catch {}
          });
        }
      }
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try { window.sessionStorage.clear(); } catch {}
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
    } catch (e) {
      console.warn('Error clearing caches and local storage:', e);
    }
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  public render() {
    if (this.state.hasError) {
      const isQuotaError =
        this.state.error &&
        (this.state.error.name === 'QuotaExceededError' ||
          this.state.error.message?.toLowerCase().includes('quota') ||
          String(this.state.error).toLowerCase().includes('quota'));

      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white">
                {isQuotaError ? 'Límite de memoria local excedido' : 'Hubo un inconveniente al cargar'}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isQuotaError
                  ? 'El almacenamiento local del navegador se llenó con imágenes o portadas de alta resolución. Pulsa "Restablecer memoria local" para liberar espacio. Tus datos en Google/Firebase están a salvo.'
                  : 'La aplicación detectó una discrepancia en la memoria local o en los archivos en caché. Puedes restablecer el almacenamiento para continuar.'}
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleResetCache}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Restablecer memoria local</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-zinc-400" />
                <span>Recargar</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
