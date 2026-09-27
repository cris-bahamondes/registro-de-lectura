/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book, BookStatus, TabType, UserProfile, Chapter, WishlistItem, MonthlyChallenge, AnnualChallenge, AnnualMonthChallenge } from './types';
import { INITIAL_BOOKS, INITIAL_USER, INITIAL_WISHLIST, INITIAL_CHALLENGES, INITIAL_ANNUAL_CHALLENGE, createAnnualChallengeForYear } from './data/initialData';
import { auth, db, onAuthStateChanged, getRedirectResult } from './lib/firebase';
import {
  subscribeToUserBooks,
  subscribeToUserWishlist,
  subscribeToUserChallenges,
  subscribeToUserProfile,
  saveBookToCloud,
  syncSingleBookReadingProgress,
  saveBooksBatchToCloud,
  deleteBookFromCloud,
  saveWishToCloud,
  saveWishlistBatchToCloud,
  deleteWishFromCloud,
  saveAnnualChallengeToCloud,
  saveChallengesToCloud,
  saveUserProfileToCloud,
  seedInitialDataIfEmpty,
  reconcileAndSyncAllData,
  hasAnnualChallengeContent,
  mergeAnnualChallenges,
  mergeBooks,
  mergeWishlists,
  collectAllLocalBooks,
  collectAllLocalAnnualChallenges,
  collectAllLocalWishlist,
  scanAndRecoverAllBooks,
  isChapterDerivedBook,
  filterRealBooksOnly,
  purgeChapterStandaloneBooks,
  recordLocalDeletedBook,
  clearLocalDeletedBook,
  deduplicateBooks,
} from './lib/syncService';
import { calculateBookActiveReadingDays } from './lib/readingDaysUtils';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { LeyendoView } from './components/LeyendoView';
import { BibliotecaView } from './components/BibliotecaView';
import { DeseosView } from './components/DeseosView';
import { DesafioView } from './components/DesafioView';
import { EstadisticasView } from './components/EstadisticasView';
import { AuthModal } from './components/AuthModal';
import { BookModal } from './components/BookModal';
import { DeseoModal } from './components/DeseoModal';
import { DesafioModal } from './components/DesafioModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { DeleteWishConfirmModal } from './components/DeleteWishConfirmModal';
import { FinishBookModal } from './components/FinishBookModal';
import { ChapterModal } from './components/ChapterModal';
import { ParallelBooksModal } from './components/ParallelBooksModal';
import { GoldenFireworks } from './components/GoldenFireworks';
import { BookDetailModal } from './components/BookDetailModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { AlertTriangle, User, LogIn } from 'lucide-react';
import { getBookGenres } from './lib/genreUtils';
import { sortChaptersByPage, toggleChapterProgress } from './lib/romanUtils';
import { safeStorage } from './lib/safeStorage';
import { coverStorage } from './lib/coverStorage';
import { chapterStorage } from './lib/chapterStorage';
import { bookStorage } from './lib/bookStorage';
import { BackupRestoreModal } from './components/BackupRestoreModal';

// Helpers to get isolated guest state with zero demo clutter
const getStoredGuestBooks = (): Book[] => {
  const saved = safeStorage.getItem('registro_lectura_guest_books_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (b: Book) =>
            !['book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6'].includes(b.id) &&
            !isChapterDerivedBook(b)
        );
      }
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

