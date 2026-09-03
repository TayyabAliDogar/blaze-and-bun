import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  tone?: "default" | "error" | "success";
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

function genToastId(): string {
  counter += 1;
  return `toast-${Date.now().toString(36)}-${counter}`;
}

/**
 * Tiny global toast store. Any component can call `useToastStore.getState().show(...)`
 * (or the `useToast()` hook) to surface a transient, dismissible message —
 * used for geolocation errors/permission hints across the UI.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, tone = "default") => {
    const id = genToastId();
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    // Auto-dismiss after 6s.
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast(): ToastState {
  return useToastStore();
}
