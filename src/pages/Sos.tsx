import { Icon } from '../components/Icon';
import { Header, Page } from '../components/support/ui';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';

export default function Sos() {
  const { t } = useT(); const { onboarded } = useAppState();
  return <Page className="support-fullscreen"><Header fallback={onboarded ? '/' : '/welcome'} /><div className="support-content support-sos-content"><h1>{t('support.notAlone')}</h1><p className="support-sos-intro">{t('support.sosIntro')}</p>
    <a className="support-call support-call-112" href="tel:112"><span className="support-icon-box" style={{ background: '#FFFFFF33' }}><Icon name="hand" size={26} /></span><span><strong>{t('support.emergencyServices')}</strong><small>{t('support.lifeThreat')}</small></span></a>
    <a className="support-call" href="tel:111"><span className="support-icon-box"><Icon name="chat" size={26} /></span><span><strong>{t('support.trustLine')}</strong><small>{t('support.trustSub')}</small></span></a>
    <a className="support-call" href="tel:150"><span className="support-icon-box" style={{ background: '#EAF2EB' }}><Icon name="family" size={26} /></span><span><strong>{t('support.youthLine')}</strong><small>150</small></span></a>
    <a className="support-button support-secondary" href="https://wa.me/77081060810" target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={22} />{t('support.whatsapp150')}</a>
    <a className="support-call" href="tel:"><span className="support-icon-box" style={{ background: '#EAF2EB' }}><Icon name="user" size={26} /></span><span><strong>{t('support.callClose')}</strong><small>{t('support.fromContacts')}</small></span></a><p className="support-sos-breathe">{t('support.breathe')}</p>
  </div></Page>;
}
