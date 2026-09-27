import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { ensureHttps } from '../lib/bookCoverService';
import { coverStorage } from '../lib/coverStorage';

interface BookCoverImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  coverColor?: string;
  bookId?: string;
  badge?: React.ReactNode;
  aspectClassName?: string;
}

export const BookCoverImage: React.FC<BookCoverImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
  coverColor = '#e4e4e7',
  bookId,
  badge,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(() => ensureHttps(src));
  const [hasError, setHasError] = useState<boolean>(false);
  const [hasAttemptedFallback, setHasAttemptedFallback] = useState<boolean>(false);

  // If src changes, update currentSrc
  useEffect(() => {
    const cleaned = ensureHttps(src);
    setCurrentSrc(cleaned);
    setHasError(false);
    setHasAttemptedFallback(false);

    // If no src provided but we have a bookId, check IndexedDB cover storage
    if (!cleaned && bookId) {
      coverStorage.getCover(bookId).then((cached) => {
        if (cached) {
          setCurrentSrc(cached);
          setHasError(false);
        }
      });
    }
  }, [src, bookId]);

  if (currentSrc && !hasError) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={className}
          onError={() => {
            console.warn(`[BookCoverImage] Failed to load cover image: ${currentSrc}`);
            
            // 1. If we haven't tried alternate source yet:
            if (!hasAttemptedFallback) {
              setHasAttemptedFallback(true);

              // Check if cached in local IndexedDB
              if (bookId) {
                coverStorage.getCover(bookId).then((cached) => {
                  if (cached && cached !== currentSrc) {
                    setCurrentSrc(cached);
                    return;
                  }
                  tryAlternateUrl();
                });
              } else {
                tryAlternateUrl();
              }
            } else {
              setHasError(true);
            }

            function tryAlternateUrl() {
              if (!currentSrc) {
                setHasError(true);
                return;
              }
              // If Google Books URL with problematic params
              if (currentSrc.includes('books.google.com')) {
                // Try switching to standard secure zoom=1 without curl or source params
                let altGb = currentSrc.replace('&edge=curl', '');
                if (altGb.includes('&zoom=')) {
                  altGb = altGb.replace(/&zoom=[0-9]/, '&zoom=1');
                }
                // Also ensure https
                if (altGb.startsWith('http://')) {
                  altGb = 'https://' + altGb.slice(7);
                }
                if (altGb !== currentSrc) {
                  setCurrentSrc(altGb);
                  return;
                }
              }
              // If OpenLibrary -L.jpg failed, try -M.jpg
              if (currentSrc.includes('covers.openlibrary.org') && currentSrc.includes('-L.jpg')) {
                const medium = currentSrc.replace('-L.jpg', '-M.jpg');
                if (medium !== currentSrc) {
                  setCurrentSrc(medium);
                  return;
                }
              }
              // If OpenLibrary -M.jpg failed, try -S.jpg
              if (currentSrc.includes('covers.openlibrary.org') && currentSrc.includes('-M.jpg')) {
                const small = currentSrc.replace('-M.jpg', '-S.jpg');
                if (small !== currentSrc) {
                  setCurrentSrc(small);
                  return;
                }
              }
              setHasError(true);
            }
          }}
        />
        {badge}
      </div>
    );
  }

  // Fallback spine
  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center p-2 text-center select-none"
      style={{ backgroundColor: coverColor || '#e4e4e7' }}
    >
      <BookOpen className="w-6 h-6 text-zinc-700/80 mb-1 shrink-0" />
      <span className="text-[10px] font-bold text-zinc-900 line-clamp-3 leading-tight px-1">
        {fallbackTitle || alt}
      </span>
      {badge}
    </div>
  );
};
