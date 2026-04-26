import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  duration?: number;
  onClose?: () => void;
}

export default function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
        type === 'success'
          ? 'bg-emerald-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <span>{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          onClose?.();
        }}
        className="ml-1 rounded-full p-0.5 hover:bg-white/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
