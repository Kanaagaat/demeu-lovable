import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SpecialistCard } from '../components/SpecialistCard';
import { Page, TileLink, Empty } from '../components/support/ui';
import { useT } from '../i18n';
import { useSpecialists } from '../lib/hooks';

export default function Support() {
  const { t } = useT(); const psychologists = useSpecialists({ kind: 'parent' });
  return <Page className="support-home"><div className="support-hero"><div><h1>{t('support.heading')}</h1><p>{t('support.subtitle')}</p></div><img src="/mascot/m-meditate.png" alt="" /></div><div className="support-content" style={{ gap: 22 }}>
    <TileLink to="/support/chat" icon="chat" title={t('support.chatTitle')} subtitle={t('support.chatSubtitle')} large />
    <div><div className="support-section-heading"><h2>{t('support.psychologists')}</h2><Link className="support-text-button" to="/specialists?kind=parent">{t('support.all')}</Link></div>
      {psychologists.loading && <p role="status">{t('support.loading')}</p>}{psychologists.error && <button className="support-button support-secondary" onClick={psychologists.reload}>{t('support.retry')}</button>}
      <div className="support-psy-list">{psychologists.data?.items.map(item => <div key={item.id}><SpecialistCard item={item} compact /></div>)}</div>{psychologists.data?.items.length === 0 && <Empty title={t('support.emptyPsy')} />}</div>
    <TileLink to="/resources#communities" icon="groups" title={t('support.communities')} subtitle={t('support.communitySub')} /><TileLink to="/useful" icon="todo-list" title={t('support.useful')} subtitle={t('support.usefulSub')} />
  </div><Link className="support-sos-banner" to="/sos"><Icon name="hand" size={22} /><span className="support-grow">{t('support.sosBanner')}</span><span aria-hidden="true">›</span></Link></Page>;
}
