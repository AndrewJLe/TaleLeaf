"use client";

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Simple worker configuration - try multiple CDN sources
const workerSources = [
  '/pdf.worker.min.js', // Local (if we copy it)
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.js',
  'https://mozilla.github.io/pdf.js/build/pdf.worker.js',
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`
];

// Try first available worker
pdfjs.GlobalWorkerOptions.workerSrc = workerSources[1]; // Start with cdnjs

interface PDFViewerTestProps {
  base64Data: string;
}

export default function PDFViewerTest({ base64Data }: PDFViewerTestProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  console.log('PDFViewerTest: Received base64 data length:', base64Data.length);
  console.log('PDFViewerTest: First 100 chars:', base64Data.substring(0, 100));

  const dataUrl = `data:application/pdf;base64,${base64Data}`;
  console.log('PDFViewerTest: Data URL length:', dataUrl.length);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    console.log('PDFViewerTest: SUCCESS - Document loaded with pages:', numPages);
    setNumPages(numPages);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDFViewerTest: ERROR - Failed to load PDF:', error);
    setError(error.message);
  }

  return (
    <div className="border-2 border-red-500 p-4 m-4">
      <h3 className="text-lg font-bold mb-2">PDF Viewer Test</h3>
      <p className="text-sm mb-2">Base64 length: {base64Data.length}</p>
      <p className="text-sm mb-2">Pages loaded: {numPages}</p>
      {error && <p className="text-red-600 text-sm mb-2">Error: {error}</p>}

      <Document
        file={dataUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={<div>Loading test PDF...</div>}
        error={<div>Error loading test PDF</div>}
      >
        {numPages > 0 && (
          <Page
            pageNumber={1}
            width={300}
            loading={<div>Loading page 1...</div>}
            error={<div>Error loading page 1</div>}
          />
        )}
      </Document>
    </div>
  );
}
