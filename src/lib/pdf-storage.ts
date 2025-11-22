/**
 * IndexedDB-based storage for PDF files
 * This keeps PDFs out of localStorage to avoid quota issues
 */

const DB_NAME = "taleleaf-pdfs";
const DB_VERSION = 1;
const STORE_NAME = "pdf-files";

interface PDFStorageItem {
  id: string;
  filename: string;
  blob: Blob;
  uploadedAt: number;
}

class PDFStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("filename", "filename", { unique: false });
        }
      };
    });
  }

  async storePDF(id: string, filename: string, blob: Blob): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const item: PDFStorageItem = {
        id,
        filename,
        blob,
        uploadedAt: Date.now(),
      };

      const request = store.put(item);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPDF(id: string): Promise<Blob | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as PDFStorageItem | undefined;
        resolve(result?.blob || null);
      };
    });
  }

  async deletePDF(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllPDFs(): Promise<PDFStorageItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async createBlobURL(id: string): Promise<string | null> {
    const blob = await this.getPDF(id);
    return blob ? URL.createObjectURL(blob) : null;
  }

  // Cleanup old PDFs (optional - can be called periodically)
  async cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const allPDFs = await this.getAllPDFs();
    const cutoff = Date.now() - maxAge;

    for (const pdf of allPDFs) {
      if (pdf.uploadedAt < cutoff) {
        await this.deletePDF(pdf.id);
      }
    }
  }
}

// Singleton instance
export const pdfStorage = new PDFStorage();
