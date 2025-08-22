"use client";

import { useState } from "react";
import { pdfStorage } from "../lib/pdf-storage";
import { PDFUtils } from "../lib/pdf-utils";
import { BookUpload } from "../types/book";

type Props = {
    onAdd: (book: any) => void;
};

// naive page split: ~1800 characters per page
const CHARS_PER_PAGE = 1800;

function splitIntoPages(text: string) {
    const pages: string[] = [];
    for (let i = 0; i < text.length; i += CHARS_PER_PAGE) {
        pages.push(text.slice(i, i + CHARS_PER_PAGE));
    }
    return pages;
}

export default function UploadForm({ onAdd }: Props) {
    const [title, setTitle] = useState("");
    const [pastedText, setPastedText] = useState("");
    const [processedUpload, setProcessedUpload] = useState<BookUpload | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
    const [manualPageCount, setManualPageCount] = useState<number | undefined>(undefined);
    const [showManualPageInput, setShowManualPageInput] = useState(false);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const input = e.currentTarget;
        const file = input.files?.[0];
        if (!file) return;

        setLoading(true);
        setLoadingMessage("Processing file...");

        try {
            if (file.type === "text/plain" || file.name.endsWith('.txt')) {
                setLoadingMessage("Processing text file...");
                const text = await file.text();
                setPastedText(text);

                const pageChunks = splitIntoPages(text.trim());
                const upload: BookUpload = {
                    id: crypto.randomUUID(),
                    filename: file.name,
                    type: 'text',
                    pageCount: pageChunks.length,
                    pages: pageChunks,
                    text: text,
                    uploadedAt: new Date()
                };
                setProcessedUpload(upload);

            } else if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
                setLoadingMessage("Validating PDF...");

                // Validate PDF
                const isValidPDF = await PDFUtils.validatePDF(file);
                if (!isValidPDF) {
                    throw new Error('Invalid PDF file. Please select a valid PDF document.');
                }

                setLoadingMessage("Extracting PDF information...");

                // Extract page count and metadata using PDF.js
                const pdfInfo = await PDFUtils.getPDFInfo(file);

                // If automatic detection gives a suspicious result for large files, show manual input
                if (pdfInfo.pageCount === 1 && file.size > 1000000) {
                    setShowManualPageInput(true);
                    setManualPageCount(undefined);
                }

                setLoadingMessage("Extracting PDF page text (may take a moment)...");

                // Extract text for all pages but cap at e.g. first 800 pages for performance; adjust as needed
                let pageTexts: string[] = [];
                try {
                    pageTexts = await PDFUtils.extractAllPageTexts(file, {
                        maxPages: pdfInfo.pageCount, // attempt all pages
                        onProgress: (current, total) => {
                            if (current % 25 === 0) {
                                setLoadingMessage(`Extracting text: page ${current}/${total}...`);
                            }
                        }
                    });
                } catch (textErr) {
                    console.warn('PDF text extraction failed, continuing without page texts.', textErr);
                }

                setLoadingMessage("Storing PDF...");

                // Store PDF in IndexedDB
                const uploadId = crypto.randomUUID();
                await pdfStorage.storePDF(uploadId, file.name, file);

                const upload: BookUpload = {
                    id: uploadId,
                    filename: file.name,
                    type: 'pdf',
                    pageCount: pdfInfo.pageCount,
                    indexedDBKey: uploadId,
                    // Store page texts only if we successfully extracted
                    pages: pageTexts.length ? pageTexts : undefined,
                    uploadedAt: new Date()
                };
                setProcessedUpload(upload);

                // Update pasted text to show PDF info
                setPastedText(`PDF: ${file.name}\nAuto-detected pages: ${pdfInfo.pageCount}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB${pdfInfo.title ? `\nTitle: ${pdfInfo.title}` : ''}${pdfInfo.author ? `\nAuthor: ${pdfInfo.author}` : ''}`);

            } else {
                throw new Error('Unsupported file type. Please upload a .txt or .pdf file.');
            }
        } catch (error) {
            console.error('File processing error:', error);
            alert(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setProcessedUpload(null);
        } finally {
            setLoading(false);
            setLoadingMessage("");
            // Clear input
            try { input.value = ''; } catch (_) { /* ignore */ }
        }
    }

    function handleAdd() {
        if (!title) return alert('Please add a title');

        // Calculate total pages from processed upload or pasted text
        let pages = 300; // default
        const uploads: BookUpload[] = [];

        if (processedUpload) {
            // Use manual page count if provided, otherwise use processed upload
            const finalPageCount = manualPageCount || processedUpload.pageCount;

            const updatedUpload: BookUpload = {
                ...processedUpload,
                pageCount: finalPageCount
            };

            pages = finalPageCount;
            uploads.push(updatedUpload);
        } else if (pastedText && pastedText.trim().length > 0) {
            // Create upload from pasted text
            const pageChunks = splitIntoPages(pastedText.trim());
            const textUpload: BookUpload = {
                id: crypto.randomUUID(),
                filename: 'Pasted Text',
                type: 'text',
                pageCount: pageChunks.length,
                pages: pageChunks,
                text: pastedText,
                uploadedAt: new Date()
            };
            pages = pageChunks.length;
            uploads.push(textUpload);
        }

        const book = {
            id: crypto.randomUUID(),
            title,
            pages,
            cover: coverDataUrl,
            sections: {
                characters: [],
                chapters: [],
                locations: [],
                notes: "",
            },
            uploads,
            window: { start: 1, end: Math.min(50, pages) },
            createdAt: Date.now(),
        };

        onAdd(book);

        // Reset form
        setTitle("");
        setPastedText("");
        setProcessedUpload(null);
        setCoverDataUrl(null);
        setManualPageCount(undefined);
        setShowManualPageInput(false);
    }

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-emerald-900 mb-2">Book Title *</label>
                        <input
                            className="w-full border border-emerald-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter the book title..."
                        />
                    </div>

                    {/* Show upload info if we have a processed upload */}
                    {processedUpload && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">
                                    {processedUpload.type === 'pdf' ? '📄' : '📝'}
                                </span>
                                <span className="font-medium text-emerald-800">
                                    {processedUpload.filename}
                                </span>
                            </div>
                            <div className="text-sm text-emerald-600">
                                <span className="font-medium">
                                    {manualPageCount || processedUpload.pageCount} pages
                                </span>
                                <span className="mx-2">•</span>
                                <span className="capitalize">{processedUpload.type} document</span>
                                {processedUpload.pageCount === 1 && processedUpload.type === 'pdf' && (
                                    <span className="mx-2 text-amber-600">• Auto-detection may be inaccurate</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manual page count input for PDFs with suspicious auto-detection */}
                    {showManualPageInput && processedUpload?.type === 'pdf' && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <label className="block text-sm font-medium text-amber-900 mb-2">
                                Correct the page count (optional)
                            </label>
                            <input
                                type="number"
                                min="1"
                                className="w-full border border-amber-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                value={manualPageCount ?? ''}
                                onChange={(e) => setManualPageCount(e.target.value ? Number(e.target.value) : undefined)}
                                placeholder={`Auto-detected: ${processedUpload.pageCount} pages`}
                            />
                            <p className="text-xs text-amber-600 mt-1">
                                💡 If the auto-detected page count (1 page) seems wrong for your PDF, enter the correct number here.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-emerald-900 mb-2">Book Cover (optional)</label>
                        <div className="flex items-center gap-4">
                            {coverDataUrl && (
                                <img src={coverDataUrl} alt="Cover preview" className="w-16 h-20 object-cover rounded-lg border border-emerald-200" />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                    const f = e.currentTarget.files?.[0];
                                    if (!f) return;
                                    const reader = new FileReader();
                                    reader.onload = () => setCoverDataUrl(String(reader.result));
                                    reader.readAsDataURL(f);
                                }}
                                className="flex-1 text-sm text-emerald-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Content Upload */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-emerald-900 mb-2">Upload File</label>
                        <div className="border-2 border-dashed border-emerald-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                            <div className="text-3xl mb-2">📄</div>
                            <p className="text-sm text-emerald-700 mb-3">Upload a .txt or .pdf file</p>
                            <input
                                type="file"
                                accept=".txt,.pdf,text/plain,application/pdf"
                                onChange={handleFile}
                                className="text-sm text-emerald-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 transition-all"
                            />
                        </div>
                    </div>

                    <div className="text-center text-emerald-600 font-medium">— OR —</div>

                    <div>
                        <label className="block text-sm font-medium text-emerald-900 mb-2">Paste Text</label>
                        <textarea
                            className="w-full border border-emerald-300 rounded-lg px-4 py-3 h-32 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Paste the book text or a large excerpt here..."
                        />
                    </div>
                </div>
            </div>

            {/* Status and Actions */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-3">
                    {loading && (
                        <>
                            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-emerald-700 font-medium">
                                {loadingMessage || "Processing file..."}
                            </span>
                        </>
                    )}
                    {processedUpload && !loading && (
                        <span className="text-sm text-emerald-700">
                            ✅ Ready to add: {manualPageCount || processedUpload.pageCount} pages from {processedUpload.filename}
                        </span>
                    )}
                    {pastedText && !processedUpload && !loading && (
                        <span className="text-sm text-emerald-700">
                            ✅ Ready to add: {splitIntoPages(pastedText.trim()).length} pages from pasted text
                        </span>
                    )}
                </div>

                <button
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                    onClick={handleAdd}
                    disabled={loading || !title}
                >
                    <span>📚</span>
                    Add Book
                </button>
            </div>
        </div>
    );
}
