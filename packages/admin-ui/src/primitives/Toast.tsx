"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "danger";
}

interface ToastContextValue {
  show: (message: string, tone?: ToastItem["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastItem["tone"], string> = {
  success: "border-success/30 bg-white text-ink before:bg-success",
  danger: "border-danger/30 bg-white text-ink before:bg-danger",
};

/**
 * Toda acción async visible (activar/desactivar, publicar, guardar) debe
 * confirmar su resultado — sin esto el operador no sabe si su clic surtió
 * efecto sin refrescar la página. Vive una sola vez en el layout del
 * dashboard; cualquier pantalla hija llama a useToast().
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto relative overflow-hidden rounded-md border py-2.5 pl-4 pr-4 text-sm shadow-pop before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
              TONE_CLASSES[item.tone]
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}