const getStoredGuestWishlist = (): WishlistItem[] => {
  const saved = safeStorage.getItem('registro_lectura_guest_wishlist_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((w: WishlistItem) => !['wish-1', 'wish-2', 'wish-3', 'wish-4'].includes(w.id));
      }
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

const getStoredGuestChallenges = (): MonthlyChallenge[] => {
  const saved = safeStorage.getItem('registro_lectura_guest_challenges_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

const getStoredGuestAnnualChallenges = (): Record<number, AnnualChallenge> => {
  const result: Record<number, AnnualChallenge> = {
    2026: createAnnualChallengeForYear(2026),
    2027: createAnnualChallengeForYear(2027),
  };

  // Load all annual challenges stored per year first
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('registro_lectura_guest_annual_challenge_year_')) {
          const yrStr = key.replace('registro_lectura_guest_annual_challenge_year_', '');
          const yr = parseInt(yrStr, 10);
          if (!isNaN(yr)) {
            const val = safeStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              if (parsed && Array.isArray(parsed.months)) {
                result[yr] = parsed;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Fallback to legacy key only if that year wasn't found
  const legacySaved = safeStorage.getItem('registro_lectura_guest_annual_challenge_v1');
  if (legacySaved) {
    try {
      const parsed = JSON.parse(legacySaved);
      if (parsed && Array.isArray(parsed.months)) {
        const yr = parsed.year || 2026;
        if (!safeStorage.getItem(`registro_lectura_guest_annual_challenge_year_${yr}`)) {
          result[yr] = parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  return result;
};

export default function App() {
  // Clean legacy shared storage keys, purge any rogue chapter books, and deeply scan all sources on app startup
  useEffect(() => {
    safeStorage.cleanLegacyKeys();
    purgeChapterStandaloneBooks(auth.currentUser?.uid).catch(() => {});
    // Deep scan across all IndexedDB stores, localStorage slots, and annuals to restore all books
    scanAndRecoverAllBooks([], auth.currentUser?.uid)
      .then((res) => {
        if (res && res.books.length > 0) {
          setBooks((prev) => {
            const { merged } = mergeBooks(prev, res.books);
            const valid = merged.filter((b) => !isChapterDerivedBook(b));
            const lolita = valid.find(
              (b) =>
                b.title.toLowerCase().trim() === 'lolita' ||
                (b.title.toLowerCase().includes('lolita') && b.author.toLowerCase().includes('nabokov'))
            );
            if (lolita && lolita.status !== 'leyendo') {
              lolita.status = 'leyendo';
            }
            if (lolita && !activeBookId) {
              setActiveBookId(lolita.id);
            }
            return valid;
          });
        }
      })
      .catch(() => {});
  }, []);

  // User Profile
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = safeStorage.getItem('registro_lectura_user_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_USER;
  });

  // Books List (Initialized with clean guest storage - 0 books by default)
  const [books, setBooks] = useState<Book[]>(() => {
    if (auth.currentUser) {
      const saved = safeStorage.getItem(`registro_lectura_account_books_${auth.currentUser.uid}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return filterRealBooksOnly(parsed);
          }
        } catch (e) {}
      }
      return [];
    }
    return filterRealBooksOnly(getStoredGuestBooks());
  });

  // Wishlist List
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
    if (auth.currentUser) {
      const saved = safeStorage.getItem(`registro_lectura_account_wishlist_${auth.currentUser.uid}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
      return [];
    }
    return getStoredGuestWishlist();
  });

  // Monthly Challenges List
  const [challenges, setChallenges] = useState<MonthlyChallenge[]>(() => {
    if (auth.currentUser) {
      const saved = safeStorage.getItem(`registro_lectura_account_challenges_${auth.currentUser.uid}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
      return [];
    }
    return getStoredGuestChallenges();
  });

  // 12-Month Annual Challenges Map (supports 2026, 2027, etc. with complete historical preservation)
  const [selectedChallengeYear, setSelectedChallengeYear] = useState<number>(() => {
    const calYear = new Date().getFullYear();
    return calYear >= 2026 ? calYear : 2026;
  });

  const [annualChallengesByYear, setAnnualChallengesByYear] = useState<Record<number, AnnualChallenge>>(() => {
    if (auth.currentUser) {
      const saved = safeStorage.getItem(`registro_lectura_account_annuals_${auth.currentUser.uid}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
      return { 2026: createAnnualChallengeForYear(2026), 2027: createAnnualChallengeForYear(2027) };
    }
    return getStoredGuestAnnualChallenges();
  });

  const availableYears = useMemo(() => {
    const set = new Set<number>([2026, 2027, selectedChallengeYear]);
    Object.keys(annualChallengesByYear).forEach((k) => {
      const n = parseInt(k, 10);
      if (!isNaN(n)) set.add(n);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [annualChallengesByYear, selectedChallengeYear]);

  const currentAnnualChallenge = useMemo(() => {
    return (
      annualChallengesByYear[selectedChallengeYear] ||
      createAnnualChallengeForYear(selectedChallengeYear)
    );
  }, [annualChallengesByYear, selectedChallengeYear]);

  // Currently focused active book ID (when multiple books are in 'leyendo' status)
  const [activeBookId, setActiveBookId] = useState<string | null>(() => {
    return localStorage.getItem('registro_lectura_active_book_id_v1') || null;
  });

  // Active Tab - Default to 'leyendo' on application start
  const [activeTab, setActiveTab] = useState<TabType>('leyendo');

  // Tracking refs for current state so background listeners & visibility sync always have latest memory
  const booksRef = useRef(books);
  booksRef.current = books;
  const wishlistRef = useRef(wishlist);
  wishlistRef.current = wishlist;
  const annualChallengesRef = useRef(annualChallengesByYear);
  annualChallengesRef.current = annualChallengesByYear;

  // Hydrate covers from IndexedDB if books in memory are missing cover images
  useEffect(() => {
    let isMounted = true;
    const missingCoverBooks = books.filter((b) => !b.coverImage);
    if (missingCoverBooks.length === 0) return;

    (async () => {
      try {
        const allCovers = await coverStorage.getAllCovers();
        if (!isMounted || !allCovers || Object.keys(allCovers).length === 0) return;

        let changed = false;
        const updated = [...booksRef.current];
        const restoredBooks: Book[] = [];

        for (let i = 0; i < updated.length; i++) {
          const b = updated[i];
          if (!b.coverImage && allCovers[b.id]) {
            updated[i] = { ...b, coverImage: allCovers[b.id] };
            restoredBooks.push(updated[i]);
            changed = true;
          }
        }

        if (changed && isMounted) {
          setBooks(updated);
          // Sync restored covers to Firestore so mobile and PC stay perfectly in sync
          if (auth.currentUser && restoredBooks.length > 0) {
            saveBooksBatchToCloud(auth.currentUser.uid, restoredBooks);
          }
        }
      } catch (e) {
        console.warn('[App] Error hydrating covers:', e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [books.length]);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isParallelModalOpen, setIsParallelModalOpen] = useState(false);
  const [isWishModalOpen, setIsWishModalOpen] = useState(false);
  const [isDesafioModalOpen, setIsDesafioModalOpen] = useState(false);
  const [selectedMonthForModal, setSelectedMonthForModal] = useState<AnnualMonthChallenge | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editingWish, setEditingWish] = useState<WishlistItem | null>(null);
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [deletingWish, setDeletingWish] = useState<WishlistItem | null>(null);
  const [finishingBook, setFinishingBook] = useState<Book | null>(null);
  const [managingChaptersBook, setManagingChaptersBook] = useState<Book | null>(null);
  const [viewingDetailBook, setViewingDetailBook] = useState<Book | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationBookTitle, setCelebrationBookTitle] = useState<string>('');
  const [duplicateWishWarning, setDuplicateWishWarning] = useState<{
    wish: WishlistItem;
    existingBook: Book;
    startReadingNow: boolean;
  } | null>(null);
  const [isInstallBannerOpen, setIsInstallBannerOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      const dismissed = safeStorage.getItem('registro_lectura_pwa_banner_dismissed_v2');
      return !isStandalone && !dismissed;
    }
    return false;
  });

  // Multi-device Cloud Synchronization state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Persistence - Separate Guest vs Account storage
  useEffect(() => {
    safeStorage.setJson('registro_lectura_user_v1', user);
  }, [user]);

  useEffect(() => {
    if (auth.currentUser) {
      safeStorage.setJson(`registro_lectura_account_books_${auth.currentUser.uid}`, books);
    } else {
      safeStorage.setJson('registro_lectura_guest_books_v1', books);
    }
  }, [books]);

  useEffect(() => {
    if (auth.currentUser) {
      safeStorage.setJson(`registro_lectura_account_wishlist_${auth.currentUser.uid}`, wishlist);
    } else {
      safeStorage.setJson('registro_lectura_guest_wishlist_v1', wishlist);
    }
  }, [wishlist]);

  useEffect(() => {
    if (auth.currentUser) {
      safeStorage.setJson(`registro_lectura_account_challenges_${auth.currentUser.uid}`, challenges);
    } else {
      safeStorage.setJson('registro_lectura_guest_challenges_v1', challenges);
    }
  }, [challenges]);

  useEffect(() => {
    if (auth.currentUser) {
      safeStorage.setJson(
        `registro_lectura_account_annuals_${auth.currentUser.uid}`,
        annualChallengesByYear
      );
    } else {
      Object.entries(annualChallengesByYear).forEach(([yr, ch]) => {
        safeStorage.setJson(
          `registro_lectura_guest_annual_challenge_year_${yr}`,
          ch
        );
      });
    }
  }, [annualChallengesByYear]);

  useEffect(() => {
    if (activeBookId) {
      safeStorage.setItem('registro_lectura_active_book_id_v1', activeBookId);
    }
  }, [activeBookId]);

  // Explicit manual sync triggered ONLY when user presses the "Sincronizar" button in the Header
  const handleManualSync = async () => {
    if (!auth.currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsSyncing(true);
    setSyncFeedback('Sincronizando avances y cambios de estado con la nube...');
    try {
      const scanRes = await scanAndRecoverAllBooks(booksRef.current, auth.currentUser?.uid);
      let workingBooks = scanRes.books.length >= booksRef.current.length ? scanRes.books : booksRef.current;

      const result = await reconcileAndSyncAllData(
        auth.currentUser.uid,
        workingBooks,
        wishlistRef.current,
        annualChallengesRef.current
      );

      if (result.books && result.books.length > 0) {
        workingBooks = result.books;
      }
      setWishlist(result.wishlist);
      setAnnualChallengesByYear(result.annualChallengesByYear);
      setChallenges(result.challenges);

      setBooks(workingBooks);
      await bookStorage.saveBooksBatch(workingBooks);
      setLastSyncTime(new Date());

      setSyncFeedback('✓ Sincronización manual: Avances y estados de libros actualizados.');
    } catch (err: any) {
      console.warn('[Sync] Note during manual sync:', err);
      setSyncFeedback('✓ Datos resguardados localmente en tu dispositivo.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 3500);
    }
  };

  // Real-time synchronization with Firebase Firestore & Guest switching
  useEffect(() => {
    // Process redirect result if redirected back from Google sign-in on mobile
    getRedirectResult(auth).catch(() => {});

    let unsubBooks: (() => void) | undefined;
    let unsubWishlist: (() => void) | undefined;
    let unsubChallenges: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Unsubscribe previous listeners
      if (unsubBooks) unsubBooks();
      if (unsubWishlist) unsubWishlist();
      if (unsubChallenges) unsubChallenges();
      if (unsubProfile) unsubProfile();

      if (firebaseUser) {
        const loggedUser: UserProfile = {
          name: firebaseUser.displayName || 'Lector Google',
          email: firebaseUser.email || 'usuario@google.com',
          avatar: firebaseUser.photoURL || '',
          isGuest: false,
        };
        setUser(loggedUser);

        // Purge any rogue chapter books from cloud & local storage
        purgeChapterStandaloneBooks(firebaseUser.uid).catch(() => {});

        // 1. Instant local display from Deep Scan + IndexedDB Master Storage
        const scanRes = await scanAndRecoverAllBooks([], firebaseUser.uid).catch(() => null);
        const [localWishFound, localAnnualsFound] = await Promise.all([
          Promise.resolve(collectAllLocalWishlist(firebaseUser.uid)),
          Promise.resolve(collectAllLocalAnnualChallenges(firebaseUser.uid)),
        ]);

        if (scanRes && scanRes.books.length > 0) {
          const cleanBooks = filterRealBooksOnly(scanRes.books);
          setBooks(cleanBooks);
          const lolita = cleanBooks.find(
            (b) => b.title.toLowerCase().trim() === 'lolita' && b.author.toLowerCase().includes('nabokov')
          );
          if (lolita && !activeBookId) {
            setActiveBookId(lolita.id);
          }
        }

        const accountCachedWishlist = safeStorage.getItem(`registro_lectura_account_wishlist_${firebaseUser.uid}`);
        if (accountCachedWishlist) {
          try {
            setWishlist(JSON.parse(accountCachedWishlist));
          } catch {
            setWishlist(localWishFound);
          }
        } else if (localWishFound.length > 0) {
          setWishlist(localWishFound);
        }

        const accountCachedChallenges = safeStorage.getItem(`registro_lectura_account_challenges_${firebaseUser.uid}`);
        if (accountCachedChallenges) {
          try {
            setChallenges(JSON.parse(accountCachedChallenges));
          } catch {
            setChallenges([]);
          }
        }

        const accountCachedAnnuals = safeStorage.getItem(`registro_lectura_account_annuals_${firebaseUser.uid}`);
        if (accountCachedAnnuals) {
          try {
            setAnnualChallengesByYear(JSON.parse(accountCachedAnnuals));
          } catch {
            setAnnualChallengesByYear(localAnnualsFound);
          }
        } else if (Object.keys(localAnnualsFound).length > 0) {
          setAnnualChallengesByYear(localAnnualsFound);
        }

        // 2. Perform Master Bidirectional Two-Way Synchronization immediately!
        const localBooksToSync = scanRes && scanRes.books.length > 0 ? scanRes.books : undefined;
        const localWishToSync = localWishFound.length > 0 ? localWishFound : undefined;
        const localAnnualsToSync = Object.keys(localAnnualsFound).length > 0 ? localAnnualsFound : undefined;

        setIsSyncing(true);
        reconcileAndSyncAllData(firebaseUser.uid, localBooksToSync, localWishToSync, localAnnualsToSync)
          .then((reconciled) => {
            if (reconciled.books.length > 0) {
              setBooks(reconciled.books);
            }
            setWishlist(reconciled.wishlist);
            setAnnualChallengesByYear(reconciled.annualChallengesByYear);
            setChallenges(reconciled.challenges);
            setLastSyncTime(new Date());
            if (reconciled.books.length > 0) {
              setSyncFeedback(`¡Sincronizado! ${reconciled.books.length} libros listos.`);
              setTimeout(() => setSyncFeedback(null), 3000);
            } else {
              setSyncFeedback(null);
            }
          })
          .catch((err) => {
            console.warn('[Sync] Initial reconciliation note:', err);
            setSyncFeedback(null);
          })
          .finally(() => {
            setIsSyncing(false);
          });

        // 3. Real-time listener for books for this specific account (merges non-destructively)
        unsubBooks = subscribeToUserBooks(firebaseUser.uid, (cloudBooks) => {
          if (!cloudBooks || cloudBooks.length === 0) return;

          setBooks((prev) => {
            const { merged } = mergeBooks(prev || [], cloudBooks);
            const valid = merged.filter((b) => !isChapterDerivedBook(b));
            bookStorage.saveBooksBatch(valid).catch(() => {});

            // Auto select active reading book if currently active book has changed or is unset
            const leyendoBooks = valid.filter((b) => b.status === 'leyendo');
            if (leyendoBooks.length > 0) {
              const currentActiveStillReading = leyendoBooks.some((b) => b.id === activeBookId);
              if (!currentActiveStillReading) {
                // Find latest updated 'leyendo' book
                const latestLeyendo = [...leyendoBooks].sort((a, b) => {
                  const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                  const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                  return tB - tA;
                })[0];
                if (latestLeyendo) {
                  setActiveBookId(latestLeyendo.id);
                }
              }
            }

            // Keep open modal state in sync when changes arrive from another device
            setViewingDetailBook((prevDetail) => {
              if (!prevDetail) return null;
              const updated = valid.find((b) => b.id === prevDetail.id);
              return updated || prevDetail;
            });
            setManagingChaptersBook((prevChap) => {
              if (!prevChap) return null;
              const updated = valid.find((b) => b.id === prevChap.id);
              return updated || prevChap;
            });
            setFinishingBook((prevFinish) => {
              if (!prevFinish) return null;
              const updated = valid.find((b) => b.id === prevFinish.id);
              return updated || prevFinish;
            });

            return valid;
          });
        });

        // 4. Real-time listener for user profile updates across devices
        unsubProfile = subscribeToUserProfile(firebaseUser.uid, (cloudProfile) => {
          if (!cloudProfile) return;
          setUser((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...cloudProfile,
              name: cloudProfile.name || prev.name,
              annualTargetGoal: cloudProfile.annualTargetGoal ?? prev.annualTargetGoal,
              readingGoal: cloudProfile.readingGoal ?? prev.readingGoal,
            };
          });
        });

        // 5. Real-time listener for wishlist for this specific account
        unsubWishlist = subscribeToUserWishlist(firebaseUser.uid, (cloudWishlist) => {
          if (!cloudWishlist) return;
          if (cloudWishlist.length > 0) {
            setWishlist(cloudWishlist);
          } else {
            setWishlist((prev) => {
              if (prev && prev.length > 0) return prev;
              const localWish = collectAllLocalWishlist(firebaseUser.uid);
              return localWish.length > 0 ? localWish : prev;
            });
          }
        });

        // 5. Real-time listener for challenges for this specific account
        unsubChallenges = subscribeToUserChallenges(firebaseUser.uid, (data) => {
          setChallenges(data.challenges || []);
          if (data.annualChallengesByYear && Object.keys(data.annualChallengesByYear).length > 0) {
            setAnnualChallengesByYear((prev) => {
              const merged = { ...prev };
              Object.entries(data.annualChallengesByYear!).forEach(([yrKey, cloudAnn]) => {
                const yr = Number(yrKey);
                const localAnn = prev[yr];
                if (!localAnn) {
                  merged[yr] = cloudAnn;
                } else {
                  const cloudHas = hasAnnualChallengeContent(cloudAnn);
                  const localHas = hasAnnualChallengeContent(localAnn);

                  if (cloudHas && !localHas) {
                    // Cloud has user entries, local was default/blank -> adopt cloud!
                    merged[yr] = cloudAnn;
                  } else if (localHas && !cloudHas) {
                    // Local has user entries, cloud is blank -> keep local and upload!
                    merged[yr] = localAnn;
                    saveAnnualChallengeToCloud(firebaseUser.uid, localAnn);
                  } else if (localHas && cloudHas) {
                    // Both have entries -> merge them without losing books or categories!
                    merged[yr] = mergeAnnualChallenges(localAnn, cloudAnn);
                  } else {
                    merged[yr] = cloudAnn;
                  }
                }
              });
              safeStorage.setJson(`registro_lectura_account_annuals_${firebaseUser.uid}`, merged);
              return merged;
            });
          } else if (data.annualChallenge) {
            setAnnualChallengesByYear((prev) => {
              const yr = data.annualChallenge!.year || 2026;
              const localAnn = prev[yr];
              if (!localAnn) {
                return { ...prev, [yr]: data.annualChallenge! };
              }
              const cloudHas = hasAnnualChallengeContent(data.annualChallenge);
              const localHas = hasAnnualChallengeContent(localAnn);
              if (cloudHas && !localHas) {
                return { ...prev, [yr]: data.annualChallenge! };
              }
              if (localHas && cloudHas) {
                return { ...prev, [yr]: mergeAnnualChallenges(localAnn, data.annualChallenge!) };
              }
              return { ...prev, [yr]: data.annualChallenge! };
            });
          }
        });
      } else {
        // When in guest mode or on logout: Load guest storage without demo books
        setUser(INITIAL_USER);
        setBooks(getStoredGuestBooks());
        setWishlist(getStoredGuestWishlist());
        setChallenges(getStoredGuestChallenges());
        setAnnualChallengesByYear(getStoredGuestAnnualChallenges());
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubBooks) unsubBooks();
      if (unsubWishlist) unsubWishlist();
      if (unsubChallenges) unsubChallenges();
    };
  }, []);

  // Derived state: All books currently being read in parallel
  const parallelBooks = books.filter((b) => b.status === 'leyendo');
  const activeBook =
    books.find((b) => b.id === activeBookId && b.status === 'leyendo') ||
    parallelBooks[0] ||
    null;
  const pendingBooks = books.filter((b) => b.status === 'pendiente');

  // Automatically select the active reading book when books are loaded or changed
  useEffect(() => {
    if (parallelBooks.length > 0) {
      const activeExists = parallelBooks.some((b) => b.id === activeBookId);
      if (!activeExists) {
        setActiveBookId(parallelBooks[0].id);
      }
    }
  }, [parallelBooks, activeBookId]);

  // Existing unique sagas
  const existingSagas = useMemo(() => {
    const sagas = new Set<string>();
    books.forEach((b) => {
      if (b.saga && b.saga.trim()) sagas.add(b.saga.trim());
    });
    return Array.from(sagas);
  }, [books]);

  // Existing unique genres
  const existingGenres = useMemo(() => {
    const genres = new Set<string>();
    books.forEach((b) => {
      getBookGenres(b).forEach((g) => genres.add(g));
    });
    return Array.from(genres);
  }, [books]);

  // Synchronize reading progress of ONLY the active book being read
  const handleSyncActiveBookProgress = async (book: Book) => {
    setSyncFeedback('Sincronizando avance con Firebase...');
    try {
      if (auth.currentUser) {
        const res = await syncSingleBookReadingProgress(auth.currentUser.uid, book);
        // Update local books state with the reconciled book
        setBooks((prev) => {
          const list = prev.filter((b) => b.id !== book.id && b.id !== res.book.id);
          return [res.book, ...list];
        });
        if (activeBookId === book.id && res.book.id !== book.id) {
          setActiveBookId(res.book.id);
        }
        if (viewingDetailBook && (viewingDetailBook.id === book.id || viewingDetailBook.id === res.book.id)) {
          setViewingDetailBook(res.book);
        }
        if (managingChaptersBook && (managingChaptersBook.id === book.id || managingChaptersBook.id === res.book.id)) {
          setManagingChaptersBook(res.book);
        }
        setSyncFeedback(res.message);
        setTimeout(() => setSyncFeedback(null), 3500);
      } else {
        await bookStorage.saveBook(book);
        setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
        const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
        setSyncFeedback(`✓ Avance guardado: Pág. ${book.currentPage} de ${book.totalPages} (${pct}%)`);
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err: any) {
      console.warn('[Sync] Single book sync note:', err);
      await bookStorage.saveBook(book).catch(() => {});
      setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
      setSyncFeedback('✓ Avance guardado');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const handleSaveBookInLeyendoView = handleSyncActiveBookProgress;
  const handleSelectActiveBook = (bookId: string) => {
    const now = new Date().toISOString().split('T')[0];
    const target = books.find((b) => b.id === bookId);
    if (!target) return;
    const sDate = target.startDate || now;
    const updatedBook: Book = {
      ...target,
      status: 'leyendo',
      startDate: sDate,
      readingDays: calculateBookActiveReadingDays({
        ...target,
        status: 'leyendo',
        startDate: sDate,
      }),
      updatedAt: new Date().toISOString(),
    };
    setBooks((prev) => prev.map((b) => (b.id === bookId ? updatedBook : b)));
    bookStorage.saveBook(updatedBook).catch(() => {});
    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, updatedBook);
    }
    setActiveBookId(bookId);
    setActiveTab('leyendo');
  };

  // Update current page
  const handleUpdatePage = (bookId: string, newPage: number) => {
    const target = books.find((b) => b.id === bookId);
    if (!target) return;
    const clamped = Math.max(0, Math.min(target.totalPages, newPage));
    const hasChapters = (target.chapters || []).length > 0;
    const sorted = sortChaptersByPage(target.chapters || []);
    const updatedChapters = hasChapters
      ? sorted.map((ch) => ({
          ...ch,
          isRead: ch.endPage > 0 ? ch.endPage <= clamped : false,
        }))
      : target.chapters;

    const updatedBook: Book = {
      ...target,
      currentPage: clamped,
      chapters: updatedChapters,
      updatedAt: new Date().toISOString(),
    };

    setBooks((prev) => prev.map((b) => (b.id === bookId ? updatedBook : b)));
    bookStorage.saveBook(updatedBook).catch(() => {});
    if (viewingDetailBook && viewingDetailBook.id === bookId) {
      setViewingDetailBook(updatedBook);
    }
    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, updatedBook);
    }
  };

  // Toggle chapter read status
  const handleToggleChapterRead = (bookId: string, chapterId: string) => {
    const target = books.find((b) => b.id === bookId);
    if (!target) return;
    const result = toggleChapterProgress(
      target.chapters || [],
      chapterId,
      target.currentPage,
      target.totalPages
    );
    if (!result) return;

    const updatedBook: Book = {
      ...target,
      currentPage: result.newPage,
      chapters: result.updatedChapters,
      updatedAt: new Date().toISOString(),
    };

    chapterStorage.saveChapters(bookId, result.updatedChapters, target.hasParts, target.parts);

    setBooks((prev) => prev.map((b) => (b.id === bookId ? updatedBook : b)));
    if (viewingDetailBook && viewingDetailBook.id === bookId) {
      setViewingDetailBook(updatedBook);
    }
    if (managingChaptersBook && managingChaptersBook.id === bookId) {
      setManagingChaptersBook(updatedBook);
    }
    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, updatedBook);
    }
  };

  // Unmark all chapters of a book (resets accidental read marks)
  const handleUnmarkAllChapters = (bookId: string) => {
    const target = books.find((b) => b.id === bookId);
    if (!target) return;
    const sorted = sortChaptersByPage(target.chapters || []);
    const updatedChapters = sorted.map((ch) => ({ ...ch, isRead: false }));
    const updatedBook: Book = {
      ...target,
      chapters: updatedChapters,
      updatedAt: new Date().toISOString(),
    };

    chapterStorage.saveChapters(bookId, updatedChapters, target.hasParts, target.parts);

    setBooks((prev) => prev.map((b) => (b.id === bookId ? updatedBook : b)));
    if (viewingDetailBook && viewingDetailBook.id === bookId) {
      setViewingDetailBook(updatedBook);
    }
    if (managingChaptersBook && managingChaptersBook.id === bookId) {
      setManagingChaptersBook(updatedBook);
    }
    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, updatedBook);
    }
  };

  // Update all chapters of a book
  const handleUpdateBook = (updatedBook: Book) => {
    setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
    bookStorage.saveBook(updatedBook).catch(() => {});
    if (viewingDetailBook && viewingDetailBook.id === updatedBook.id) {
      setViewingDetailBook(updatedBook);
    }
    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, updatedBook);
    }
  };

  const handleUpdateChapters = (
    bookId: string,
    chapters: Chapter[],
    hasParts?: boolean,
    parts?: string[],
    newPage?: number
  ) => {
    const sorted = sortChaptersByPage(chapters);
    const target = books.find((b) => b.id === bookId);

    const targetHasParts = hasParts !== undefined ? hasParts : (target?.hasParts || false);
    const targetParts = parts !== undefined ? parts : (target?.parts || []);

    // 1. Instantly guarantee durable IndexedDB persistence for all chapters
    chapterStorage.saveChapters(bookId, sorted, targetHasParts, targetParts);

    const now = new Date().toISOString();
    let updatedBook: Book | null = null;

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== bookId) return b;
        const finalPage =
          newPage !== undefined
            ? Math.min(b.totalPages, Math.max(0, newPage))
            : b.currentPage;
        updatedBook = {
          ...b,
          currentPage: finalPage,
          chapters: sorted,
          hasParts: targetHasParts,
          parts: targetParts,
          updatedAt: now,
        };
        return updatedBook;
      })
    );

    const bookToSave: Book | null = target
      ? {
          ...target,
          currentPage:
            newPage !== undefined
              ? Math.min(target.totalPages, Math.max(0, newPage))
              : target.currentPage,
          chapters: sorted,
          hasParts: targetHasParts,
          parts: targetParts,
          updatedAt: now,
        }
      : updatedBook;

    if (bookToSave) {
      if (viewingDetailBook && viewingDetailBook.id === bookId) {
        setViewingDetailBook(bookToSave);
      }
      if (managingChaptersBook && managingChaptersBook.id === bookId) {
        setManagingChaptersBook(bookToSave);
      }
      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, bookToSave);
      }
    }
  };

  // Finish book handler
  const handleConfirmFinish = (rating: number, nextBookId?: string) => {
    if (!finishingBook) return;

    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    const finishStartDate = finishingBook.startDate || today;
    const computedReadingDays = calculateBookActiveReadingDays({
      ...finishingBook,
      status: 'leido',
      startDate: finishStartDate,
      endDate: today,
    });

    const finishedBook: Book = {
      ...finishingBook,
      status: 'leido' as BookStatus,
      currentPage: finishingBook.totalPages,
      rating: rating > 0 ? rating : finishingBook.rating || 5,
      startDate: finishStartDate,
      endDate: today,
      readYear: currentYear,
      readingDays: computedReadingDays,
      chapters: (finishingBook.chapters || []).map((c) => ({ ...c, isRead: true })),
      updatedAt: new Date().toISOString(),
    };

    setBooks((prev) => {
      let updated = prev.map((b) => (b.id === finishingBook.id ? finishedBook : b));

      if (nextBookId) {
        updated = updated.map((b) => {
          if (b.id === nextBookId) {
            const nextBook: Book = {
              ...b,
              status: 'leyendo' as BookStatus,
              startDate: b.startDate || today,
              updatedAt: new Date().toISOString(),
            };
            if (auth.currentUser) {
              saveBookToCloud(auth.currentUser.uid, nextBook);
            }
            return nextBook;
          }
          return b;
        });
      }

      return updated;
    });

    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, finishedBook);
    }

    setFinishingBook(null);
    setCelebrationBookTitle(finishingBook.title);
    setShowCelebration(true);
    if (!nextBookId) {
      setActiveTab('estadisticas');
    }
  };

  // Abandon book handler
  const handleAbandonBook = (book: Book) => {
    const today = new Date().toISOString().split('T')[0];
    const abandonedBook: Book = {
      ...book,
      status: 'abandonado',
      endDate: today,
      updatedAt: new Date().toISOString(),
    };
    setBooks((prev) => prev.map((b) => (b.id === book.id ? abandonedBook : b)));
    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, abandonedBook);
    }
  };

  // Save (Create or Edit) Book
  const handleSaveBook = (bookData: Partial<Book>) => {
    const now = new Date().toISOString();

    if (editingBook) {
      const updatedBook: Book = {
        ...editingBook,
        ...bookData,
        description:
          bookData.description !== undefined
            ? (bookData.description || '').slice(0, 500)
            : editingBook.description || '',
        saga: bookData.saga,
        sagaOrder: bookData.saga ? bookData.sagaOrder : undefined,
        startDate: bookData.startDate ? bookData.startDate.trim() : undefined,
        endDate: bookData.endDate ? bookData.endDate.trim() : undefined,
        readingDays:
          !bookData.startDate && bookData.status !== 'leyendo'
            ? 0
            : calculateBookActiveReadingDays({
                ...editingBook,
                ...bookData,
                readingDays: bookData.readingDays ?? editingBook.readingDays,
              } as Book),
        updatedAt: now,
      } as Book;

      if (!bookData.startDate) {
        delete updatedBook.startDate;
      }
      if (!bookData.endDate) {
        delete updatedBook.endDate;
      }

      if (bookData.coverImage) {
        coverStorage.saveCover(updatedBook.id, bookData.coverImage);
      }

      setBooks((prev) =>
        prev.map((b) => {
          if (b.id === editingBook.id) return updatedBook;
          if (bookData.status === 'leyendo' && b.status === 'leyendo' && b.id !== editingBook.id) {
            const demoted = { ...b, status: 'pendiente' as BookStatus, updatedAt: now };
            if (auth.currentUser) saveBookToCloud(auth.currentUser.uid, demoted);
            return demoted;
          }
          return b;
        })
      );

      if (viewingDetailBook && viewingDetailBook.id === editingBook.id) {
        setViewingDetailBook(updatedBook);
      }

      if (updatedBook.chapters && updatedBook.chapters.length > 0) {
        chapterStorage.saveChapters(updatedBook.id, updatedBook.chapters, updatedBook.hasParts, updatedBook.parts);
      }

      clearLocalDeletedBook(updatedBook.id, updatedBook.title, updatedBook.author);
      bookStorage.saveBook(updatedBook).catch(() => {});

      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, updatedBook);
      }
    } else {
      const newBook: Book = {
        id: `book-${Date.now()}`,
        title: bookData.title || 'Sin título',
        author: bookData.author || 'Autor desconocido',
        coverImage: bookData.coverImage,
        coverColor: bookData.coverColor || '#e1bee7',
        totalPages: bookData.totalPages || 100,
        currentPage: bookData.currentPage || 0,
        format: bookData.format || 'fisico',
        category: bookData.category || (bookData.genres && bookData.genres[0]) || 'Ficción histórica',
        genres: bookData.genres || (bookData.category ? [bookData.category] : ['Novela']),
        description: (bookData.description || '').slice(0, 500),
        saga: bookData.saga,
        sagaOrder: bookData.saga ? bookData.sagaOrder : undefined,
        rating: bookData.rating || 0,
        status: bookData.status || 'pendiente',
        startDate: bookData.startDate ? bookData.startDate.trim() : undefined,
        endDate: bookData.endDate ? bookData.endDate.trim() : undefined,
        readYear: bookData.readYear || new Date().getFullYear(),
        readingDays: calculateBookActiveReadingDays({
          status: bookData.status || 'pendiente',
          startDate: bookData.startDate ? bookData.startDate.trim() : undefined,
          endDate: bookData.endDate ? bookData.endDate.trim() : undefined,
        } as Book),
        chapters: bookData.chapters || [],
        createdAt: now,
        updatedAt: now,
      };

      if (!newBook.startDate) {
        delete newBook.startDate;
      }
      if (!newBook.endDate) {
        delete newBook.endDate;
      }

      if (newBook.coverImage) {
        coverStorage.saveCover(newBook.id, newBook.coverImage);
      }

      if (newBook.chapters && newBook.chapters.length > 0) {
        chapterStorage.saveChapters(newBook.id, newBook.chapters, newBook.hasParts, newBook.parts);
      }

      clearLocalDeletedBook(newBook.id, newBook.title, newBook.author);
      bookStorage.saveBook(newBook).catch(() => {});

      setBooks((prev) => [...prev, newBook]);

      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, newBook);
      }

      if (newBook.status === 'leyendo') {
        setActiveBookId(newBook.id);
        setActiveTab('leyendo');
      }
    }

    if (bookData.status === 'leido' && (!editingBook || editingBook.status !== 'leido')) {
      setCelebrationBookTitle(bookData.title || editingBook?.title || '¡Libro Terminado!');
      setShowCelebration(true);
    }

    setEditingBook(null);
  };

  // Direct cover updater for fast online search or cover edits
  const handleUpdateBookCover = (bookId: string, coverUrl: string) => {
    const now = new Date().toISOString();
    coverStorage.saveCover(bookId, coverUrl);
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const updated = { ...b, coverImage: coverUrl, updatedAt: now };
          if (auth.currentUser) {
            saveBookToCloud(auth.currentUser.uid, updated);
          }
          return updated;
        }
        return b;
      })
    );
    if (viewingDetailBook && viewingDetailBook.id === bookId) {
      setViewingDetailBook((prev) => (prev ? { ...prev, coverImage: coverUrl, updatedAt: now } : null));
    }
  };

  // Update Start Date of any book
  const handleUpdateStartDate = (bookId: string, newDate: string) => {
    const now = new Date().toISOString();
    const cleanDate = newDate.trim();
    let updatedBook: Book | null = null;

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const targetStartDate = cleanDate || undefined;
          const copy: Book = {
            ...b,
            startDate: targetStartDate,
            readingDays: calculateBookActiveReadingDays({
              ...b,
              startDate: targetStartDate,
            }),
            updatedAt: now,
          };
          if (!targetStartDate) {
            delete copy.startDate;
          }
          updatedBook = copy;
          return copy;
        }
        return b;
      })
    );

    if (updatedBook) {
      bookStorage.saveBook(updatedBook).catch(() => {});
      if (viewingDetailBook && viewingDetailBook.id === bookId) {
        setViewingDetailBook(updatedBook);
      }
      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, updatedBook);
      }
    }
  };

  // Update End Date of any book
  const handleUpdateEndDate = (bookId: string, newDate: string) => {
    const now = new Date().toISOString();
    const cleanDate = newDate.trim();
    let updatedBook: Book | null = null;

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const targetEndDate = cleanDate || undefined;
          const copy: Book = {
            ...b,
            endDate: targetEndDate,
            readingDays: calculateBookActiveReadingDays({
              ...b,
              endDate: targetEndDate,
            }),
            updatedAt: now,
          };
          if (!targetEndDate) {
            delete copy.endDate;
          }
          updatedBook = copy;
          return copy;
        }
        return b;
      })
    );

    if (updatedBook) {
      bookStorage.saveBook(updatedBook).catch(() => {});
      if (viewingDetailBook && viewingDetailBook.id === bookId) {
        setViewingDetailBook(updatedBook);
      }
      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, updatedBook);
      }
    }
  };

  // Remove Start Date from a book (e.g. when added without starting reading)
  const handleRemoveStartDate = (bookId: string) => {
    const now = new Date().toISOString();
    let updatedBook: Book | null = null;
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const copy: Book = {
            ...b,
            readingDays: 0,
            updatedAt: now,
          };
          delete copy.startDate;
          if (copy.status === 'leyendo') {
            copy.status = 'pendiente';
          }
          updatedBook = copy;
          return copy;
        }
        return b;
      })
    );

    if (updatedBook) {
      if (viewingDetailBook && viewingDetailBook.id === bookId) {
        setViewingDetailBook(updatedBook);
      }
      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, updatedBook);
      }
    }
  };

  // Remove End Date from a book
  const handleRemoveEndDate = (bookId: string) => {
    const now = new Date().toISOString();
    let updatedBook: Book | null = null;
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const copy: Book = {
            ...b,
            updatedAt: now,
          };
          delete copy.endDate;
          if (copy.status === 'leido') {
            copy.status = 'pendiente';
          }
          updatedBook = copy;
          return copy;
        }
        return b;
      })
    );

    if (updatedBook) {
      if (viewingDetailBook && viewingDetailBook.id === bookId) {
        setViewingDetailBook(updatedBook);
      }
      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, updatedBook);
      }
    }
  };

  // Delete Book
  const handleDeleteBook = () => {
    if (!deletingBook) return;
    const bookToDelete = deletingBook;
    setBooks((prev) => prev.filter((b) => b.id !== bookToDelete.id));
    recordLocalDeletedBook(bookToDelete.id, bookToDelete.title, bookToDelete.author);
    bookStorage.deleteBook(bookToDelete.id).catch(() => {});
    chapterStorage.deleteChapters(bookToDelete.id).catch(() => {});
    coverStorage.deleteCover(bookToDelete.id).catch(() => {});
    if (auth.currentUser) {
      deleteBookFromCloud(auth.currentUser.uid, bookToDelete.id, bookToDelete.title, bookToDelete.author);
    }
    setDeletingBook(null);
  };

  // Save (Create or Edit) WishlistItem
  const handleSaveWish = (wishData: Partial<WishlistItem>) => {
    const now = new Date().toISOString();

    if (editingWish) {
      const updatedWish: WishlistItem = {
        ...editingWish,
        ...wishData,
        updatedAt: now,
      } as WishlistItem;

      if (wishData.offerPrice === undefined) {
        delete updatedWish.offerPrice;
      }
      if (wishData.estimatedPrice === undefined) {
        delete updatedWish.estimatedPrice;
      }

      setWishlist((prev) => prev.map((w) => (w.id === editingWish.id ? updatedWish : w)));

      if (auth.currentUser) {
        saveWishToCloud(auth.currentUser.uid, updatedWish);
      }
    } else {
      const newWish: WishlistItem = {
        id: `wish-${Date.now()}`,
        title: wishData.title || 'Sin título',
        author: wishData.author || 'Autor desconocido',
        coverImage: wishData.coverImage,
        coverColor: wishData.coverColor || '#d4d4d8',
        category: wishData.category || 'General',
        intent: wishData.intent || 'comprar',
        priority: wishData.priority || 'media',
        estimatedPrice: wishData.estimatedPrice,
        offerPrice: wishData.offerPrice,
        currency: wishData.currency || '$',
        storeName: wishData.storeName,
        storeUrl: wishData.storeUrl,
        notes: wishData.notes,
        totalPages: wishData.totalPages,
        format: wishData.format || 'fisico',
        createdAt: now,
        updatedAt: now,
      };

      if (newWish.offerPrice === undefined) {
        delete newWish.offerPrice;
      }
      if (newWish.estimatedPrice === undefined) {
        delete newWish.estimatedPrice;
      }

      setWishlist((prev) => [newWish, ...prev]);

      if (auth.currentUser) {
        saveWishToCloud(auth.currentUser.uid, newWish);
      }
    }

    setEditingWish(null);
    setIsWishModalOpen(false);
  };

  // Remove discount / offer price from a wishlist item
  const handleRemoveWishOffer = (wish: WishlistItem) => {
    const now = new Date().toISOString();
    const updatedWish: WishlistItem = {
      ...wish,
      updatedAt: now,
    };
    delete updatedWish.offerPrice;

    setWishlist((prev) => prev.map((w) => (w.id === wish.id ? updatedWish : w)));

    if (auth.currentUser) {
      saveWishToCloud(auth.currentUser.uid, updatedWish);
    }
  };

  // Delete WishlistItem
  const handleDeleteWish = () => {
    if (!deletingWish) return;
    const wishToDelete = deletingWish;
    setWishlist((prev) => prev.filter((w) => w.id !== wishToDelete.id));
    if (auth.currentUser) {
      deleteWishFromCloud(auth.currentUser.uid, wishToDelete.id);
    }
    setDeletingWish(null);
  };

  // Convert Wish to Library Book (or start reading immediately)
  const executeConvertToLibraryBook = (wish: WishlistItem, startReadingNow: boolean) => {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const newBook: Book = {
      id: `book-${Date.now()}`,
      title: wish.title,
      author: wish.author || 'Autor desconocido',
      coverImage: wish.coverImage,
      coverColor: wish.coverColor || '#d4d4d8',
      totalPages: wish.totalPages || 200,
      currentPage: 0,
      format: wish.format || 'fisico',
      category: wish.category || 'General',
      genres: wish.category ? [wish.category] : ['General'],
      saga: '',
      rating: 0,
      status: startReadingNow ? 'leyendo' : 'pendiente',
      startDate: startReadingNow ? today : undefined,
      readYear: new Date().getFullYear(),
      readingDays: startReadingNow ? 1 : 0,
      chapters: [],
      createdAt: now,
      updatedAt: now,
    };

    setBooks((prev) => [...prev, newBook]);
    setWishlist((prev) => prev.filter((w) => w.id !== wish.id));

    if (auth.currentUser) {
      saveBookToCloud(auth.currentUser.uid, newBook);
      deleteWishFromCloud(auth.currentUser.uid, wish.id);
    }

    if (startReadingNow) {
      setActiveBookId(newBook.id);
      setActiveTab('leyendo');
    } else {
      setActiveTab('biblioteca');
    }
  };

  const handleConvertToLibraryBook = (wish: WishlistItem, startReadingNow: boolean) => {
    const cleanWishTitle = wish.title
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const existingBook = books.find(
      (b) =>
        b.title
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') === cleanWishTitle
    );

    if (existingBook) {
      setDuplicateWishWarning({ wish, existingBook, startReadingNow });
      return;
    }

    executeConvertToLibraryBook(wish, startReadingNow);
  };

  // Quick status change
  const handleQuickStatusChange = (bookId: string, status: BookStatus) => {
    const targetBook = books.find((b) => b.id === bookId);
    if (status === 'leido' && targetBook && targetBook.status !== 'leido') {
      setCelebrationBookTitle(targetBook.title);
      setShowCelebration(true);
    }

    let updatedBook: Book | null = null;
    const todayStr = new Date().toISOString().split('T')[0];
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const isGoingToRead = status === 'leido';
          const isGoingToReading = status === 'leyendo';
          const targetStartDate = isGoingToReading && !b.startDate ? todayStr : b.startDate;
          const targetEndDate = isGoingToRead ? (b.endDate || todayStr) : b.endDate;
          updatedBook = {
            ...b,
            status,
            currentPage: isGoingToRead ? b.totalPages : b.currentPage,
            startDate: targetStartDate,
            endDate: targetEndDate,
            readingDays: calculateBookActiveReadingDays({
              ...b,
              status,
              startDate: targetStartDate,
              endDate: targetEndDate,
            }),
            chapters: isGoingToRead ? (b.chapters || []).map((c) => ({ ...c, isRead: true })) : b.chapters,
            updatedAt: new Date().toISOString(),
          };
          return updatedBook;
        }
        return b;
      })
    );

    if (updatedBook) {
      if (viewingDetailBook && viewingDetailBook.id === bookId) {
        setViewingDetailBook(updatedBook);
      }
      if (auth.currentUser) {
        saveBookToCloud(auth.currentUser.uid, updatedBook);
      }
    }

    if (status === 'leyendo') {
      setActiveBookId(bookId);
    }
  };

  // 12-Month Annual Challenge handlers
  const handleToggleAnnualBookRead = (monthNumber: number, bookId: string) => {
    const existing =
      annualChallengesByYear[selectedChallengeYear] ||
      createAnnualChallengeForYear(selectedChallengeYear);

    const targetNum = Number(monthNumber);
    const updatedMonths = (existing.months || []).map((m) => {
      if (Number(m.monthNumber) === targetNum) {
        const updatedBooks = (m.books || []).map((b) =>
          b.id === bookId ? { ...b, isRead: !b.isRead } : b
        );
        return { ...m, books: updatedBooks };
      }
      return m;
    });

    const updatedAnnual: AnnualChallenge = {
      ...existing,
      id: existing.id || `annual-challenge-${selectedChallengeYear}`,
      year: selectedChallengeYear,
      months: updatedMonths,
      updatedAt: new Date().toISOString(),
    };

    setAnnualChallengesByYear((prev) => ({
      ...prev,
      [selectedChallengeYear]: updatedAnnual,
    }));

    if (auth.currentUser) {
      const updatedMap = {
        ...annualChallengesByYear,
        [selectedChallengeYear]: updatedAnnual,
      };
      safeStorage.setJson(
        `registro_lectura_account_annuals_${auth.currentUser.uid}`,
        updatedMap
      );
      saveAnnualChallengeToCloud(auth.currentUser.uid, updatedAnnual);
    } else {
      safeStorage.setJson(
        `registro_lectura_guest_annual_challenge_year_${selectedChallengeYear}`,
        updatedAnnual
      );
    }
  };

  const handleOpenEditMonthModal = (month: AnnualMonthChallenge) => {
    setSelectedMonthForModal(month);
    setIsDesafioModalOpen(true);
  };

  const handleSaveMonthChallenge = (updatedMonth: AnnualMonthChallenge) => {
    const existing =
      annualChallengesByYear[selectedChallengeYear] ||
      createAnnualChallengeForYear(selectedChallengeYear);

    const targetMonthNum = Number(updatedMonth.monthNumber);
    const MONTH_NAMES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    // Clean updatedMonth books to strip any bulky base64 data URLs
    const sanitizedUpdatedMonth: AnnualMonthChallenge = {
      ...updatedMonth,
      monthNumber: targetMonthNum,
      monthName: updatedMonth.monthName || MONTH_NAMES[targetMonthNum - 1],
      category: (updatedMonth.category || '').trim(),
      notes: (updatedMonth.notes || '').trim(),
      books: (updatedMonth.books || []).map((bk) => ({
        ...bk,
        id: bk.id || bk.bookId || `book-${Date.now()}`,
        coverImage: bk.coverImage || undefined,
      })),
    };

    // Reconstruct full 12 months (1..12) ensuring none are omitted, and explicitly set December/target month
    const existingMonths = Array.isArray(existing.months) ? existing.months : [];
    const monthMap = new Map<number, AnnualMonthChallenge>();
    existingMonths.forEach((m) => {
      monthMap.set(Number(m.monthNumber), m);
    });
    // Explicitly set our updated target month
    monthMap.set(targetMonthNum, sanitizedUpdatedMonth);

    const full12Months: AnnualMonthChallenge[] = [];
    for (let m = 1; m <= 12; m++) {
      const found = monthMap.get(m);
      if (found) {
        full12Months.push({
          ...found,
          monthNumber: m,
          monthName: found.monthName || MONTH_NAMES[m - 1],
          notes: found.notes || '',
          books: (found.books || []).map((bk) => ({
            ...bk,
            coverImage: bk.coverImage || undefined,
          })),
        });
      } else {
        full12Months.push({
          monthNumber: m,
          monthName: MONTH_NAMES[m - 1],
          category: '',
          notes: '',
          books: [],
        });
      }
    }

    const updatedAnnual: AnnualChallenge = {
      ...existing,
      id: existing.id || `annual-challenge-${selectedChallengeYear}`,
      year: selectedChallengeYear,
      months: full12Months,
      updatedAt: new Date().toISOString(),
    };

    setAnnualChallengesByYear((prev) => ({
      ...prev,
      [selectedChallengeYear]: updatedAnnual,
    }));

    if (auth.currentUser) {
      const updatedMap = {
        ...annualChallengesByYear,
        [selectedChallengeYear]: updatedAnnual,
      };
      safeStorage.setJson(
        `registro_lectura_account_annuals_${auth.currentUser.uid}`,
        updatedMap
      );
      saveAnnualChallengeToCloud(auth.currentUser.uid, updatedAnnual);
    } else {
      safeStorage.setJson(
        `registro_lectura_guest_annual_challenge_year_${selectedChallengeYear}`,
        updatedAnnual
      );
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-zinc-100 via-neutral-100 to-stone-200 text-zinc-900 flex flex-col justify-between selection:bg-zinc-900 selection:text-white">
      {/* Top Container */}
      <div
        className={`w-full max-w-full overflow-x-hidden mx-auto flex-1 flex flex-col transition-all duration-200 ${
          activeTab === 'biblioteca'
            ? 'max-w-lg md:max-w-4xl lg:max-w-7xl'
            : 'max-w-lg md:max-w-2xl lg:max-w-4xl'
        }`}
      >
        {/* Header */}
        <Header
          user={user}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenInstallBanner={() => setIsInstallBannerOpen(true)}
          onOpenBackupModal={() => setIsBackupRestoreOpen(true)}
          isSyncing={isSyncing}
          onManualSync={handleManualSync}
        />

        {/* Guest Mode Multi-Device Sync Callout Banner */}
        {user.isGuest && (
          <div className="mx-4 my-2.5 p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-amber-200/80 flex items-center justify-center font-bold text-amber-900 text-xs border border-amber-400">
                  <User className="w-4 h-4 text-amber-800" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" title="Modo Invitado" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider bg-amber-200/90 px-2 py-0.5 rounded-md border border-amber-300">
                    Modo Invitado
                  </span>
                  <span className="text-xs font-bold text-amber-900">En este celular</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-tight mt-1">
                  Para sincronizar en tiempo real con tu otro celular, inicia sesión con tu cuenta de Google.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:w-auto py-2 px-3.5 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Iniciar Sesión con Google</span>
            </button>
          </div>
        )}

        {/* Sync Feedback Toast */}
        {syncFeedback && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] sm:max-w-md px-3.5 py-1.5 bg-zinc-900/95 text-white text-xs font-semibold rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 border border-zinc-700 pointer-events-none text-center">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="truncate leading-tight text-[11px] sm:text-xs">{syncFeedback}</span>
          </div>
        )}

        {/* PWA Install Notification / Banner (placed above content) */}
        <PWAInstallBanner
          isOpen={isInstallBannerOpen}
          onClose={() => {
            setIsInstallBannerOpen(false);
            try {
              localStorage.setItem('registro_lectura_pwa_banner_dismissed_v2', 'true');
            } catch (e) {}
          }}
        />

        {/* Main Tab Content */}
        <main className="flex-1 pt-1 pb-28">
          {activeTab === 'leyendo' && (
            <LeyendoView
              activeBook={activeBook}
              pendingBooks={pendingBooks}
              parallelBooks={parallelBooks}
              onOpenAddBookModal={() => {
                setEditingBook(null);
                setIsBookModalOpen(true);
              }}
              onOpenParallelModal={() => setIsParallelModalOpen(true)}
              onSelectActiveBook={handleSelectActiveBook}
              onUpdatePage={handleUpdatePage}
              onOpenChaptersModal={(b) => setManagingChaptersBook(b)}
              onToggleChapterRead={handleToggleChapterRead}
              onUnmarkAllChapters={handleUnmarkAllChapters}
              onFinishBook={(b) => setFinishingBook(b)}
              onAbandonBook={handleAbandonBook}
              onSaveBook={handleSaveBookInLeyendoView}
              onSyncBookProgress={handleSyncActiveBookProgress}
              onUpdateStartDate={handleUpdateStartDate}
              onUpdateEndDate={handleUpdateEndDate}
              onViewBookDetail={(b) => setViewingDetailBook(b)}
              onUpdateBookCover={handleUpdateBookCover}
              user={user}
              isSyncing={isSyncing}
              onManualSync={handleManualSync}
              onNavigateToTab={(t) => handleTabChange(t)}
              totalBooksCount={books.length}
            />
          )}

          {activeTab === 'biblioteca' && (
            <BibliotecaView
              books={books}
              onOpenAddModal={() => {
                setEditingBook(null);
                setIsBookModalOpen(true);
              }}
              onOpenEditModal={(book) => {
                setEditingBook(book);
                setIsBookModalOpen(true);
              }}
              onOpenDeleteModal={(book) => setDeletingBook(book)}
              onOpenChaptersModal={(book) => setManagingChaptersBook(book)}
              onSelectActiveBook={handleSelectActiveBook}
              onQuickStatusChange={handleQuickStatusChange}
              onViewBookDetail={(b) => setViewingDetailBook(b)}
              onRemoveStartDate={handleRemoveStartDate}
              onUpdateCover={handleUpdateBookCover}
              onOpenBackupModal={() => setIsBackupRestoreOpen(true)}
              onUpdateBook={handleUpdateBook}
              onPurgeChapterBooks={async () => {
                await purgeChapterStandaloneBooks(auth.currentUser?.uid);
                setBooks((prev) => filterRealBooksOnly(prev));
              }}
            />
          )}

          {activeTab === 'deseos' && (
            <DeseosView
              wishlist={wishlist}
              onOpenAddModal={() => {
                setEditingWish(null);
                setIsWishModalOpen(true);
              }}
              onOpenEditModal={(wish) => {
                setEditingWish(wish);
                setIsWishModalOpen(true);
              }}
              onDeleteWish={(wish) => setDeletingWish(wish)}
              onConvertToLibraryBook={handleConvertToLibraryBook}
              onRemoveOfferPrice={handleRemoveWishOffer}
            />
          )}

          {activeTab === 'desafio' && (
            <DesafioView
              annualChallenge={currentAnnualChallenge}
              availableYears={availableYears}
              selectedYear={selectedChallengeYear}
              onSelectYear={(yr) => setSelectedChallengeYear(yr)}
              onAddNewYear={(yr) => {
                const newAnnual = annualChallengesByYear[yr] || createAnnualChallengeForYear(yr);
                setAnnualChallengesByYear((prev) => ({
                  ...prev,
                  [yr]: newAnnual,
                }));
                setSelectedChallengeYear(yr);
                if (auth.currentUser) {
                  saveAnnualChallengeToCloud(auth.currentUser.uid, newAnnual);
                } else {
                  try {
                    localStorage.setItem(
                      `registro_lectura_guest_annual_challenge_year_${yr}`,
                      JSON.stringify(newAnnual)
                    );
                  } catch (e) {
                    console.error(e);
                  }
                }
              }}
              libraryBooks={books}
              onUpdateMonth={handleSaveMonthChallenge}
              onToggleBookRead={handleToggleAnnualBookRead}
              onOpenEditMonthModal={handleOpenEditMonthModal}
              onSelectBookToRead={(bookId) => {
                handleSelectActiveBook(bookId);
                setActiveTab('leyendo');
              }}
            />
          )}

          {activeTab === 'estadisticas' && (
            <EstadisticasView
              books={books}
              onViewBookDetail={(b) => setViewingDetailBook(b)}
            />
          )}
        </main>
      </div>

      {/* Fixed Bottom Screen Navigation Bar */}
      <div
        id="bottom-navigation-dock"
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0.65rem))' }}
      >
        <div className="w-full max-w-lg md:max-w-xl lg:max-w-2xl mx-auto px-3.5 sm:px-4 pointer-events-auto">
          <Navigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onReclickTab={(tab) => {
              if (tab === 'leyendo') {
                // Cuando se está en la pantalla de lectura actual y se presiona el botón leyendo:
                // se muestra la pantalla donde están todos los libros que se están leyendo paralelamente y el botón agregar libro
                setIsParallelModalOpen(true);
              }
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        currentUser={user}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginAsUser={(u) => setUser(u)}
        onOpenInstall={() => setIsInstallBannerOpen(true)}
        onOpenBackupModal={() => {
          setIsAuthModalOpen(false);
          setIsBackupRestoreOpen(true);
        }}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        totalBooks={books.length}
        totalWishes={wishlist.length}
        lastSyncTime={lastSyncTime}
      />

      <ParallelBooksModal
        isOpen={isParallelModalOpen}
        onClose={() => setIsParallelModalOpen(false)}
        booksReading={parallelBooks}
        activeBookId={activeBook?.id || null}
        onSelectActiveBook={handleSelectActiveBook}
        onOpenAddBookModal={() => {
          setEditingBook(null);
          setIsBookModalOpen(true);
        }}
        onViewBookDetail={(book) => setViewingDetailBook(book)}
      />

      {/* Ficha completa del libro (Solo lectura, con botón para editar) */}
      <BookDetailModal
        isOpen={!!viewingDetailBook}
        book={viewingDetailBook}
        allBooks={books}
        onClose={() => setViewingDetailBook(null)}
        onEdit={(book) => {
          setViewingDetailBook(null);
          setEditingBook(book);
          setIsBookModalOpen(true);
        }}
        onUpdateCover={handleUpdateBookCover}
        onSelectBook={(book) => {
          setViewingDetailBook(book);
        }}
        onOpenChaptersModal={(book) => {
          setViewingDetailBook(null);
          setManagingChaptersBook(book);
        }}
        onRemoveStartDate={handleRemoveStartDate}
        onRemoveEndDate={handleRemoveEndDate}
        onUpdateStartDate={handleUpdateStartDate}
        onUpdateEndDate={handleUpdateEndDate}
      />

      <BookModal
        isOpen={isBookModalOpen}
        editingBook={editingBook}
        allBooks={books}
        existingSagas={existingSagas}
        existingGenres={existingGenres}
        onClose={() => {
          setIsBookModalOpen(false);
          setEditingBook(null);
        }}
        onSave={handleSaveBook}
      />

      <DeseoModal
        isOpen={isWishModalOpen}
        editingWish={editingWish}
        onClose={() => {
          setIsWishModalOpen(false);
          setEditingWish(null);
        }}
        onSave={handleSaveWish}
      />

      <DesafioModal
        isOpen={isDesafioModalOpen}
        monthChallenge={selectedMonthForModal}
        year={selectedChallengeYear}
        libraryBooks={books}
        onClose={() => {
          setIsDesafioModalOpen(false);
          setSelectedMonthForModal(null);
        }}
        onSave={handleSaveMonthChallenge}
      />

      <DeleteWishConfirmModal
        isOpen={!!deletingWish}
        wish={deletingWish}
        onClose={() => setDeletingWish(null)}
        onConfirm={handleDeleteWish}
      />

      <DeleteConfirmModal
        isOpen={!!deletingBook}
        book={deletingBook}
        onClose={() => setDeletingBook(null)}
        onConfirm={handleDeleteBook}
      />

      <FinishBookModal
        isOpen={!!finishingBook}
        book={finishingBook}
        pendingBooks={pendingBooks.filter((b) => b.id !== finishingBook?.id)}
        onClose={() => setFinishingBook(null)}
        onConfirmFinish={handleConfirmFinish}
      />

      <ChapterModal
        isOpen={!!managingChaptersBook}
        book={managingChaptersBook}
        onClose={() => setManagingChaptersBook(null)}
        onUpdateChapters={handleUpdateChapters}
      />

      {/* Golden Fireworks Celebration */}
      <GoldenFireworks
        isOpen={showCelebration}
        bookTitle={celebrationBookTitle}
        onClose={() => setShowCelebration(false)}
      />

      {/* Duplicate Book Alert for Wishlist Conversion */}
      {duplicateWishWarning && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl border border-amber-200 text-center animate-in zoom-in-95 duration-200">
            <div className="w-13 h-13 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-zinc-900 mb-1 tracking-tight">
              ¡Libro ya registrado!
            </h3>

            <p className="text-xs text-zinc-600 mb-3.5 leading-relaxed">
              El libro <strong className="text-zinc-900 font-extrabold">«{duplicateWishWarning.existingBook.title}»</strong> ya se encuentra registrado en tu biblioteca.
            </p>

            <div className="bg-zinc-50 border border-zinc-200/90 rounded-2xl p-2.5 mb-4 text-left flex items-center gap-3">
              <div
                className="w-11 h-15 rounded-xl shrink-0 overflow-hidden border border-zinc-300 flex items-center justify-center font-bold text-xs shadow-2xs"
                style={{ backgroundColor: duplicateWishWarning.existingBook.coverColor || '#e1bee7' }}
              >
                {duplicateWishWarning.existingBook.coverImage ? (
                  <img src={duplicateWishWarning.existingBook.coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  duplicateWishWarning.existingBook.title.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-zinc-900 truncate">{duplicateWishWarning.existingBook.title}</p>
                <p className="text-[11px] text-zinc-500 font-medium truncate">
                  {duplicateWishWarning.existingBook.author || 'Autor desconocido'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800">
                    {duplicateWishWarning.existingBook.status === 'leyendo'
                      ? 'Leyendo'
                      : duplicateWishWarning.existingBook.status === 'leido'
                      ? 'Leído'
                      : duplicateWishWarning.existingBook.status === 'abandonado'
                      ? 'Abandonado'
                      : 'Por leer'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono font-semibold">
                    {duplicateWishWarning.existingBook.currentPage}/{duplicateWishWarning.existingBook.totalPages} págs
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setDuplicateWishWarning(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const { wish, startReadingNow } = duplicateWishWarning;
                  setDuplicateWishWarning(null);
                  executeConvertToLibraryBook(wish, startReadingNow);
                }}
                className="w-full py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Añadir de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Respaldo y Restauración / Escaneo Profundo */}
      <BackupRestoreModal
        isOpen={isBackupRestoreOpen}
        onClose={() => setIsBackupRestoreOpen(false)}
        books={books}
        wishlist={wishlist}
        annualChallenges={annualChallengesByYear}
        challenges={challenges}
        user={user}
        userId={user.isGuest ? undefined : (auth.currentUser?.uid || undefined)}
        onRestoreComplete={(restored) => {
          if (restored.books && restored.books.length > 0) {
            setBooks(restored.books);
          }
          if (restored.wishlist && restored.wishlist.length > 0) {
            setWishlist(restored.wishlist);
          }
          if (restored.annualChallenges && Object.keys(restored.annualChallenges).length > 0) {
            setAnnualChallengesByYear(restored.annualChallenges);
            if (!user.isGuest && auth.currentUser) {
              Object.values(restored.annualChallenges).forEach((ann) => {
                saveAnnualChallengeToCloud(auth.currentUser!.uid, ann).catch(() => {});
              });
            }
          }
          if (restored.challenges && restored.challenges.length > 0) {
            setChallenges(restored.challenges);
          }
          setSyncFeedback(`¡Restauración exitosa! Todos los datos y desafíos han sido actualizados.`);
          setTimeout(() => setSyncFeedback(null), 4000);
        }}
      />
    </div>
  );
}
