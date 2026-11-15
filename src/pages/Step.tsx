import { Link, useParams } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { usePersonalPlan, usePlanAi } from '../lib/personalHooks';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { isChecks, usePlanValue } from '../state/plan';
import { Check, Content, Empty, Page, Panel } from '../components/plan/ui';
import { LinkRow } from '../components/plan/personal';

export default function Step() {
  const { idx } = useParams();
  const index = idx && /^\d+$/.test(idx) ? Number(idx) : -1;
  const { t, language } = useT();
  const { card, planDone, togglePlanDone } = useAppState();
  const plan = usePersonalPlan(card);
  const ai = usePlanAi(card, language);
  const step = plan?.steps[index];
  const [docs, setDocs] = usePlanValue<Record<string, boolean>>('docs', {}, isChecks);
  const toast = useToast();
  const done = !!step && planDone.includes(step.id);
  const note = step ? ai.data?.notes[step.id] : undefined;
  const questions = step ? [...new Set([...(note?.ask ?? []), ...step.ask])] : [];
  const title = step ? (language === 'kz' ? step.title_kk : step.title) : '';
  const stage = plan?.stages.find(s => s.id === step?.stage);
  return <Page className="pl-step" title={step ? `${t('plan.step')} ${index + 1} ${t('plan.of')} ${plan!.steps.length}` : t('plan.planTitle')}>
    {!step ? <Empty title={t('plan.notFound')} action={<Link to="/plan" className="pl-primary">{t('plan.backPlan')}</Link>} /> : <><Content className="!gap-[22px] !pb-6">
      <div className="flex flex-col gap-2.5">{stage && <span className="text-[13px] font-extrabold uppercase tracking-wide text-brand">{language === 'kz' ? stage.title_kk : stage.title}</span>}<h1>{title}</h1><span className="pl-badge"><Icon name="shield" size={16} />{t('plan.verifiedAt')}</span></div>
      {note ? <div className="rounded-[20px] bg-[#F5F1FF] p-4"><h3 className="flex items-center gap-2"><img src="/mascot/m-laptop.png" alt="" className="w-9" />{t('plan.personal')}</h3><p>{note.personal}</p></div> : ai.status === 'loading' && <p role="status" className="pl-muted rounded-[16px] bg-[#F5F1FF] px-4 py-3 text-[14px] leading-5">{t('plan.aiLoading')}</p>}
      <div><h3>{t('plan.why')}</h3><p>{step.why}</p></div>
      {step.age_notes.map(text => <div key={text} className="rounded-[18px] bg-[#EAF2EB] p-3.5"><h3 className="!mb-1 !text-[15px]">{t('plan.ageNote')}</h3><p className="!text-[15px] !leading-[22px]">{text}</p></div>)}
      {!!step.how.length && <div><h3>{t('plan.how')}</h3><ol className="m-0 flex list-none flex-col gap-2.5 p-0">{step.how.map((item, position) => <li key={item} className="flex gap-3 text-[16px] leading-6"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F1FF] text-sm font-black text-brand">{position + 1}</span>{item}</li>)}</ol></div>}
      {!!step.docs.length && <div><h3>{t('plan.take')}</h3><Panel className="!px-3.5 !py-1">{step.docs.map(doc => { const key = `${step.id}:${doc}`; return <button key={key} className="pl-check-row last:border-0" role="checkbox" aria-checked={!!docs[key]} onClick={() => setDocs({ ...docs, [key]: !docs[key] })}><Check checked={!!docs[key]} />{doc}</button>; })}</Panel></div>}
      <div><h3>{t('plan.where')}</h3><Panel><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#EAF2EB]"><Icon name="home" /></span><div><div className="text-base font-extrabold leading-[22px]">{step.where}</div>{(step.address || step.minutes != null) && <div className="text-sm leading-5 text-muted">{step.address}{step.minutes != null && `${step.address ? ' · ' : ''}≈ ${step.minutes} ${t('plan.minutes')}`}</div>}<div className="mt-1 text-sm leading-5 text-muted">{t('plan.timeline')}: {step.timeline}</div></div></div>{step.address && <a className="pl-secondary mt-3" href={`https://2gis.kz/almaty/search/${encodeURIComponent(step.address)}`} target="_blank" rel="noreferrer"><Icon name="home" color="6E6880" size={20} />{t('plan.directions')}</a>}{step.specialist_id && <Link className="pl-text mt-1" to={`/specialists/${step.specialist_id}`}>{t('plan.specialistProfile')}</Link>}</Panel></div>
      {!!questions.length && <div><h3>{t('plan.ask')}</h3><Panel><ul className="m-0 flex list-none flex-col gap-2 p-0">{questions.map(question => <li key={question} className="flex gap-2.5 text-[16px] leading-6"><Icon name="help" size={20} />{question}</li>)}</ul></Panel></div>}
      {!!step.links.length && <div><h3>{t('plan.links')}</h3><div className="flex flex-col gap-2">{step.links.map(link => <LinkRow key={link.id} link={link} />)}</div></div>}
      {step.internal && <Link className="pl-secondary" to={step.internal.to}>{step.internal.label}</Link>}
      <div className="rounded-[20px] bg-[#FFF8F1] p-4"><h3 className="flex items-center gap-2"><Icon name="shield" size={22} />{t('plan.rights')}</h3><p className="!text-[15px] !leading-[22px]">{t('plan.checkOfficial')}</p><a className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-extrabold text-brand" href="https://adilet.zan.kz/rus/docs/K2300000224" target="_blank" rel="noreferrer">{t('plan.source')}<Icon name="external-link" size={14} /></a></div>
    </Content><div className="pl-footer">{step.specialist_id && <Link className="pl-primary" to={`/book/${step.specialist_id}`}>{t('plan.book')}</Link>}<button className={done ? 'pl-secondary !bg-[#EAF2EB] !text-[#4F7454]' : 'pl-primary'} aria-pressed={done} onClick={() => { togglePlanDone(step.id); if (!done) toast(t('plan.stepMarked')); }}>{done ? <><Icon name="checkmark" color="4F7454" size={22} />{t('plan.stepDone')} · {t('plan.undo')}</> : t('plan.markDone')}</button></div></>}
  </Page>;
}
