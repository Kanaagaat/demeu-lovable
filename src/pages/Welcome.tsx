import { RIDES_ENABLED } from '../lib/flags';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { Arrow, Page, Primary } from '../components/home/ui';
export default function Welcome() {
  const { t, language, setLanguage } = useT();
  const navigate = useNavigate();
  return <Page className="hm-welcome">

    <div style={{ position: 'absolute', right: -90, top: 283, width: 320, height: 320, borderRadius: '50%', background: '#F5F1FF' }} />

    <div style={{ position: 'absolute', left: -70, top: 393, width: 180, height: 180, borderRadius: '50%', background: '#FFF8F1' }} />

    <div className="hm-welcome-copy">
      <img className="hm-welcome-logo" src="/mascot/m-logo.png" alt="DEMEU" />
      <h1>{t('onboarding.wTitle')}</h1>
      <p>{t('onboarding.wSub')}</p>
    </div>

    <div className="hm-welcome-mascot">
      <img src="/mascot/m-hug.png" alt="" />
    </div>

    <div className="hm-welcome-actions">
      <Primary onClick={() => navigate('/consent')}>
        {t('onboarding.start')}
        <Arrow white />
      </Primary>
      <Primary className="hm-secondary" style={{ height: 52, minHeight: 52, fontSize: 16 }} onClick={() => navigate('/login')}>{t('onboarding.have')}</Primary>

      {RIDES_ENABLED && <Link to="/driver" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, color: '#6E6880', fontSize: 14, fontWeight: 700 }}>{t('ridesEntry.driver')}</Link>}

      <div className="hm-language" aria-label={t('common.language')}>{(['ru', 'kz'] as const).map(lang => <button key={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)} style={{ background: language === lang ? '#6755B2' : 'transparent', color: language === lang ? '#FFFFFF' : '#6E6880' }}>{lang.toUpperCase()}</button>)}</div>

    </div>

  </Page>;
}
