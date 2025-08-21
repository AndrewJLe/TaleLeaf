"use client";

import { useState } from "react";

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
    const [estimatedPages, setEstimatedPages] = useState<number | undefined>(undefined);
    const [pastedText, setPastedText] = useState("");
    const [extractedPages, setExtractedPages] = useState<string[] | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const input = e.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
            if (file.type === "text/plain" || file.name.endsWith('.txt')) {
                const text = await file.text();
                setPastedText(text);
                const pageChunks = splitIntoPages(text.trim());
                setExtractedPages(pageChunks);
                setEstimatedPages(Math.max(1, pageChunks.length));
            } else if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
                // parse PDF client-side using pdf.js loaded from CDN
                const arrayBuffer = await file.arrayBuffer();

                async function loadPdfJsFromCdn() {
                    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
                    await new Promise<void>((res, rej) => {
                        const s = document.createElement('script');
                        s.src = 'https://unpkg.com/pdfjs-dist@3.11.349/build/pdf.min.js';
                        s.onload = () => res();
                        s.onerror = () => rej(new Error('Failed to load pdf.js from CDN'));
                        document.head.appendChild(s);
                    });
                    return (window as any).pdfjsLib;
                }

                const pdfjs = await loadPdfJsFromCdn();
                pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.349/build/pdf.worker.min.js';

                const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                const pageChunks: string[] = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const strings = content.items.map((item: any) => item.str || '').join(' ');
                    pageChunks.push(strings);
                }
                setPastedText(pageChunks.join('\n\n'));
                setExtractedPages(pageChunks);
                setEstimatedPages(Math.max(1, pageChunks.length));
            } else {
                // unsupported file type for now
                alert('Unsupported file type. Paste text, upload a .txt, or upload a .pdf file.');
            }
        } finally {
            setLoading(false);
            // clear input using captured reference (avoid React pooled event null)
            try { input.value = ''; } catch (_) { /* ignore */ }
        }
    }

    function handleAdd() {
        if (!title) return alert('Please add a title');

        // prefer pastedText if present; otherwise use estimatedPages from user
        let pages = estimatedPages ?? 300;
        const uploads: any[] = [];
        if (extractedPages && extractedPages.length > 0) {
            pages = extractedPages.length;
            uploads.push({ id: crypto.randomUUID(), type: 'uploaded', pages: extractedPages });
        } else if (pastedText && pastedText.trim().length > 0) {
            const pageChunks = splitIntoPages(pastedText.trim());
            pages = pageChunks.length;
            uploads.push({ id: crypto.randomUUID(), type: 'pasted', text: pastedText, pages: pageChunks });
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
            },
            uploads,
            window: { start: 1, end: Math.min(50, pages) },
            createdAt: Date.now(),
        };
        onAdd(book);
        setTitle("");
        setPastedText("");
        setEstimatedPages(undefined);
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

                    <div>
                        <label className="block text-sm font-medium text-emerald-900 mb-2">Estimated Pages (optional)</label>
                        <input
                            type="number"
                            className="w-full border border-emerald-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            value={estimatedPages ?? ''}
                            onChange={(e) => setEstimatedPages(e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="300"
                        />
                    </div>

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
                            <span className="text-sm text-emerald-700 font-medium">Processing file...</span>
                        </>
                    )}
                    {extractedPages && (
                        <span className="text-sm text-emerald-700">
                            ✅ Extracted {extractedPages.length} pages
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
