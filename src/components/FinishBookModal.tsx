import React, { useState } from 'react';
import { Book } from '../types';
import { StarRating } from './StarRating';
import { Award, CheckCircle2, ChevronRight, BookOpen, X, Sparkles } from 'lucide-react';

interface FinishBookModalProps {
  isOpen: boolean;
  book: Book | null;
  pendingBooks: Book[];
  onClose: () => void;
  onConfirmFinish: (rating: number, nextBookId?: string) => void;
}

export const FinishBookModal: React.FC<FinishBookModalProps> = ({
  isOpen,
  book,
  pendingBooks,
  onClose,
  onConfirmFinish,
}) => {
  const [rating, setRating] = useState(book?.rating || 5);
  const [selectedNextBookId, setSelectedNextBookId] = useState<string>(
    pendingBooks.length > 0 ? pendingBooks[0].id : ''
  );

  if (!isOpen || !book) return null;

  const handleConfirm = () => {
    onConfirmFinish(rating, selectedNextBookId || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-purple-100 text-center animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-[#FDA5D5] text-[#4a154b] flex items-center justify-center mx-auto mb-3 shadow-xs border border-[#f48fb1]">
          <Award className="w-8 h-8" />
        </div>

        <h2 className="text-lg font-extrabold text-[#3a2d4c] mb-1">
          ¡Felicitaciones! 🎉
        </h2>

        <p className="text-xs text-gray-500 mb-4">
          Has terminado de leer <strong className="text-[#3a2d4c]">«{book.title}»</strong>.
        </p>

        {/* Rating Picker */}
        <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100 mb-4">
          <label className="block text-xs font-bold text-[#3a2d4c] mb-1.5">
            ¿Cómo calificas esta lectura?
          </label>
          <div className="flex items-center justify-center gap-2">
            <StarRating
              rating={rating}
              interactive
              onRatingChange={(r) => setRating(r)}
              size="lg"
            />
          </div>
          <p className="text-[11px] font-bold text-[#8e24aa] mt-1">
            {rating > 0 ? `${rating} estrellas` : 'Sin calificación'}
          </p>
        </div>

        {/* Next Book Suggestion (Section 6 Continuity) */}
        {pendingBooks.length > 0 && (
          <div className="text-left bg-purple-50/40 p-3 rounded-2xl border border-purple-100 mb-4">
            <label className="block text-xs font-bold text-[#3a2d4c] mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#8e24aa]" />
              Siguiente libro en lectura:
            </label>
            <select
              value={selectedNextBookId}
              onChange={(e) => setSelectedNextBookId(e.target.value)}
              className="w-full bg-white border border-purple-200 rounded-xl px-2.5 py-1.5 text-xs text-[#3a2d4c] font-medium focus:outline-none"
            >
              <option value="">(Ninguno por ahora, elegiré luego)</option>
              {pendingBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} - {b.author}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#FDA5D5] hover:bg-[#f386c3] text-[#4a154b] font-black text-xs shadow-xs border border-[#f48fb1] transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Guardar y Terminar
          </button>
        </div>
      </div>
    </div>
  );
};
