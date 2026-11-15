import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { usePersonalPlan, usePlanAi } from '../lib/personalHooks';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { childNameForPlan } from '../state/plan';
import { Content, Empty, Page, Panel } from '../components/plan/ui';
import { IrishaCard } from '../components/plan/personal';

export default function Plan() {
  const { t, language } = useT();
  const { card, planDone, togglePlanDone } = useAppState();
  const plan = usePersonalPlan(card);
  const ai = usePlanAi(card, language);
  const toast = useToast();
  const steps = plan?.steps ?? [];
  const doneN = steps.filter(step => planDone.includes(step.id)).length;
  const current = steps.findIndex(step => !planDone.includes(step.id));
  const name = childNameForPlan(card);
  return <Page hideTabs={false}><Content className="!gap-[18px]"><div><h1>{t('plan.planTitle')}</h1><p className="pl-muted mt-1">{name ? t('plan.route').replace('{name}', name) : t('plan.routeNeutral')}</p></div>
    {!card || !plan ? <Empty mascot="m-laptop" title={t('plan.noCard')} text={t('plan.noCardText')} action={<Link to="/quiz" className="pl-primary">{t('plan.fillCard')}</Link>} /> : <>
      <IrishaCard ai={ai} />
      {doneN === steps.length && <div className="flex items-center gap-3 rounded-[22px] bg-[#EAF2EB] px-4 py-3"><img src="/mascot/m-cheer.png" alt="" className="w-[84px] shrink-0" /><strong className="text-[17px] leading-[23px]">{t('home.allDone')}</strong></div>}
      <Panel className="!rounded-[22px]"><div className="mb-2.5 flex items-baseline justify-between"><span className="text-[15px] font-bold text-muted">{t('plan.completed')}</span><span className="text-[22px] font-black text-brand">{doneN} {t('plan.of')} {steps.length}</span></div><div role="progressbar" aria-label={t('plan.completed')} aria-valuenow={doneN} aria-valuemin={0} aria-valuemax={steps.length} className="h-2.5 rounded-full bg-[#EEE9F7]"><div className="h-full rounded-full bg-sage transition-[width]" style={{ width: `${doneN / steps.length * 100}%` }} /></div></Panel>
      {plan.stages.map((stage, stageIndex) => {
        const stageDone = stage.steps.filter(step => planDone.includes(step.id)).length;
        return <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="flex flex-col gap-2.5">
          <div className="flex items-end justify-between gap-3"><div className="min-w-0"><span className="text-[13px] font-extrabold uppercase tracking-wide text-brand">{t('plan.stage')} {stageIndex + 1}</span><h2 id={`stage-${stage.id}`} className="!text-[21px] !leading-[26px]">{language === 'kz' ? stage.title_kk : stage.title}</h2><p className="pl-muted !text-sm !leading-5">{stage.hint}</p></div><span className="shrink-0 rounded-full bg-[#F4F2F7] px-2.5 py-1 text-[13px] font-extrabold text-muted">{t('plan.stageProgress').replace('{done}', String(stageDone)).replace('{total}', String(stage.steps.length))}</span></div>
          <div>{stage.steps.map((step, position) => {
            const index = steps.indexOf(step), done = planDone.includes(step.id), now = index === current, last = position === stage.steps.length - 1;
            const title = language === 'kz' ? step.title_kk : step.title;
            return <div key={step.id} className="flex gap-3.5"><div className="flex w-11 shrink-0 flex-col items-center"><button aria-label={`${t('plan.mark')}: ${title}`} aria-pressed={done} onClick={() => { togglePlanDone(step.id); if (!done) toast(t('plan.stepMarked')); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[2.5px] text-[17px] font-black" style={{ borderColor: done ? '#9DB8A0' : now ? '#6755B2' : '#DAD5E6', background: done ? '#9DB8A0' : now ? '#6755B2' : '#FFFFFF', color: now ? '#FFFFFF' : '#6E6880' }}>{done ? <Icon name="checkmark" color="FFFFFF" size={22} /> : index + 1}</button>{!last && <div className="my-1 min-h-5 w-[3px] flex-1 rounded" style={{ background: done ? '#9DB8A0' : '#E6E0F5' }} />}</div><Link to={`/plan/${index}`} aria-current={now ? 'step' : undefined} className="mb-3.5 flex min-w-0 flex-1 items-center gap-2 rounded-[20px] border-2 bg-white p-3.5 text-ink shadow-card" style={{ borderColor: now ? '#CBBFF5' : 'transparent' }}><div className="min-w-0 flex-1"><span className="inline-block rounded-full px-2.5 py-[3px] text-xs font-extrabold leading-4" style={{ background: done ? '#EAF2EB' : now ? '#F5F1FF' : '#F4F2F7', color: done ? '#4F7454' : now ? '#6755B2' : '#6E6880' }}>{t(done ? 'plan.done' : now ? 'plan.now' : 'plan.ahead')}</span><div className="mt-1.5 text-[17px] font-extrabold leading-[22px]">{title}</div><div className="text-sm leading-5 text-muted">{step.subtitle}</div>{ai.data?.notes[step.id] && <div className="mt-1.5 flex items-center gap-1 text-[12px] font-extrabold text-brand"><Icon name="like" size={14} />{t('plan.personal')}</div>}</div><span className="-rotate-90"><Icon name="expand-arrow" color="6E6880" size={20} /></span></Link></div>;
          })}</div>
        </section>;
      })}
      <Link to="/resources" className="flex items-center gap-3 rounded-[20px] bg-[#EAF2EB] p-4 text-ink"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white"><Icon name="groups" size={26} /></span><span className="min-w-0 flex-1"><strong className="block text-[16px] font-extrabold leading-[22px]">{t('plan.resourcesTitle')}</strong><small className="block text-[13px] leading-[18px] text-muted">{t('plan.resourcesSub')}</small></span><span className="-rotate-90"><Icon name="expand-arrow" color="6E6880" size={20} /></span></Link>
    </>}
  </Content></Page>;
}
