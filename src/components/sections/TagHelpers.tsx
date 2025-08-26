import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { PlusIcon } from '../ui/Icons';

// Tag color palette - same as BaseEntityCard
const TAG_PALETTE = [
  '#e11d48', '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#059669', '#0891b2', '#0284c7', '#2563eb', '#4f46e5',
  '#7c3aed', '#9333ea', '#c026d3', '#db2777'
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function colorForTagName(tagName: string): string {
  const hash = hashString(tagName.toLowerCase().trim());
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function readableTextColor(bgHex: string): string {
  const lum = luminance(bgHex);
  return lum > 0.5 ? '#000000' : '#ffffff';
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function isValidTag(tag: string): boolean {
  return tag.trim().length > 0 && tag.trim().length <= 50;
}

// Enhanced Tag Component
interface EnhancedTagProps {
  tag: string;
  onRemove: () => void;
  className?: string;
}

export const EnhancedTag: React.FC<EnhancedTagProps> = ({ tag, onRemove, className = '' }) => {
  const color = colorForTagName(tag);
  const textColor = readableTextColor(color);
  const bgColor = hexToRgba(color, 0.6); // translucent background

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border group hover:scale-105 transition-all duration-200 ${className}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        borderColor: color
      }}
    >
      {tag}
      <button
        onClick={onRemove}
        className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
        style={{ color: textColor }}
      >
        ×
      </button>
    </span>
  );
};

// Enhanced Tag Input Component
interface EnhancedTagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const EnhancedTagInput: React.FC<EnhancedTagInputProps> = ({
  tags,
  onTagsChange,
  placeholder = "Add a tag...",
  className = ''
}) => {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleAddTag = () => {
    if (!isValidTag(newTag)) return;

    const trimmedTag = newTag.trim();
    if (!tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag]);
    }

    setNewTag('');
    setIsAddingTag(false);
    setShowColorPicker(false);
  };

  const handleRemoveTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onTagsChange(newTags);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2 items-center">
        {tags.map((tag, index) => (
          <EnhancedTag
            key={index}
            tag={tag}
            onRemove={() => handleRemoveTag(index)}
          />
        ))}

        {isAddingTag ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddTag();
                } else if (e.key === 'Escape') {
                  setIsAddingTag(false);
                  setNewTag('');
                }
              }}
              placeholder={placeholder}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleAddTag}
              className="text-green-600 hover:text-green-700 font-semibold text-sm"
            >
              ✓
            </button>
            <button
              onClick={() => {
                setIsAddingTag(false);
                setNewTag('');
              }}
              className="text-red-600 hover:text-red-700 font-semibold text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingTag(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full border border-dashed border-gray-300 hover:border-gray-400 transition-all"
          >
            <PlusIcon size={12} />
            Add tag
          </Button>
        )}
      </div>
    </div>
  );
};

// Enhanced Card Container with visual effects
interface EnhancedCardProps {
  children: React.ReactNode;
  gradientFrom: string; // e.g., 'purple', 'orange'
  className?: string;
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  gradientFrom,
  className = ''
}) => {
  return (
    <div
      className={`relative group bg-gradient-to-br from-${gradientFrom}-50 to-slate-50 border border-${gradientFrom}-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.01] hover:border-${gradientFrom}-300 ${className}`}
    >
      {/* Sheen overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg pointer-events-none" />

      <div className="relative">
        {children}
      </div>
    </div>
  );
};
