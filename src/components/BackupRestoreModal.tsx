import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Search,
  Database,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Sparkles,
  BookOpen,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { Book, WishlistItem, AnnualChallenge, MonthlyChallenge, UserProfile } from '../types';
import {
  generateLibraryBackupJson,
  downloadLibraryBackupFile,
  parseLibraryBackupJson,
  scanAndRecoverAllBooks,
  saveBooksBatchToCloud,
  saveAnnualChallengeToCloud,
  isCorruptedOrPlaceholderTitle,
  filterRealBooksOnly,
  clearLocalDeletedBook,
  DeepScanResult,
} from '../lib/syncService';
import { bookStorage } from '../lib/bookStorage';
import { coverStorage } from '../lib/coverStorage';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  wishlist: WishlistItem[];
  annualChallenges: Record<number, AnnualChallenge>;
  challenges?: MonthlyChallenge[];
  user: UserProfile;
  userId?: string;
  onRestoreComplete: (restored: {
    books: Book[];
    wishlist?: WishlistItem[];
    annualChallenges?: Record<number, AnnualChallenge>;
    challenges?: MonthlyChallenge[];
  }) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  books,
  wishlist,
  annualChallenges,
  challenges = [],
  user,
  userId,
  onRestoreComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'import' | 'export'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DeepScanResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    booksCount: number;
    wishlistCount: number;
    yearsCount: number;
    challengesCount: number;
    data: {
      books: Book[];
      wishlist: WishlistItem[];
      annualChallenges: Record<number, AnnualChallenge>;
      challenges: MonthlyChallenge[];
    };
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Deep Scan
  const handleRunDeepScan = async () => {
    setIsScanning(true);
    setFeedback(null);
    try {
      const result = await scanAndRecoverAllBooks(books, userId);
      setScanResult(result);
      if (result.books && result.books.length > 0) {
        onRestoreComplete({ books: result.books });
      }
      if (result.newlyRecovered > 0) {
        setFeedback({
          type: 'success',
          message: `¡Se recuperaron ${result.newlyRecovered} libros adicionales! Total en biblioteca: ${result.totalFound} libros.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Escaneo completado. Se verificaron ${result.totalFound} libros en el almacenamiento local y nube.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error durante el escaneo de memoria.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Export
  const handleExportBackup = () => {
    try {
      const json = generateLibraryBackupJson(books, wishlist, annualChallenges, user, challenges);
      downloadLibraryBackupFile(json);
      setFeedback({
        type: 'success',
        message: `¡Copia de seguridad descargada exitosamente! Incluye libros, lista de deseos y desafíos de lectura.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'No se pudo generar el archivo de respaldo.',
      });
    }
  };

  // Handle File Pick
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseLibraryBackupJson(text);
        setImportPreview({
          fileName: file.name,
          booksCount: parsed.books.length,
          wishlistCount: parsed.wishlist.length,
          yearsCount: Object.keys(parsed.annualChallenges).length,
          challengesCount: parsed.challenges.length,
          data: parsed,
        });
        setFeedback(null);
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err?.message || 'El archivo seleccionado no es un respaldo válido.',
        });
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    setFeedback(null);

    try {
      const {
        books: importedBooks,
        wishlist: importedWish,
        annualChallenges: importedAnnuals,
        challenges: importedChallenges,
      } = importPreview.data;

      // Merge with existing books or use imported list (strictly filtering out any non-book items)
      const cleanExisting = filterRealBooksOnly(books);
      const cleanImported = filterRealBooksOnly(importedBooks);

      const booksMap = new Map<string, Book>();
      cleanExisting.forEach((b) => booksMap.set(b.id, b));
      cleanImported.forEach((b) => {
        if (b && b.id && b.title) {
          const existing = booksMap.get(b.id);
          if (!existing) {
            booksMap.set(b.id, b);
          } else {
            const existingHasReal = !isCorruptedOrPlaceholderTitle(existing.title);
            const bHasReal = !isCorruptedOrPlaceholderTitle(b.title);
            let chosen = b;
            if (!existingHasReal && bHasReal) {
              chosen = b;
            } else if (existingHasReal && !bHasReal) {
              chosen = existing;
            } else {
              const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
              chosen = bTime >= exTime ? b : existing;
            }
            booksMap.set(b.id, {
              ...chosen,
              coverImage: b.coverImage || existing.coverImage || chosen.coverImage,
              chapters: (b.chapters && b.chapters.length > 0) ? b.chapters : existing.chapters,
            });
          }
        }
      });

      const mergedBooks = filterRealBooksOnly(Array.from(booksMap.values())).sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      // Save to IndexedDB, clear tombstones, and cache covers
      for (const b of mergedBooks) {
        if (b && b.id) {
          clearLocalDeletedBook(b.id, b.title, b.author);
          if (b.coverImage) {
            coverStorage.saveCover(b.id, b.coverImage).catch(() => {});
          }
        }
      }
      await bookStorage.saveBooksBatch(mergedBooks);

      // Save to Cloud in background if logged in
      if (userId) {
        if (mergedBooks.length > 0) {
          saveBooksBatchToCloud(userId, mergedBooks).catch(() => {});
        }
        if (Object.keys(importedAnnuals).length > 0) {
          Object.values(importedAnnuals).forEach((ann) => {
            saveAnnualChallengeToCloud(userId, ann).catch(() => {});
          });
        }
      }

      onRestoreComplete({
        books: mergedBooks,
        wishlist: importedWish.length > 0 ? importedWish : undefined,
        annualChallenges: Object.keys(importedAnnuals).length > 0 ? importedAnnuals : undefined,
        challenges: importedChallenges.length > 0 ? importedChallenges : undefined,
      });

      setFeedback({
        type: 'success',
        message: `¡Restauración exitosa! Libros, lista de deseos y desafíos de lectura restaurados correctamente.`,
      });
      setImportPreview(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Ocurrió un error al restaurar los datos.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-['Playfair_Display',serif] font-bold text-lg text-zinc-900 leading-tight">
                Copia de Seguridad y Recuperación
              </h2>
              <p className="text-xs text-zinc-500">
                Respalda, importa o recupera todos tus libros
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 bg-zinc-100/60 p-1.5 gap-1 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('scan');
              setFeedback(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'scan'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-cyan-600" />
            <span>Escanear y Recuperar</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('import');
              setFeedback(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Importar JSON</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('export');
              setFeedback(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'export'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Descargar Copia</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3 rounded-2xl flex items-start gap-2.5 text-xs font-medium animate-in fade-in duration-200 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{feedback.message}</div>
            </div>
          )}

          {/* TAB 1: SCAN & RECOVER */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-cyan-50/70 border border-cyan-200/80 rounded-2xl text-cyan-950 text-xs leading-relaxed space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-cyan-900">
                  <Sparkles className="w-4 h-4 text-cyan-600" />
                  <span>Escaneo Profundo de Memoria e IndexedDB</span>
                </div>
                <p>
                  Si tus libros no aparecen completos o se guardaron en otra sesión/base de datos, este escáner busca en todas las fuentes de almacenamiento local, retos anuales y bases de datos Firestore para reconstruir tu biblioteca completa.
                </p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Libros cargados en pantalla:</span>
                  <span className="font-bold text-zinc-900">{books.length} libros</span>
                </div>
                {scanResult && (
                  <div className="pt-2 border-t border-zinc-200 space-y-1.5 text-xs text-zinc-600">
                    <div className="flex justify-between">
                      <span>Total detectado en todas las fuentes:</span>
                      <strong className="text-zinc-900">{scanResult.totalFound} libros</strong>
                    </div>
                    <div className="text-[11px] text-zinc-500 pl-2 space-y-0.5 border-l-2 border-cyan-400">
                      <div>• IndexedDB persistente: {scanResult.sources.indexedDbMaster}</div>
                      <div>• Cachés de almacenamiento local: {scanResult.sources.localStorageSlots}</div>
                      <div>• Retos y meses de lectura: {scanResult.sources.annualChallenges}</div>
                      <div>• Firestore Nube: {scanResult.sources.cloudDatabase}</div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleRunDeepScan}
                disabled={isScanning}
                className="w-full py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{isScanning ? 'Escaneando memoria y nube...' : 'Escanear y Recuperar Todos los Libros'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: IMPORT BACKUP */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-emerald-950 text-xs leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  <span>Importar archivo de respaldo (.json)</span>
                </div>
                <p>
                  Si tienes un archivo JSON de respaldo, súbelo aquí para restaurar títulos, capítulos, fechas de lectura y portadas en un solo paso.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 rounded-2xl p-6 text-center cursor-pointer bg-zinc-50/60 hover:bg-zinc-100/60 transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto text-zinc-400 group-hover:text-zinc-700 transition-colors mb-2" />
                <p className="text-xs font-bold text-zinc-800">
                  Haz clic para seleccionar tu archivo de respaldo JSON
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Formatos compatibles: .json de Mi Registro de Lectura
                </p>
              </div>

              {/* Preview if file selected */}
              {importPreview && (
                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-900">
                    <span className="truncate max-w-[200px]">{importPreview.fileName}</span>
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                      Válido
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 space-y-1.5 pt-1 border-t border-zinc-200/80">
                    <div className="flex items-center gap-1.5 text-zinc-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Libros y registros de lectura</span>
                    </div>
                    {importPreview.wishlistCount > 0 && (
                      <div className="flex items-center gap-1.5 text-zinc-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Lista de deseos</span>
                      </div>
                    )}
                    {importPreview.yearsCount > 0 && (
                      <div className="flex items-center gap-1.5 text-zinc-700">
                        <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Desafíos y retos anuales de lectura</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>
                      {isImporting ? 'Restaurando datos...' : 'Restaurar datos a la biblioteca'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXPORT BACKUP */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-amber-950 text-xs leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <Download className="w-4 h-4 text-amber-600" />
                  <span>Descargar Copia de Seguridad Completa</span>
                </div>
                <p>
                  Guarda un archivo de respaldo con todos tus libros, portadas, lista de capítulos, fechas, calificaciones y retos de lectura en tu disco para que nunca pierdas tu progreso.
                </p>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2 text-xs text-zinc-700">
                <div className="flex items-center gap-2 text-zinc-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Libros y registro de lectura</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Lista de deseos</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-800">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Información de desafíos anuales de lectura</span>
                </div>
              </div>

              <button
                onClick={handleExportBackup}
                className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Archivo de Respaldo JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-200/60 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
