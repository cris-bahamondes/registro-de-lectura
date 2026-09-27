import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Book, BookFormat, BookStatus, Chapter } from '../types';
import { CATEGORIES } from '../data/initialData';
import { StarRating } from './StarRating';
import { X, Upload, Camera, BookOpen, Trash2, Link as LinkIcon, Check, Plus, Crop, Layers, Bookmark, Tag, AlertTriangle, Search, Sparkles } from 'lucide-react';
import { ImageEditorModal } from './ImageEditorModal';
import { ChapterModal } from './ChapterModal';
import { CoverSearchModal } from './CoverSearchModal';
import { formatChapterDisplayTitle } from '../lib/romanUtils';
import { RomanChapterText } from './RomanChapterText';
import { getBookGenres, getStoredCustomGenres, saveCustomGenre } from '../lib/genreUtils';
import { calculateBookActiveReadingDays } from '../lib/readingDaysUtils';

interface BookModalProps {
  isOpen: boolean;
  editingBook: Book | null;
  allBooks?: Book[];
  existingSagas?: string[];
  existingGenres?: string[];
  onClose: () => void;
  onSave: (bookData: Partial<Book>) => void;
}

export const BookModal: React.FC<BookModalProps> = ({
  isOpen,
  editingBook,
  allBooks = [],
  existingSagas = [],
  existingGenres = [],
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState<number | ''>(300);
  const [currentPage, setCurrentPage] = useState<number | ''>(0);
  const [format, setFormat] = useState<BookFormat>('fisico');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Novela']);
  const [savedCustomGenres, setSavedCustomGenres] = useState<string[]>(() => getStoredCustomGenres());
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [showCustomGenreField, setShowCustomGenreField] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedSaga, setSelectedSaga] = useState('');
  const [newSagaName, setNewSagaName] = useState('');
  const [isCreatingNewSaga, setIsCreatingNewSaga] = useState(false);
  const [sagaOrder, setSagaOrder] = useState<number | ''>('');
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<BookStatus>('pendiente');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [readYear, setReadYear] = useState<number | ''>(2026);
  const [coverImage, setCoverImage] = useState<string>('');
  const [hasParts, setHasParts] = useState<boolean>(false);
  const [parts, setParts] = useState<string[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [isCoverSearchOpen, setIsCoverSearchOpen] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [editorImageSrc, setEditorImageSrc] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Combine default genres, saved custom genres, and all existing genres in library
  const allAvailableGenres = useMemo(() => {
    const set = new Set<string>();
    CATEGORIES.forEach((c) => set.add(c.trim()));
    savedCustomGenres.forEach((g) => {
      if (g && g.trim()) set.add(g.trim());
    });
    existingGenres.forEach((g) => {
      if (g && g.trim()) set.add(g.trim());
    });
    if (editingBook) {
      getBookGenres(editingBook).forEach((g) => {
        if (g && g.trim()) set.add(g.trim());
      });
    }
    selectedGenres.forEach((g) => {
      if (g && g.trim()) set.add(g.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [savedCustomGenres, existingGenres, editingBook, selectedGenres]);

  // Deduplicate and combine existing sagas
  const availableSagas = useMemo(() => {
    const set = new Set<string>();
    existingSagas.forEach((s) => {
      if (s && s.trim()) set.add(s.trim());
    });
    if (editingBook?.saga && editingBook.saga.trim()) {
      set.add(editingBook.saga.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingSagas, editingBook]);

  const activeSagaName = isCreatingNewSaga ? newSagaName.trim() : selectedSaga.trim();

  const booksInActiveSaga = useMemo(() => {
    if (!activeSagaName || !allBooks.length) return [];
    return allBooks
      .filter(
        (b) =>
          b.saga &&
          b.saga.trim().toLowerCase() === activeSagaName.toLowerCase() &&
          (!editingBook || b.id !== editingBook.id)
      )
      .sort((a, b) => {
        const orderA = a.sagaOrder ?? 9999;
        const orderB = b.sagaOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });
  }, [activeSagaName, allBooks, editingBook]);

  const suggestedNextOrder = useMemo(() => {
    if (!booksInActiveSaga.length) return 1;
    const existingOrders = booksInActiveSaga
      .map((b) => b.sagaOrder)
      .filter((n): n is number => n !== undefined && n !== null && !isNaN(n));
    if (existingOrders.length === 0) return booksInActiveSaga.length + 1;
    return Math.max(...existingOrders) + 1;
  }, [booksInActiveSaga]);

  // Detect if book already exists in library by normalized title
  const duplicateBook = useMemo(() => {
    const clean = title
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!clean || clean.length < 2) return null;
    return (
      allBooks.find((b) => {
        if (editingBook && b.id === editingBook.id) return false;
        const bClean = b.title
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return bClean === clean;
      }) || null
    );
  }, [title, allBooks, editingBook]);

  useEffect(() => {
    setSavedCustomGenres(getStoredCustomGenres());

    if (editingBook) {
      setTitle(editingBook.title);
      setAuthor(editingBook.author);
      setTotalPages(editingBook.totalPages);
      setCurrentPage(editingBook.currentPage);
      setFormat(editingBook.format);
      const loadedGenres = getBookGenres(editingBook);
      setSelectedGenres(loadedGenres.length > 0 ? loadedGenres : ['Novela']);
      setCustomGenreInput('');
      setShowCustomGenreField(false);
      setDescription(editingBook.description || '');
      
      const bookSaga = editingBook.saga?.trim() || '';
      if (bookSaga) {
        setSelectedSaga(bookSaga);
        setIsCreatingNewSaga(false);
        setNewSagaName('');
      } else {
        setSelectedSaga('');
        setIsCreatingNewSaga(false);
        setNewSagaName('');
      }
      setSagaOrder(
        editingBook.sagaOrder !== undefined && editingBook.sagaOrder !== null
          ? editingBook.sagaOrder
          : ''
      );

      setRating(editingBook.rating || 0);
      setStatus(editingBook.status);
      setStartDate(editingBook.startDate || '');
      setEndDate(editingBook.endDate || '');
      setReadYear(editingBook.readYear || 2026);
      setCoverImage(editingBook.coverImage || '');
      setHasParts(editingBook.hasParts || false);
      setParts(editingBook.parts ? [...editingBook.parts] : []);
      setChapters(editingBook.chapters ? [...editingBook.chapters] : []);
      setShowUrlInput(false);
      setWebUrl('');
      setShowDuplicateAlert(false);
    } else {
      // Defaults for new book
      setTitle('');
      setAuthor('');
      setTotalPages(300);
      setCurrentPage(0);
      setFormat('fisico');
      setSelectedGenres(['Novela']);
      setCustomGenreInput('');
      setShowCustomGenreField(false);
      setDescription('');
      setSelectedSaga('');
      setIsCreatingNewSaga(false);
      setNewSagaName('');
      setSagaOrder('');
      setRating(0);
      setStatus('pendiente');
      setStartDate('');
      setEndDate('');
      setReadYear(new Date().getFullYear());
      setCoverImage('');
      setHasParts(false);
      setParts([]);
      setChapters([]);
      setShowUrlInput(false);
      setWebUrl('');
      setShowDuplicateAlert(false);
    }
  }, [editingBook, isOpen]);

  if (!isOpen) return null;

  // Process and optimize image file (JPG, PNG, WEBP, Camera capture)
  const processImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setEditorImageSrc(event.target.result as string);
        setIsImageEditorOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleApplyWebUrl = () => {
    if (webUrl.trim()) {
      setEditorImageSrc(webUrl.trim());
      setIsImageEditorOpen(true);
      setShowUrlInput(false);
      setWebUrl('');
    }
  };

  const handleOpenEditorWithCurrentCover = () => {
    if (coverImage) {
      setEditorImageSrc(coverImage);
      setIsImageEditorOpen(true);
    }
  };

  const handleSagaSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__NEW__') {
      setIsCreatingNewSaga(true);
      setSelectedSaga('__NEW__');
    } else {
      setIsCreatingNewSaga(false);
      setSelectedSaga(val);
    }
  };

  const handleAddGenre = (genreToAdd: string) => {
    const clean = genreToAdd.trim();
    if (!clean) return;
    if (!selectedGenres.some((g) => g.toLowerCase() === clean.toLowerCase())) {
      setSelectedGenres((prev) => [...prev, clean]);
    }
    const isDefault = CATEGORIES.some((c) => c.toLowerCase() === clean.toLowerCase());
    if (!isDefault) {
      const updated = saveCustomGenre(clean);
      setSavedCustomGenres(updated);
    }
  };

  const handleRemoveGenre = (genreToRemove: string) => {
    setSelectedGenres((prev) => prev.filter((g) => g !== genreToRemove));
  };

  const handleAddCustomGenre = () => {
    const clean = customGenreInput.trim();
    if (clean) {
      handleAddGenre(clean);
      const updated = saveCustomGenre(clean);
      setSavedCustomGenres(updated);
      setCustomGenreInput('');
      setShowCustomGenreField(false);
    }
  };

  const executeSave = () => {
    const finalGenres = selectedGenres.length > 0 ? selectedGenres : ['Novela'];
    const finalCategory = finalGenres.join(', ');

    let finalSaga: string | undefined = undefined;
    if (isCreatingNewSaga) {
      finalSaga = newSagaName.trim() || undefined;
    } else if (selectedSaga && selectedSaga !== '__NEW__') {
      finalSaga = selectedSaga.trim() || undefined;
    }

    const finalSagaOrder =
      finalSaga && sagaOrder !== '' && !isNaN(Number(sagaOrder))
        ? Number(sagaOrder)
        : undefined;

    const numTotalPages = Number(totalPages) || 1;
    const numCurrentPage = Math.min(numTotalPages, Math.max(0, Number(currentPage) || 0));

    let computedReadingDays: number | undefined = editingBook?.readingDays;
    if (status === 'pendiente' && !startDate) {
      computedReadingDays = 0;
    } else {
      computedReadingDays = calculateBookActiveReadingDays({
        status,
        startDate: startDate ? startDate.trim() : undefined,
        endDate: endDate ? endDate.trim() : undefined,
        readingDays: editingBook?.readingDays,
      } as Book);
    }

    onSave({
      title: title.trim(),
      author: author.trim() || 'Autor desconocido',
      totalPages: numTotalPages,
      currentPage: numCurrentPage,
      format,
      category: finalCategory,
      genres: finalGenres,
      description: description.trim() ? description.trim().slice(0, 500) : undefined,
      saga: finalSaga,
      sagaOrder: finalSagaOrder,
      rating,
      status,
      startDate: startDate ? startDate.trim() : undefined,
      endDate: endDate ? endDate.trim() : undefined,
      readYear: readYear ? Number(readYear) : undefined,
      readingDays: computedReadingDays,
      coverImage: coverImage || undefined,
      hasParts,
      parts,
      chapters,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Check if book is already registered
    if (duplicateBook) {
      setShowDuplicateAlert(true);
      return;
    }

    executeSave();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-purple-100 flex flex-col my-auto text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden">
        {/* Modal Header - Fixed at Top */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-200 text-zinc-900 flex items-center justify-center shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 tracking-tight">
                {editingBook ? 'EDITANDO LIBRO' : 'AÑADIR NUEVO LIBRO'}
              </h2>
              {editingBook && (
                <p className="text-[10px] text-zinc-600 font-bold truncate max-w-[220px]">
                  «{editingBook.title}»
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form
          id="book-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs overscroll-contain"
        >
          {/* Cover Preview & Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col sm:flex-row gap-3.5 items-start sm:items-center bg-zinc-50 p-3.5 rounded-2xl border transition-colors ${
              isDragging ? 'border-zinc-900 bg-zinc-100 ring-2 ring-zinc-400' : 'border-zinc-200'
            }`}
          >
            {/* Book Cover Preview */}
            <div className="w-18 h-26 rounded-xl overflow-hidden shadow-xs bg-zinc-200 shrink-0 border border-zinc-300 relative group mx-auto sm:mx-0">
              {coverImage ? (
                <>
                  <img
                    src={coverImage}
                    alt="Portada"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                    <button
                      type="button"
                      onClick={handleOpenEditorWithCurrentCover}
                      title="Editar / Zoom / Girar imagen"
                      className="p-1.5 bg-zinc-900/90 hover:bg-black text-white rounded-lg transition-transform active:scale-95 shadow-xs"
                    >
                      <Crop className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverImage('')}
                      title="Quitar portada"
                      className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition-transform active:scale-95 shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Mobile direct edit button */}
                  <button
                    type="button"
                    onClick={handleOpenEditorWithCurrentCover}
                    title="Editar imagen"
                    className="sm:hidden absolute bottom-1 right-1 p-1 bg-black/75 text-white rounded-md"
                  >
                    <Crop className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center bg-zinc-200 text-zinc-800">
                  <BookOpen className="w-6 h-6 text-zinc-700 mb-0.5" />
                  <span className="text-[9px] font-bold text-zinc-900 line-clamp-2">
                    {title || 'Sin portada'}
                  </span>
                </div>
              )}
            </div>

            {/* Upload, Camera & Link Actions */}
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-zinc-900">
                  Portada del libro
                </label>
                <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-200 px-2 py-0.5 rounded-full border border-zinc-300">
                  JPG • PNG • WEBP
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* File Upload Button */}
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-bold text-xs cursor-pointer hover:bg-zinc-100 shadow-2xs transition-all active:scale-98">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp,image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {/* Camera Button */}
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-bold text-xs cursor-pointer hover:bg-zinc-100 shadow-2xs transition-all active:scale-98">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Cámara</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {/* Web URL Button */}
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-bold text-xs transition-all active:scale-98 ${
                    showUrlInput
                      ? 'bg-zinc-200 border-zinc-800 text-zinc-900'
                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100 shadow-2xs'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Web</span>
                </button>

                {/* Online Cover Search Button */}
                <button
                  type="button"
                  onClick={() => setIsCoverSearchOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-bold text-xs shadow-2xs transition-all active:scale-98"
                >
                  <Search className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Buscar online</span>
                </button>

                {coverImage && (
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-zinc-300 bg-white text-zinc-700 font-bold text-xs hover:bg-zinc-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>

              {/* Quick cover suggestion button if title typed but no cover */}
              {!coverImage && title.trim() && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsCoverSearchOpen(true)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 text-amber-900 text-[11px] font-bold flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">Buscar portada para «{title.trim()}»</span>
                    </span>
                    <span className="text-[10px] font-black underline shrink-0 ml-1">Ver portadas</span>
                  </button>
                </div>
              )}

              {/* Web URL input toggle */}
              {showUrlInput && (
                <div className="flex items-center gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="Pega URL de imagen (https://...)"
                    className="flex-1 bg-white border border-zinc-300 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyWebUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyWebUrl}
                    disabled={!webUrl.trim()}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-900 text-white font-bold text-xs shadow-2xs hover:bg-zinc-800 disabled:opacity-50 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">
              Título <span className="text-zinc-950 font-bold">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cien años de soledad"
              className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 ${
                duplicateBook
                  ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20'
                  : 'border-zinc-300 focus:ring-zinc-800'
              }`}
            />
            {duplicateBook && (
              <div className="flex items-start gap-2 p-2 mt-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">¡Libro ya registrado!:</span> «{duplicateBook.title}» ({duplicateBook.author || 'Autor desconocido'}) ya está en tu biblioteca ({duplicateBook.status === 'leyendo' ? 'Leyendo actualmente' : duplicateBook.status === 'leido' ? 'Leído' : duplicateBook.status === 'abandonado' ? 'Abandonado' : 'Por leer'}).
                </div>
              </div>
            )}
          </div>

          {/* Author */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">Autor</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ej: Gabriel García Márquez (o vacío para 'Autor desconocido')"
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
            />
          </div>

          {/* Pages & Current Page */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-900 mb-1">Total de páginas</label>
              <input
                type="number"
                min="1"
                required
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-900 mb-1">Página actual</label>
              <input
                type="number"
                min="0"
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
            </div>
          </div>

          {/* Format & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-900 mb-1">Formato</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as BookFormat)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                <option value="fisico">Físico</option>
                <option value="digital">Digital</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-900 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                <option value="pendiente">Pendiente</option>
                <option value="leyendo">Leyendo</option>
                <option value="pausado">Pausado</option>
                <option value="leido">Leído</option>
                <option value="abandonado">Abandonado</option>
              </select>
            </div>
          </div>

          {/* Capítulos del Libro (Para libros leyendo, pendientes o en espera) */}
          <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-2xs">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-900 text-xs">
                    Capítulos del Libro
                  </label>
                  <p className="text-[10px] text-zinc-500 font-medium">
                    {chapters.length === 0
                      ? 'Sin capítulos configurados'
                      : `${chapters.length} ${chapters.length === 1 ? 'capítulo guardado' : 'capítulos guardados'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChapterModalOpen(true)}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-[11px] font-bold shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{chapters.length > 0 ? 'Gestionar capítulos' : 'Agregar capítulos'}</span>
              </button>
            </div>

            {chapters.length > 0 && (
              <div className="mt-2.5 space-y-2 max-h-44 overflow-y-auto pr-0.5">
                {hasParts && parts.length > 0 ? (
                  parts.map((partName) => {
                    const partChapters = chapters.filter((c) => c.part === partName);
                    if (partChapters.length === 0) return null;
                    return (
                      <div key={partName} className="space-y-1 bg-zinc-100/60 p-2 rounded-xl border border-zinc-200/80">
                        <div className="flex items-center gap-1.5 px-1 py-0.5 text-zinc-900 font-extrabold text-[11px]">
                          <Bookmark className="w-3 h-3 text-zinc-900" />
                          <span>{partName}</span>
                          <span className="text-[10px] text-zinc-500 font-medium ml-auto">
                            {partChapters.length} {partChapters.length === 1 ? 'cap.' : 'caps.'}
                          </span>
                        </div>
                        {partChapters.map((ch) => (
                          <div
                            key={ch.id}
                            className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-zinc-200 text-xs shadow-2xs gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <RomanChapterText
                                  title={ch.title}
                                  romanSize="text-[18px]"
                                  className={ch.isRead ? 'line-through text-zinc-500' : 'text-zinc-900'}
                                  isRead={ch.isRead}
                                />
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800 font-mono shrink-0">
                                  {Math.max(1, ch.endPage - ch.startPage + 1)} págs
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-250 font-mono text-[10px] font-bold text-zinc-900 whitespace-nowrap shrink-0">
                                  <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase">Páginas</span>
                                  <span>{ch.startPage} – {ch.endPage}</span>
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setChapters((prev) => prev.filter((c) => c.id !== ch.id))}
                              className="p-1 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                              title="Eliminar capítulo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : null}

                {/* Show unassigned or all chapters if no parts */}
                {(!hasParts || parts.length === 0
                  ? chapters
                  : chapters.filter((c) => !c.part || !parts.includes(c.part))
                ).map((ch, idx) => (
                  <div
                    key={ch.id || idx}
                    className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-zinc-200 text-xs shadow-2xs gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RomanChapterText
                          title={ch.title}
                          romanSize="text-[18px]"
                          className={ch.isRead ? 'line-through text-zinc-500' : 'text-zinc-900'}
                          isRead={ch.isRead}
                        />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800 font-mono shrink-0">
                          {Math.max(1, ch.endPage - ch.startPage + 1)} págs
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-250 font-mono text-[10px] font-bold text-zinc-900 whitespace-nowrap shrink-0">
                          <span className="text-[9px] font-sans font-bold text-zinc-500 uppercase">Páginas</span>
                          <span>{ch.startPage} – {ch.endPage}</span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChapters((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      title="Eliminar capítulo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Multi-Genre / Categorías Section */}
          <div className="space-y-2.5 p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-600" />
                <span>Géneros / Categorías</span>
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                {selectedGenres.length === 0
                  ? 'Sin géneros'
                  : `${selectedGenres.length} ${selectedGenres.length === 1 ? 'género' : 'géneros'}`}
              </span>
            </div>

            {/* Selected genre chips */}
            <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-white rounded-xl border border-zinc-200 items-center">
              {selectedGenres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200/70 border border-zinc-300 text-xs font-bold text-zinc-900 shadow-2xs transition-colors"
                >
                  <span>{genre}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGenre(genre)}
                    className="text-zinc-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                    title={`Quitar género ${genre}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {selectedGenres.length === 0 && (
                <span className="text-xs text-zinc-400 italic px-1">
                  Ningún género seleccionado. Elige uno de abajo.
                </span>
              )}
            </div>

            {/* Selector to add more genres from list */}
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__CUSTOM__') {
                    setShowCustomGenreField(true);
                  } else if (val) {
                    handleAddGenre(val);
                  }
                }}
                className="flex-1 bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800 cursor-pointer"
              >
                <option value="">+ Añadir género de la lista...</option>
                {allAvailableGenres.filter((c) => !selectedGenres.includes(c)).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CUSTOM__">✍️ Escribir otro género personalizado...</option>
              </select>

              {!showCustomGenreField && (
                <button
                  type="button"
                  onClick={() => setShowCustomGenreField(true)}
                  className="px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-800 rounded-xl text-xs font-bold border border-zinc-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                  title="Escribir un género personalizado"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Otro</span>
                </button>
              )}
            </div>

            {/* Custom genre text field if activated */}
            {showCustomGenreField && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: Distopía, Ensayo, Novela Gráfica..."
                  value={customGenreInput}
                  onChange={(e) => setCustomGenreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomGenre();
                    }
                  }}
                  className="flex-1 bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
                />
                <button
                  type="button"
                  onClick={handleAddCustomGenre}
                  disabled={!customGenreInput.trim()}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Añadir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomGenreField(false);
                    setCustomGenreInput('');
                  }}
                  className="px-2.5 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Quick suggestions pills */}
            <div className="pt-0.5">
              <span className="block text-[10px] font-bold text-zinc-500 mb-1">
                Sugerencias rápidas:
              </span>
              <div className="flex flex-wrap gap-1">
                {allAvailableGenres
                  .filter((c) => !selectedGenres.includes(c))
                  .slice(0, 10)
                  .map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleAddGenre(cat)}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white hover:bg-zinc-200/80 text-zinc-700 border border-zinc-200 transition-colors flex items-center gap-0.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-2.5 h-2.5 text-zinc-400" />
                      <span>{cat}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Saga / Colección */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">Saga / Colección</label>
            <select
              value={isCreatingNewSaga ? '__NEW__' : selectedSaga}
              onChange={handleSagaSelectChange}
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
            >
              <option value="">Ninguna / Sin saga</option>
              {availableSagas.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__NEW__">+ Nueva saga / colección...</option>
            </select>

              {isCreatingNewSaga && (
                <div className="mt-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Escribe el nombre de la saga..."
                    value={newSagaName}
                    onChange={(e) => setNewSagaName(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-900 rounded-xl px-3 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewSaga(false);
                      setSelectedSaga('');
                      setNewSagaName('');
                      setSagaOrder('');
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-800 underline block text-right cursor-pointer"
                  >
                    Cancelar nueva saga
                  </button>
                </div>
              )}

              {/* Número / Orden en la saga (para orden de lectura) */}
              {activeSagaName && (
                <div className="mt-2.5 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-zinc-900">
                      N° / Orden en la saga
                      <span className="font-normal text-zinc-500 text-[11px] ml-1">(orden de lectura)</span>
                    </label>
                    {suggestedNextOrder && sagaOrder === '' && (
                      <button
                        type="button"
                        onClick={() => setSagaOrder(suggestedNextOrder)}
                        className="text-[10px] font-bold text-zinc-700 bg-white hover:bg-zinc-200/80 px-2 py-0.5 rounded-md border border-zinc-200 cursor-pointer shadow-2xs transition-colors"
                        title={`Sugerir libro #${suggestedNextOrder}`}
                      >
                        Sugerir: Libro #{suggestedNextOrder}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                        #
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Ej. 1"
                        value={sagaOrder !== undefined && sagaOrder !== null ? sagaOrder : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSagaOrder(val === '' ? '' : Number(val));
                        }}
                        className="w-full bg-white border border-zinc-300 rounded-xl pl-6 pr-2.5 py-1.5 text-xs text-zinc-900 font-bold focus:outline-none focus:ring-2 focus:ring-zinc-800"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-tight">
                      {sagaOrder !== ''
                        ? `Registrado como libro #${sagaOrder} de la saga.`
                        : 'Indica el número (1, 2, 3...) para saber su orden en la saga.'}
                    </p>
                  </div>

                  {/* Listado de libros ya registrados en esta saga */}
                  {booksInActiveSaga.length > 0 && (
                    <div className="pt-1.5 border-t border-zinc-200/80">
                      <p className="text-[10px] font-bold text-zinc-600 mb-1">
                        Otros libros en esta saga ({booksInActiveSaga.length}):
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                        {booksInActiveSaga.map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-700 shadow-2xs"
                          >
                            <span className="font-bold text-zinc-900 bg-zinc-100 px-1 rounded">
                              {b.sagaOrder !== undefined && b.sagaOrder !== null ? `#${b.sagaOrder}` : '•'}
                            </span>
                            <span className="truncate max-w-[130px]" title={b.title}>
                              {b.title}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* Pequeña descripción del libro (máx. 500 caracteres, opcional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-900">
                Pequeña descripción / Sinopsis <span className="font-normal text-zinc-400 text-[11px]">(Opcional)</span>
              </label>
              <span
                className={`text-[11px] font-mono font-bold ${
                  description.length >= 500
                    ? 'text-rose-600'
                    : description.length >= 450
                    ? 'text-amber-600'
                    : 'text-zinc-400'
                }`}
              >
                {description.length} / 500
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Opcional: Breve reseña, sinopsis o notas sobre el libro (máx. 500 caracteres)..."
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800 resize-none transition-shadow"
            />
          </div>

          {/* Rating (Interactive Half-Stars) */}
          <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
            <label className="block font-bold text-zinc-900 mb-1.5">
              Valoración (0 - 5 estrellas)
            </label>
            <div className="flex items-center justify-between">
              <StarRating
                rating={rating}
                interactive
                onRatingChange={(r) => setRating(r)}
                size="md"
              />
              <span className="text-xs font-bold text-zinc-900">
                {rating > 0 ? `${rating} ★` : 'Sin puntaje'}
              </span>
            </div>
          </div>

          {/* Dates & Year */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-zinc-900">F. Inicio</label>
                {startDate && (
                  <button
                    type="button"
                    onClick={() => setStartDate('')}
                    className="text-[9px] font-bold text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-0.5 leading-none"
                    title="Eliminar fecha de inicio"
                  >
                    <X className="w-2.5 h-2.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-2 py-1.5 text-[11px] text-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-zinc-900">F. Término</label>
                {endDate && (
                  <button
                    type="button"
                    onClick={() => setEndDate('')}
                    className="text-[9px] font-bold text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-0.5 leading-none"
                    title="Eliminar fecha de término"
                  >
                    <X className="w-2.5 h-2.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-2 py-1.5 text-[11px] text-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-900 mb-1">Año Lectura</label>
              <input
                type="number"
                min="1990"
                max="2099"
                value={readYear}
                onChange={(e) => setReadYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full bg-white border border-zinc-300 rounded-xl px-2 py-1.5 text-[11px] text-zinc-900 focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer - Fixed at Bottom */}
        <div className="px-5 py-3 border-t border-zinc-200 bg-white shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="book-form"
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            {editingBook ? 'Guardar Cambios' : 'Registrar Libro'}
          </button>
        </div>
      </div>

      {/* Image Zoom, Rotate & Crop Editor Modal */}
      <ImageEditorModal
        isOpen={isImageEditorOpen}
        imageSrc={editorImageSrc}
        onClose={() => {
          setIsImageEditorOpen(false);
          setEditorImageSrc('');
        }}
        onSave={(editedDataUrl) => {
          setCoverImage(editedDataUrl);
          setIsImageEditorOpen(false);
          setEditorImageSrc('');
        }}
      />

      {/* Chapter Manager Modal */}
      <ChapterModal
        isOpen={isChapterModalOpen}
        book={{
          id: editingBook?.id || 'temp-book',
          title: title || 'Nuevo libro',
          author: author || 'Autor',
          totalPages: Number(totalPages) || 300,
          currentPage: Number(currentPage) || 0,
          format,
          category: selectedGenres.join(', ') || 'Novela',
          genres: selectedGenres,
          description: description.trim().slice(0, 500),
          rating,
          status,
          hasParts,
          parts,
          chapters,
          createdAt: '',
          updatedAt: '',
        }}
        onClose={() => setIsChapterModalOpen(false)}
        onUpdateChapters={(_, updated, updatedHasParts, updatedParts) => {
          setChapters(updated);
          if (updatedHasParts !== undefined) setHasParts(updatedHasParts);
          if (updatedParts !== undefined) setParts(updatedParts);
        }}
      />

      {/* Alert Dialog for Duplicate Book */}
      {showDuplicateAlert && duplicateBook && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl border border-amber-200 text-center animate-in zoom-in-95 duration-200">
            <div className="w-13 h-13 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-zinc-900 mb-1 tracking-tight">
              ¡Libro ya registrado!
            </h3>

            <p className="text-xs text-zinc-600 mb-3.5 leading-relaxed">
              El libro <strong className="text-zinc-900 font-extrabold">«{duplicateBook.title}»</strong> ya se encuentra registrado en tu biblioteca.
            </p>

            {/* Existing Book Card Preview */}
            <div className="bg-zinc-50 border border-zinc-200/90 rounded-2xl p-2.5 mb-4 text-left flex items-center gap-3">
              <div
                className="w-11 h-15 rounded-xl shrink-0 overflow-hidden border border-zinc-300 flex items-center justify-center font-bold text-xs shadow-2xs"
                style={{ backgroundColor: duplicateBook.coverColor || '#e1bee7' }}
              >
                {duplicateBook.coverImage ? (
                  <img src={duplicateBook.coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  duplicateBook.title.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-zinc-900 truncate">{duplicateBook.title}</p>
                <p className="text-[11px] text-zinc-500 font-medium truncate">{duplicateBook.author || 'Autor desconocido'}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    duplicateBook.status === 'leyendo'
                      ? 'bg-blue-100 text-blue-800'
                      : duplicateBook.status === 'leido'
                      ? 'bg-emerald-100 text-emerald-800'
                      : duplicateBook.status === 'abandonado'
                      ? 'bg-zinc-200 text-zinc-700'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {duplicateBook.status === 'leyendo'
                      ? 'Leyendo'
                      : duplicateBook.status === 'leido'
                      ? 'Leído'
                      : duplicateBook.status === 'abandonado'
                      ? 'Abandonado'
                      : 'Por leer'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono font-semibold">
                    {duplicateBook.currentPage}/{duplicateBook.totalPages} págs
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowDuplicateAlert(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Volver y corregir título
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateAlert(false);
                  executeSave();
                }}
                className="w-full py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Añadir de todos modos (otra edición)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Cover Search Modal */}
      <CoverSearchModal
        isOpen={isCoverSearchOpen}
        initialTitle={title}
        initialAuthor={author}
        onClose={() => setIsCoverSearchOpen(false)}
        onSelectCover={(selectedUrl) => {
          setCoverImage(selectedUrl);
          setShowUrlInput(false);
        }}
      />
    </div>
  );
};
