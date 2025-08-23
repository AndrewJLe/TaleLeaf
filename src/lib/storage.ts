// Utilities for sanitizing large objects before saving to localStorage
export function sanitizeBookForLocalStorage(book: any) {
  const copy = { ...book };
  if (Array.isArray(copy.uploads)) {
    copy.uploads = copy.uploads.map((u: any) => {
      const upload = { ...u };

      // For PDF uploads, KEEP truncated page texts so AI context works offline.
      if (upload.type === 'pdf') {
        if (Array.isArray(upload.pages)) {
          upload.pages = upload.pages.map((p: any) => {
            if (typeof p === 'string' && p.length > 4000) {
              return p.slice(0, 4000) + '...';
            }
            return p;
          });
        }
        return {
          id: upload.id,
          filename: upload.filename,
          type: upload.type,
          pageCount: upload.pageCount,
          uploadedAt: upload.uploadedAt,
          indexedDBKey: upload.indexedDBKey,
          pages: upload.pages // may be undefined if extraction failed
        };
      }

      // For text uploads, truncate very large page content
      if (upload.type === 'text' && Array.isArray(upload.pages)) {
        upload.pages = upload.pages.map((p: any) => {
          if (typeof p === 'string' && p.length > 4000) {
            return p.slice(0, 4000) + '...';
          }
          return p;
        });
      }

      // Truncate large text fields
      if (upload.text && typeof upload.text === 'string' && upload.text.length > 100000) {
        upload.text = upload.text.slice(0, 100000) + '...';
      }

      return upload;
    });
  }
  return copy;
}

export function sanitizeBooksArrayForLocalStorage(books: any[]) {
  return books.map(sanitizeBookForLocalStorage);
}
