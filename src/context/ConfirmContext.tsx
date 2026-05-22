"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { AlertTriangle, Info, HelpCircle, X } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [activeConfirm, setActiveConfirm] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const [isClosing, setIsClosing] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActiveConfirm({
        options,
        resolve,
      });
      setIsClosing(false);
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (!activeConfirm) return;
    setIsClosing(true);
    setTimeout(() => {
      activeConfirm.resolve(result);
      setActiveConfirm(null);
      setIsClosing(false);
    }, 250); // Match transition duration
  }, [activeConfirm]);

  const contextValue = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}

      {activeConfirm && (
        <div
          className={`confirm-backdrop ${isClosing ? "closing" : ""}`}
          onClick={() => handleClose(false)}
        >
          <div
            className={`confirm-card ${isClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Icon */}
            <div className="confirm-header">
              <div className={`confirm-icon-ring confirm-ring-${activeConfirm.options.type || "info"}`}>
                {activeConfirm.options.type === "danger" ? (
                  <AlertTriangle className="confirm-icon" size={24} />
                ) : activeConfirm.options.type === "warning" ? (
                  <AlertTriangle className="confirm-icon" size={24} />
                ) : (
                  <Info className="confirm-icon" size={24} />
                )}
              </div>
              <button className="confirm-close-x" onClick={() => handleClose(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="confirm-body">
              <h3 className="confirm-title">{activeConfirm.options.title}</h3>
              <p className="confirm-message">{activeConfirm.options.message}</p>
            </div>

            {/* Actions */}
            <div className="confirm-footer">
              <button
                type="button"
                className="confirm-btn-cancel"
                onClick={() => handleClose(false)}
              >
                {activeConfirm.options.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                className={`confirm-btn-action confirm-btn-${activeConfirm.options.type || "info"}`}
                onClick={() => handleClose(true)}
              >
                {activeConfirm.options.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
