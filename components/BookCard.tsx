import React, { useState, useEffect } from 'react';
import { Book } from '../types';
import { BookOpen, Star } from 'lucide-react';
import { Document, Page } from 'react-pdf';

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
  onDelete: (id: string) => void;
  fileData?: ArrayBuffer;
  scale?: number;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onOpen, onDelete, fileData, scale = 1 }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Convert ArrayBuffer to Blob URL for reliable PDF loading
  useEffect(() => {
    if (fileData) {
      try {
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Error creating blob URL", e);
      }
    } else {
      setPdfUrl(null);
    }
  }, [fileData]);

  // Calculate progress percentage
  const progress = book.totalPages > 0 ? Math.min(100, (book.currentPage / book.totalPages) * 100) : 0;

  // Render Stars
  const renderStars = () => {
    if (!book.rating) return null;
    return (
      <div className="flex gap-0.5 justify-center mt-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`w-3 h-3 ${star <= (book.rating || 0) ? 'fill-purple-400 text-purple-400' : 'text-slate-700'}`} 
          />
        ))}
      </div>
    );
  };

  // Base dimensions - Width scales, Height is auto
  const baseWidth = 200; 
  const currentWidth = baseWidth * scale;
  const coverWidth = 128 * scale;
  const coverHeight = 192 * scale;

  return (
    <div 
      className="group relative mx-auto select-none hover:z-50"
      style={{ width: `${currentWidth}px`, maxWidth: '100%' }}
    >
      {/* Main Card Content - Glassmorphism */}
      <div 
        className="bg-white/5 backdrop-blur-md p-4 border border-white/10 transition-all duration-300 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)] flex flex-col items-center rounded-3xl cursor-pointer z-10 relative"
        onClick={() => onOpen(book)}
      >
        {/* Visual Cover Representation */}
        <div 
          className="bg-black/40 mb-3 relative overflow-hidden border border-white/5 shadow-lg flex items-center justify-center shrink-0 group-hover:-translate-y-1 transition-transform duration-300 rounded-2xl"
          style={{ width: `${coverWidth}px`, height: `${coverHeight}px` }}
        >
          {pdfUrl ? (
             <div className="w-full h-full opacity-90 hover:opacity-100 transition-opacity flex items-center justify-center">
               <Document 
                  file={pdfUrl} 
                  loading={<div className="w-full h-full flex items-center justify-center text-xs text-slate-500">...</div>}
                  error={<div className="flex items-center justify-center h-full text-[10px] text-red-400 text-center p-1">Error</div>}
                  className="flex items-center justify-center w-full h-full"
               >
                  <Page 
                      pageNumber={1} 
                      height={coverHeight} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false}
                  />
               </Document>
             </div>
          ) : (
              <div className="text-center p-2 opacity-50">
                  <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-1" />
              </div>
          )}
          
          {/* Spine Glow */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <BookOpen className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </div>
        </div>

        {/* Details */}
        <div className="w-full relative z-10 px-1 flex flex-col items-center gap-2">
          <div className="w-full text-center">
              {/* Title */}
              <h3 
                  className="font-sans font-semibold text-slate-200 text-xs mb-1 w-full leading-tight line-clamp-2 group-hover:text-white transition-colors" 
                  title={book.title}
              >
              {book.title}
              </h3>
              
              {/* Rating */}
              {renderStars()}
          </div>
          
          <div className="w-full mt-1">
              {/* Progress Bar - Neon */}
              <div className="flex flex-col gap-1 w-full px-2">
                  <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                      <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          style={{ width: `${progress}%` }}
                      ></div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium text-center">
                      {book.currentPage} <span className="text-slate-600">/</span> {book.totalPages > 0 ? book.totalPages : '?'}
                  </p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};