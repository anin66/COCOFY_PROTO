"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toastValue = useMemo(() => ({
    showToast,
    toast: {
      success: (message: string) => showToast(message, "success"),
      error: (message: string) => showToast(message, "error"),
      warning: (message: string) => showToast(message, "warning"),
      info: (message: string) => showToast(message, "info"),
    }
  }), [showToast]);

  return (
    <ToastContext.Provider value={toastValue}>
      {children}
      
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((t) => {
          let Icon = Info;
          let colorClass = "toast-info";
          if (t.type === "success") {
            Icon = CheckCircle;
            colorClass = "toast-success";
          } else if (t.type === "error") {
            Icon = AlertCircle;
            colorClass = "toast-error";
          } else if (t.type === "warning") {
            Icon = AlertTriangle;
            colorClass = "toast-warning";
          }

          return (
            <div key={t.id} className={`toast-card ${colorClass}`}>
              <div className="toast-icon-wrapper">
                <Icon size={20} className="toast-icon" />
              </div>
              <div className="toast-content">
                <p className="toast-message">{t.message}</p>
              </div>
              <button 
                onClick={() => removeToast(t.id)} 
                className="toast-close-btn" 
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
