import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { formatPhone } from '../state/home';
import { useToast } from '../components/Toast';
import { Header, Page, Primary } from '../components/home/ui';
export default function Login() {
  const { t } = useT();
  const { setOnboarded } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [seconds, setSeconds] = useState(59);
  useEffect(() => {
    if (stage !== 'code')
      return;
    const interval = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, [stage]);
  useEffect(() => {
    if (stage !== 'code' || code.length !== 4)
      return;
    const timer = setTimeout(() => { setOnboarded(true); navigate('/', { replace: true }); }, 450);
    return () => clearTimeout(timer);
  }, [code, stage, setOnboarded, navigate]);
  return <Page className="hm-fixed">
    <Header onBack={() => stage === 'code' ? (setStage('phone'), setCode('')) : navigate('/welcome')} />

    {stage === 'phone' ? <>
      <form id="home-login" className="hm-content" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onSubmit={e => {
        e.preventDefault(); if (phone.length === 10) {
          setStage('code');
          setSeconds(59);
        }
      }}>
        <h1>{t('onboarding.lTitle')}</h1>
        <p className="hm-sub" style={{ marginBottom: 20 }}>{t('onboarding.lSub')}</p>
        <label htmlFor="home-phone" style={{ fontSize: 13, lineHeight: '18px', fontWeight: 700, color: '#6E6880' }}>{t('onboarding.phone')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ height: 60, padding: '0 18px', borderRadius: 16, background: '#F5F1FF', display: 'flex', alignItems: 'center', fontSize: 20, fontWeight: 800, color: '#6755B2' }}>+7</div>
          <input id="home-phone" className="hm-input" style={{ height: 60, fontSize: 20, letterSpacing: '.02em' }} inputMode="tel" autoComplete="tel-national" placeholder="(700) 000-00-00" value={formatPhone(phone)} onChange={e => {
            let digits = e.target.value.replace(/\D/g, ''); if (digits.length > 10 && /^[78]/.test(digits))
              digits = digits.slice(1); setPhone(digits.slice(0, 10));
          }} />
        </div>
        <p className="hm-sub" style={{ fontSize: 13, lineHeight: '18px', marginTop: 6 }}>{t('home.login.anyPhone')}</p>
      </form>
      <div className="hm-footer">
        <Primary type="submit" form="home-login" disabled={phone.length !== 10}>{t('onboarding.getCode')}</Primary>
      </div>
    </> :
      <div className="hm-content" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1>{t('onboarding.codeTitle')}</h1>
        <p className="hm-sub" style={{ marginBottom: 24 }}>{t('onboarding.codeSub')} +7 {formatPhone(phone)}</p>
        <div className="hm-code-boxes">
          {[0, 1, 2, 3].map(i => <div key={i} aria-hidden="true" style={{ borderColor: i === Math.min(code.length, 3) ? '#6755B2' : '#E6E0F5' }}>{code[i] ?? ''}</div>)}
          <input autoFocus aria-label={t('home.login.codeLabel')} inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <p className="hm-sub" style={{ fontSize: 13, lineHeight: '18px', marginTop: 8 }}>{t('home.login.anyCode')}</p>
        {seconds > 0 ? <p className="hm-sub" style={{ fontSize: 15, lineHeight: '22px', marginTop: 16 }}>{t('onboarding.resend')} 0:{String(seconds).padStart(2, '0')}</p> : <button className="hm-text-button" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => { setSeconds(59); setCode(''); toast(t('home.login.resent')); }}>{t('onboarding.resendNow')}</button>}
      </div>}

  </Page>;
}
