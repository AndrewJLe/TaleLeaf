import React, { useEffect, useRef, useState } from "react";

interface ResizableTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  maxRows?: number;
}

export const ResizableTextArea: React.FC<ResizableTextAreaProps> = ({
  value,
  onChange,
  onSave,
  placeholder,
  className = "",
  minRows = 3,
  maxRows = 20,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && onSave) {
      e.preventDefault();
      onSave();
    }
  };

  // Auto-resize based on content
  useEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.style.height = "auto";
      const scrollHeight = textArea.scrollHeight;
      const minHeight = minRows * 24; // Approximate line height
      const maxHeight = maxRows * 24;
      textArea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [value, minRows, maxRows]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartHeight(textAreaRef.current?.offsetHeight || 0);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !textAreaRef.current) return;

      const deltaY = e.clientY - startY;
      const newHeight = Math.max(
        minRows * 24,
        Math.min(maxRows * 24, startHeight + deltaY),
      );
      textAreaRef.current.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startY, startHeight, minRows, maxRows]);

  return (
    <div className="relative">
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-y overflow-auto ${className}`}
        style={{ minHeight: `${minRows * 24}px` }}
      />

      {/* Optional subtle drag area to allow click-drag resizing without custom visible handle */}
      <div
        className={`absolute bottom-0 right-0 w-6 h-6 -translate-y-0 -translate-x-0 cursor-ns-resize opacity-0 hover:opacity-20 transition-opacity`}
        onMouseDown={handleMouseDown}
        aria-hidden="true"
      />
    </div>
  );
};
