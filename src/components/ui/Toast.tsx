import React, { useEffect, useState } from 'react';
import { CheckIcon } from './Icons';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onHide: () => void;
  duration?: number;
  type?: 'success' | 'error' | 'info';
  position?: 'top-right' | 'relative';
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  onHide,
  duration = 3000,
  type = 'success',
  position = 'top-right',
  className = ''
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onHide();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onHide]);

  const typeStyles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const iconColor = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    info: 'text-blue-600'
  };

  if (!isVisible) return null;

  const positionClasses = position === 'top-right'
    ? 'fixed top-4 right-4 z-50'
    : 'relative';

  return (
    <div className={`${positionClasses} flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-top-2 ${typeStyles[type]} ${className}`}>
      <CheckIcon size={16} className={iconColor[type]} />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

// Hook to manage toast state
export const useToast = () => {
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  return {
    toast,
    showToast,
    hideToast
  };
};
