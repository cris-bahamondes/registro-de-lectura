// Helper utilities for Roman numerals and chapter formatting
import { Chapter } from '../types';

export const toRoman = (num: number): string => {
  if (num <= 0) return String(num);
  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [val, letter] of romanMap) {
    while (n >= val) {
      result += letter;
      n -= val;
    }
  }
  return result;
};

export const fromRoman = (str: string): number | null => {
  const romanLookup: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  const upper = str.toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(upper)) return null;
  let total = 0;
  for (let i = 0; i < upper.length; i++) {
    const curr = romanLookup[upper[i]];
    const next = romanLookup[upper[i + 1]];
    if (next && curr < next) {
      total += next - curr;
      i++;
    } else {
      total += curr;
    }
  }
  return total > 0 ? total : null;
};

/**
 * Transforms titles like "Capítulo 1", "Capitulo 5", "Cap. 1", "Capítulo I", or "Capítulo 3: El Inicio"
 * into Roman numeral representations: "I", "V", "I", "III: El Inicio".
 */
export const formatChapterDisplayTitle = (title: string): string => {
  if (!title) return '';
  const trimmed = title.trim();

  // "Capítulo 1", "Capitulo 10", "Cap. 1", "Cap 1" -> "I" or "X"
  const pureCapNum = trimmed.match(/^Cap(?:[íi]tulo|\.)?\s+(\d+)$/i);
  if (pureCapNum) {
    const num = parseInt(pureCapNum[1], 10);
    return toRoman(num);
  }

  // "Capítulo IV", "Cap. IV", "Cap IV" -> "IV"
  const pureCapRoman = trimmed.match(/^Cap(?:[íi]tulo|\.)?\s+([IVXLCDM]+)$/i);
  if (pureCapRoman) {
    return pureCapRoman[1].toUpperCase();
  }

  // "Capítulo 1: Subtítulo" or "Cap. 2 - Subtítulo"
  const capNumWithSubtitle = trimmed.match(/^Cap(?:[íi]tulo|\.)?\s+(\d+)\s*([:\-–]\s*.*)$/i);
  if (capNumWithSubtitle) {
    const num = parseInt(capNumWithSubtitle[1], 10);
    return `${toRoman(num)}${capNumWithSubtitle[2]}`;
  }

  // "Capítulo IV: Subtítulo" or "Cap. IV - Subtítulo"
  const capRomanWithSubtitle = trimmed.match(/^Cap(?:[íi]tulo|\.)?\s+([IVXLCDM]+)\s*([:\-–]\s*.*)$/i);
  if (capRomanWithSubtitle) {
    return `${capRomanWithSubtitle[1].toUpperCase()}${capRomanWithSubtitle[2]}`;
  }

  return trimmed;
};

export interface ChapterComponents {
  number: string;
  name: string;
  isRoman: boolean;
  isNumeric: boolean;
}

/**
 * Parses chapter number and chapter name from separate fields or from a combined title.
 * Accurately parses cases like "VIII. Los mitos", "VII - Enfoques", "1. Inicio", "Capítulo 4: Final", "Prólogo", etc.
 */
export const parseChapterComponents = (
  title?: string,
  chapterNumber?: string,
  chapterName?: string
): ChapterComponents => {
  const explicitNum = (chapterNumber || '').trim();
  const explicitName = (chapterName || '').trim();

  if (explicitNum || explicitName) {
    const isRoman = fromRoman(explicitNum) !== null;
    const isNumeric = /^\d+$/.test(explicitNum);
    return {
      number: explicitNum,
      name: explicitName,
      isRoman,
      isNumeric,
    };
  }

  const rawTitle = (title || '').trim();
  if (!rawTitle) {
    return { number: '', name: '', isRoman: false, isNumeric: false };
  }

  // 1. Pure Roman numeral (e.g. "VII", "X", "IV")
  if (fromRoman(rawTitle) !== null) {
    return {
      number: rawTitle.toUpperCase(),
      name: '',
      isRoman: true,
      isNumeric: false,
    };
  }

  // 2. Pure number (e.g. "7", "12")
  if (/^\d+$/.test(rawTitle)) {
    return {
      number: rawTitle,
      name: '',
      isRoman: false,
      isNumeric: true,
    };
  }

  // 3. "Capítulo 1: Nombre", "Capítulo IV - Nombre", "Cap. 2. Nombre"
  const capWithSubtitle = rawTitle.match(/^Cap(?:[íi]tulo|\.)?\s*([IVXLCDM]+|\d+)(?:[\.\:\-–—•]\s*|\s+)(.*)$/i);
  if (capWithSubtitle) {
    const numPart = capWithSubtitle[1];
    const isRoman = fromRoman(numPart) !== null;
    return {
      number: isRoman ? numPart.toUpperCase() : numPart,
      name: capWithSubtitle[2]?.trim() || '',
      isRoman,
      isNumeric: /^\d+$/.test(numPart),
    };
  }

  // 4. "Capítulo 1", "Capítulo IV"
  const pureCap = rawTitle.match(/^Cap(?:[íi]tulo|\.)?\s*([IVXLCDM]+|\d+)$/i);
  if (pureCap) {
    const numPart = pureCap[1];
    const isRoman = fromRoman(numPart) !== null;
    return {
      number: isRoman ? numPart.toUpperCase() : numPart,
      name: '',
      isRoman,
      isNumeric: /^\d+$/.test(numPart),
    };
  }

  // 5. Roman numeral followed by dot, colon, dash, bullet, or space (e.g. "VIII. Los mitos", "VII - Enfoques", "IV: El Encuentro")
  const romanPrefixMatch = rawTitle.match(/^([IVXLCDM]+)(?:[\.\:\-–—•]\s*|\s+)(.*)$/i);
  if (romanPrefixMatch && fromRoman(romanPrefixMatch[1]) !== null) {
    return {
      number: romanPrefixMatch[1].toUpperCase(),
      name: romanPrefixMatch[2]?.trim() || '',
      isRoman: true,
      isNumeric: false,
    };
  }

  // 6. Regular number followed by dot, colon, dash, bullet, or space (e.g. "8. Los mitos", "7 - Enfoques", "1: Inicio")
  const numPrefixMatch = rawTitle.match(/^(\d+)(?:[\.\:\-–—•]\s*|\s+)(.*)$/);
  if (numPrefixMatch) {
    return {
      number: numPrefixMatch[1],
      name: numPrefixMatch[2]?.trim() || '',
      isRoman: false,
      isNumeric: true,
    };
  }

  // 7. Plain name without number (e.g. "Prólogo", "Epílogo", "Introducción")
  return {
    number: '',
    name: rawTitle,
    isRoman: false,
    isNumeric: false,
  };
};

