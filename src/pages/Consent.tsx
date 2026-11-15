import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { Icon } from '../components/Icon';
import { Header, Page, Primary } from '../components/home/ui';
export default function Consent() {
  const { t } = useT();
  const navigate = useNavigate();
  const [agree, setAgree] = useState(false);
  return <Page className="hm-fixed">
    <Header onBack={() => navigate('/welcome')} />
    <div className="hm-content" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div className="hm-icon-tile" style={{ width: 88, height: 88, borderRadius: 28 }}>
        <Icon name="shield" size={48} />
      </div>
      <h1>{t('onboarding.cTitle')}</h1>

      <div className="hm-stack" style={{ gap: 12 }}>{['todo-list', 'shield', 'cancel', 'microphone'].map((icon, index) => <div className="hm-card" key={icon} style={{ display: 'flex', gap: 14 }}>
        <div className="hm-icon-tile" style={{ background: ['#FFF8F1', '#EAF2EB', '#F5F1FF'][index] }}>
          <Icon name={icon} />
        </div>
        <div>
          <h3 style={{ fontSize: 17, lineHeight: '22px' }}>{t(`onboarding.c${index + 1}t`)}</h3>
          <p className="hm-sub" style={{ fontSize: 15, lineHeight: '22px', marginTop: 2 }}>{t(`onboarding.c${index + 1}`)}</p>
        </div>
      </div>)}</div>

    </div>
    <div className="hm-footer" style={{ gap: 14 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', minHeight: 48, cursor: 'pointer', fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>
        <span className="hm-consent-check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span style={{ background: agree ? '#6755B2' : 'white', borderColor: agree ? '#6755B2' : '#CFC8E0' }}>{agree && <Icon name="checkmark" color="FFFFFF" size={16} />}</span></span>{t('onboarding.agree')}
      </label>
      <Primary disabled={!agree} onClick={() => navigate('/login')}>{t('onboarding.cont')}</Primary>
    </div>
  </Page>;
}
