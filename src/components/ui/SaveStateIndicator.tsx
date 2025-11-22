import React from "react";
import { CheckIcon, SpinnerIcon } from "./Icons";

interface SaveStateIndicatorProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  showSaved?: boolean;
  className?: string;
}

export const SaveStateIndicator: React.FC<SaveStateIndicatorProps> = ({
  isSaving,
  hasUnsavedChanges,
  showSaved = false,
  className = "",
}) => {
  if (isSaving) {
    return (
      <span
        className={`text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md font-medium flex items-center gap-1.5 ${className}`}
      >
        <SpinnerIcon size={12} className="text-emerald-600 animate-spin" />
        Saving...
      </span>
    );
  }

  if (showSaved) {
    return (
      <span
        className={`text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md font-medium flex items-center gap-1.5 animate-in zoom-in-50 duration-300 ${className}`}
      >
        <CheckIcon
          size={12}
          className="text-emerald-600 animate-in zoom-in-50 duration-300"
        />
        Saved
      </span>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <span
        className={`text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-md font-medium ${className}`}
      >
        Unsaved changes
      </span>
    );
  }

  return null;
};
