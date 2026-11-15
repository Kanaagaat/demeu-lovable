import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' };

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  const color = variant === 'primary' ? 'bg-brand text-white hover:bg-brand-hover' : 'bg-mist text-brand hover:bg-lilac-soft';
  return <button type={type} className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-button px-5 text-[17px] font-extrabold disabled:cursor-default disabled:opacity-45 ${color} ${className}`} {...props} />;
}
