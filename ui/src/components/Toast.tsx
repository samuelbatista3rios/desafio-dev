"use client";

import { useState, useCallback } from "react";

export type ToastType = "success" | "error" | "confirm" | "undo";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onUndo?: () => void;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...toast, id }]);

      if (toast.type !== "confirm") {
        const delay = toast.type === "undo" ? 4000 : 3500;
        setTimeout(() => removeToast(id), delay);
      }

      return id;
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string) => addToast({ type: "success", message }),
    [addToast]
  );

  const showError = useCallback(
    (message: string) => addToast({ type: "error", message }),
    [addToast]
  );

  const showConfirm = useCallback(
    (message: string, onConfirm: () => void) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [
        ...prev,
        {
          id,
          type: "confirm",
          message,
          onConfirm: () => {
            removeToast(id);
            onConfirm();
          },
          onCancel: () => removeToast(id),
        },
      ]);
    },
    [removeToast]
  );

  const showUndo = useCallback(
    (message: string, onUndo: () => void) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [
        ...prev,
        {
          id,
          type: "undo",
          message,
          onUndo: () => {
            removeToast(id);
            onUndo();
          },
        },
      ]);
      setTimeout(() => removeToast(id), 4000);
      return id;
    },
    [removeToast]
  );

  return { toasts, removeToast, showSuccess, showError, showConfirm, showUndo };
}


interface ToastContainerProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          {toast.type === "confirm" ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-1">
                  {toast.message}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toast.onCancel}
                  className="flex-1 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={toast.onConfirm}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : toast.type === "undo" ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border bg-slate-800 dark:bg-slate-700 border-slate-700 dark:border-slate-600 text-white">
              <svg className="w-5 h-5 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-medium flex-1 text-slate-200">{toast.message}</span>
              <button
                onClick={toast.onUndo}
                className="shrink-0 px-3 py-1 text-sm font-semibold text-orange-400 hover:text-orange-300 hover:underline transition"
              >
                Desfazer
              </button>
            </div>
          ) : (
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border ${
                toast.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300"
              }`}
            >
              {toast.type === "success" ? (
                <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="text-sm font-medium flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
