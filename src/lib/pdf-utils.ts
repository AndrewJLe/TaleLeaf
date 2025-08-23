/**
 * PDF utilities using PDF.js for reliable page count extraction.
 *
 * Issues addressed:
 * - "No GlobalWorkerOptions.workerSrc specified" warning -> we set disableWorker: true.
 * - Environment lacks Promise.withResolvers (used by pdfjs-dist v4) -> lightweight polyfill added before dynamic import.
 * - Avoids top-level import so that polyfill is applied first and SSR doesn't break.
 */

// We lazy-load pdfjs to (a) apply polyfills first, (b) avoid SSR evaluation errors, (c) cut initial bundle size.
type PDFJSLib = typeof import('pdfjs-dist');

class PDFJSDynamicLoader {
  private static _lib: PDFJSLib | null = null;
  static async load(): Promise<PDFJSLib> {
    if (this._lib) return this._lib;
    if (typeof window === 'undefined') {
      throw new Error('PDF.js can only be loaded in a browser environment');
    }
    // Polyfill Promise.withResolvers if missing (Chrome < 124 / some runtimes)
    if (!(Promise as any).withResolvers) {
      (Promise as any).withResolvers = function withResolversPolyfill<T = unknown>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: any) => void;
        const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
        return { promise, resolve, reject };
      };
    }
    const lib = await import('pdfjs-dist');
    // Try local module worker first (v4 naming: pdf.worker.mjs)
    const TRY_WORKER_PATHS = [
      'pdfjs-dist/build/pdf.worker.mjs',
      'pdfjs-dist/build/pdf.worker.js',
    ];
    let workerSet = false;
    for (const p of TRY_WORKER_PATHS) {
      try {
        (lib as any).GlobalWorkerOptions.workerSrc = new URL(p, import.meta.url).toString();
        workerSet = true;
        break;
      } catch {
        // continue
      }
    }
    if (!workerSet) {
      // Fallback to CDN
      (lib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(lib as any).version}/pdf.worker.min.js`;
    }
    this._lib = lib;
    return lib;
  }
}

export interface PDFInfo {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

export class PDFUtils {
  /**
   * Get page count using PDF.js API directly (most reliable method)
   */
  static async getPageCount(file: File | ArrayBuffer): Promise<number> {
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    console.log('📄 Getting page count via dynamic PDF.js load...');
    try {
      const pdfjsLib = await PDFJSDynamicLoader.load();
      const loadOnce = async () => {
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          disableFontFace: true,
          isEvalSupported: false,
          stopAtErrors: false,
          useWorkerFetch: false,
        });
        const pdfDocument = await loadingTask.promise;
        const pageCount = pdfDocument.numPages;
        pdfDocument.destroy();
        return pageCount;
      };
      try {
        const pc = await loadOnce();
        console.log(`✅ Accurate page count from PDF.js: ${pc}`);
        return pc;
      } catch (firstErr: any) {
        if (firstErr && typeof firstErr.message === 'string' && firstErr.message.includes('GlobalWorkerOptions.workerSrc')) {
          console.warn('WorkerSrc warning encountered, applying CDN fallback and retrying...');
          try {
            (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
            const pc2 = await loadOnce();
            console.log(`✅ Page count after workerSrc retry: ${pc2}`);
            return pc2;
          } catch (retryErr) {
            console.error('Retry after setting workerSrc failed, will fallback to simple method.', retryErr);
            throw retryErr;
          }
        }
        throw firstErr;
      }
    } catch (err) {
      console.error('❌ Page count via PDF.js failed:', err);
      throw err;
    }
  }
  /**
   * Simple PDF page count extraction without worker (fallback)
   */
  static async getPageCountSimple(arrayBuffer: ArrayBuffer): Promise<number> {
    try {
      // Convert to string to search for page count indicators
      const uint8Array = new Uint8Array(arrayBuffer);
      let text = '';

      // Read more of the PDF to find page count hints
      const sampleSize = Math.min(200000, uint8Array.length); // First 200KB
      for (let i = 0; i < sampleSize; i++) {
        const byte = uint8Array[i];
        // Only include printable ASCII to avoid binary noise
        if (byte >= 32 && byte <= 126) {
          text += String.fromCharCode(byte);
        } else if (byte === 10 || byte === 13) {
          text += ' '; // Replace newlines with spaces
        }
      }

      console.log('PDF text sample:', text.substring(0, 1000)); // Debug log

      // Look for common PDF page count patterns (more comprehensive)
      const patterns = [
        /\/Count\s+(\d+)/gi,
        /\/N\s+(\d+)/gi,
        /\/Kids\s*\[\s*(\d+)/gi,
        /\/Type\s*\/Pages.*?\/Count\s+(\d+)/gi,
        /Pages\s+(\d+)/gi,
        /page\s*(\d+)\s*of\s*(\d+)/gi,
      ];

      let maxCount = 1;
      let foundCounts: number[] = [];

      for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
          // Check both capture groups for "page X of Y" pattern
          const count1 = parseInt(match[1]);
          const count2 = match[2] ? parseInt(match[2]) : 0;

          if (count1 > 0 && count1 < 100000) { // Reasonable page count
            foundCounts.push(count1);
            maxCount = Math.max(maxCount, count1);
          }
          if (count2 > 0 && count2 < 100000) {
            foundCounts.push(count2);
            maxCount = Math.max(maxCount, count2);
          }
        }
      }

      console.log('Found page counts:', foundCounts);
      console.log('Selected max count:', maxCount);

      // If we found multiple counts, try to be smarter about selection
      if (foundCounts.length > 0) {
        // Remove outliers and pick the most reasonable count
        const sortedCounts = [...new Set(foundCounts)].sort((a, b) => b - a);
        const topCount = sortedCounts[0];

        // If the top count seems reasonable, use it
        if (topCount > 10) {
          return topCount;
        }
      }

      return Math.max(1, maxCount);
    } catch (error) {
      console.warn('Simple page count extraction failed:', error);
      return 1; // Default to 1 page
    }
  }

  /**
   * Extract page count and metadata from a PDF file using PDF.js API
   */
  static async getPDFInfo(file: File | ArrayBuffer): Promise<PDFInfo> {
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    console.log('🚀 getPDFInfo start');
    let pageCount = 1;
    try {
      pageCount = await this.getPageCount(arrayBuffer);
    } catch (pcErr) {
      console.warn('Page count via PDF.js failed; using fallback simple parser.', pcErr);
      try {
        pageCount = await this.getPageCountSimple(arrayBuffer);
      } catch (simpleErr) {
        console.error('Fallback simple page count also failed, keeping 1.', simpleErr);
        pageCount = 1;
      }
    }

    // Metadata (best-effort, independent of page count)
    let metadata: any = {};
    try {
      const pdfjsLib = await PDFJSDynamicLoader.load();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableFontFace: true,
        isEvalSupported: false,
        stopAtErrors: false,
        useWorkerFetch: false,
      });
      const pdf = await loadingTask.promise;
      try {
        const metadataResult = await pdf.getMetadata();
        metadata = metadataResult.info || {};
      } catch (mErr) {
        console.warn('Metadata extraction failed:', mErr);
      }
      pdf.destroy();
    } catch (metaOuterErr) {
      console.warn('Unable to reload PDF for metadata (continuing):', metaOuterErr);
    }

    return {
      pageCount,
      title: metadata.Title || undefined,
      author: metadata.Author || undefined,
      subject: metadata.Subject || undefined,
      creator: metadata.Creator || undefined,
      producer: metadata.Producer || undefined,
      creationDate: metadata.CreationDate || undefined,
      modificationDate: metadata.ModDate || undefined,
    };
  }

  /**
   * Validate that a file is a PDF
   */
  static async validatePDF(file: File): Promise<boolean> {
    try {
      // Check file extension and MIME type first
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        return false;
      }

      // Try to read the PDF header
      const chunk = file.slice(0, 1024);
      const text = await chunk.text();
      return text.startsWith('%PDF-');
    } catch {
      return false;
    }
  }

  /**
   * Create a blob URL for PDF viewing
   */
  static createPDFBlobURL(file: File | Blob): string {
    return URL.createObjectURL(file);
  }

  /**
   * Revoke a blob URL to free memory
   */
  static revokeBlobURL(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * Extract text for all (or a limited number of) pages in a PDF.
   * Returns an array where index = pageIndex (0-based) and value = text content.
   * For large PDFs you can pass maxPages to limit extraction for performance.
   */
  static async extractAllPageTexts(
    file: File | ArrayBuffer,
    opts: { maxPages?: number; onProgress?: (current: number, total: number) => void } = {}
  ): Promise<string[]> {
    const { maxPages, onProgress } = opts;
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    const texts: string[] = [];
    try {
      const pdfjsLib = await PDFJSDynamicLoader.load();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableFontFace: true,
        isEvalSupported: false,
        stopAtErrors: false,
        useWorkerFetch: false,
      });
      const pdf = await loadingTask.promise;
      const total = pdf.numPages;
      const targetTotal = maxPages ? Math.min(total, maxPages) : total;
      for (let i = 1; i <= targetTotal; i++) {
        try {
          const page = await pdf.getPage(i);
          // getTextContent returns an object with items containing strings.
          const content = await page.getTextContent();
          const pageText = content.items
            .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
            .join(' ') // join with space to avoid word collisions
            .replace(/\s+/g, ' ') // normalize whitespace
            .trim();
          texts[i - 1] = pageText;
        } catch (pageErr) {
          console.warn(`Failed to extract page ${i}:`, pageErr);
          texts[i - 1] = '';
        }
        if (onProgress) onProgress(i, targetTotal);
      }
      pdf.destroy();
      return texts;
    } catch (err) {
      console.error('PDF page text extraction failed:', err);
      if (texts.length > 0) return texts; // partial
      throw err;
    }
  }
}

export default PDFUtils;
