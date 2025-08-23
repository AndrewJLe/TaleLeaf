import React from 'react';
import { Button } from './ui/Button';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  bookTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  bookTitle,
  onConfirm,
  onCancel,
  isDeleting = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-red-200 shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Delete Book</h3>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-3">
            Are you sure you want to delete <strong>"{bookTitle}"</strong>?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>This action cannot be undone.</strong> This will permanently delete this book and all associated data including characters, chapters, locations, notes, and uploaded files.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="secondary"
            className="flex-1"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 px-4 py-2 gap-2 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm hover:shadow-lg"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              'Delete Book'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
