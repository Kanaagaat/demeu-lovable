import type { ButtonHTMLAttributes } from 'react';

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean };

export function Chip({ selected = false, className = '', type = 'button', ...props }: ChipProps) {
  const color = selected ? 'border-brand bg-brand text-white' : 'border-line-strong bg-white text-ink';
  return <button type={type} aria-pressed={selected} className={`inline-flex min-h-11 items-center justify-center rounded-full border-[1.5px] px-3.5 text-sm font-bold disabled:opacity-45 ${color} ${className}`} {...props} />;
}
