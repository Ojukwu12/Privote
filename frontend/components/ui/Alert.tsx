'use client';

import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export function Alert({ type, title, message, onClose }: AlertProps) {
  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconEmoji = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`border rounded-lg p-4 ${typeStyles[type]}`}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0 text-2xl">{iconEmoji[type]}</div>
        <div className="ml-3">
          {title && <p className="font-semibold">{title}</p>}
          <p className={title ? 'text-sm mt-1' : ''}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-lg font-bold opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
