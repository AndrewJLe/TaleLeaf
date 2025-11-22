import React from "react";
import { Button } from "./Button";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  onStay: () => void;
  unsavedCount: number;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onSaveAndContinue,
  onDiscardAndContinue,
  onStay,
  unsavedCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Unsaved Changes
        </h3>

        <p className="text-gray-600 mb-6">
          You have {unsavedCount} unsaved note{unsavedCount !== 1 ? "s" : ""}.
          What would you like to do with your changes?
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={onSaveAndContinue}
            variant="primary"
            className="w-full"
          >
            Save Changes and Continue
          </Button>

          <Button
            onClick={onDiscardAndContinue}
            variant="danger"
            className="w-full"
          >
            Discard Changes
          </Button>

          <Button onClick={onStay} variant="secondary" className="w-full">
            Stay on Notes
          </Button>
        </div>
      </div>
    </div>
  );
};
