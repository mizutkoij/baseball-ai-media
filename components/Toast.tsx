/**
 * Toast Component - 共有体験磨き
 * 
 * ShareButton成功時のトースト通知システム
 * アニメーション付きでUX向上
 */

"use client";

import { useState, useEffect } from "react";
import { CheckCircle, X, Copy, ExternalLink } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Toast({ 
  message, 
  type = "success", 
  duration = 3000, 
  onClose,
  action 
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300); // アニメーション完了後にonClose
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const getIcon = () => {
    switch (type) {
      case "success": return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "error": return <X className="w-5 h-5 text-red-400" />;
      case "info": return <Copy className="w-5 h-5 text-blue-400" />;
      default: return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case "success": return "border-green-400/50 bg-green-950/20";
      case "error": return "border-red-400/50 bg-red-950/20";
      case "info": return "border-blue-400/50 bg-blue-950/20";
      default: return "border-green-400/50 bg-green-950/20";
    }
  };

  return (
    <div 
      className={`
        fixed bottom-4 right-4 z-50 
        ${isVisible ? 'animate-slide-up opacity-100' : 'animate-slide-down opacity-0'}
        transition-all duration-300 ease-in-out
        rounded-lg border p-4 backdrop-blur-md shadow-lg
        ${getColorClasses()}
        max-w-sm
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getIcon()}
          <span className="text-white text-sm font-medium">{message}</span>
        </div>
        
        <div className="flex items-center gap-2 ml-3">
          {action && (
            <button
              onClick={action.onClick}
              className="text-xs text-blue-300 hover:text-blue-200 underline transition-colors"
            >
              {action.label}
            </button>
          )}
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast管理用のContext/Provider
export interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'onClose'>) => void;
}

export const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const showToast = (toast: Omit<ToastProps, 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = {
      ...toast,
      id,
      onClose: () => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }
    };
    
    setToasts(prev => [...prev, newToast]);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Custom hook
export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

import React from "react";