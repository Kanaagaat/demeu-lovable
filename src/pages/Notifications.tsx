import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useNotifications } from '../state/notifications';
import { Icon } from '../components/Icon';
import { Content, Empty, Page, ResourceState } from '../components/plan/ui';

export default function Notifications() {
  const { t } = useT();
  const navigate = useNavigate();
  const { notifications, markRead, readAll, loading } = useNotifications();
  return <Page><header className="flex h-[60px] shrink-0 items-center px-5"><button className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-back" aria-label={t('common.back')} onClick={() => navigate(-1)}><Icon name="back" size={22} /></button><div className="flex-1 text-center text-lg font-extrabold">{t('plan.notifications')}</div>{notifications.length ? <button className="flex h-12 w-12 items-center justify-center" aria-label={t('plan.readAll')} onClick={readAll}><Icon name="ok" /></button> : <span className="w-12" />}</header>
    {loading ? <ResourceState loading /> : !notifications.length ? <Empty mascot="m-sleep" title={t('plan.quiet')} text={t('plan.quietText')} /> : <Content><div className="flex flex-col gap-2.5">{notifications.map(item => {
      let title = t(`plan.${item.title}`);
      for (const [key, value] of Object.entries(item.values ?? {})) title = title.replace(`{${key}}`, value);
      return <button key={item.id} className="pl-panel flex items-start gap-3 !p-3.5 text-left" onClick={() => { markRead(item.id); navigate(item.go); }}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: item.tint }}><Icon name={item.icon} /></span><span className="min-w-0 flex-1"><span className="block text-base font-extrabold leading-[22px]">{title}</span><span className="block text-sm leading-5 text-muted">{item.detailKey ? t(`plan.${item.detailKey}`) : item.detail}</span><span className="mt-1 block text-xs leading-4 text-[#8A849A]">{t(`plan.${item.when ?? 'justNow'}`)}{item.demo && ` · ${t('plan.demo')}`}</span></span><span aria-label={item.unread ? t('plan.unread') : undefined} className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.unread ? '#6755B2' : 'transparent' }} /></button>;
    })}</div></Content>}
  </Page>;
}
