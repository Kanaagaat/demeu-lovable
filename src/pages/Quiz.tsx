import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { COMM, CUSTOM_LENGTH, CUSTOM_MAX, DISABILITY, DISTRICTS, FEATURES, GOALS, REACT, clearDraft, completeCard, missingStep, readCustomFeatures, readDraft, saveCustomFeatures, saveDraft, toggleFeature } from '../state/home';
import type { Draft } from '../state/home';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Back, Page, Primary } from '../components/home/ui';
import { DistrictMap } from '../components/home/DistrictMap';
import { play } from '../lib/sfx';
const questions = [
  { key: 'features', values: FEATURES, icons: ['puzzle', 'wheelchair', 'like', 'brain', 'hearing', 'blind', 'more', 'help'], cols: 2 },
  { key: 'comm', values: COMM, icons: ['chat', 'speech-bubble', 'hand', 'layers'], cols: 1 },
  { key: 'react', values: REACT, icons: ['happy', 'hourglass', 'lightning-bolt'], cols: 1 },
  { key: 'goals', values: GOALS, icons: ['communication', 'sun', 'walking', 'paint-palette', 'school', 'conference-call'], cols: 2 },
  { key: 'disability', values: DISABILITY, icons: ['ok', 'cancel', 'hourglass'], cols: 1 },
] as const;
export default function Quiz() {
  const { t } = useT();
  const { card, setCard } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => readDraft(card));
  const [step, setStep] = useState(() => {
    const value = (location.state as {
      step?: number;
    } | null)?.step; return value && value >= 1 && value <= 7 ? value : 1;
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [custom, setCustom] = useState<string[]>(readCustomFeatures);
  const [customText, setCustomText] = useState('');
  useEffect(() => saveDraft(draft), [draft]);
  useEffect(() => saveCustomFeatures(custom), [custom]);
  const addCustom = () => {
    const value = customText.trim().replace(/\s+/g, ' ').slice(0, CUSTOM_LENGTH);
    if (!value)
      return;
    if (custom.length >= CUSTOM_MAX) {
      toast(t('home.quiz.customLimit'));
      return;
    }
    if (!custom.some(v => v.toLowerCase() === value.toLowerCase()))
      setCustom(list => [...list, value]);
    if (!draft.features.includes(FEATURES[6]))
      update('features', toggleFeature(draft.features, FEATURES[6]));
    setCustomText('');
  };
  const removeCustom = (value: string) => setCustom(list => list.filter(v => v !== value));
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const next = () => {
    if (step < 7) {
      setStep(s => s + 1);
      return;
    }
    const saved = completeCard(draft);
    if (!saved) {
      setStep(missingStep(draft) ?? 1);
      play('error');
      toast(t('home.quiz.required'));
      return;
    }
    play('success');
    setCard(saved);
    clearDraft();
    navigate('/result');
  };
  const question = questions[step - 3];
  return <Page className="hm-quiz">
    <div className="hm-quiz-header">
      <Back onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/')} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 13, lineHeight: '18px', fontWeight: 800, color: '#6E6880' }}>{t('home.quiz.step').replace('{n}', String(step))}</div>
        <div className="hm-progress" role="progressbar" aria-label={t('screens.quiz')} aria-valuemin={1} aria-valuemax={7} aria-valuenow={step}>
          <div style={{ width: `${Math.round(step / 7 * 100)}%` }} />
        </div>
      </div>
      {step >= 2 && <button className="hm-text-button" style={{ fontSize: 15, padding: '0 4px' }} onClick={next}>{t('home.quiz.skip')}</button>}
    </div>

    <div className="hm-quiz-body" key={step}>
      {step === 1 && <div className="hm-stack" style={{ gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <h2>{t('home.quiz.title1')}</h2>
            <p className="hm-sub" style={{ marginTop: 6 }}>{t('home.quiz.sub1')}</p>
          </div>
          <img src="/mascot/m-laptop.png" alt="" style={{ width: 92, flex: 'none' }} />
        </div>
        <button onClick={() => navigate('/quiz/voice')} style={{ border: 0, background: '#F5F1FF', borderRadius: 22, padding: 16, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
          <div className="hm-icon-tile" style={{ width: 56, height: 56, borderRadius: '50%', background: '#6755B2' }}>
            <Icon name="microphone" color="FFFFFF" style="fluency-systems-filled" size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 17, lineHeight: '22px', fontWeight: 800, color: '#6755B2' }}>{t('home.quiz.voice')}</strong>
            <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: '#6E6880' }}>{t('home.quiz.voiceSub')}</span>
          </div>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#8A849A', fontSize: 13, fontWeight: 700 }}>
          <span style={{ flex: 1, height: 1, background: '#EEE9F7' }} />
          {t('home.quiz.or')}
          <span style={{ flex: 1, height: 1, background: '#EEE9F7' }} />
        </div>
        <div className="hm-stack" style={{ gap: 8 }}>
          <label htmlFor="home-child-name" style={{ fontSize: 15, fontWeight: 800 }}>{t('home.quiz.name')}</label>
          <input id="home-child-name" className="hm-input" value={draft.name ?? ''} maxLength={80} autoComplete="off" placeholder={t('home.quiz.namePlaceholder')} onChange={e => update('name', e.target.value)} />
        </div>
        <div className="hm-stack" style={{ gap: 10 }}>
          <div id="home-age-label" style={{ fontSize: 15, fontWeight: 800 }}>{t('home.quiz.age')}</div>
          <div className="hm-age-grid" role="group" aria-labelledby="home-age-label">{Array.from({ length: 19 }, (_, age) => <button key={age} aria-pressed={draft.age === age} onClick={() => update('age', age)}>{age === 18 ? '18+' : age}</button>)}</div>
        </div>
      </div>}
      {step === 2 && <div className="hm-stack" style={{ gap: 16 }}>
        <div>
          <h2>{t('home.quiz.title2')}</h2>
          <p className="hm-sub" style={{ marginTop: 6 }}>{t('home.quiz.sub2')}</p>
        </div>
        <button className="hm-text-button" style={{ border: '1.5px dashed #CBBFF5', background: 'white', borderRadius: 18, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={() => setMapOpen(true)}>
          <Icon name="map" size={22} color="6E6880" />
          {t('home.quiz.map')}
        </button>
        <div className="hm-stack" style={{ gap: 8 }}>{DISTRICTS.map((district, i) => <button key={district} className="hm-option" style={{ minHeight: 52, padding: '0 16px', borderRadius: 16, fontWeight: 700, boxShadow: 'none' }} aria-pressed={draft.district === district} onClick={() => update('district', district)}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${draft.district === district ? '#6755B2' : '#CFC8E0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: draft.district === district ? '#6755B2' : 'white' }} />
          </span>
          {t(`home.districts.${i}`)}
        </button>)}</div>
      </div>}
      {question && <div className="hm-stack" style={{ gap: 16 }}>
        <div>
          <h2>{t(`home.quiz.title${step}`).replace('{name}', draft.name?.trim() || t('home.child'))}</h2>
          <p className="hm-sub" style={{ marginTop: 6 }}>{t(`home.quiz.sub${step}`)}</p>
        </div>
        <div className="hm-options" style={{ gridTemplateColumns: `repeat(${question.cols},minmax(0,1fr))` }}>{question.values.map((value, i) => {
          const current = draft[question.key];
          const selected = Array.isArray(current) ? (current as string[]).includes(value) : current === value;
          return <button className="hm-option" aria-pressed={selected} key={value} onClick={() => {
            if (question.key === 'features') {
              const nextFeatures = toggleFeature(draft.features, FEATURES[i]);
              if (!nextFeatures.includes(FEATURES[6]))
                setCustom([]);
              update('features', nextFeatures);
            }
            else if (question.key === 'goals')
              update('goals', draft.goals.includes(GOALS[i]) ? draft.goals.filter(v => v !== GOALS[i]) : [...draft.goals, GOALS[i]]);
            else if (question.key === 'comm')
              update('comm', COMM[i]);
            else if (question.key === 'react')
              update('react', REACT[i]);
            else
              update('disability', DISABILITY[i]);
          }}>
            <span className="hm-icon-tile">
              <Icon name={question.icons[i]} size={26} />
            </span>
            <span className="hm-option-label">{t(`home.options.${question.key}.${i}`)}</span>
            {selected && <span className="hm-option-check">
              <Icon name="checkmark" color="FFFFFF" size={14} />
            </span>}
          </button>;
        })}</div>
        {question.key === 'features' && <div className="hm-stack" style={{ gap: 10 }}>
          <label htmlFor="home-custom-feature" style={{ fontSize: 15, fontWeight: 800 }}>{t('home.quiz.customTitle')}</label>
          <div className="hm-custom">
            <input id="home-custom-feature" className="hm-input" value={customText} maxLength={CUSTOM_LENGTH} autoComplete="off" placeholder={t('home.quiz.customPlaceholder')} onChange={e => setCustomText(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }} />
            <button disabled={!customText.trim()} onClick={addCustom}>{t('home.quiz.customAdd')}</button>
          </div>
          {custom.length > 0 && <div className="hm-custom-chips">{custom.map(value => <span key={value}>{value}
            <button aria-label={`${t('home.quiz.customRemove')}: ${value}`} onClick={() => removeCustom(value)}><Icon name="cancel" color="FFFFFF" size={12} /></button>
          </span>)}</div>}
        </div>}
      </div>}
    </div>
    <div className="hm-quiz-footer">
      <Primary onClick={next}>{t(step === 7 ? 'home.quiz.done' : 'home.quiz.next')}</Primary>
    </div>
    {mapOpen && <DistrictMap value={draft.district} toast={toast} onClose={() => setMapOpen(false)} onPick={district => update('district', district)} />}

  </Page>;
}
