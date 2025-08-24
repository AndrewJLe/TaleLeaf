import React from 'react';

interface SaveStatusProps {
  isSaving?: boolean;
  lastSaved?: Date | null;
  error?: string | null;
  className?: string;
}

export const SaveStatus: React.FC<SaveStatusProps> = ({
  isSaving = false,
  lastSaved = null,
  error = null,
  className = ''
}) => {
  if (isSaving) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-blue-600 ${className}`}>
        <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-red-600 ${className}`}>
        <span>⚠️</span>
        <span>Save failed</span>
      </div>
    );
  }

  if (lastSaved) {
    const timeAgo = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    let timeText = '';

    if (timeAgo < 5) {
      timeText = 'just now';
    } else if (timeAgo < 60) {
      timeText = `${timeAgo}s ago`;
    } else if (timeAgo < 3600) {
      timeText = `${Math.floor(timeAgo / 60)}m ago`;
    } else {
      timeText = lastSaved.toLocaleTimeString();
    }

    return (
      <div className={`flex items-center gap-1.5 text-xs text-green-600 ${className}`}>
        <span>✓</span>
        <span>Saved {timeText}</span>
      </div>
    );
  }

  return null;
};
