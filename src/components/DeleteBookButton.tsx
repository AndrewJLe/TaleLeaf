import React, { useState } from 'react';
import { Button } from './ui/Button';
import { TrashIcon } from './ui/Icons';
import { Tooltip } from './ui/Tooltip';

interface DeleteBookButtonProps {
  bookTitle: string;
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
  className?: string;
}

export const DeleteBookButton: React.FC<DeleteBookButtonProps> = ({
  bookTitle,
  onDelete,
  isDeleting = false,
  className = ''
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      await onDelete();
      setShowConfirm(false);
    } catch (error) {
      console.error('Delete failed:', error);
      // Keep confirmation open on error so user can retry
    } finally {
      setIsProcessing(false);
    }
  };

  if (showConfirm) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrashIcon size={20} className="text-red-600" />
          <h3 className="font-semibold text-red-900">Delete Book</h3>
        </div>
        <p className="text-red-700 text-sm mb-4">
          Are you sure you want to delete "<strong>{bookTitle}</strong>"?
        </p>
        <p className="text-red-600 text-xs mb-4">
          This will permanently remove all notes, characters, chapters, locations, and uploaded files. This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            variant="danger"
            size="sm"
            isLoading={isProcessing}
            disabled={isDeleting}
          >
            <TrashIcon size={16} />
            {isProcessing ? 'Deleting...' : 'Delete Forever'}
          </Button>
          <Button
            onClick={() => setShowConfirm(false)}
            variant="secondary"
            size="sm"
            disabled={isProcessing || isDeleting}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Tooltip text="Delete this book permanently" id="delete-book-button">
      <Button
        onClick={() => setShowConfirm(true)}
        variant="danger"
        size="sm"
        disabled={isDeleting}
        className={className}
      >
        <TrashIcon size={16} />
        Delete Book
      </Button>
    </Tooltip>
  );
};
