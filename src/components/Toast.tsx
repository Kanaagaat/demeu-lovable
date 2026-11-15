import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Icon } from './Icon';
import { play } from '../lib/sfx';

const ToastContext = createContext<((message: string) => void) | null>(null);

export function Toast({ message }: { message: string | null }) {
  return <div role="status" aria-live="polite" aria-atomic="true" className={message ? 'toast' : 'sr-only'}>
    {message ? <><Icon name="checkmark" color="FFFFFF" size={20} /><span>{message}</span></> : null}
  </div>;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toast = useCallback((text: string) => {
    clearTimeout(timer.current);
    play('pop');
    setMessage(text);
    setShown(n => n + 1);
    timer.current = setTimeout(() => setMessage(null), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <ToastContext.Provider value={toast}>{children}<Toast key={shown} message={message} /></ToastContext.Provider>;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used within ToastProvider');
  return toast;
}
