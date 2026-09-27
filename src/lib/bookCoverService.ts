/**
 * Service to search and fetch book covers from Open Library and Google Books
 */

export interface CoverSearchResult {
  id: string;
  thumbnailUrl: string;
  largeUrl: string;
  title: string;
  author?: string;
  year?: number;
  source: 'openlibrary' | 'googlebooks';
}

/**
 * Ensures any image URL uses HTTPS to avoid mixed content blocking in secure contexts.
 * Handles protocol-relative URLs (//covers.openlibrary.org/...) and Google Books parameters.
 */
export function ensureHttps(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  if (trimmed.startsWith('http://')) {
    return 'https://' + trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Searches for book covers using Open Library API and Google Books API
 */
export async function searchBookCovers(title: string, author?: string): Promise<CoverSearchResult[]> {
  const cleanTitle = (title || '').trim();
  const cleanAuthor = (author || '').trim();

  if (!cleanTitle) return [];

  const results: CoverSearchResult[] = [];
  const seenUrls = new Set<string>();

  // 1. Try Open Library search
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('title', cleanTitle);
    if (cleanAuthor) {
      queryParams.set('author', cleanAuthor);
    }
    queryParams.set('limit', '15');

    const response = await fetch(`https://openlibrary.org/search.json?${queryParams.toString()}`);
    if (response.ok) {
      const data = await response.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];

      for (const doc of docs) {
        // Option A: Direct cover_i ID
        if (doc.cover_i) {
          const thumb = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
          const large = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          if (!seenUrls.has(thumb)) {
            seenUrls.add(thumb);
            results.push({
              id: `ol-id-${doc.cover_i}`,
              thumbnailUrl: thumb,
              largeUrl: large,
              title: doc.title || cleanTitle,
              author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : cleanAuthor,
              year: doc.first_publish_year,
              source: 'openlibrary',
            });
          }
        }

        // Option B: cover_edition_key (OLID)
        if (doc.cover_edition_key && (!doc.cover_i || results.length < 3)) {
          const thumb = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-M.jpg`;
          const large = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
          if (!seenUrls.has(thumb)) {
            seenUrls.add(thumb);
            results.push({
              id: `ol-olid-${doc.cover_edition_key}`,
              thumbnailUrl: thumb,
              largeUrl: large,
              title: doc.title || cleanTitle,
              author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : cleanAuthor,
              year: doc.first_publish_year,
              source: 'openlibrary',
            });
          }
        }

        // Option C: ISBN
        if (Array.isArray(doc.isbn) && doc.isbn.length > 0 && results.length < 5) {
          const isbn = doc.isbn[0];
          const thumb = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
          const large = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
          if (!seenUrls.has(thumb)) {
            seenUrls.add(thumb);
            results.push({
              id: `ol-isbn-${isbn}`,
              thumbnailUrl: thumb,
              largeUrl: large,
              title: doc.title || cleanTitle,
              author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : cleanAuthor,
              year: doc.first_publish_year,
              source: 'openlibrary',
            });
          }
        }

        if (results.length >= 12) break;
      }
    }
  } catch (err) {
    console.warn('[bookCoverService] Open Library search failed:', err);
  }

  // 2. Try Google Books API (works client-side in browser)
  try {
    const gQuery = cleanAuthor ? `intitle:${cleanTitle}+inauthor:${cleanAuthor}` : cleanTitle;
    const gResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gQuery)}&maxResults=8`);
    if (gResponse.ok) {
      const gData = await gResponse.json();
      const items = Array.isArray(gData?.items) ? gData.items : [];

      for (const item of items) {
        const volumeInfo = item.volumeInfo;
        const imageLinks = volumeInfo?.imageLinks;
        if (imageLinks) {
          const rawUrl = imageLinks.thumbnail || imageLinks.smallThumbnail;
          if (rawUrl) {
            const secureUrl = ensureHttps(rawUrl);
            // Replace zoom=1 with zoom=2 or zoom=3 for higher res if available
            const highRes = secureUrl.replace('&zoom=1', '&zoom=2').replace('&edge=curl', '');
            if (!seenUrls.has(secureUrl) && !seenUrls.has(highRes)) {
              seenUrls.add(secureUrl);
              results.push({
                id: `gb-${item.id}`,
                thumbnailUrl: secureUrl,
                largeUrl: highRes || secureUrl,
                title: volumeInfo.title || cleanTitle,
                author: Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(', ') : cleanAuthor,
                year: volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.slice(0, 4), 10) : undefined,
                source: 'googlebooks',
              });
            }
          }
        }
      }
    }
  } catch (err) {
    // Google books may be rate limited; ignore gracefully
  }

  return results;
}

/**
 * Optimizes an image URL by loading it into an in-memory canvas and returning a lightweight
 * compressed WebP / JPEG data URL (approx 15-25KB). If CORS blocks the canvas export,
 * returns the clean HTTPS URL.
 */
export async function optimizeCoverImage(imageUrl: string, maxWidth = 280, maxHeight = 380): Promise<string> {
  const secureUrl = ensureHttps(imageUrl);
  if (!secureUrl) return '';

  // If already a compact data URL, return it
  if (secureUrl.startsWith('data:') && secureUrl.length < 60000) {
    return secureUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate aspect ratio fit
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(secureUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        let dataUrl = canvas.toDataURL('image/webp', 0.82);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        }
        resolve(dataUrl);
      } catch {
        // Tainted canvas due to CORS: keep original HTTPS URL
        resolve(secureUrl);
      }
    };

    img.onerror = () => {
      // Return secure URL on error
      resolve(secureUrl);
    };

    img.src = secureUrl;
  });
}