/**
 * Combines separate chapter number and chapter name into a composite title string
 */
export const composeChapterTitle = (chapterNumber?: string, chapterName?: string): string => {
  const num = (chapterNumber || '').trim();
  const name = (chapterName || '').trim();

  if (num && name) {
    return `${num} - ${name}`;
  }
  if (num) return num;
  if (name) return name;
  return '';
};

/**
 * Sorts chapters by their startPage and endPage to maintain true book chronology
 */
export const sortChaptersByPage = (chapters: Chapter[]): Chapter[] => {
  if (!chapters || chapters.length <= 1) return chapters || [];
  const hasAnyPage = chapters.some(
    (c) => (c.startPage !== undefined && c.startPage > 0) || (c.endPage !== undefined && c.endPage > 0)
  );
  if (!hasAnyPage) return chapters;

  return [...chapters].sort((a, b) => {
    const aStart = a.startPage || a.endPage || 0;
    const bStart = b.startPage || b.endPage || 0;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.endPage || a.startPage || 0;
    const bEnd = b.endPage || b.startPage || 0;
    return aEnd - bEnd;
  });
};

export interface ChapterProgressResult {
  updatedChapters: Chapter[];
  newPage: number;
}

/**
 * Calculates cascading chapter read status so that:
 * - Marking a chapter marks strictly that chapter and all previous ones (by endPage <= chapter.endPage)
 * - All subsequent chapters (endPage > chapter.endPage) are set to false (PENDIENTE)
 * - Unmarking a chapter sets it and all subsequent chapters to false
 * - Reading page updates to match the progress
 */
export const toggleChapterProgress = (
  chapters: Chapter[],
  chapterId: string,
  bookCurrentPage: number,
  bookTotalPages: number
): ChapterProgressResult | null => {
  const sorted = sortChaptersByPage(chapters);
  const targetIdx = sorted.findIndex((c) => c.id === chapterId);
  if (targetIdx === -1) return null;

  const targetChapter = sorted[targetIdx];
  const isCurrentlyRead = targetChapter.isRead;
  const hasPages = sorted.some((c) => c.endPage > 0);

  let updatedChapters: Chapter[];
  let newPage = bookCurrentPage;

  if (hasPages && targetChapter.endPage > 0) {
    if (!isCurrentlyRead) {
      // User is marking targetChapter as READ:
      // Mark targetChapter AND ONLY PREVIOUS CHAPTERS (endPage <= targetChapter.endPage) as READ.
      // Any chapter with endPage > targetChapter.endPage is STRICTLY set to false (PENDIENTE).
      updatedChapters = sorted.map((ch) => ({
        ...ch,
        isRead: ch.endPage > 0 ? ch.endPage <= targetChapter.endPage : false,
      }));
      newPage = Math.min(bookTotalPages, targetChapter.endPage);
    } else {
      // User is unmarking targetChapter:
      // targetChapter and all subsequent chapters become PENDIENTE (false).
      // Any chapter that ends before targetChapter starts (or endPage < targetChapter.endPage) stays READ.
      const boundary = targetChapter.startPage > 0 ? targetChapter.startPage : targetChapter.endPage;
      updatedChapters = sorted.map((ch) => ({
        ...ch,
        isRead: ch.endPage > 0 ? ch.endPage < boundary : false,
      }));
      const remainingRead = updatedChapters.filter((c) => c.isRead && c.endPage > 0);
      if (remainingRead.length > 0) {
        newPage = Math.max(...remainingRead.map((c) => c.endPage));
      } else {
        newPage = Math.max(0, (targetChapter.startPage || 1) - 1);
      }
    }
  } else {
    // Index-based progression fallback if book chapters have no page numbers
    if (!isCurrentlyRead) {
      updatedChapters = sorted.map((ch, idx) => ({
        ...ch,
        isRead: idx <= targetIdx,
      }));
    } else {
      updatedChapters = sorted.map((ch, idx) => ({
        ...ch,
        isRead: idx < targetIdx,
      }));
    }
  }

  return { updatedChapters, newPage };
};

