import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const ToastStack = () => {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((toast) => setTimeout(() => removeToast(toast.id), 2500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  return (
    <div className="fixed right-4 bottom-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div key={toast.id} className="bg-panelAlt border border-panel px-3 py-2 rounded shadow-lg text-sm max-w-xs">
          {toast.message}
        </div>
      ))}
    </div>
  );
};
