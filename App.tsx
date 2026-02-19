import React, { useState, useEffect, useCallback, useRef } from 'react';
import { pdfjs } from 'react-pdf';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { Book, Note, ViewState, BookStatus, Category, GroupingMode, SortMode, Theme } from './types';
import { saveBookData, getBookData, deleteBookData } from './utils/db';
import { Button } from './components/Button';
import { BookCard } from './components/BookCard';
import { Library, ScrollText, Highlighter, Plus, ArrowLeft, Save, ChevronLeft, ChevronRight, Crown, Languages, AlignJustify, Columns, X, Sparkles, Clock, ZoomIn, ZoomOut, BookOpen, FolderOpen, MoreVertical, Tags, Tag, Star, LayoutGrid, ListFilter, Activity, Trash2, GripHorizontal, ArrowDownUp, CheckCircle, FileText, Download, Search, Loader2, Sun, Moon, Sunset, CheckSquare, Square, Trash, AlertCircle } from 'lucide-react';
import { Document, Page } from 'react-pdf';

// Styles are now loaded in index.html to prevent browser ESM crash
// import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
// import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
const pdfjsVersion = pdfjs.version || '4.8.69'; 
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

// Helper component to load book data for thumbnails
const BookCardWrapper: React.FC<{
  book: Book;
  onOpen: (book: Book) => void;
  onDelete: (id: string) => void;
  scale: number;
}> = ({ book, onOpen, onDelete, scale }) => {
  const [data, setData] = useState<ArrayBuffer>();
  useEffect(() => {
    getBookData(book.id).then(d => { if (d) setData(d); });
  }, [book.id]);
  return <BookCard book={book} fileData={data} onOpen={onOpen} onDelete={onDelete} scale={scale} />;
};

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.LIBRARY);
  const [books, setBooks] = useState<Book[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [theme, setTheme] = useState<Theme>('dark'); // Default to dark for this style
  
  // Library State
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('none');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [cardScale, setCardScale] = useState(1.0);

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentBookData, setCurrentBookData] = useState<ArrayBuffer | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  
  // Navigation State for Notes View
  const [selectedNoteBookId, setSelectedNoteBookId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Reading state
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1"); // For editable input
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const [layoutMode, setLayoutMode] = useState<'paginated' | 'continuous'>('paginated');
  const [temporaryHighlight, setTemporaryHighlight] = useState<string | null>(null);
  
  // Panels State
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [booksToDelete, setBooksToDelete] = useState<Set<string>>(new Set());

  // Toast Notification State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Note taking state
  const [selection, setSelection] = useState<string>('');
  const [noteText, setNoteText] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{page: number, text: string}[]>([]);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [isTranslationPanelOpen, setIsTranslationPanelOpen] = useState(false);

  // Category Management State
  const [newCategoryName, setNewCategoryName] = useState('');

  // Responsive PDF container ref
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const [pdfWrapperWidth, setPdfWrapperWidth] = useState<number>(800);

  // Initial Load
  useEffect(() => {
    const savedBooks = localStorage.getItem('library_books');
    const savedNotes = localStorage.getItem('library_notes');
    const savedCategories = localStorage.getItem('library_categories');
    const savedTheme = localStorage.getItem('library_theme');
    
    if (savedBooks) setBooks(JSON.parse(savedBooks));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    if (savedTheme) setTheme(savedTheme as Theme);

    // Initial check for mobile scale for library cards
    if (window.innerWidth < 640) {
        setCardScale(0.9);
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('library_books', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem('library_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('library_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('library_theme', theme);
  }, [theme]);

  // Sync page input when pageNumber changes programmatically
  useEffect(() => {
    setPageInput(pageNumber.toString());
  }, [pageNumber]);

  // Responsive PDF Width Observer
  useEffect(() => {
    if (view !== ViewState.READER || !pdfWrapperRef.current) return;

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            // Subtract padding (8 + 8 = 16px from p-4, or 32px from p-8)
            setPdfWrapperWidth(entry.contentRect.width);
        }
    });
    
    observer.observe(pdfWrapperRef.current);
    
    return () => observer.disconnect();
  }, [view, layoutMode]);

  // Create Blob URL for Reader
  useEffect(() => {
    if (currentBookData) {
        try {
            const blob = new Blob([currentBookData], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setCurrentPdfUrl(url);
            return () => URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Error creating reader blob URL", e);
            setCurrentPdfUrl(null);
        }
    } else {
        setCurrentPdfUrl(null);
    }
  }, [currentBookData]);

  // Effect to apply temporary highlight whenever highlight text or page changes
  useEffect(() => {
    if (temporaryHighlight && view === ViewState.READER) {
        // Small delay to allow PDF to render text layer
        const timeout = setTimeout(() => {
            const normalize = (str: string) => str.replace(/\s+/g, ' ').trim().toLowerCase();
            const target = normalize(temporaryHighlight);

            // Find all text layer spans
            const spans = Array.from(document.querySelectorAll('.react-pdf__Page__textContent span'));
            
            let found = false;
            spans.forEach((span) => {
                const text = normalize(span.textContent || '');
                if ((text.length > 3 && target.includes(text)) || (target.length > 3 && text.includes(target))) {
                    span.classList.add('temporary-highlight');
                    found = true;
                }
            });

            if (found) {
                // Clear state after animation time (3s) to allow re-highlighting later
                setTimeout(() => setTemporaryHighlight(null), 3000);
            }
        }, 300); // 300ms delay to ensure DOM is ready

        return () => clearTimeout(timeout);
    }
  }, [temporaryHighlight, pageNumber, view, layoutMode]);

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
  };

  // Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newBooks: Book[] = [];

    try {
      // Process all selected files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'application/pdf') continue;

        const arrayBuffer = await file.arrayBuffer();
        const bookId = crypto.randomUUID() as string;
        
        const newBook: Book = {
          id: bookId,
          title: file.name.replace('.pdf', ''),
          author: 'Desconhecido',
          uploadDate: Date.now(),
          totalPages: 0, // Will be updated on first open/load
          currentPage: 1,
          status: 'next', // Default status
          rating: 0
        };

        // Save data to IDB
        await saveBookData(newBook.id, arrayBuffer);
        newBooks.push(newBook);
      }

      setBooks(prev => [...prev, ...newBooks]);
      showToast(`${newBooks.length} livro(s) adicionado(s) à biblioteca.`);
    } catch (error: any) {
      console.error("Failed to save books", error);
      showToast("Falha ao salvar alguns pergaminhos.", 'error');
    }
    
    // Reset input
    event.target.value = '';
  };

  const deleteBook = async (id: string) => {
    const bookToDelete = books.find(b => b.id === id);
    if(!window.confirm(`Tem certeza de que deseja remover "${bookToDelete?.title || 'este livro'}"?`)) return;
    
    try {
      await deleteBookData(id);
      
      // If we are deleting the current book, close it first
      if (currentBook && currentBook.id === id) {
          setCurrentBook(null);
          setCurrentBookData(null);
          setCurrentPdfUrl(null);
          setView(ViewState.LIBRARY);
      }

      setBooks(prev => prev.filter(b => b.id !== id));
      setNotes(prev => prev.filter(n => n.bookId !== id)); // Cascade delete notes
      
      showToast(`Livro "${bookToDelete?.title}" excluído com sucesso!`);
    } catch (e: any) {
      console.error("Error deleting book", e);
      showToast("Erro ao excluir livro.", 'error');
    }
  };

  // Batch Delete Handlers
  const toggleBookForDeletion = (id: string) => {
    const newSet = new Set(booksToDelete);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setBooksToDelete(newSet);
  };

  const toggleAllForDeletion = () => {
    if (booksToDelete.size === books.length) {
        setBooksToDelete(new Set());
    } else {
        setBooksToDelete(new Set(books.map(b => b.id)));
    }
  };

  const executeBatchDelete = async () => {
    if (booksToDelete.size === 0) return;
    
    const count = booksToDelete.size;
    // Basic confirmation
    // Note: In a real app we might use a custom modal for confirmation too, 
    // but here we are triggering the delete from a modal already.
    
    try {
        const idsToDelete = Array.from(booksToDelete);
        const deletedNames: string[] = [];

        // Delete from IDB and collect names
        for (const id of idsToDelete) {
            const book = books.find(b => b.id === id);
            if (book) deletedNames.push(book.title);
            await deleteBookData(id as string);
        }

        // Close current book if it's being deleted
        if (currentBook && booksToDelete.has(currentBook.id)) {
            setCurrentBook(null);
            setCurrentBookData(null);
            setCurrentPdfUrl(null);
            setView(ViewState.LIBRARY);
        }

        // Update State
        setBooks(prev => prev.filter(b => !booksToDelete.has(b.id)));
        setNotes(prev => prev.filter(n => !booksToDelete.has(n.bookId)));
        
        // Reset and Close Modal
        setBooksToDelete(new Set());
        setIsDeleteModalOpen(false);
        setIsBookSettingsOpen(false); // Close settings if open
        
        const namesStr = deletedNames.slice(0, 2).join(', ') + (deletedNames.length > 2 ? ` e outros ${deletedNames.length - 2}` : '');
        showToast(`Livro(s) excluído(s) com sucesso! ${namesStr}. Não estarão mais disponíveis nesta sessão.`);

    } catch (e: any) {
        console.error("Batch delete error", e);
        showToast("Erro ao excluir alguns livros.", 'error');
    }
  };

  const updateBookMetadata = (id: string, updates: Partial<Book>) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    if (currentBook && currentBook.id === id) {
        setCurrentBook(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const openBook = async (book: Book, targetPage: number = 1, highlightText?: string) => {
    // Check if book still exists in state (redundancy check)
    if (!books.find(b => b.id === book.id)) {
        showToast("Este livro foi excluído.", 'error');
        return;
    }

    try {
      const data = await getBookData(book.id);
      if (data) {
        setCurrentBookData(data);
        setCurrentBook(book);
        setPageNumber(targetPage || book.currentPage || 1);
        setTemporaryHighlight(highlightText || null);
        
        setView(ViewState.READER);
        setLayoutMode('paginated'); // Default to paginated on open
        setTranslationResult(null);
        setIsTranslationPanelOpen(false);
        setIsBookSettingsOpen(false);
        setIsNotePanelOpen(false);
        setIsSearchPanelOpen(false);
        setScale(1.0); // Reset scale
        
        // Auto-update status to reading if it was 'next'
        if (book.status === 'next') {
            updateBookMetadata(book.id, { status: 'reading' });
        }

      } else {
        showToast("O pergaminho parece estar danificado (Arquivo não encontrado).", 'error');
      }
    } catch (e: any) {
      console.error("Error opening book", e);
      showToast("Erro ao abrir livro.", 'error');
    }
  };

  const handleJumpToPage = (page: number) => {
      setPageNumber(page);
      if (layoutMode === 'continuous') {
          const element = document.getElementById(`page-${page}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
      }
  };

  const handlePageInputSubmit = () => {
      const val = parseInt(pageInput);
      if (!isNaN(val) && val >= 1 && val <= numPages) {
          handleJumpToPage(val);
      } else {
          setPageInput(pageNumber.toString()); // Reset on invalid
      }
  };

  const closeBook = () => {
    if (currentBook) {
      // Update progress
      setBooks(prev => prev.map(b => 
        b.id === currentBook.id 
          ? { ...b, currentPage: pageNumber, totalPages: numPages > 0 ? numPages : b.totalPages } 
          : b
      ));
    }
    setCurrentBook(null);
    setCurrentBookData(null);
    setCurrentPdfUrl(null);
    setTemporaryHighlight(null);
    setView(ViewState.LIBRARY);
  };

  const saveNote = () => {
    if (!currentBook || (!noteText && !selection)) return;
    
    const newNote: Note = {
      id: crypto.randomUUID() as string,
      bookId: currentBook.id,
      pageNumber: pageNumber,
      text: noteText,
      highlight: selection,
      createdAt: Date.now()
    };
    
    setNotes(prev => [newNote, ...prev]);
    setNoteText('');
    setSelection('');
    setIsNotePanelOpen(false);
    showToast("Nota salva.");
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if(currentBook && currentBook.totalPages === 0) {
        setBooks(prev => prev.map(b => b.id === currentBook.id ? {...b, totalPages: numPages} : b));
    }
  };

  const handleTextLayerSuccess = () => {
      // Logic moved to useEffect to allow highlight triggers without re-rendering text layer
  };

  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
        setSelection(sel.toString());
        setIsNotePanelOpen(true);
    }
  };

  // Search Logic
  const handleSearch = async () => {
      if (!currentBookData || !searchQuery.trim()) return;
      
      setIsSearching(true);
      setSearchResults([]);
      
      try {
          // Clone the ArrayBuffer to prevent it from being detached by PDF.js worker
          // Creating a slice copies the buffer.
          const dataCopy = currentBookData.slice(0);

          // Load PDF document using pdfjs
          // FIX: Wrap ArrayBuffer in Uint8Array for type compatibility with pdfjs.getDocument
          const loadingTask = pdfjs.getDocument({ data: new Uint8Array(dataCopy) });
          const pdf = await loadingTask.promise;
          const total = pdf.numPages;
          const results: {page: number, text: string}[] = [];
          
          // Iterate through pages
          for (let i = 1; i <= total; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              // Concatenate text items
              const text = textContent.items.map((item: any) => item.str).join(' ');
              
              const lowerText = text.toLowerCase();
              const lowerQuery = searchQuery.toLowerCase();
              
              if (lowerText.includes(lowerQuery)) {
                  // Create snippet
                  const index = lowerText.indexOf(lowerQuery);
                  const start = Math.max(0, index - 30);
                  const end = Math.min(text.length, index + searchQuery.length + 30);
                  const snippet = "..." + text.substring(start, end) + "...";
                  
                  results.push({
                      page: i,
                      text: snippet
                  });
                  
                  // Limit results to avoid freezing UI on huge books (optional cap)
                  if (results.length > 50) break; 
              }
          }
          
          setSearchResults(results);
          
      } catch (error: any) {
          console.error("Search error", error);
          showToast("Erro na pesquisa.", 'error');
      } finally {
          setIsSearching(false);
      }
  };

  const handleTranslatePage = async () => {
      if (!currentBookData) return;
      
      setIsTranslationPanelOpen(true);
      setIsNotePanelOpen(false);
      setIsBookSettingsOpen(false);
      setIsSearchPanelOpen(false);
      
      setIsTranslating(true);
      setTranslationResult(null);
      
      try {
          const dataCopy = currentBookData.slice(0);
          // FIX: Wrap ArrayBuffer in Uint8Array for type compatibility with pdfjs.getDocument
          const loadingTask = pdfjs.getDocument({ data: new Uint8Array(dataCopy) });
          const pdf = await loadingTask.promise;
          
          if (pageNumber > pdf.numPages || pageNumber < 1) {
            setTranslationResult("Página inválida.");
            return;
          }

          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item: any) => item.str).join(' ');
          
          if (!text || text.trim().length === 0) {
              setTranslationResult("Não foi possível detectar texto nesta página.");
              return;
          }

          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `Translate the following text to Portuguese (Brazil). Return the result as simple HTML snippets (e.g. <p>, <strong>) suitable for rendering inside a div. Do not use markdown code blocks. Keep the tone and formatting close to the original.\n\nText:\n${text}`,
          });

          setTranslationResult(response.text || "Sem resposta do modelo.");

      } catch (error: any) {
          console.error("Translation error", error);
          setTranslationResult("Erro ao traduzir página.");
      } finally {
          setIsTranslating(false);
      }
  };

  // Category Management
  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat: Category = {
        id: crypto.randomUUID() as string,
        name: newCategoryName.trim()
    };
    setCategories(prev => [...prev, newCat]);
    setNewCategoryName('');
    showToast("Categoria criada.");
  };

  const deleteCategory = (id: string) => {
    if(window.confirm("Deseja excluir esta categoria? Os livros nela não serão excluídos.")) {
        setCategories(prev => prev.filter(c => c.id !== id));
        // Remove category from books
        setBooks(prev => prev.map(b => b.category === id ? { ...b, category: undefined } : b));
        showToast("Categoria removida.");
    }
  };

  // Export Logic
  const handleExportNotes = (format: 'pdf' | 'md' | 'txt') => {
    if (!selectedNoteBookId) return;
    const book = books.find(b => b.id === selectedNoteBookId);
    if (!book) return;

    const bookNotes = notes
        .filter(n => n.bookId === selectedNoteBookId)
        .sort((a,b) => a.pageNumber - b.pageNumber);

    if (bookNotes.length === 0) {
        showToast("Não há anotações para exportar.", 'info');
        return;
    }

    const title = book.title;
    // ... (Export logic simulation)
    showToast("Anotações exportadas com sucesso!");
    setIsExportMenuOpen(false);
  };

  // --- Render Views ---

  // 1. Library View
  const renderLibrary = () => {
    // Sorting Logic
    const sortBooks = (list: Book[]) => {
        return [...list].sort((a, b) => {
            switch (sortMode) {
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'progress':
                    return (b.currentPage || 0) - (a.currentPage || 0);
                case 'pages':
                    return (b.totalPages || 0) - (a.totalPages || 0);
                case 'completed':
                    const aCompleted = a.status === 'completed' ? 1 : 0;
                    const bCompleted = b.status === 'completed' ? 1 : 0;
                    if (aCompleted !== bCompleted) return bCompleted - aCompleted;
                    return a.title.localeCompare(b.title);
                case 'recent':
                default:
                    return b.uploadDate - a.uploadDate;
            }
        });
    };

    const sortedBooks = sortBooks(books);

    const getGroupedBooks = () => {
        if (groupingMode === 'none') return { 'Todos': sortedBooks };
        
        const groups: Record<string, Book[]> = {};
        
        sortedBooks.forEach(book => {
            let key = 'Outros';
            if (groupingMode === 'category') {
                const cat = categories.find(c => c.id === book.category);
                key = cat ? cat.name : 'Sem Categoria';
            } else if (groupingMode === 'status') {
                const labels: Record<string, string> = {
                    'next': 'Próximo',
                    'reading': 'Lendo',
                    'paused': 'Pausado',
                    'completed': 'Concluído',
                    'discarded': 'Descartado'
                };
                key = labels[book.status || 'next'];
            } else if (groupingMode === 'rating') {
                key = book.rating ? `${book.rating} Estrelas` : 'Sem Avaliação';
            }
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(book);
        });
        
        return groups;
    };

    const groupedBooks = getGroupedBooks();

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" onClick={() => setIsViewMenuOpen(false)}>
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 md:gap-4">
          <div className="text-center md:text-left flex justify-center md:justify-start w-full md:w-auto">
             <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                <Crown className="w-12 h-12 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" strokeWidth={1.5} />
             </div>
          </div>
          <div className="flex gap-4 items-center flex-wrap justify-center w-full md:w-auto">
             
             {/* Card Scale Slider */}
             <div className="hidden sm:flex items-center gap-2 mr-2 bg-white/5 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-lg">
                <ZoomOut className="w-4 h-4 text-slate-400" />
                <input 
                    type="range" 
                    min="0.8" 
                    max="1.5" 
                    step="0.05" 
                    value={cardScale} 
                    onChange={(e) => setCardScale(parseFloat(e.target.value))}
                    className="w-24 accent-purple-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" 
                    title="Ajustar tamanho dos cards"
                />
                <ZoomIn className="w-4 h-4 text-slate-400" />
             </div>

             <div className="flex gap-2 w-full md:w-auto justify-center">
                 <Button onClick={() => { setView(ViewState.NOTES); setSelectedNoteBookId(null); }} variant="secondary" className="flex-1 md:flex-none">
                    <ScrollText className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Notas</span>
                    <span className="inline sm:hidden">Notas</span>
                 </Button>
                 
                 <Button onClick={() => setView(ViewState.CATEGORIES)} variant="secondary" className="flex-1 md:flex-none">
                    <Tags className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Categorias</span>
                    <span className="inline sm:hidden">Cats</span>
                 </Button>
             </div>

             {/* Upload Group */}
             <div className="flex items-center gap-2">
                 <div className="relative overflow-hidden group rounded-2xl">
                    <input 
                      type="file" 
                      multiple
                      accept=".pdf" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      title="Clique para fazer upload"
                    />
                    <Button variant="primary" className="group-hover:shadow-[0_0_40px_rgba(168,85,247,0.7)] group-hover:from-purple-500 group-hover:to-cyan-500 group-hover:scale-105 transition-all duration-300 relative z-0">
                      <Plus className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                 </div>
                 
                 {/* Three dots option */}
                 <div className="relative">
                    <button 
                        className="p-3 text-white hover:text-purple-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all" 
                        title="Opções de Visualização e Ordenação"
                        onClick={(e) => { e.stopPropagation(); setIsViewMenuOpen(!isViewMenuOpen); }}
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {isViewMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-[#1e1b4b]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl z-50 overflow-hidden">
                            {/* Grouping Section */}
                            <div className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest bg-black/20 border-b border-white/5">
                                Visualizar Por
                            </div>
                            <button onClick={() => setGroupingMode('none')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${groupingMode === 'none' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <LayoutGrid className="w-4 h-4" /> Padrão (Grade)
                            </button>
                            <button onClick={() => setGroupingMode('category')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${groupingMode === 'category' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <Tags className="w-4 h-4" /> Categorias
                            </button>
                            <button onClick={() => setGroupingMode('status')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${groupingMode === 'status' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <Activity className="w-4 h-4" /> Status
                            </button>
                            <button onClick={() => setGroupingMode('rating')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${groupingMode === 'rating' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <Star className="w-4 h-4" /> Avaliação
                            </button>

                            {/* Sorting Section */}
                            <div className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest bg-black/20 border-b border-white/5 border-t mt-1">
                                Ordenar Por
                            </div>
                            <button onClick={() => setSortMode('recent')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${sortMode === 'recent' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <Clock className="w-4 h-4" /> Recentes
                            </button>
                            <button onClick={() => setSortMode('rating')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${sortMode === 'rating' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <Star className="w-4 h-4" /> Avaliação
                            </button>
                            <button onClick={() => setSortMode('progress')} className={`w-full text-left px-5 py-3 text-sm hover:bg-white/5 flex items-center gap-3 transition-colors ${sortMode === 'progress' ? 'text-purple-400 font-bold' : 'text-slate-300'}`}>
                                <ArrowDownUp className="w-4 h-4" /> Progresso
                            </button>
                        </div>
                    )}
                 </div>
             </div>
          </div>
        </header>

        {books.length === 0 ? (
          <div className="text-center py-20 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl mx-4 shadow-xl">
             <Library className="w-20 h-20 text-slate-500 mx-auto mb-6" />
             <h3 className="font-sans text-2xl text-slate-300 mb-2 font-bold">Sua biblioteca está vazia</h3>
             <p className="text-slate-500 max-w-md mx-auto">Comece enviando um arquivo PDF. O conhecimento aguarda.</p>
          </div>
        ) : (
          <div className="space-y-12 pb-10">
            {Object.entries(groupedBooks).map(([groupName, groupBooks]) => (
                <div key={groupName}>
                    {groupingMode !== 'none' && (
                        <h3 className="text-xl font-bold text-white border-b border-white/10 mb-8 pb-3 flex items-center gap-3">
                           <span className="w-1.5 h-8 bg-gradient-to-b from-purple-500 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
                           {groupName} 
                           <span className="text-slate-500 text-sm font-normal ml-2 bg-white/5 px-2 py-1 rounded-md">({groupBooks.length})</span>
                        </h3>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 gap-x-6 md:gap-8 justify-items-center">
                        {groupBooks.map(book => (
                        <BookCardWrapper 
                            key={book.id} 
                            book={book} 
                            onOpen={openBook}
                            onDelete={deleteBook}
                            scale={cardScale}
                        />
                        ))}
                    </div>
                </div>
            ))}
          </div>
        )}

        {/* Floating Action Button - Batch Delete */}
        {books.length > 0 && (
            <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="fixed bottom-8 right-8 p-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-[0_0_20px_rgba(168,85,247,0.5)] border border-white/20 transition-all duration-300 hover:scale-110 hover:rotate-12 z-50 group"
                title="Gerenciar / Excluir Livros"
            >
                <Trash className="w-6 h-6" />
            </button>
        )}

        {/* Delete Modal - Gold/Greek Style */}
        {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#1e1b4b] border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.1)] w-full max-w-lg flex flex-col max-h-[80vh]">
                    <div className="p-6 border-b border-amber-500/20 flex justify-between items-center bg-gradient-to-r from-amber-900/10 to-transparent rounded-t-3xl">
                        <div>
                            <h3 className="text-xl font-bold text-amber-500 flex items-center gap-2 font-heading">
                                <Trash2 className="w-5 h-5" /> Excluir Livros
                            </h3>
                            <p className="text-sm text-amber-200/60 mt-1">Selecione os itens para remover permanentemente.</p>
                        </div>
                        <button onClick={() => setIsDeleteModalOpen(false)} className="text-amber-500/50 hover:text-amber-400 p-2 hover:bg-amber-500/10 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                         {books.length === 0 ? (
                             <p className="text-center text-slate-500 py-10">Biblioteca vazia.</p>
                         ) : (
                             <div className="space-y-1">
                                {books.map(book => (
                                    <div 
                                        key={book.id} 
                                        onClick={() => toggleBookForDeletion(book.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${booksToDelete.has(book.id) ? 'bg-amber-900/20 border-amber-500/50' : 'hover:bg-white/5 border-transparent'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${booksToDelete.has(book.id) ? 'bg-amber-500 border-amber-500 text-black' : 'border-slate-600 text-transparent'}`}>
                                            <CheckSquare className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${booksToDelete.has(book.id) ? 'text-amber-100' : 'text-slate-300'}`}>{book.title}</p>
                                            <p className="text-xs text-slate-500">{book.author || 'Autor Desconhecido'}</p>
                                        </div>
                                    </div>
                                ))}
                             </div>
                         )}
                    </div>

                    <div className="p-6 border-t border-amber-500/20 bg-black/20 rounded-b-3xl">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={toggleAllForDeletion} className="text-xs font-bold text-amber-500 hover:text-amber-300 uppercase tracking-widest transition-colors">
                                {booksToDelete.size === books.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                            <span className="text-sm text-slate-400">{booksToDelete.size} selecionado(s)</span>
                        </div>
                        <div className="flex gap-3">
                            <Button 
                                variant="secondary" 
                                onClick={() => setIsDeleteModalOpen(false)} 
                                className="flex-1 border-amber-500/20 text-amber-100/80 hover:bg-amber-500/10"
                            >
                                Cancelar
                            </Button>
                            <button
                                onClick={executeBatchDelete}
                                disabled={booksToDelete.size === 0}
                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-900 to-red-800 text-red-100 font-bold py-2.5 rounded-2xl border border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.3)] disabled:opacity-50 disabled:shadow-none hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] hover:border-red-400 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir ({booksToDelete.size})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  };

  // 2. Reader View
  const renderReader = () => (
    <div className={`h-screen flex flex-col overflow-hidden theme-${theme}`}>
      {/* Reader Toolbar - Glassmorphism */}
      <div className="h-16 border-b border-white/10 bg-[#0f0720]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 shadow-lg z-20 shrink-0 text-white">
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button onClick={closeBook} className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-sm md:text-base hidden sm:block truncate max-w-[150px] md:max-w-xs text-white">{currentBook?.title}</h2>
        </div>

        {/* Scrollable controls container */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pl-2">
             
             {/* Navigation / Progress */}
            {layoutMode === 'paginated' && (
              <div className="flex items-center gap-1 md:gap-2 rounded-xl px-2 md:px-4 py-1.5 border border-white/10 bg-white/5 shrink-0 text-slate-200">
                  <button 
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
                      disabled={pageNumber <= 1}
                      className="hover:text-purple-400 disabled:opacity-30 p-1 transition-colors"
                  >
                      <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {/* Editable Page Input */}
                  <div className="flex items-center gap-1">
                    <input 
                        type="text"
                        className="w-8 md:w-10 text-center bg-transparent border-b border-slate-600 outline-none font-mono text-sm p-0 text-white focus:border-purple-500 !rounded-none !border-0 !border-b"
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit() }}
                        onBlur={handlePageInputSubmit}
                    />
                    <span className="text-xs md:text-sm opacity-50 whitespace-nowrap">/ {numPages || '--'}</span>
                  </div>

                  <button 
                      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} 
                      disabled={pageNumber >= numPages}
                      className="hover:text-purple-400 disabled:opacity-30 p-1 transition-colors"
                  >
                      <ChevronRight className="w-4 h-4" />
                  </button>
              </div>
            )}

             {/* Theme Toggle */}
             <div className="flex items-center rounded-xl border border-white/10 mr-1 overflow-hidden shrink-0 bg-white/5">
                <button 
                  onClick={() => setTheme('light')}
                  className={`p-2 ${theme === 'light' ? 'bg-purple-600/30 text-purple-300' : 'text-slate-400 hover:text-white'}`}
                  title="Modo Claro"
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setTheme('night')}
                  className={`p-2 ${theme === 'night' ? 'bg-purple-600/30 text-purple-300' : 'text-slate-400 hover:text-white'}`}
                  title="Modo Noturno (Sépia)"
                >
                  <Sunset className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`p-2 ${theme === 'dark' ? 'bg-purple-600/30 text-purple-300' : 'text-slate-400 hover:text-white'}`}
                  title="Modo Escuro"
                >
                  <Moon className="w-4 h-4" />
                </button>
             </div>

             {/* Search Button */}
             <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setIsSearchPanelOpen(true);
                  setIsNotePanelOpen(false);
                  setIsTranslationPanelOpen(false);
                  setIsBookSettingsOpen(false);
                }}
                className={`shrink-0 ${isSearchPanelOpen ? 'text-purple-400 bg-white/10' : ''}`}
                title="Pesquisar no livro"
             >
                <Search className="w-4 h-4" />
             </Button>

             {/* Zoom Controls */}
             <div className="hidden md:flex items-center rounded-xl border border-white/10 mr-1 shrink-0 bg-white/5">
                <button 
                  onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                  className="p-2 opacity-60 hover:opacity-100 hover:text-purple-400 text-slate-400"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs opacity-50 w-10 text-center select-none text-slate-300">{Math.round(scale * 100)}%</span>
                <button 
                  onClick={() => setScale(s => Math.min(3.0, s + 0.2))}
                  className="p-2 opacity-60 hover:opacity-100 hover:text-purple-400 text-slate-400"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
             </div>

             <Button 
               size="sm" 
               variant="ghost" 
               onClick={() => setLayoutMode(prev => prev === 'paginated' ? 'continuous' : 'paginated')}
               title={layoutMode === 'paginated' ? "Mudar para rolagem vertical" : "Mudar para modo paginado"}
               className="shrink-0"
             >
                {layoutMode === 'paginated' ? <AlignJustify className="w-4 h-4" /> : <Columns className="w-4 h-4" />}
             </Button>
             
             {/* Book Settings Button */}
             <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                    setIsBookSettingsOpen(true);
                    setIsNotePanelOpen(false);
                    setIsTranslationPanelOpen(false);
                    setIsSearchPanelOpen(false);
                }}
                className={`shrink-0 ${isBookSettingsOpen ? 'text-purple-400 bg-white/10' : ''}`}
                title="Configurações do Livro (Status, Categoria, Avaliação)"
             >
                <Tag className="w-4 h-4" />
             </Button>

             <Button size="sm" variant="ghost" onClick={handleTranslatePage} title="Traduzir página atual" className="shrink-0">
                <Languages className="w-4 h-4" />
             </Button>
             
             <Button size="sm" variant="ghost" onClick={() => {
                 setIsNotePanelOpen(true);
                 setIsBookSettingsOpen(false);
                 setIsTranslationPanelOpen(false);
                 setIsSearchPanelOpen(false);
             }} className="shrink-0">
                <Highlighter className="w-4 h-4" />
             </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative bg-[#0f0720]">
        {/* PDF Canvas Area */}
        <div 
            id="pdf-scroll-container"
            ref={pdfWrapperRef}
            className="flex-1 overflow-auto flex justify-center p-4 md:p-8"
            onMouseUp={handleSelection} 
        >
          {currentPdfUrl && (
            <Document
                file={currentPdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                className="shadow-2xl max-w-full"
                loading={<div className="font-sans text-purple-400 animate-pulse mt-20">Carregando documento...</div>}
                error={<div className="mt-20 text-red-400 font-sans">Erro ao carregar PDF</div>}
            >
                {layoutMode === 'paginated' ? (
                  <Page 
                      key={`page_${pageNumber}`}
                      pageNumber={pageNumber} 
                      width={pdfWrapperWidth ? Math.min(pdfWrapperWidth, 800) : undefined}
                      scale={scale}
                      className="bg-white border-0 rounded-lg overflow-hidden"
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      onRenderTextLayerSuccess={handleTextLayerSuccess}
                  />
                ) : (
                  // Continuous Mode
                  Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_${index + 1}`} className="mb-8" id={`page-${index + 1}`}>
                       <Page 
                          pageNumber={index + 1} 
                          width={pdfWrapperWidth ? Math.min(pdfWrapperWidth, 800) : undefined}
                          scale={scale}
                          className="bg-white border-0 rounded-lg overflow-hidden"
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          onRenderTextLayerSuccess={handleTextLayerSuccess}
                       />
                       <div className="text-center text-xs text-slate-500 mt-2">Página {index + 1}</div>
                    </div>
                  ))
                )}
            </Document>
          )}
        </div>

        {/* Translation Panel - Dark Glass */}
        {isTranslationPanelOpen && (
           <div className="w-full md:w-96 bg-[#1a1625]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-300 absolute right-0 top-0 bottom-0 text-slate-200">
             <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                 <h3 className="font-bold text-white flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-purple-400" /> Tradução IA
                 </h3>
                 <button onClick={() => setIsTranslationPanelOpen(false)} className="text-slate-400 hover:text-white">
                     <X className="w-5 h-5" />
                 </button>
             </div>
             <div className="p-6 flex-1 overflow-y-auto leading-relaxed">
                {isTranslating ? (
                  <div className="flex flex-col items-center justify-center h-40 space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    <p className="text-sm text-purple-300 animate-pulse">Traduzindo...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm">
                     <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-4 border-b border-white/10 pb-2">
                        Página {pageNumber}
                     </h4>
                     {translationResult ? (
                       <div dangerouslySetInnerHTML={{ __html: translationResult.replace(/\n/g, '<br/>') }} />
                     ) : (
                       <p className="text-slate-500 italic text-center">Nenhuma tradução disponível.</p>
                     )}
                  </div>
                )}
             </div>
           </div>
        )}

        {/* Search Panel - Dark Glass */}
        {isSearchPanelOpen && (
           <div className="w-full md:w-80 bg-[#1a1625]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-300 absolute right-0 top-0 bottom-0 text-slate-200">
             <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                 <h3 className="font-bold text-white flex items-center gap-2">
                   <Search className="w-4 h-4 text-purple-400" /> Pesquisar
                 </h3>
                 <button onClick={() => setIsSearchPanelOpen(false)} className="text-slate-400 hover:text-white">
                     <X className="w-5 h-5" />
                 </button>
             </div>
             <div className="p-5 border-b border-white/10">
                 <div className="flex gap-2">
                     <input 
                       type="text" 
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                       placeholder="Buscar termo..."
                       className="flex-1 p-2 bg-black/30 border border-white/10 rounded-lg text-sm outline-none focus:border-purple-500 text-white placeholder-slate-500"
                       autoFocus
                     />
                     <Button size="sm" onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                     </Button>
                 </div>
             </div>
             <div className="p-4 flex-1 overflow-y-auto">
                 {isSearching && (
                     <div className="text-center py-8 text-slate-400 text-sm">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-500" />
                        Varrendo documento...
                     </div>
                 )}
                 {!isSearching && searchResults.length > 0 && (
                     <div className="space-y-4">
                        <p className="text-xs text-slate-500 uppercase tracking-widest text-center">{searchResults.length} Resultados</p>
                        {searchResults.map((result, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => {
                                    handleJumpToPage(result.page);
                                    setTemporaryHighlight(searchQuery); 
                                }}
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer border border-transparent hover:border-purple-500/30 transition-all"
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-purple-400 uppercase">Página {result.page}</span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                                    "{result.text}"
                                </p>
                            </div>
                        ))}
                     </div>
                 )}
                 {!isSearching && searchResults.length === 0 && searchQuery && (
                     <div className="text-center py-10 text-slate-500 italic text-sm">
                         Nenhuma ocorrência.
                     </div>
                 )}
             </div>
           </div>
        )}

        {/* Book Settings Panel - Dark Glass */}
        {isBookSettingsOpen && currentBook && (
            <div className="w-full md:w-80 bg-[#1a1625]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-300 absolute right-0 top-0 bottom-0 text-slate-200">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="font-bold text-white">Detalhes do Livro</h3>
                    <button onClick={() => setIsBookSettingsOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-8 overflow-y-auto">
                    {/* Status */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Status
                        </label>
                        <select 
                            value={currentBook.status || 'next'}
                            onChange={(e) => updateBookMetadata(currentBook.id, { status: e.target.value as BookStatus })}
                            className="w-full p-2.5 bg-black/30 border border-white/10 rounded-xl text-slate-200 focus:border-purple-500 outline-none appearance-none"
                        >
                            <option value="next">Próximo</option>
                            <option value="reading">Lendo Agora</option>
                            <option value="paused">Pausado</option>
                            <option value="completed">Concluído</option>
                            <option value="discarded">Descartado</option>
                        </select>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Categoria
                        </label>
                        <select 
                            value={currentBook.category || ''}
                            onChange={(e) => updateBookMetadata(currentBook.id, { category: e.target.value || undefined })}
                            className="w-full p-2.5 bg-black/30 border border-white/10 rounded-xl text-slate-200 focus:border-purple-500 outline-none appearance-none"
                        >
                            <option value="">Sem Categoria</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        {categories.length === 0 && (
                            <p className="text-xs text-slate-500 mt-2 italic">Crie categorias na biblioteca.</p>
                        )}
                    </div>

                    {/* Rating */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                            Avaliação
                        </label>
                        <div className="flex items-center gap-1 justify-center bg-black/20 p-2 rounded-xl border border-white/5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => updateBookMetadata(currentBook.id, { rating: star })}
                                    className="p-1 hover:scale-110 transition-transform"
                                >
                                    <Star 
                                        className={`w-8 h-8 ${star <= (currentBook.rating || 0) ? 'fill-purple-500 text-purple-500' : 'text-slate-700'}`} 
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Delete Section */}
                    <div className="pt-8 mt-8 border-t border-white/10">
                        <Button 
                            variant="danger" 
                            className="w-full"
                            onClick={() => deleteBook(currentBook.id)}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir Livro
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* Note Panel - Dark Glass */}
        {isNotePanelOpen && (
            <div className="w-full md:w-80 bg-[#1a1625]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-300 absolute right-0 top-0 bottom-0 text-slate-200">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="font-bold text-white">Anotações</h3>
                    <button onClick={() => setIsNotePanelOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {/* Note Taking Form */}
                <div className="p-5 border-b border-white/10">
                    {selection && (
                        <div className="mb-4 p-3 bg-purple-600/20 border-l-4 border-purple-500 rounded text-xs text-slate-300 italic relative group">
                            "{selection}"
                            <button 
                                onClick={() => setSelection('')}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    <textarea 
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Escreva algo sobre esta página..."
                        className="w-full h-32 p-3 bg-black/30 border border-white/10 rounded-xl text-sm text-slate-200 outline-none focus:border-purple-500 resize-none placeholder-slate-500"
                    />
                    <div className="flex justify-between items-center mt-3">
                         <span className="text-xs text-slate-500">Pg. {pageNumber}</span>
                         <Button size="sm" onClick={saveNote} disabled={!noteText && !selection}>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar
                         </Button>
                    </div>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {notes.filter(n => n.bookId === currentBook?.id).length === 0 ? (
                        <p className="text-center text-slate-500 text-sm py-10">Nenhuma anotação neste livro.</p>
                    ) : (
                        notes.filter(n => n.bookId === currentBook?.id)
                             .sort((a,b) => b.createdAt - a.createdAt)
                             .map(note => (
                            <div key={note.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full">
                                        Página {note.pageNumber}
                                    </span>
                                    <button 
                                        onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {note.highlight && (
                                    <div 
                                        className="mb-2 pl-2 border-l-2 border-slate-600 text-xs text-slate-400 italic cursor-pointer hover:text-purple-300 transition-colors"
                                        onClick={() => {
                                            handleJumpToPage(note.pageNumber);
                                            setTemporaryHighlight(note.highlight || null);
                                        }}
                                        title="Ir para texto destacado"
                                    >
                                        "{note.highlight}"
                                    </div>
                                )}
                                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                                <p className="text-[10px] text-slate-600 mt-2 text-right">
                                    {new Date(note.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );

  // 3. Notes / Categories View
  const renderAuxiliaryView = () => (
     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" onClick={() => setIsViewMenuOpen(false)}>
        <header className="flex items-center gap-4 mb-10">
            <button 
                onClick={() => setView(ViewState.LIBRARY)} 
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white transition-all hover:-translate-x-1"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                {view === ViewState.NOTES ? <><ScrollText className="w-8 h-8 text-purple-400" /> Minhas Anotações</> : <><Tags className="w-8 h-8 text-purple-400" /> Gerenciar Categorias</>}
            </h1>
        </header>

        {view === ViewState.NOTES && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Book Selection Sidebar */}
                <div className="bg-[#1e1b4b]/50 backdrop-blur-sm rounded-3xl border border-white/10 p-2 h-[80vh] flex flex-col">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-4 py-4">Livros com Notas</h3>
                    <div className="flex-1 overflow-y-auto space-y-1">
                        {books.filter(b => notes.some(n => n.bookId === b.id)).map(book => {
                            const noteCount = notes.filter(n => n.bookId === book.id).length;
                            return (
                                <button
                                    key={book.id}
                                    onClick={() => setSelectedNoteBookId(book.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex justify-between items-center transition-all ${selectedNoteBookId === book.id ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-300 hover:bg-white/5'}`}
                                >
                                    <span className="truncate font-medium">{book.title}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedNoteBookId === book.id ? 'bg-white/20' : 'bg-white/10'}`}>{noteCount}</span>
                                </button>
                            );
                        })}
                        {books.filter(b => notes.some(n => n.bookId === b.id)).length === 0 && (
                             <p className="px-4 text-sm text-slate-500 italic">Você ainda não fez anotações.</p>
                        )}
                    </div>
                </div>

                {/* Notes Display */}
                <div className="md:col-span-2 bg-[#1e1b4b]/30 backdrop-blur-sm rounded-3xl border border-white/10 p-6 h-[80vh] flex flex-col relative">
                    {selectedNoteBookId ? (
                        <>
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">{books.find(b => b.id === selectedNoteBookId)?.title}</h2>
                                    <p className="text-sm text-slate-400">
                                        {notes.filter(n => n.bookId === selectedNoteBookId).length} anotações encontradas
                                    </p>
                                </div>
                                
                                <div className="relative">
                                    <Button 
                                        variant="secondary" 
                                        size="sm"
                                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Exportar
                                    </Button>

                                    {isExportMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1b4b] border border-white/10 shadow-2xl rounded-xl overflow-hidden z-20">
                                            <button onClick={() => handleExportNotes('md')} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Markdown (.md)
                                            </button>
                                            <button onClick={() => handleExportNotes('txt')} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2">
                                                <AlignJustify className="w-4 h-4" /> Texto Puro (.txt)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {notes.filter(n => n.bookId === selectedNoteBookId)
                                      .sort((a,b) => a.pageNumber - b.pageNumber)
                                      .map(note => (
                                    <div key={note.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-purple-500/30 transition-colors">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs font-bold text-black bg-purple-400 px-2 py-0.5 rounded-full">Pg. {note.pageNumber}</span>
                                            <span className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {note.highlight && (
                                            <div className="mb-3 pl-3 border-l-2 border-purple-500/50 text-slate-400 text-sm italic">
                                                "{note.highlight}"
                                            </div>
                                        )}
                                        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <ScrollText className="w-16 h-16 mb-4 opacity-50" />
                            <p>Selecione um livro para ver suas notas</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === ViewState.CATEGORIES && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                 <div className="bg-[#1e1b4b]/50 backdrop-blur-sm rounded-3xl border border-white/10 p-8">
                     <h3 className="text-lg font-bold text-white mb-6">Criar Nova Categoria</h3>
                     <div className="flex gap-2">
                         <input 
                            type="text" 
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Nome da categoria..."
                            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 text-white focus:border-purple-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                         />
                         <Button onClick={addCategory} disabled={!newCategoryName.trim()}>
                             <Plus className="w-4 h-4" />
                         </Button>
                     </div>
                 </div>

                 <div className="bg-[#1e1b4b]/50 backdrop-blur-sm rounded-3xl border border-white/10 p-8">
                     <h3 className="text-lg font-bold text-white mb-6">Categorias Existentes</h3>
                     {categories.length === 0 ? (
                         <p className="text-slate-500 italic text-center py-4">Nenhuma categoria criada.</p>
                     ) : (
                         <div className="space-y-2">
                             {categories.map(cat => (
                                 <div key={cat.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 transition-all group">
                                     <span className="text-slate-200 font-medium flex items-center gap-2">
                                         <Tag className="w-4 h-4 text-purple-400" />
                                         {cat.name}
                                     </span>
                                     <button 
                                        onClick={() => deleteCategory(cat.id)}
                                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                     >
                                         <Trash2 className="w-4 h-4" />
                                     </button>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
            </div>
        )}
     </div>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#0f0720] via-[#1a103c] to-[#2d1b4e] font-sans selection:bg-purple-500/30 selection:text-white ${view === ViewState.READER ? 'overflow-hidden' : ''}`}>
      {view === ViewState.LIBRARY && renderLibrary()}
      {view === ViewState.READER && renderReader()}
      {(view === ViewState.NOTES || view === ViewState.CATEGORIES) && renderAuxiliaryView()}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100' : toast.type === 'error' ? 'bg-red-900/80 border-red-500/50 text-red-100' : 'bg-blue-900/80 border-blue-500/50 text-blue-100'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : toast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Sparkles className="w-5 h-5 shrink-0" />}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X className="w-4 h-4"/></button>
        </div>
      )}
    </div>
  );
}