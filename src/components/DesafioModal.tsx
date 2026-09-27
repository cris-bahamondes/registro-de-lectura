import React, { useState, useEffect, useMemo } from 'react';
import { Book, AnnualMonthChallenge, MonthChallengeBook } from '../types';
import {
  X,
  Check,
  Plus,
  Trash2,
  BookOpen,
  Layers,
  Sparkles,
  Tag,
  RotateCcw,
  Search,
  CheckCircle2,
  Image as ImageIcon,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface DesafioModalProps {
  isOpen: boolean;
  monthChallenge: AnnualMonthChallenge | null;
  year: number;
  libraryBooks: Book[];
  onClose: () => void;
  onSave: (updatedMonth: AnnualMonthChallenge) => void;
}

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Libros del siglo XX',
  'Clásicos Universales',
  'Ficción Histórica',
  'Ciencia Ficción y Distopía',
  'Desarrollo Personal',
  'Misterio y Thriller',
  'Filosofía y Ensayo',
  'Literatura Latinoamericana',
  'Biografías y Memorias',
  'Terror y Gótico',
  'Fantasía Épica',
  'Novela Contemporánea',
  'Romance',
  'Poesía y Teatro',
  'Novela Gráfica y Manga',
  'Aventura y Viajes',
];

export const DesafioModal: React.FC<DesafioModalProps> = ({
  isOpen,
  monthChallenge,
  year,
  libraryBooks,
  onClose,
  onSave,
}) => {
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [books, setBooks] = useState<MonthChallengeBook[]>([]);

  // Category tags state with persistent storage
  const [suggestedTags, setSuggestedTags] = useState<string[]>(() => {
    const saved = localStorage.getItem('registro_lectura_category_tags_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_CATEGORY_SUGGESTIONS;
  });

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Visual book selector state
  const BOOKS_PER_PAGE = 10;
  const [libraryPage, setLibraryPage] = useState(1);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [statusTabFilter, setStatusTabFilter] = useState<'all' | 'leyendo' | 'pendiente' | 'leido'>('all');
  const [showCustomBookForm, setShowCustomBookForm] = useState(false);

  // Custom book addition form
  const [newTitle, setNewTitle] = useState<string>('');
  const [newAuthor, setNewAuthor] = useState<string>('');
  const [newPages, setNewPages] = useState<string>('');

  useEffect(() => {
    if (monthChallenge) {
      setCategory(monthChallenge.category || '');
      setNotes(monthChallenge.notes || '');
      setBooks(monthChallenge.books ? [...monthChallenge.books] : []);
    } else {
      setCategory('');
      setNotes('');
      setBooks([]);
    }
    setNewTitle('');
    setNewAuthor('');
    setNewPages('');
    setBookSearchQuery('');
    setShowCustomBookForm(false);
    setIsAddingTag(false);
    setNewTagInput('');
    setLibraryPage(1);
  }, [monthChallenge, isOpen]);

  // Reset page when filter or search changes
  useEffect(() => {
    setLibraryPage(1);
  }, [statusTabFilter, bookSearchQuery]);

  // Filter library books for the visual cover picker
  const filteredLibraryBooks = useMemo(() => {
    let result = libraryBooks;
    if (statusTabFilter !== 'all') {
      result = result.filter((b) => b.status === statusTabFilter);
    }
    if (bookSearchQuery.trim()) {
      const q = bookSearchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.category && b.category.toLowerCase().includes(q)) ||
          (b.genres && b.genres.some((g) => g.toLowerCase().includes(q)))
      );
    }
    return result;
  }, [libraryBooks, statusTabFilter, bookSearchQuery]);

  const totalLibraryPages = Math.max(1, Math.ceil(filteredLibraryBooks.length / BOOKS_PER_PAGE));
  const safeLibraryPage = Math.min(Math.max(1, libraryPage), totalLibraryPages);
  const startIndex = (safeLibraryPage - 1) * BOOKS_PER_PAGE;
  const endIndex = Math.min(startIndex + BOOKS_PER_PAGE, filteredLibraryBooks.length);
  const paginatedLibraryBooks = useMemo(() => {
    return filteredLibraryBooks.slice(startIndex, startIndex + BOOKS_PER_PAGE);
  }, [filteredLibraryBooks, startIndex]);

  if (!isOpen || !monthChallenge) return null;

  // Add new tag handler
  const handleAddNewTag = (tagToAdd?: string) => {
    const raw = tagToAdd !== undefined ? tagToAdd : newTagInput;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const exists = suggestedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase());
    let updated = suggestedTags;
    if (!exists) {
      updated = [...suggestedTags, trimmed];
      setSuggestedTags(updated);
      try {
        localStorage.setItem('registro_lectura_category_tags_v1', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }

    setCategory(trimmed);
    setNewTagInput('');
    setIsAddingTag(false);
  };

  // Delete/Remove tag handler
  const handleRemoveTag = (tagToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = suggestedTags.filter((t) => t !== tagToRemove);
    setSuggestedTags(updated);
    try {
      localStorage.setItem('registro_lectura_category_tags_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Restore default tags handler
  const handleResetTags = (e: React.MouseEvent) => {
    e.preventDefault();
    setSuggestedTags(DEFAULT_CATEGORY_SUGGESTIONS);
    try {
      localStorage.setItem('registro_lectura_category_tags_v1', JSON.stringify(DEFAULT_CATEGORY_SUGGESTIONS));
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle book in month by clicking its cover
  const handleToggleLibraryBook = (libBook: Book) => {
    const isAlreadySelected = books.some((b) => b.id === libBook.id || b.bookId === libBook.id);

    if (isAlreadySelected) {
      // Remove from month
      setBooks((prev) => prev.filter((b) => b.id !== libBook.id && b.bookId !== libBook.id));
    } else {
      // Add to month
      const newBookItem: MonthChallengeBook = {
        id: libBook.id,
        bookId: libBook.id,
        title: libBook.title,
        author: libBook.author,
        coverImage: libBook.coverImage || undefined,
        totalPages: libBook.totalPages,
        isRead: libBook.status === 'leido',
      };
      setBooks((prev) => [...prev, newBookItem]);
    }
  };

  const handleAddCustomBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const pages = parseInt(newPages, 10);
    const newBookItem: MonthChallengeBook = {
      id: `custom-book-${Date.now()}`,
      title: newTitle.trim(),
      author: newAuthor.trim() || 'Autor desconocido',
      totalPages: isNaN(pages) ? undefined : pages,
      isRead: false,
    };

    setBooks((prev) => [...prev, newBookItem]);
    setNewTitle('');
    setNewAuthor('');
    setNewPages('');
    setShowCustomBookForm(false);
  };

  const handleRemoveBook = (bookId: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  const handleToggleBookRead = (bookId: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === bookId ? { ...b, isRead: !b.isRead } : b))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AnnualMonthChallenge = {
      ...monthChallenge,
      category: category.trim() || 'Lectura Libre',
      notes: notes.trim(),
      books,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-zinc-300 overflow-hidden animate-in zoom-in-95 duration-200 text-zinc-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 flex items-center justify-between bg-zinc-100/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
              {String(monthChallenge.monthNumber).padStart(2, '0')}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 leading-tight">
                {monthChallenge.monthName} {year}
              </h2>
              <p className="text-xs text-zinc-500 font-medium flex items-center gap-1.5 mt-0.5">
                <Layers className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span>Configurar temática y portadas de libros</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 rounded-full hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Scrollable Body */}
        <form
          id="month-desafio-form"
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden space-y-5 flex-1 text-left"
        >
          {/* Section 1: Category Input & Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-700" />
                <span>Categoría / Temática del Mes</span>
              </label>
              {suggestedTags.length < DEFAULT_CATEGORY_SUGGESTIONS.length && (
                <button
                  type="button"
                  onClick={handleResetTags}
                  className="text-[10px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                  title="Restablecer lista de etiquetas predeterminadas"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Restablecer
                </button>
              )}
            </div>

            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Libros del siglo XX, Clásicos, Romance, Novela..."
              className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3 text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none placeholder:text-zinc-400"
            />

            {/* Quick add typed text as tag helper */}
            {category.trim() &&
              !suggestedTags.some((t) => t.toLowerCase() === category.trim().toLowerCase()) && (
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleAddNewTag(category)}
                    className="text-[11px] font-bold text-zinc-800 hover:text-black flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg border border-zinc-300 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Guardar «{category.trim()}» como etiqueta</span>
                  </button>
                </div>
              )}

            {/* Category Tags Pills */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                  Etiquetas sugeridas (toca para aplicar):
                </span>
                {!isAddingTag && (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="text-[11px] font-bold text-zinc-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    Nueva etiqueta
                  </button>
                )}
              </div>

              {isAddingTag && (
                <div className="mb-2 p-2 bg-zinc-50 rounded-xl border border-zinc-300 flex items-center gap-1.5 animate-in fade-in duration-150">
                  <Tag className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1" />
                  <input
                    type="text"
                    autoFocus
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewTag();
                      } else if (e.key === 'Escape') {
                        setIsAddingTag(false);
                      }
                    }}
                    placeholder="Escribe el nombre de la nueva etiqueta..."
                    className="flex-1 bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddNewTag()}
                    disabled={!newTagInput.trim()}
                    className="px-2.5 py-1 bg-zinc-900 text-white rounded-lg font-bold text-xs hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTag(false);
                      setNewTagInput('');
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {suggestedTags.map((sug) => {
                  const isSelected = category === sug;
                  return (
                    <div
                      key={sug}
                      onClick={() => setCategory(sug)}
                      className={`group flex items-center gap-1 text-[11px] font-semibold pl-2.5 pr-1.5 py-1 rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
                        isSelected
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                          : 'bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <span className="truncate max-w-[170px]">{sug}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveTag(sug, e)}
                        className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                            : 'text-zinc-400 hover:text-red-600 hover:bg-zinc-300/60'
                        }`}
                        title={`Eliminar etiqueta «${sug}»`}
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Selected Books for this Month */}
          <div className="border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-zinc-700" />
                <span>Libros seleccionados para {monthChallenge.monthName} ({books.length})</span>
              </label>
              {books.length > 0 && (
                <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                  {books.filter((b) => b.isRead).length} de {books.length} leídos
                </span>
              )}
            </div>

            {books.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {books.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                      b.isRead
                        ? 'bg-zinc-100/80 border-zinc-300 text-zinc-800'
                        : 'bg-white border-zinc-200 text-zinc-900 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox toggle read */}
                      <button
                        type="button"
                        onClick={() => handleToggleBookRead(b.id)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                          b.isRead
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xs'
                            : 'border-zinc-300 bg-zinc-50 hover:border-zinc-500 text-zinc-400'
                        }`}
                        title={b.isRead ? 'Marcar como no leído' : 'Marcar como leído'}
                      >
                        {b.isRead ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <div className="w-2 h-2 rounded-xs bg-zinc-300" />
                        )}
                      </button>

                      {/* Visual Cover Thumbnail */}
                      <div className="w-10 h-13 rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0 relative flex items-center justify-center shadow-2xs">
                        {(() => {
                          const displayCover =
                            b.coverImage ||
                            libraryBooks.find((lb) => lb.id === (b.bookId || b.id))?.coverImage;
                          return displayCover ? (
                            <img
                              src={displayCover}
                              alt={b.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-200 flex items-center justify-center p-1 text-center">
                              <BookOpen className="w-4 h-4 text-zinc-500" />
                            </div>
                          );
                        })()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-bold truncate ${
                            b.isRead ? 'line-through text-zinc-500' : 'text-zinc-900'
                          }`}
                        >
                          {b.title}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {b.author}
                        </div>
                        {b.isRead ? (
                          <span className="inline-block text-[9px] font-black text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded mt-0.5">
                            Leído ✓
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded mt-0.5">
                            Por leer
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveBook(b.id)}
                      className="p-2 text-zinc-400 hover:text-red-600 rounded-xl hover:bg-zinc-100 transition-colors ml-1 cursor-pointer shrink-0"
                      title="Quitar del mes"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-dashed border-zinc-300 text-center mb-3">
                <p className="text-xs text-zinc-600 font-bold">No has seleccionado ningún libro aún</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Haz clic en las portadas abajo para agregarlos directamente a este mes.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: VISUAL BOOK SELECTOR (GRID OF BOOK COVERS) */}
          <div className="border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-700" />
                <span>Portadas de tu Biblioteca ({libraryBooks.length})</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCustomBookForm(!showCustomBookForm)}
                className="text-[11px] font-bold text-zinc-900 hover:underline flex items-center gap-1 cursor-pointer bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg border border-zinc-200"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                {showCustomBookForm ? 'Cerrar libro manual' : 'Otro libro (manual)'}
              </button>
            </div>

            {/* Manual custom book drawer */}
            {showCustomBookForm && (
              <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-300 space-y-2.5 mb-3 animate-in fade-in duration-150">
                <span className="text-xs font-bold text-zinc-800 block">
                  Ingresar un libro que no está en la biblioteca:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Título del libro"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <input
                    type="text"
                    placeholder="Autor"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Págs"
                      value={newPages}
                      onChange={(e) => setNewPages(e.target.value)}
                      className="w-20 bg-white border border-zinc-300 rounded-xl px-2 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <button
                      type="button"
                      disabled={!newTitle.trim()}
                      onClick={handleAddCustomBook}
                      className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Status Filters for Cover Gallery */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en tu biblioteca por título o autor..."
                  value={bookSearchQuery}
                  onChange={(e) => setBookSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setStatusTabFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusTabFilter === 'all'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Todos ({libraryBooks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTabFilter('leyendo')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusTabFilter === 'leyendo'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Leyendo ({libraryBooks.filter((b) => b.status === 'leyendo').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTabFilter('pendiente')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusTabFilter === 'pendiente'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Pendientes ({libraryBooks.filter((b) => b.status === 'pendiente').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTabFilter('leido')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusTabFilter === 'leido'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Leídos ({libraryBooks.filter((b) => b.status === 'leido').length})
                </button>
              </div>
            </div>

            {/* Visual Covers Grid Gallery */}
            {filteredLibraryBooks.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-300 text-zinc-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="text-xs font-bold text-zinc-700">No se encontraron libros</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Agrega libros en la pestaña Biblioteca o utiliza el botón "Otro libro (manual)".
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 p-2 border border-zinc-200 rounded-2xl bg-zinc-50/70">
                  {paginatedLibraryBooks.map((libBook) => {
                    const isSelected = books.some((b) => b.id === libBook.id || b.bookId === libBook.id);

                    return (
                      <div
                        key={libBook.id}
                        onClick={() => handleToggleLibraryBook(libBook)}
                        className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all flex flex-col justify-between bg-white text-left select-none ${
                          isSelected
                            ? 'border-zinc-950 shadow-md ring-2 ring-zinc-950/20 scale-[1.02]'
                            : 'border-zinc-200 hover:border-zinc-400 hover:shadow-xs'
                        }`}
                        title={isSelected ? `Quitar «${libBook.title}»` : `Agregar «${libBook.title}» al mes`}
                      >
                        {/* Book Cover Container */}
                        <div className="w-full aspect-[3/4.3] bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                          {libBook.coverImage ? (
                            <img
                              src={libBook.coverImage}
                              alt={libBook.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-1.5 bg-gradient-to-b from-zinc-100 to-zinc-200 text-center">
                              <BookOpen className="w-6 h-6 text-zinc-400 mb-1" />
                              <span className="text-[9px] font-bold text-zinc-800 line-clamp-2 leading-tight">
                                {libBook.title}
                              </span>
                            </div>
                          )}

                          {/* Selected overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/45 backdrop-blur-2xs flex flex-col items-center justify-center text-white animate-in fade-in duration-100">
                              <div className="w-7 h-7 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-lg">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </div>
                              <span className="text-[9px] font-black mt-1 uppercase tracking-wider text-white">
                                Asignado
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info & Action bar on the card */}
                        <div className="p-2 bg-white flex flex-col justify-between flex-1">
                          <div>
                            <h4 className="text-[11px] font-bold text-zinc-900 line-clamp-1 leading-tight" title={libBook.title}>
                              {libBook.title}
                            </h4>
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                              {libBook.author}
                            </p>
                          </div>

                          <div className="mt-1.5 pt-1.5 border-t border-zinc-100 flex items-center justify-between">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-zinc-900 text-white'
                                : 'bg-zinc-100 text-zinc-700 group-hover:bg-zinc-200'
                            }`}>
                              {isSelected ? '✓ Asignado' : '+ Asignar'}
                            </span>
                            {libBook.status === 'leido' && (
                              <span className="text-[8px] text-emerald-700 font-extrabold">Leído</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Arrow Pagination Controls (10 books per page) */}
                {totalLibraryPages > 1 && (
                  <div className="flex items-center justify-between bg-zinc-100/90 border border-zinc-200 rounded-2xl p-2 select-none shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setLibraryPage((p) => Math.max(1, p - 1))}
                      disabled={safeLibraryPage <= 1}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all ${
                        safeLibraryPage <= 1
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'
                          : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50 active:scale-95 cursor-pointer shadow-2xs'
                      }`}
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-center">
                      <span className="text-xs font-black text-zinc-900">
                        Página {safeLibraryPage} de {totalLibraryPages}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold">
                        ({startIndex + 1}–{endIndex} de {filteredLibraryBooks.length} libros)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLibraryPage((p) => Math.min(totalLibraryPages, p + 1))}
                      disabled={safeLibraryPage >= totalLibraryPages}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all ${
                        safeLibraryPage >= totalLibraryPages
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'
                          : 'bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800 active:scale-95 cursor-pointer shadow-2xs'
                      }`}
                      title="Página siguiente"
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Notes */}
          <div className="border-t border-zinc-200 pt-4">
            <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
              <span>Notas o Comentarios del Mes</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Leer 15 páginas diarias, reflexionar sobre el contexto histórico..."
              className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none placeholder:text-zinc-400"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-100/80 flex gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="month-desafio-form"
            onClick={handleSubmit}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>
    </div>
  );
};
