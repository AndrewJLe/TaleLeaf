import React, { useState } from 'react';
import { BookUpload } from '../../types/book';
import { BookOpenIcon, FileTextIcon } from './Icons';
import PDFViewer from './PDFViewer';

interface DocumentViewerProps {
    book: {
        uploads?: BookUpload[];
    };
    currentPage?: number;
    onPageChange?: (page: number) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
    book,
    currentPage = 1,
    onPageChange
}) => {
    const [selectedUpload, setSelectedUpload] = useState(0);

    const upload = book.uploads?.[selectedUpload];

    if (!book.uploads || book.uploads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-50">
                <div className="text-6xl mb-4 text-gray-300">
                    <FileTextIcon size={64} strokeWidth={1} />
                </div>
                <h3 className="text-xl font-medium text-gray-700 mb-2">No Document Uploaded</h3>
                <p className="text-sm text-gray-500 text-center max-w-sm">
                    Upload a PDF or paste text content to view it here alongside your book analysis.
                </p>
                <div className="mt-6 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                        <strong>Tip:</strong> Documents appear here automatically when you upload them in the main interface.
                    </p>
                </div>
            </div>
        );
    }

    // Get current page content for text uploads
    const getCurrentPageContent = () => {
        if (!upload || upload.type !== 'text') return '';

        if (upload.pages && upload.pages.length > 0) {
            // Handle paginated text content
            const page = upload.pages[currentPage - 1];
            return page || '';
        }

        // Single content (pasted text)
        return upload.text || '';
    };

    const currentPageContent = getCurrentPageContent();
    const totalPages = upload?.pageCount || 0;

    // Determine document type for display
    const getDocumentTypeDisplay = () => {
        if (!upload) return 'Document';
        return upload.type === 'pdf' ? 'PDF Document' : 'Text Document';
    };

    const getDocumentIcon = () => {
        if (!upload) return <FileTextIcon size={16} className="text-amber-700" />;
        return upload.type === 'pdf'
            ? <span className="text-red-600 text-sm font-bold">PDF</span>
            : <FileTextIcon size={16} className="text-amber-700" />;
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Only show compact header for file selection and page navigation when needed */}
            {(book.uploads.length > 1 || (totalPages > 1 && upload?.type === 'text')) && (
                <div className="flex-shrink-0 px-3 py-1 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        {book.uploads.length > 1 && (
                            <select
                                value={selectedUpload}
                                onChange={(e) => setSelectedUpload(Number(e.target.value))}
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-emerald-400 focus:border-transparent bg-white"
                            >
                                {book.uploads.map((upload, index) => (
                                    <option key={index} value={index}>
                                        {upload.filename}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Compact Page Navigation - only for text content */}
                        {totalPages > 1 && upload?.type === 'text' && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
                                    disabled={currentPage <= 1}
                                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ←
                                </button>
                                <span className="text-xs text-gray-600 mx-1">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    →
                                </button>
                                <input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    value={currentPage}
                                    onChange={(e) => {
                                        const page = parseInt(e.target.value);
                                        if (page >= 1 && page <= totalPages && onPageChange) {
                                            onPageChange(page);
                                        }
                                    }}
                                    className="w-10 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-emerald-400 focus:border-transparent text-center ml-1"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Document Content - Grid container provides full height */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {upload?.type === 'pdf' && upload.indexedDBKey ? (
                    <PDFViewer
                        uploadId={upload.indexedDBKey}
                        currentPage={currentPage}
                        onPageChange={onPageChange}
                        className="h-full"
                    />
                ) : upload?.type === 'text' ? (
                    <div className="h-full overflow-auto">
                        <div className="p-4 h-full">
                            <div className="max-w-none h-full">
                                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800 bg-white h-full">
                                    {currentPageContent || (
                                        <div className="flex items-center justify-center h-full text-gray-500">
                                            <div className="text-center">
                                                <BookOpenIcon size={48} className="mx-auto mb-4 text-gray-300" />
                                                <p>No content available for this page</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-50">
                        <div className="text-6xl mb-4 text-gray-400">
                            ❓
                        </div>
                        <h3 className="text-xl font-medium text-gray-700 mb-2">Unknown Document Type</h3>
                        <p className="text-sm text-gray-500 text-center max-w-sm">
                            This document format is not supported for viewing.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
