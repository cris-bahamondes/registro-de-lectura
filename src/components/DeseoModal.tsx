import React, { useState, useEffect } from 'react';
import { X, Upload, Link as LinkIcon, BookOpen, Trash2, Camera, ShoppingCart, Heart, Sparkles, DollarSign, Tag, Store, Crop, AlertTriangle, Search } from 'lucide-react';
import { WishlistItem, WishlistIntent, WishlistPriority, BookFormat } from '../types';
import { CATEGORIES } from '../data/initialData';
import { ImageEditorModal } from './ImageEditorModal';
import { CoverSearchModal } from './CoverSearchModal';

interface DeseoModalProps {
  isOpen: boolean;
  editingWish: WishlistItem | null;
  onClose: () => void;
  onSave: (wishData: Partial<WishlistItem>) => void;
}

export const DeseoModal: React.FC<DeseoModalProps> = ({
  isOpen,
  editingWish,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverColor, setCoverColor] = useState('#d4d4d8');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [intent, setIntent] = useState<WishlistIntent>('comprar');
  const [priority, setPriority] = useState<WishlistPriority>('media');
  const [estimatedPrice, setEstimatedPrice] = useState<number | ''>('');
  const [offerPrice, setOfferPrice] = useState<number | ''>('');
  const [currency, setCurrency] = useState('$');
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [totalPages, setTotalPages] = useState<number | ''>('');
  const [format, setFormat] = useState<BookFormat>('fisico');

  // URL input helper toggle
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [webUrl, setWebUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [editorImageSrc, setEditorImageSrc] = useState('');
  const [isCoverSearchOpen, setIsCoverSearchOpen] = useState(false);

  const parseInitPrice = (val: any): number | '' => {
    if (val === undefined || val === null || val === '') return '';
    const n = Number(val);
    return isNaN(n) || n <= 0 ? '' : n;
  };

  const handlePriceChange = (valStr: string, setter: (val: number | '') => void) => {
    // Strip non-digit characters to smoothly support Chilean thousands separators and pasted formats
    const digits = valStr.replace(/[^\d]/g, '');
    if (!digits) {
      setter('');
      return;
    }
    const num = parseInt(digits, 10);
    setter(isNaN(num) ? '' : num);
  };

  useEffect(() => {
    if (editingWish) {
      setTitle(editingWish.title || '');
      setAuthor(editingWish.author || '');
      setCoverImage(editingWish.coverImage || '');
      setCoverColor(editingWish.coverColor || '#d4d4d8');
      if (CATEGORIES.includes(editingWish.category)) {
        setCategory(editingWish.category);
        setCustomCategory('');
      } else {
        setCategory('__CUSTOM__');
        setCustomCategory(editingWish.category || '');
      }
      setIntent(editingWish.intent || 'comprar');
      setPriority(editingWish.priority || 'media');
      setEstimatedPrice(parseInitPrice(editingWish.estimatedPrice));
      setOfferPrice(parseInitPrice(editingWish.offerPrice));
      setCurrency(editingWish.currency || '$');
      setStoreName(editingWish.storeName || '');
      setStoreUrl(editingWish.storeUrl || '');
      setNotes(editingWish.notes || '');
      setTotalPages(editingWish.totalPages != null ? editingWish.totalPages : '');
      setFormat(editingWish.format || 'fisico');
    } else {
      setTitle('');
      setAuthor('');
      setCoverImage('');
      setCoverColor('#d4d4d8');
      setCategory(CATEGORIES[0]);
      setCustomCategory('');
      setIntent('comprar');
      setPriority('media');
      setEstimatedPrice('');
      setOfferPrice('');
      setCurrency('$');
      setStoreName('');
      setStoreUrl('');
      setNotes('');
      setTotalPages('');
      setFormat('fisico');
    }
    setShowUrlInput(false);
    setWebUrl('');
  }, [editingWish, isOpen]);

  if (!isOpen) return null;

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setEditorImageSrc(e.target.result as string);
        setIsImageEditorOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalCategory = category === '__CUSTOM__' ? (customCategory.trim() || 'General') : category;

    onSave({
      title: title.trim(),
      author: author.trim() || 'Autor desconocido',
      coverImage: coverImage.trim() || undefined,
      coverColor,
      category: finalCategory,
      intent,
      priority,
      estimatedPrice: estimatedPrice === '' || isNaN(Number(estimatedPrice)) || Number(estimatedPrice) <= 0 ? undefined : Number(estimatedPrice),
      offerPrice: offerPrice === '' || isNaN(Number(offerPrice)) || Number(offerPrice) <= 0 ? undefined : Number(offerPrice),
      currency: currency.trim() || '$',
      storeName: storeName.trim() || undefined,
      storeUrl: storeUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      totalPages: totalPages === '' ? undefined : Number(totalPages),
      format,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 flex flex-col my-auto text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shadow-2xs">
              <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 tracking-tight">
                {editingWish ? 'EDITAR DESEO' : 'AÑADIR A LISTA DE DESEOS'}
              </h2>
              {editingWish && (
                <p className="text-[10px] text-zinc-600 font-bold truncate max-w-[220px]">
                  «{editingWish.title}»
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

        {/* Modal Body - Scrollable */}
        <form
          id="wish-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4 text-xs overscroll-contain"
        >
          {/* Cover & Media Dropzone */}
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
                  Portada opcional
                </label>
                <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-200 px-2 py-0.5 rounded-full border border-zinc-300">
                  JPG • PNG • WEBP
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-bold text-xs cursor-pointer hover:bg-zinc-100 shadow-2xs transition-all active:scale-98">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-zinc-300 text-zinc-900 font-bold text-xs cursor-pointer hover:bg-zinc-100 shadow-2xs transition-all active:scale-98">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Cámara</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>

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
                  <span>Enlace</span>
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

              {showUrlInput && (
                <div className="flex items-center gap-1 mt-1 animate-in fade-in duration-150">
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
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">
              Título del libro <span className="text-zinc-950 font-bold">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Klara y el Sol, Dune, Sapiens..."
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">Autor</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ej: Kazuo Ishiguro"
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
            />
          </div>

          {/* Intent: ¿Por qué está en la lista? (Comprar, Leer, Ambos) */}
          <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
            <label className="block font-bold text-zinc-900 mb-2">
              Objetivo / Propósito
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setIntent('comprar')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center gap-1 border ${
                  intent === 'comprar'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Por Comprar</span>
              </button>

              <button
                type="button"
                onClick={() => setIntent('leer')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center gap-1 border ${
                  intent === 'leer'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Por Leer</span>
              </button>

              <button
                type="button"
                onClick={() => setIntent('ambos')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center gap-1 border ${
                  intent === 'ambos'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Ambos</span>
              </button>
            </div>
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-900 mb-1">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WishlistPriority)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                <option value="alta">🔴 Alta prioridad</option>
                <option value="media">🟡 Media prioridad</option>
                <option value="baja">⚪ Baja prioridad</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-900 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CUSTOM__">➕ Otra...</option>
              </select>
              {category === '__CUSTOM__' && (
                <input
                  type="text"
                  placeholder="Escribe la categoría..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-1.5 w-full bg-white border border-zinc-300 rounded-xl px-3 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Format & Pages */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-900 mb-1">Formato</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as BookFormat)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              >
                <option value="fisico">Físico (Papel)</option>
                <option value="digital">Digital / Ebook</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-900 mb-1">
                Páginas estimadas
              </label>
              <input
                type="number"
                min="1"
                placeholder="Ej: 350"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
              />
            </div>
          </div>

          {/* Price & Discount Section */}
          <div className="bg-zinc-50/80 p-3 rounded-2xl border border-zinc-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-zinc-900 text-xs flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-600" />
                Precio y Descuento
              </span>
              {typeof estimatedPrice === 'number' &&
                typeof offerPrice === 'number' &&
                estimatedPrice > offerPrice &&
                offerPrice > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 animate-in fade-in">
                    -{Math.round(((estimatedPrice - offerPrice) / estimatedPrice) * 100)}% ahorro
                  </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Normal / List Price */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                  Precio normal
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-zinc-400 font-bold text-xs">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={estimatedPrice !== '' ? estimatedPrice.toLocaleString('es-CL') : ''}
                    onChange={(e) => handlePriceChange(e.target.value, setEstimatedPrice)}
                    className="w-full bg-white border border-zinc-300 rounded-xl pl-7 pr-3 py-2 text-xs text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  />
                </div>
              </div>

              {/* Offer Price (Optional, Green digits, Deletable) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    Precio oferta <span className="text-[10px] font-normal text-zinc-400">(opcional)</span>
                  </label>
                  {offerPrice !== '' && offerPrice !== undefined && (
                    <button
                      type="button"
                      onClick={() => setOfferPrice('')}
                      title="Eliminar precio de oferta"
                      className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 px-1 py-0.5 rounded transition-colors flex items-center gap-0.5 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <span className="absolute left-3 text-emerald-600 font-bold text-xs">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 14.990"
                    value={offerPrice !== '' ? offerPrice.toLocaleString('es-CL') : ''}
                    onChange={(e) => handlePriceChange(e.target.value, setOfferPrice)}
                    className="w-full bg-white border border-emerald-300 focus:border-emerald-600 rounded-xl pl-7 pr-7 py-2 text-xs text-emerald-600 font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {offerPrice !== '' && offerPrice !== undefined && (
                    <button
                      type="button"
                      onClick={() => setOfferPrice('')}
                      title="Eliminar precio oferta"
                      className="absolute right-2 text-zinc-400 hover:text-red-600 p-0.5 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Hint / Helper text */}
            {typeof estimatedPrice === 'number' &&
              typeof offerPrice === 'number' &&
              estimatedPrice > offerPrice &&
              offerPrice > 0 && (
                <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 pt-0.5">
                  ✓ Estás ahorrando ${(estimatedPrice - offerPrice).toLocaleString('es-CL')} con este descuento.
                </p>
              )}

            {typeof estimatedPrice === 'number' &&
              typeof offerPrice === 'number' &&
              offerPrice > estimatedPrice &&
              estimatedPrice > 0 && (
                <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  Atención: El precio de oferta es mayor al precio normal.
                </p>
              )}
          </div>

          {/* Store / Where to buy */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">
              Tienda / Librería
            </label>
            <input
              type="text"
              placeholder="Ej: Buscalibre, Feria Chilena..."
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800"
            />
          </div>

          {/* Notes / Reason */}
          <div>
            <label className="block font-bold text-zinc-900 mb-1">
              Notas / Recomendaciones
            </label>
            <textarea
              rows={2}
              placeholder="¿Quién te lo recomendó? ¿Alguna edición especial o fecha en mente?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-800 resize-none"
            />
          </div>
        </form>

        {/* Modal Footer */}
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
            form="wish-form"
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            {editingWish ? 'Guardar Cambios' : 'Añadir a Deseos'}
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

      {/* Online Cover Search Modal */}
      <CoverSearchModal
        isOpen={isCoverSearchOpen}
        initialTitle={title}
        initialAuthor={author}
        onClose={() => setIsCoverSearchOpen(false)}
        onSelectCover={(coverUrl) => {
          setCoverImage(coverUrl);
        }}
      />
    </div>
  );
};
