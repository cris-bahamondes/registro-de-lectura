import { Book, UserProfile, WishlistItem, MonthlyChallenge, AnnualChallenge } from '../types';

export const INITIAL_USER: UserProfile = {
  name: 'Usuario',
  email: '',
  avatar: '',
  isGuest: true,
};

export const INITIAL_BOOKS: Book[] = [];

export const CATEGORIES = [
  'Novela',
  'Ficción',
  'Ficción histórica',
  'Clásico',
  'Romance',
  'Fantasía',
  'Ciencia Ficción',
  'Misterio / Thriller',
  'No Ficción',
  'Biografía',
  'Desarrollo Personal',
  'Aventura',
  'Terror',
  'Poesía',
];

export const INITIAL_WISHLIST: WishlistItem[] = [];

export const INITIAL_CHALLENGES: MonthlyChallenge[] = [];

export const createAnnualChallengeForYear = (year: number): AnnualChallenge => ({
  id: `annual-challenge-${year}`,
  year,
  title: `Desafío de Lectura ${year}`,
  createdAt: `${year}-01-01T00:00:00.000Z`,
  updatedAt: '1970-01-01T00:00:00.000Z',
  months: [
    { monthNumber: 1, monthName: 'Enero', category: '', books: [] },
    { monthNumber: 2, monthName: 'Febrero', category: '', books: [] },
    { monthNumber: 3, monthName: 'Marzo', category: '', books: [] },
    { monthNumber: 4, monthName: 'Abril', category: '', books: [] },
    { monthNumber: 5, monthName: 'Mayo', category: '', books: [] },
    { monthNumber: 6, monthName: 'Junio', category: '', books: [] },
    { monthNumber: 7, monthName: 'Julio', category: '', books: [] },
    { monthNumber: 8, monthName: 'Agosto', category: '', books: [] },
    { monthNumber: 9, monthName: 'Septiembre', category: '', books: [] },
    { monthNumber: 10, monthName: 'Octubre', category: '', books: [] },
    { monthNumber: 11, monthName: 'Noviembre', category: '', books: [] },
    { monthNumber: 12, monthName: 'Diciembre', category: '', books: [] },
  ],
});

export const INITIAL_ANNUAL_CHALLENGE: AnnualChallenge = createAnnualChallengeForYear(2026);
