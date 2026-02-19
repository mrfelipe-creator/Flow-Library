export type BookStatus = 'next' | 'reading' | 'paused' | 'completed' | 'discarded';

export interface Book {
  id: string;
  title: string;
  author: string; // Optional, user can edit
  uploadDate: number;
  fileData?: ArrayBuffer; // Only present in IDB, not state usually
  totalPages: number;
  currentPage: number;
  status?: BookStatus;
  category?: string;
  rating?: number; // 0 to 5
}

export interface Note {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  highlight?: string; // The selected text from the PDF
  createdAt: number;
}

export enum ViewState {
  LIBRARY = 'LIBRARY',
  READER = 'READER',
  NOTES = 'NOTES',
  CATEGORIES = 'CATEGORIES'
}

export type GroupingMode = 'none' | 'category' | 'status' | 'rating';

export type SortMode = 'recent' | 'rating' | 'progress' | 'pages' | 'completed';

export type Theme = 'light' | 'dark' | 'night';

export interface Category {
  id: string;
  name: string;
}

export interface StorageItem {
  key: string;
  value: any;
}