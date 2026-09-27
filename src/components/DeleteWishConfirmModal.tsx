import React from 'react';
import { WishlistItem } from '../types';
import { Trash2 } from 'lucide-react';

interface DeleteWishConfirmModalProps {
  isOpen: boolean;
  wish: WishlistItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteWishConfirmModal: React.FC<DeleteWishConfirmModalProps> = ({
  isOpen,
  wish,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !wish) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-800 flex items-center justify-center mx-auto mb-3">
          <Trash2 className="w-6 h-6" />
        </div>

        <h3 className="text-base font-extrabold text-zinc-900 mb-1">
          ¿Eliminar de tu lista de deseos?
        </h3>

        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
          Estás a punto de quitar <strong className="text-zinc-900">«{wish.title}»</strong> de tus libros deseados.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};
