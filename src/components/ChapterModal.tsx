import React, { useState, useEffect, useRef } from 'react';
import { Book, Chapter } from '../types';
import {
  Layers,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  FolderPlus,
  Bookmark,
  Pencil,
  RotateCw,
} from 'lucide-react';
import {
  toRoman,
  fromRoman,
  parseChapterComponents,
  composeChapterTitle,
  sortChaptersByPage,
  toggleChapterProgress,
} from '../lib/romanUtils';
import { RomanChapterText } from './RomanChapterText';
import { chapterStorage } from '../lib/chapterStorage';

interface ChapterModalProps {
  isOpen: boolean;
  book: Book | null;
  initialEditingChapterId?: string | null;
  onClose: () => void;
  onUpdateChapters: (
    bookId: string,
    chapters: Chapter[],
    hasParts?: boolean,
    parts?: string[],
    newPage?: number
  ) => void;
}

export const ChapterModal: React.FC<ChapterModalProps> = ({
  isOpen,
  book,
  initialEditingChapterId,
  onClose,
  onUpdateChapters,
}) => {
  const [chapters, setChapters] = useState<Chapter[]>(book?.chapters || []);
  const [hasParts, setHasParts] = useState<boolean>(book?.hasParts || false);
  const [parts, setParts] = useState<string[]>(book?.parts || []);
  const [newPartInput, setNewPartInput] = useState('');
  const [selectedPart, setSelectedPart] = useState<string>('');

  // Default format is Roman numerals (I, II, III, IV, V...)
  const [titleFormat, setTitleFormat] = useState<'capitulo' | 'romanos'>('romanos');
  
  // Separate fields for new chapter:
  const [newChapterNumber, setNewChapterNumber] = useState<string>('');
  const [newChapterName, setNewChapterName] = useState<string>('');
  
  const [startPage, setStartPage] = useState<number | ''>('');
  const [endPage, setEndPage] = useState<number | ''>('');
  const [batchCount, setBatchCount] = useState<number | ''>('');
  const [batchPart, setBatchPart] = useState<string>('');
  const [batchFormat, setBatchFormat] = useState<'capitulo' | 'romanos'>('romanos');
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  // State for editing a chapter:
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterNumber, setEditChapterNumber] = useState<string>('');
  const [editChapterName, setEditChapterName] = useState<string>('');
  const [editStartPage, setEditStartPage] = useState<number | ''>('');
  const [editEndPage, setEditEndPage] = useState<number | ''>('');
  const [editPart, setEditPart] = useState<string>('');

  // State for editing a part/section:
  const [editingPartName, setEditingPartName] = useState<string | null>(null);
  const [partNameEditInput, setPartNameEditInput] = useState<string>('');

  const getNextChapterIndexForPart = (
    targetPart?: string,
    chaptersList: Chapter[] = chapters,
    partsEnabled: boolean = hasParts
  ): number => {
    if (!partsEnabled || !targetPart) {
      return chaptersList.length + 1;
    }
    const inPart = chaptersList.filter((c) => c.part === targetPart);
    return inPart.length + 1;
  };

  const getSuggestedNumber = (
    targetPart?: string,
    format: 'capitulo' | 'romanos' = titleFormat,
    chaptersList: Chapter[] = chapters,
    partsEnabled: boolean = hasParts
  ) => {
    const idx = getNextChapterIndexForPart(targetPart, chaptersList, partsEnabled);
    return format === 'romanos' ? toRoman(idx) : String(idx);
  };

  const prevOpenRef = useRef<boolean>(false);
  const prevBookIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !book) {
      prevOpenRef.current = false;
      return;
    }

    const isFreshOpen = !prevOpenRef.current || prevBookIdRef.current !== book.id;
    prevOpenRef.current = true;
    prevBookIdRef.current = book.id;

    let bookChapters = sortChaptersByPage(book.chapters || []);

    // If in-memory chapters are empty, attempt instantaneous recovery from IndexedDB
    if (bookChapters.length === 0 && book.id) {
      chapterStorage.getChapters(book.id).then((stored) => {
        if (stored && Array.isArray(stored.chapters) && stored.chapters.length > 0) {
          const recovered = sortChaptersByPage(stored.chapters);
          setChapters(recovered);
          const recHasParts = stored.hasParts || false;
          const recParts = stored.parts || [];
          setHasParts(recHasParts);
          setParts(recParts);
          onUpdateChapters(book.id, recovered, recHasParts, recParts);
        }
      });
    }

    setChapters(bookChapters);
    const currentHasParts = book.hasParts || false;
    const currentParts = book.parts && book.parts.length > 0 ? book.parts : [];
    setHasParts(currentHasParts);
    setParts(currentParts);

    // If modal is freshly opened or switching to a different book:
    let initialPart = '';
    if (isFreshOpen) {
      // Default to the part of the last chapter if it exists, or the first part
      const lastChapterWithPart = [...bookChapters].reverse().find((c) => c.part && currentParts.includes(c.part));
      initialPart = lastChapterWithPart?.part || (currentParts.length > 0 ? currentParts[0] : '');
      setSelectedPart(initialPart);
      setBatchPart(initialPart);
    } else {
      setSelectedPart((prev) => {
        if (prev && currentParts.includes(prev)) {
          initialPart = prev;
          return prev;
        }
        const lastChapterWithPart = [...bookChapters].reverse().find((c) => c.part && currentParts.includes(c.part));
        initialPart = lastChapterWithPart?.part || (currentParts.length > 0 ? currentParts[0] : '');
        return initialPart;
      });
      setBatchPart((prev) => {
        if (prev && currentParts.includes(prev)) {
          return prev;
        }
        const lastChapterWithPart = [...bookChapters].reverse().find((c) => c.part && currentParts.includes(c.part));
        return lastChapterWithPart?.part || (currentParts.length > 0 ? currentParts[0] : '');
      });
    }

    const lastChapter = bookChapters.length > 0 ? bookChapters[bookChapters.length - 1] : null;
    const nextStart = lastChapter ? lastChapter.endPage + 1 : 1;
    setStartPage(nextStart <= book.totalPages ? nextStart : book.totalPages);
    setEndPage(Math.min(book.totalPages, nextStart + 20));
    setNewChapterNumber(getSuggestedNumber(initialPart, titleFormat, bookChapters, currentHasParts));
    setNewChapterName('');

    if (initialEditingChapterId) {
      const target = bookChapters.find((c) => c.id === initialEditingChapterId);
      if (target) {
        handleStartEditChapter(target);
      }
    }
  }, [book, isOpen, titleFormat, initialEditingChapterId]);

  // When user switches title format toggle, update the suggested number in single chapter input
  const handleFormatChange = (fmt: 'capitulo' | 'romanos') => {
    setTitleFormat(fmt);
    setBatchFormat(fmt);
    setNewChapterNumber(getSuggestedNumber(selectedPart, fmt, chapters, hasParts));
    // Also convert existing chapters to match selected format
    if (chapters.length > 0) {
      handleConvertAllTitles(fmt);
    }
  };

  if (!isOpen || !book) return null;

  const notifyChange = (
    updatedChapters: Chapter[],
    updatedHasParts: boolean,
    updatedParts: string[],
    newPage?: number
  ) => {
    const sorted = sortChaptersByPage(updatedChapters);
    setChapters(sorted);
    setHasParts(updatedHasParts);
    setParts(updatedParts);
    chapterStorage.saveChapters(book.id, sorted, updatedHasParts, updatedParts);
    onUpdateChapters(book.id, sorted, updatedHasParts, updatedParts, newPage);
  };

  const handleClose = () => {
    if (book) {
      chapterStorage.saveChapters(book.id, chapters, hasParts, parts);
      onUpdateChapters(book.id, chapters, hasParts, parts);
    }
    onClose();
  };

  // Convert existing chapters between Roman numerals ("I", "II", "III"...) and Arabic numbers ("1", "2", "3"...)
  // If book has parts, natural index starts at 1 for each division/part
  const handleConvertAllTitles = (targetFormat: 'capitulo' | 'romanos') => {
    const partCounters: Record<string, number> = {};
    let unassignedCounter = 0;

    const updated = chapters.map((ch) => {
      const partKey = hasParts && ch.part && parts.includes(ch.part) ? ch.part : '__none__';
      let naturalIndex = 1;
      if (partKey === '__none__') {
        unassignedCounter += 1;
        naturalIndex = unassignedCounter;
      } else {
        partCounters[partKey] = (partCounters[partKey] || 0) + 1;
        naturalIndex = partCounters[partKey];
      }

      const { number, name } = parseChapterComponents(ch.title, ch.chapterNumber, ch.chapterName);
      
      let extractedIndex: number = naturalIndex;
      if (number) {
        if (/^\d+$/.test(number)) {
          extractedIndex = parseInt(number, 10);
        } else if (fromRoman(number) !== null) {
          extractedIndex = fromRoman(number) || naturalIndex;
        }
      }

      const newNumber = targetFormat === 'romanos' ? toRoman(extractedIndex) : String(extractedIndex);
      const newTitle = composeChapterTitle(newNumber, name);

      return {
        ...ch,
        chapterNumber: newNumber,
        chapterName: name,
        title: newTitle,
      };
    });
    notifyChange(updated, hasParts, parts);
    setTitleFormat(targetFormat);
    setBatchFormat(targetFormat);
    setNewChapterNumber(getSuggestedNumber(selectedPart, targetFormat, updated, hasParts));
  };

  // Renumber all chapters so every division starts from chapter 1 (or I) and counts sequentially
  const handleRenumberPartsFromOne = (targetFormat: 'capitulo' | 'romanos' = titleFormat) => {
    const partCounters: Record<string, number> = {};
    let unassignedCounter = 0;

    const updated = chapters.map((ch) => {
      const partKey = ch.part && parts.includes(ch.part) ? ch.part : '__unassigned__';
      let idx = 1;
      if (partKey === '__unassigned__') {
        unassignedCounter += 1;
        idx = unassignedCounter;
      } else {
        partCounters[partKey] = (partCounters[partKey] || 0) + 1;
        idx = partCounters[partKey];
      }

      const numStr = targetFormat === 'romanos' ? toRoman(idx) : String(idx);
      const { name } = parseChapterComponents(ch.title, ch.chapterNumber, ch.chapterName);
      const newTitle = composeChapterTitle(numStr, name);

      return {
        ...ch,
        chapterNumber: numStr,
        chapterName: name,
        title: newTitle,
      };
    });

    notifyChange(updated, hasParts, parts);
    setNewChapterNumber(getSuggestedNumber(selectedPart, targetFormat, updated, hasParts));
  };

  const handleToggleHasParts = (checked: boolean) => {
    let updatedParts = parts;
    if (checked && parts.length === 0) {
      updatedParts = ['Primera Parte', 'Segunda Parte'];
      setSelectedPart('Primera Parte');
      setBatchPart('Primera Parte');
    }
    notifyChange(chapters, checked, updatedParts);
    const activeP = checked ? (selectedPart || updatedParts[0] || '') : undefined;
    setNewChapterNumber(getSuggestedNumber(activeP, titleFormat, chapters, checked));
  };

  const handleAddPart = () => {
    const trimmed = newPartInput.trim();
    if (!trimmed) return;
    if (parts.includes(trimmed)) return;
    const updatedParts = [...parts, trimmed];
    setParts(updatedParts);
    setSelectedPart(trimmed);
    setBatchPart(trimmed);
    setNewPartInput('');
    notifyChange(chapters, true, updatedParts);
    setNewChapterNumber(getSuggestedNumber(trimmed, titleFormat, chapters, true));
  };

  const handleSaveEditPart = (oldPartName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldPartName) {
      setEditingPartName(null);
      return;
    }
    const updatedParts = parts.map((p) => (p === oldPartName ? trimmed : p));
    const updatedChapters = chapters.map((c) =>
      c.part === oldPartName ? { ...c, part: trimmed } : c
    );
    if (selectedPart === oldPartName) setSelectedPart(trimmed);
    if (batchPart === oldPartName) setBatchPart(trimmed);
    setEditingPartName(null);
    notifyChange(updatedChapters, hasParts, updatedParts);
  };

  const handleDeletePart = (partNameToDelete: string) => {
    const updatedParts = parts.filter((p) => p !== partNameToDelete);
    const updatedChapters = chapters.map((c) =>
      c.part === partNameToDelete ? { ...c, part: undefined } : c
    );
    if (selectedPart === partNameToDelete) {
      setSelectedPart(updatedParts.length > 0 ? updatedParts[0] : '');
    }
    if (batchPart === partNameToDelete) {
      setBatchPart(updatedParts.length > 0 ? updatedParts[0] : '');
    }
    notifyChange(updatedChapters, hasParts, updatedParts);
  };

  const handleAddSingleChapter = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = newChapterNumber.trim();
    const cleanName = newChapterName.trim();

    // At least one of the two should be present (either number or name)
    if (!cleanNum && !cleanName) return;

    const start = Number(startPage) || 1;
    const end = Math.max(start, Number(endPage) || start);
    const compTitle = composeChapterTitle(cleanNum, cleanName);

    const newChap: Chapter = {
      id: `ch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: compTitle,
      chapterNumber: cleanNum || undefined,
      chapterName: cleanName || undefined,
      startPage: start,
      endPage: end,
      isRead: false,
      part: hasParts && selectedPart ? selectedPart : undefined,
    };

    const updated = [...chapters, newChap];
    notifyChange(updated, hasParts, parts);

    const nextStart = end + 1;
    setStartPage(nextStart <= book.totalPages ? nextStart : book.totalPages);
    setEndPage(Math.min(book.totalPages, nextStart + 20));
    setNewChapterNumber(getSuggestedNumber(selectedPart, titleFormat, updated, hasParts));
    setNewChapterName('');
  };

  const handleBatchGenerate = (count: number) => {
    if (count <= 0) return;
    const isTargetingPart = hasParts && !!batchPart;
    const existingInPart = isTargetingPart
      ? chapters.filter((c) => c.part === batchPart).length
      : chapters.length;

    const lastInPart = isTargetingPart
      ? [...chapters].reverse().find((c) => c.part === batchPart)
      : null;
    const lastOverall = chapters.length > 0 ? chapters[chapters.length - 1] : null;
    const referenceChap = lastInPart || lastOverall;

    let currentStart = referenceChap ? referenceChap.endPage + 1 : 1;
    const remainingPages = Math.max(1, book.totalPages - currentStart + 1);
    const pagesPerChap = Math.max(1, Math.floor(remainingPages / count));

    const newBatch: Chapter[] = [];
    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const end = isLast ? book.totalPages : Math.min(book.totalPages, currentStart + pagesPerChap - 1);
      // In any division, numbering starts from 1 and counts from there
      const chapterIdx = existingInPart + i;
      const numStr = batchFormat === 'romanos' ? toRoman(chapterIdx) : String(chapterIdx);

      newBatch.push({
        id: `ch-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        title: numStr,
        chapterNumber: numStr,
        chapterName: '',
        startPage: currentStart,
        endPage: end,
        isRead: false,
        part: hasParts && batchPart ? batchPart : undefined,
      });
      currentStart = end + 1;
    }

    const updated = [...chapters, ...newBatch];
    notifyChange(updated, hasParts, parts);
    setShowBatchModal(false);
    setNewChapterNumber(getSuggestedNumber(selectedPart || batchPart, titleFormat, updated, hasParts));
    setNewChapterName('');
  };

  const handleDeleteChapter = (chapId: string) => {
    const updated = chapters.filter((c) => c.id !== chapId);
    notifyChange(updated, hasParts, parts);
  };

  const handleChangeChapterPart = (chapId: string, newPart: string) => {
    const updated = chapters.map((c) =>
      c.id === chapId ? { ...c, part: newPart || undefined } : c
    );
    notifyChange(updated, hasParts, parts);
  };

  const handleStartEditChapter = (chap: Chapter) => {
    const { number, name } = parseChapterComponents(chap.title, chap.chapterNumber, chap.chapterName);
    setEditingChapterId(chap.id);
    setEditChapterNumber(number);
    setEditChapterName(name);
    setEditStartPage(chap.startPage);
    setEditEndPage(chap.endPage);
    setEditPart(chap.part || '');
  };

  const handleSaveChapter = (chapId: string) => {
    const cleanNum = editChapterNumber.trim();
    const cleanName = editChapterName.trim();
    if (!cleanNum && !cleanName) return;

    const start = typeof editStartPage === 'number' && editStartPage >= 1 ? editStartPage : 1;
    const end = typeof editEndPage === 'number' && editEndPage >= start ? editEndPage : start;
    const compTitle = composeChapterTitle(cleanNum, cleanName);

    const updated = chapters.map((c) => {
      if (c.id !== chapId) return c;
      return {
        ...c,
        chapterNumber: cleanNum || undefined,
        chapterName: cleanName || undefined,
        title: compTitle,
        startPage: start,
        endPage: end,
        part: editPart || undefined,
      };
    });

    notifyChange(updated, hasParts, parts);
    setEditingChapterId(null);
    setEditChapterNumber('');
    setEditChapterName('');
  };

  const handleCancelEditChapter = () => {
    setEditingChapterId(null);
    setEditChapterNumber('');
    setEditChapterName('');
  };

  const handleToggleRead = (chapId: string) => {
    const result = toggleChapterProgress(chapters, chapId, book.currentPage, book.totalPages);
    if (!result) return;
    notifyChange(result.updatedChapters, hasParts, parts, result.newPage);
  };

  const handleUnmarkAll = () => {
    const updated = chapters.map((ch) => ({ ...ch, isRead: false }));
    notifyChange(updated, hasParts, parts);
  };

  const handleMarkAll = () => {
    const updated = chapters.map((ch) => ({ ...ch, isRead: true }));
    const lastChapter = chapters[chapters.length - 1];
    const newPage = lastChapter ? lastChapter.endPage : (book ? book.totalPages : undefined);
    notifyChange(updated, hasParts, parts, newPage);
  };

  // Check if any chapter has the old "Capítulo" naming
  const hasCapituloTitles = chapters.some((c) => /^Cap[íi]tulo\b/i.test(c.title.trim()));

  // Render an individual chapter row (either normal row or active edit card)
  const renderChapterRow = (ch: Chapter) => {
    const isEditing = editingChapterId === ch.id;
    const chapterPages = Math.max(1, ch.endPage - ch.startPage + 1);

    if (isEditing) {
      return (
        <div
          key={ch.id}
          className="p-3.5 bg-zinc-50 border-2 border-zinc-900 rounded-2xl shadow-md space-y-3 animate-in fade-in duration-150 text-left"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-zinc-900" />
              Editar Capítulo y Páginas
            </span>
            <button
              type="button"
              onClick={handleCancelEditChapter}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
              title="Cancelar edición"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider">
                  Número (Romano o normal)
                </label>
                <span className="text-[9px] font-bold text-zinc-400 uppercase bg-zinc-200/80 px-1 py-0.5 rounded">
                  Opcional
                </span>
              </div>
              <input
                type="text"
                placeholder="Ej: VIII o 8"
                value={editChapterNumber}
                onChange={(e) => setEditChapterNumber(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-1.5 font-['Times_New_Roman',Times,serif] font-bold text-[18px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const num = parseInt(editChapterNumber, 10);
                    if (!isNaN(num) && num > 0) {
                      setEditChapterNumber(toRoman(num));
                    }
                  }}
                  className="text-[9px] text-zinc-600 hover:text-zinc-900 font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 cursor-pointer"
                >
                  Convertir a Romano
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = fromRoman(editChapterNumber);
                    if (num !== null) {
                      setEditChapterNumber(String(num));
                    }
                  }}
                  className="text-[9px] text-zinc-600 hover:text-zinc-900 font-bold px-1.5 py-0.5 rounded bg-zinc-200/80 cursor-pointer"
                >
                  Convertir a Normal
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider">
                  Nombre del capítulo
                </label>
                <span className="text-[9px] font-bold text-zinc-400 uppercase bg-zinc-200/80 px-1 py-0.5 rounded">
                  Opcional
                </span>
              </div>
              <input
                type="text"
                placeholder="Ej: Los mitos de la ciencia"
                value={editChapterName}
                onChange={(e) => setEditChapterName(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider mb-1">
                Pág Inicio
              </label>
              <input
                type="number"
                min="1"
                max={book.totalPages}
                value={editStartPage}
                onChange={(e) => setEditStartPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider mb-1">
                Pág Fin
              </label>
              <input
                type="number"
                min="1"
                max={book.totalPages}
                value={editEndPage}
                onChange={(e) => setEditEndPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {hasParts && parts.length > 0 && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider mb-1">
                  Parte / Sección
                </label>
                <select
                  value={editPart}
                  onChange={(e) => setEditPart(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">(Sin asignar)</option>
                  {parts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Preview of edit */}
          <div className="p-2.5 bg-white rounded-xl border border-zinc-200 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Vista previa:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <RomanChapterText
                chapterNumber={editChapterNumber}
                chapterName={editChapterName}
                romanSize="text-[18px]"
              />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-300 font-mono text-xs font-bold text-zinc-900 whitespace-nowrap shadow-2xs">
                <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase tracking-wide">Págs</span>
                <span>{editStartPage || 1} – {editEndPage || editStartPage || 1}</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-mono whitespace-nowrap">
                {Math.max(1, (Number(editEndPage) || 1) - (Number(editStartPage) || 1) + 1)} págs
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-200">
            <button
              type="button"
              onClick={handleCancelEditChapter}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleSaveChapter(ch.id)}
              disabled={!editChapterNumber.trim() && !editChapterName.trim()}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar cambios</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={ch.id}
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
          ch.isRead
            ? 'bg-zinc-100/90 border-zinc-300 text-zinc-700'
            : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300 shadow-2xs'
        }`}
      >
        <div className="flex flex-col gap-2.5">
          {/* Top row: Checkbox + 1. Número - Nombre + Estado */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => handleToggleRead(ch.id)}
                className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 border transition-all cursor-pointer mt-0.5 ${
                  ch.isRead
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xs'
                    : 'border-zinc-300 bg-zinc-50 hover:border-zinc-500'
                }`}
                title={ch.isRead ? 'Marcar como pendiente' : 'Marcar como leído'}
              >
                {ch.isRead && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              <div className="min-w-0 flex-1">
                {/* 1. Número - nombre */}
                <div
                  onClick={() => handleStartEditChapter(ch)}
                  className={`cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 flex-wrap ${
                    ch.isRead ? 'line-through text-zinc-500' : 'text-zinc-900'
                  }`}
                  title="Toca para editar el capítulo o sus páginas"
                >
                  <RomanChapterText
                    title={ch.title}
                    chapterNumber={ch.chapterNumber}
                    chapterName={ch.chapterName}
                    romanSize="text-[18px] sm:text-[20px]"
                    showEmptyNamePlaceholder={true}
                    isRead={ch.isRead}
                  />
                </div>
              </div>
            </div>

            {/* Read / Pending status pill */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                ch.isRead
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              {ch.isRead ? 'Leído' : 'Pendiente'}
            </span>
          </div>

          {/* Middle row: 2. Página inicio - página final & 3. Sección */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-150">
            {/* 2. Página inicio - página final */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-250 font-mono text-xs font-bold text-zinc-900 shadow-2xs">
                <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase tracking-wide">
                  Página inicio:
                </span>
                <span className="text-zinc-900">{ch.startPage}</span>
                <span className="text-zinc-400 font-bold mx-0.5">–</span>
                <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase tracking-wide">
                  Página final:
                </span>
                <span className="text-zinc-900">{ch.endPage}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-200/90 text-zinc-700 font-mono whitespace-nowrap">
                {chapterPages} {chapterPages === 1 ? 'pág' : 'págs'}
              </span>
            </div>

            {/* 3. Sección */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                Sección:
              </span>
              {hasParts && parts.length > 0 ? (
                <select
                  value={ch.part || ''}
                  onChange={(e) => handleChangeChapterPart(ch.id, e.target.value)}
                  className="text-xs bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-300 rounded-lg px-2 py-0.5 text-zinc-800 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer max-w-[150px] truncate"
                  title="Cambiar sección/parte"
                >
                  {parts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="">(Sin sección)</option>
                </select>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 font-medium text-xs text-zinc-600">
                  {ch.part || 'Sin sección'}
                </span>
              )}
            </div>
          </div>

          {/* 4. Botón editar - botón borrar */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-150">
            <button
              type="button"
              onClick={() => handleStartEditChapter(ch)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-98"
              title="Editar número, nombre, páginas o sección"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-600" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              onClick={() => handleDeleteChapter(ch.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-98"
              title="Eliminar capítulo"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Borrar</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-zinc-200 my-8 text-left max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 text-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 leading-tight">
                Capítulos y Partes del Libro
              </h2>
              <p className="text-xs text-zinc-500 truncate max-w-xs font-medium mt-0.5">
                «{book.title}» ({book.totalPages} págs)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          {/* Format selector bar */}
          <div className="p-3 bg-zinc-100/90 rounded-2xl border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="font-extrabold text-xs text-zinc-900 block">Formato de numeración</span>
              <span className="text-[10px] text-zinc-500 font-medium">
                Selecciona cómo deseas numerar por defecto los capítulos:
              </span>
            </div>
            <div className="flex items-center bg-white p-1 rounded-xl border border-zinc-300 shadow-2xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleFormatChange('romanos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  titleFormat === 'romanos'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <span>Romanos</span>
                <span className="font-['Times_New_Roman',Times,serif] font-bold text-[18px] leading-none">(I, II, III...)</span>
              </button>
              <button
                type="button"
                onClick={() => handleFormatChange('capitulo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  titleFormat === 'capitulo'
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <span>Normal (1, 2, 3...)</span>
              </button>
            </div>
          </div>

          {/* Quick convert alert if old "Capítulo" format is detected */}
          {hasCapituloTitles && (
            <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center justify-between gap-3 text-amber-900">
              <div className="min-w-0">
                <p className="font-bold text-xs">Capítulos con formato antiguo «Capítulo X»</p>
                <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                  <span>Cambia todos a números romanos</span>
                  <span className="font-['Times_New_Roman',Times,serif] font-bold text-[18px] leading-none">(I, II, III, IV, V...)</span>
                  <span>con un solo clic.</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleConvertAllTitles('romanos')}
                className="px-3 py-1.5 bg-zinc-900 text-white font-bold text-xs rounded-xl hover:bg-black shrink-0 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Convertir a</span>
                <span className="font-['Times_New_Roman',Times,serif] font-bold text-[18px] leading-none">(I, II, III...)</span>
              </button>
            </div>
          )}

          {/* Checkbox: Dividir en Partes / Secciones */}
          <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={hasParts}
                  onChange={(e) => handleToggleHasParts(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer accent-zinc-900"
                />
                <div>
                  <span className="font-bold text-xs text-zinc-900 block">
                    Dividir este libro en Partes / Secciones
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium block">
                    Organiza los capítulos dentro de secciones como «Primera Parte», «Segunda Parte», etc.
                  </span>
                </div>
              </div>
              <Bookmark className={`w-4 h-4 ${hasParts ? 'text-zinc-900 fill-zinc-900' : 'text-zinc-400'}`} />
            </label>

            {/* Administrador de partes si está activo */}
            {hasParts && (
              <div className="pt-2 border-t border-zinc-200/80 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                    Partes configuradas ({parts.length}) • Cada división inicia en el capítulo 1 (o I)
                  </span>
                  {chapters.some((c) => c.part) && (
                    <button
                      type="button"
                      onClick={() => handleRenumberPartsFromOne(titleFormat)}
                      className="px-2.5 py-1 text-[10px] font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 rounded-xl shadow-2xs transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Renumerar para que cada parte/sección comience con el capítulo 1 (o I) y cuente desde ahí"
                    >
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      <span>Renumerar desde 1 en cada parte</span>
                    </button>
                  )}
                </div>

                {/* Lista de tags de partes */}
                <div className="flex flex-wrap gap-1.5">
                  {parts.map((p) => {
                    const isEditingThisPart = editingPartName === p;

                    if (isEditingThisPart) {
                      return (
                        <div
                          key={p}
                          className="flex items-center gap-1 bg-white border-2 border-zinc-900 px-2 py-1 rounded-xl shadow-xs"
                        >
                          <input
                            type="text"
                            value={partNameEditInput}
                            onChange={(e) => setPartNameEditInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditPart(p, partNameEditInput);
                              } else if (e.key === 'Escape') {
                                setEditingPartName(null);
                              }
                            }}
                            autoFocus
                            className="bg-zinc-50 border border-zinc-300 rounded-lg px-2 py-0.5 text-xs font-bold text-zinc-900 w-36 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditPart(p, partNameEditInput)}
                            className="p-1 bg-zinc-900 text-white rounded-lg hover:bg-black cursor-pointer"
                            title="Guardar nombre"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPartName(null)}
                            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={p}
                        className="flex items-center gap-1.5 bg-white border border-zinc-300 px-2.5 py-1 rounded-xl text-xs font-semibold text-zinc-800 shadow-2xs"
                      >
                        <span>{p}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPartName(p);
                            setPartNameEditInput(p);
                          }}
                          className="text-zinc-400 hover:text-zinc-900 p-0.5 rounded cursor-pointer transition-colors"
                          title="Editar nombre de esta parte/sección"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePart(p)}
                          className="text-zinc-400 hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                          title="Eliminar esta parte"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Input para nueva parte */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Ej: Primera Parte, Acto I, Libro 1..."
                    value={newPartInput}
                    onChange={(e) => setNewPartInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPart();
                      }
                    }}
                    className="flex-1 bg-white border border-zinc-300 rounded-xl px-3 py-1.5 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddPart}
                    disabled={!newPartInput.trim()}
                    className="px-3 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Añadir Parte</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add chapter form */}
          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-zinc-900 uppercase tracking-wider text-[11px]">
                Añadir Capítulo
              </span>
              <button
                type="button"
                onClick={() => setShowBatchModal(!showBatchModal)}
                className="text-[11px] font-bold text-zinc-700 hover:text-black hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-800" />
                {showBatchModal ? 'Formulario individual' : 'Generador múltiple'}
              </button>
            </div>

            {showBatchModal ? (
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] text-zinc-600 font-medium">
                  Genera todos los capítulos automáticamente numerados en {batchFormat === 'romanos' ? 'Romanos (I, II, III...)' : 'Normal (1, 2, 3...)'}:
                </p>

                {hasParts && parts.length > 0 && (
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-wider mb-1">
                      Asignar a la parte:
                    </label>
                    <select
                      value={batchPart}
                      onChange={(e) => {
                        const nextP = e.target.value;
                        setBatchPart(nextP);
                        setSelectedPart(nextP);
                        setNewChapterNumber(getSuggestedNumber(nextP, titleFormat, chapters, hasParts));
                      }}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      {parts.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value="">(Sin parte específica)</option>
                    </select>
                  </div>
                )}

                {hasParts && parts.length > 0 && batchPart && (
                  <p className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl">
                    {chapters.filter((c) => c.part === batchPart).length === 0
                      ? `Comenzará desde el capítulo ${batchFormat === 'romanos' ? 'I' : '1'} para "${batchPart}".`
                      : `Continuará desde el capítulo ${batchFormat === 'romanos' ? toRoman(chapters.filter((c) => c.part === batchPart).length + 1) : chapters.filter((c) => c.part === batchPart).length + 1} para "${batchPart}".`}
                  </p>
                )}

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="¿Cuántos capítulos? (ej: 15)"
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="flex-1 bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleBatchGenerate(Number(batchCount))}
                    disabled={!batchCount || Number(batchCount) <= 0}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span>Generar</span>
                    {batchFormat === 'romanos' ? (
                      <span className="font-['Times_New_Roman',Times,serif] font-bold text-[18px] leading-none">(I, II, III...)</span>
                    ) : (
                      <span className="text-xs font-bold">(1, 2...)</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSingleChapter} className="space-y-3">
                {/* Two separate fields for Number and Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Field 1: Número */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] text-zinc-700 font-black uppercase tracking-wider">
                        Número del capítulo
                      </label>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase bg-zinc-200/80 px-1.5 py-0.5 rounded">
                        Opcional
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ej: VIII o 8"
                      value={newChapterNumber}
                      onChange={(e) => setNewChapterNumber(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 font-['Times_New_Roman',Times,serif] font-bold text-[18px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400 placeholder:font-sans placeholder:text-xs placeholder:font-normal"
                    />
                    <div className="flex items-center gap-1.5 mt-1">
                      {(() => {
                        const nextPartIdx = getNextChapterIndexForPart(selectedPart, chapters, hasParts);
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => setNewChapterNumber(toRoman(nextPartIdx))}
                              className="text-[10px] text-zinc-600 hover:text-zinc-950 font-bold px-1.5 py-0.5 rounded bg-zinc-200/70 hover:bg-zinc-200 cursor-pointer transition-colors"
                              title="Usar número romano"
                            >
                              Romano ({toRoman(nextPartIdx)})
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewChapterNumber(String(nextPartIdx))}
                              className="text-[10px] text-zinc-600 hover:text-zinc-950 font-bold px-1.5 py-0.5 rounded bg-zinc-200/70 hover:bg-zinc-200 cursor-pointer transition-colors"
                              title="Usar número normal"
                            >
                              Normal ({nextPartIdx})
                            </button>
                          </>
                        );
                      })()}
                      {newChapterNumber && (
                        <button
                          type="button"
                          onClick={() => setNewChapterNumber('')}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 ml-auto cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Field 2: Nombre del capítulo */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] text-zinc-700 font-black uppercase tracking-wider">
                        Nombre del capítulo
                      </label>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase bg-zinc-200/80 px-1.5 py-0.5 rounded">
                        Opcional
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ej: Los mitos de la ciencia..."
                      value={newChapterName}
                      onChange={(e) => setNewChapterName(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400 placeholder:font-normal"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Puedes llenar número, nombre, o ambos.
                    </p>
                  </div>
                </div>

                {/* Pages and Part */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider mb-1">
                      Pág Inicio
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={book.totalPages}
                      required
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider mb-1">
                      Pág Fin
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={book.totalPages}
                      required
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>

                  {hasParts && parts.length > 0 && (
                    <div className="col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] text-zinc-600 font-black uppercase tracking-wider">
                          Parte / Sección
                        </label>
                      </div>
                      <select
                        value={selectedPart}
                        onChange={(e) => {
                          const nextP = e.target.value;
                          setSelectedPart(nextP);
                          setBatchPart(nextP);
                          setNewChapterNumber(getSuggestedNumber(nextP, titleFormat, chapters, hasParts));
                        }}
                        className="w-full bg-white border border-zinc-300 rounded-xl px-2.5 py-2 text-xs text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      >
                        {parts.map((p) => (
                          <option key={p} value={p}>
                            {p} {selectedPart === p ? '•' : ''}
                          </option>
                        ))}
                        <option value="">(Sin asignar)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Live Preview */}
                {(newChapterNumber || newChapterName || startPage !== '' || endPage !== '') && (
                  <div className="p-2.5 bg-zinc-100 rounded-xl border border-zinc-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Vista previa:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <RomanChapterText
                        chapterNumber={newChapterNumber}
                        chapterName={newChapterName}
                        romanSize="text-[18px]"
                      />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-zinc-300 font-mono text-xs font-bold text-zinc-900 whitespace-nowrap shadow-2xs">
                        <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase tracking-wide">Páginas</span>
                        <span>{startPage || 1} – {endPage || startPage || 1}</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-mono whitespace-nowrap">
                        {Math.max(1, (Number(endPage) || 1) - (Number(startPage) || 1) + 1)} págs
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!newChapterNumber.trim() && !newChapterName.trim()}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Capítulo</span>
                </button>
              </form>
            )}
          </div>

          {/* Chapters List */}
          <div>
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <span className="font-extrabold text-zinc-900 uppercase tracking-wider text-[11px]">
                Lista de Capítulos ({chapters.length})
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-zinc-500 font-semibold">
                  {chapters.filter((c) => c.isRead).length} de {chapters.length} leídos
                </span>
                {chapters.some((c) => c.isRead) && (
                  <button
                    type="button"
                    onClick={handleUnmarkAll}
                    className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 transition-colors cursor-pointer"
                    title="Desmarcar todos los capítulos"
                  >
                    Desmarcar todos
                  </button>
                )}
                {chapters.some((c) => !c.isRead) && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 transition-colors cursor-pointer"
                    title="Marcar todos los capítulos como leídos"
                  >
                    Marcar todos
                  </button>
                )}
              </div>
            </div>

            {chapters.length === 0 ? (
              <div className="py-8 px-4 text-center text-zinc-400 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                <p className="text-xs font-medium">Aún no has registrado capítulos para este libro.</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Puedes agregar capítulos usando los campos independientes de número y nombre o el generador múltiple.
                </p>
              </div>
            ) : hasParts && parts.length > 0 ? (
              /* Grouped by Parts */
              <div className="space-y-4">
                {parts.map((partName) => {
                  const partChapters = chapters.filter((c) => c.part === partName);
                  const readInPart = partChapters.filter((c) => c.isRead).length;
                  const isPartComplete = partChapters.length > 0 && readInPart === partChapters.length;
                  const isSelected = selectedPart === partName;
                  const isEditingThisPart = editingPartName === partName;

                  const hasPartChapters = partChapters.length > 0;
                  const partStartPage = hasPartChapters ? Math.min(...partChapters.map((c) => c.startPage)) : 0;
                  const partEndPage = hasPartChapters ? Math.max(...partChapters.map((c) => c.endPage)) : 0;
                  const partTotalPages = hasPartChapters ? Math.max(0, partEndPage - partStartPage + 1) : 0;

                  return (
                    <div
                      key={partName}
                      className={`space-y-2 p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/70 shadow-2xs'
                          : 'bg-zinc-50/70 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
                        {isEditingThisPart ? (
                          <div className="flex items-center gap-1.5 flex-1 py-0.5">
                            <Bookmark className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                            <input
                              type="text"
                              value={partNameEditInput}
                              onChange={(e) => setPartNameEditInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditPart(partName, partNameEditInput);
                                } else if (e.key === 'Escape') {
                                  setEditingPartName(null);
                                }
                              }}
                              autoFocus
                              className="bg-white border-2 border-zinc-900 rounded-xl px-2.5 py-1 text-xs font-extrabold text-zinc-900 flex-1 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditPart(partName, partNameEditInput)}
                              className="p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-black cursor-pointer shrink-0"
                              title="Guardar nombre"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPartName(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200 cursor-pointer shrink-0"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <Bookmark className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-700' : 'text-zinc-900'}`} />
                            <span className="font-extrabold text-zinc-900 text-xs">{partName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPartName(partName);
                                setPartNameEditInput(partName);
                              }}
                              className="text-zinc-400 hover:text-zinc-900 p-0.5 rounded cursor-pointer"
                              title="Renombrar esta parte o sección"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            {hasPartChapters && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-mono shrink-0">
                                Págs {partStartPage}–{partEndPage} ({partTotalPages} págs)
                              </span>
                            )}
                            {isPartComplete && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                ✓ Completa
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                                Activa
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-zinc-500">
                            {readInPart} de {partChapters.length} leídos
                          </span>
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPart(partName);
                                setBatchPart(partName);
                                setNewChapterNumber(getSuggestedNumber(partName, titleFormat, chapters, hasParts));
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                              title={`Añadir próximos capítulos en ${partName}`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Añadir aquí</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {partChapters.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 italic px-1 py-1">Sin capítulos asignados a esta parte.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {partChapters.map((ch) => renderChapterRow(ch))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Chapters with no part assigned */}
                {chapters.some((c) => !c.part || !parts.includes(c.part)) && (
                  <div className="space-y-1.5 bg-zinc-50/70 p-2.5 rounded-2xl border border-dashed border-zinc-300">
                    <div className="flex items-center justify-between px-1">
                      <span className="font-extrabold text-zinc-600 text-xs">Sin Parte Asignada</span>
                    </div>
                    <div className="space-y-1.5">
                      {chapters
                        .filter((c) => !c.part || !parts.includes(c.part))
                        .map((ch) => renderChapterRow(ch))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Continuous list when no parts */
              <div className="space-y-1.5">
                {chapters.map((ch) => renderChapterRow(ch))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-200 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

