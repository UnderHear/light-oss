import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type ToastType = "success" | "error";

interface ToastContextValue {
  pushToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  function pushToast(type: ToastType, message: string) {
    if (type === "success") {
      toast.success(message);
      return;
    }

    toast.error(message);
  }

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <Toaster offset={{ top: 64 }} position="top-center" />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
