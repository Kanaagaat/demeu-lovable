import type { ReactNode } from 'react';
import { ScreenHeader } from './ScreenHeader';

export function Placeholder({ title, back = false, children }: { title: string; back?: boolean; children?: ReactNode }) {
  return <>
    {back ? <ScreenHeader title={title} /> : <h1 className="px-5 pb-4 pt-2 text-[28px] font-black leading-[34px]">{title}</h1>}
    {children ? <div className="px-5 pb-7">{children}</div> : null}
  </>;
}