export interface BookMetadataResult {
  title: string;
  author: string;
  totalPages?: number;
  category?: string;
  coverUrl?: string;
  year?: number;
  source: 'openlibrary' | 'googlebooks';
}

/**
 * Searches for book metadata using Open Library and Google Books
 */
export async function searchBookMetadata(query: string): Promise<BookMetadataResult[]> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  const results: BookMetadataResult[] = [];
  const seenTitles = new Set<string>();

  // 1. Search Open Library
  try {
    const qParams = new URLSearchParams();
    qParams.set('q', cleanQuery);
    qParams.set('limit', '8');

    const res = await fetch(`https://openlibrary.org/search.json?${qParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      for (const doc of docs) {
        if (!doc.title) continue;
        const normalized = `${doc.title.toLowerCase()}___${(doc.author_name?.[0] || '').toLowerCase()}`;
        if (!seenTitles.has(normalized)) {
          seenTitles.add(normalized);
          const coverUrl = doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : undefined;

          results.push({
            title: doc.title,
            author: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 2).join(', ') : 'Autor desconocido',
            totalPages: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : undefined,
            category: Array.isArray(doc.subject) && doc.subject[0] ? String(doc.subject[0]) : undefined,
            coverUrl,
            year: doc.first_publish_year,
            source: 'openlibrary',
          });
        }
      }
    }
  } catch (olErr) {
    console.warn('[searchBookMetadata] Open Library search error:', olErr);
  }

  // 2. Search Google Books
  try {
    const gbRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&maxResults=8`
    );
    if (gbRes.ok) {
      const gbData = await gbRes.json();
      const items = Array.isArray(gbData?.items) ? gbData.items : [];
      for (const item of items) {
        const info = item.volumeInfo;
        if (!info?.title) continue;
        const author = Array.isArray(info.authors) ? info.authors.slice(0, 2).join(', ') : 'Autor desconocido';
        const normalized = `${info.title.toLowerCase()}___${author.toLowerCase()}`;
        if (!seenTitles.has(normalized)) {
          seenTitles.add(normalized);
          const coverUrl = info.imageLinks?.thumbnail ? ensureHttps(info.imageLinks.thumbnail) : undefined;
          results.push({
            title: info.title,
            author,
            totalPages: typeof info.pageCount === 'number' ? info.pageCount : undefined,
            category: Array.isArray(info.categories) && info.categories[0] ? String(info.categories[0]) : undefined,
            coverUrl,
            year: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) : undefined,
            source: 'googlebooks',
          });
        }
      }
    }
  } catch (gbErr) {
    // Gracefully ignore rate limits
  }

  return results;
}
