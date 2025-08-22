"use client";

import { useEffect, useRef, useState } from 'react';
import { pdfStorage } from '../../lib/pdf-storage';

interface PDFViewerProps {
  uploadId: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export default function PDFViewer({
  uploadId,
  currentPage = 1,
  onPageChange,
  className = ""
}: PDFViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = await pdfStorage.createBlobURL(uploadId);

        if (!mounted) return;

        if (url) {
          setBlobUrl(url);
        } else {
          setError('PDF not found. It may have been removed from storage.');
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load PDF:', err);
        setError('Failed to load PDF. Please try refreshing the page.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      mounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [uploadId]);

  // Update iframe src when page changes
  useEffect(() => {
    if (blobUrl && iframeRef.current) {
      const pageFragment = currentPage > 1 ? `#page=${currentPage}` : '';
      iframeRef.current.src = `${blobUrl}${pageFragment}`;
    }
  }, [blobUrl, currentPage]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 h-full ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 h-full ${className}`}>
        <div className="text-center p-6">
          <div className="text-4xl mb-4 text-red-400">⚠️</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">PDF Loading Error</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full ${className}`}>
      {blobUrl && (
        <>
          <iframe
            ref={iframeRef}
            src={`${blobUrl}#page=${currentPage}`}
            className="w-full h-full border-0"
            title="PDF Document"
            onError={() => setError('Failed to display PDF')}
          />

          {/* Floating action buttons */}
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => window.open(blobUrl, '_blank')}
              className="p-1 bg-black/70 text-white rounded hover:bg-black/90 transition-colors text-xs"
              title="Open in new tab"
            >
              ↗
            </button>
            <a
              href={blobUrl}
              download="document.pdf"
              className="p-1 bg-black/70 text-white rounded hover:bg-black/90 transition-colors text-xs"
              title="Download PDF"
            >
              ⬇
            </a>
          </div>

          {/* Simple prev/next overlay controls */}
          {onPageChange && (
            <div className="absolute left-2 bottom-2 flex gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-1 bg-white/90 text-gray-800 rounded border shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                ← Prev
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                className="px-2 py-1 bg-white/90 text-gray-800 rounded border shadow-sm text-sm"
                title="Next page"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
