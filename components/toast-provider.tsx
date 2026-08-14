"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastInput = {
  message: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  autoDismiss?: boolean;
};

type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
  autoDismiss: boolean;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastId() {
  return globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const variant = toast.variant ?? "info";
      const autoDismiss = toast.autoDismiss ?? (variant === "success" || variant === "info");
      const id = toastId();
      setToasts((current) => [...current.slice(-2), { ...toast, id, variant, autoDismiss }]);

      if (autoDismiss) {
        window.setTimeout(() => removeToast(id), 4000);
      }
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast, removeToast }), [removeToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastStack" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <article key={toast.id} className={`toast toast--${toast.variant}`} role={toast.variant === "error" ? "alert" : "status"}>
            <div className="toastBar" />
            <div className="toastBody">
              <p className="toastMessage">{toast.message}</p>
              {toast.actionLabel && toast.onAction ? (
                <button
                  className="toastAction"
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    if (toast.autoDismiss) {
                      removeToast(toast.id);
                    }
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
            <button className="toastDismiss" type="button" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
              ×
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
