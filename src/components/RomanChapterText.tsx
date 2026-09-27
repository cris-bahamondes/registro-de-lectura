import React from 'react';
import { parseChapterComponents } from '../lib/romanUtils';

interface RomanChapterTextProps {
  title?: string;
  chapterNumber?: string;
  chapterName?: string;
  className?: string;
  romanSize?: string; // Default 'text-[18px]'
  text?: string; // For backwards compatibility
  showEmptyNamePlaceholder?: boolean;
  isRead?: boolean;
}

/**
 * Renders chapter titles ensuring numbers (Roman numerals like I, II, III, IV or numbers)
 * are displayed in Times New Roman, bold, at a specified size,
 * followed by ' - ' and the chapter name (if provided).
 * When read (isRead), titles are clearly struck through (tachados).
 *
 * Format:
 * [Número en Times New Roman negrita] - [Nombre del capítulo]
 */
export const RomanChapterText: React.FC<RomanChapterTextProps> = ({
  title,
  chapterNumber,
  chapterName,
  className = '',
  romanSize = 'text-[18px]',
  text,
  showEmptyNamePlaceholder = false,
  isRead = false,
}) => {
  const isStruck = isRead || className.includes('line-through');
  const { number, name } = parseChapterComponents(title || text, chapterNumber, chapterName);

  const struckStyle = isStruck ? 'line-through decoration-zinc-400 text-zinc-500' : '';

  // Both empty fallback
  if (!number && !name) {
    return <span className={`${className} ${struckStyle}`}>Capítulo</span>;
  }

  // Case 1: Has both number and name -> Format: Número - nombre
  if (number && name) {
    return (
      <span className={`inline-flex items-baseline gap-1.5 flex-wrap min-w-0 ${className} ${struckStyle}`}>
        <span
          className={`font-['Times_New_Roman',Times,serif] font-bold tracking-tight shrink-0 leading-none ${romanSize} ${struckStyle}`}
        >
          {number}
        </span>
        <span className={`text-zinc-500 font-bold shrink-0 text-sm select-none mx-0.5 ${isStruck ? 'line-through decoration-zinc-400' : ''}`}>-</span>
        <span className={`font-semibold text-xs sm:text-sm leading-snug break-words ${struckStyle}`}>{name}</span>
      </span>
    );
  }

  // Case 2: Only number (pure Roman or numeric)
  if (number && !name) {
    return (
      <span className={`inline-flex items-baseline gap-1.5 flex-wrap min-w-0 ${className} ${struckStyle}`}>
        <span
          className={`font-['Times_New_Roman',Times,serif] font-bold tracking-tight leading-none ${romanSize} ${struckStyle}`}
        >
          {number}
        </span>
        {showEmptyNamePlaceholder && (
          <>
            <span className={`text-zinc-400 font-bold shrink-0 text-sm select-none mx-0.5 ${isStruck ? 'line-through decoration-zinc-400' : ''}`}>-</span>
            <span className={`text-xs text-zinc-400 italic font-normal select-none ${struckStyle}`}>(Sin nombre)</span>
          </>
        )}
      </span>
    );
  }

  // Case 3: Only name (e.g. "Prólogo", "Epílogo")
  return (
    <span className={`font-semibold text-xs sm:text-sm leading-snug break-words ${className} ${struckStyle}`}>
      {name}
    </span>
  );
};

