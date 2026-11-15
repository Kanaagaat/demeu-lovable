import { Icon } from '../Icon';
import { useT } from '../../i18n';
import type { AiPlanState } from '../../lib/personalHooks';
import type { KbLink } from '../../lib/types';

/** Irisha's block on the plan screen: summary and «this week» list, or an honest status when the assistant is not available. */
export function IrishaCard({ ai }: { ai: AiPlanState }) {
  const { t } = useT();
  if (ai.status === 'idle') return null;
  return <section aria-label={t('plan.aiTitle')} className="rounded-[22px] bg-[#F5F1FF] p-4">
    <div className="flex items-center gap-3">
      <img src="/mascot/m-laptop.png" alt="" className="w-14 shrink-0" />
      <div className="min-w-0 flex-1"><strong className="block text-[17px] font-black leading-[22px]">{t('plan.aiTitle')}</strong><span className="text-[13px] font-bold text-brand">{t('plan.aiBadge')}</span></div>
    </div>
    {ai.status === 'loading' && <p role="status" className="pl-muted mt-3 text-[15px] leading-[22px]">{t('plan.aiLoading')}</p>}
    {ai.status === 'error' && <div className="mt-3 flex flex-col gap-2"><p role="status" className="pl-muted text-[15px] leading-[22px]">{t(ai.reason === 'offline' ? 'plan.aiOffline' : 'plan.aiError')}</p><button className="pl-secondary !bg-white" onClick={ai.retry}>{t('plan.aiRetry')}</button></div>}
    {ai.status === 'ready' && ai.data && <div className="mt-3 flex flex-col gap-3">
      {ai.data.summary && <p className="text-[16px] leading-[24px]">{ai.data.summary}</p>}
      {ai.data.first_week.length > 0 && <div><h3 className="!mb-1.5 !text-[15px]">{t('plan.firstWeek')}</h3><ol className="m-0 flex list-none flex-col gap-1.5 p-0">{ai.data.first_week.map((item, index) => <li key={item} className="flex gap-2.5 text-[15px] leading-[22px]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-black text-brand">{index + 1}</span>{item}</li>)}</ol></div>}
    </div>}
  </section>;
}

export const linkIcon = (kind: string) => kind === 'youtube' ? 'training' : kind === 'facebook' || kind === 'instagram' ? 'groups' : kind === 'gov' || kind === 'law' ? 'shield' : 'todo-list';

export function LinkRow({ link }: { link: KbLink }) {
  const { t } = useT();
  return <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.title}. ${t('plan.externalHint')}`} className="flex items-start gap-3 rounded-[16px] bg-white p-3 text-ink shadow-card">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EAF2EB]"><Icon name={linkIcon(link.kind)} size={22} /></span>
    <span className="min-w-0 flex-1"><strong className="block text-[15px] font-extrabold leading-5">{link.title}</strong><small className="block text-[13px] leading-[18px] text-muted">{link.desc}</small></span>
    <Icon name="external-link" size={16} />
  </a>;
}
