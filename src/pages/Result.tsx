import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { useMatch } from '../lib/hooks';
import { usePersonalPlan } from '../lib/personalHooks';
import { Icon } from '../components/Icon';
import { MatchedSpecialist } from '../components/home/MatchedSpecialist';
import { Arrow, Header, Loading, Page, Primary, ResourceError, Safety } from '../components/home/ui';
const stageIcons: Record<string, string> = { clinic: 'todo-list', status: 'diploma', benefits: 'like', growth: 'school' };
// Plan steps that point at a catalogue specialist: role to filter by and the legacy code of their kz texts.
const roleSteps: Record<string, { role: string; code: string; icon: string }> = { 'g-speech': { role: 'Логопед', code: 'speech', icon: 'communication' }, 'g-defect': { role: 'Дефектолог', code: 'defect', icon: 'puzzle' }, 'g-neuro': { role: 'Нейропсихолог', code: 'neuro', icon: 'brain' }, 'g-psych': { role: 'Психолог', code: 'psych', icon: 'mental-health' }, 'g-motor': { role: 'Реабилитолог', code: 'rehab', icon: 'physical-therapy' }, 'g-aba': { role: 'АВА-терапевт', code: 'aba', icon: 'training' } };
const SHOWN_STEPS = 6;
export default function Result() {
  const { t, language } = useT();
  const { card } = useAppState();
  const navigate = useNavigate();
  const plan = usePersonalPlan(card);
  const match = useMatch(card);
  const steps = plan?.steps ?? [];
  const recommendations = steps.filter(step => roleSteps[step.id]);
  return <Page className="hm-result">
    <Header title={t('screens.result')} onBack={() => navigate('/')} />
    <div className="hm-result-scroll">
      <div className="hm-result-mascot">
        <img src="/mascot/m-hug.png" alt="" />
      </div>
      <div className="hm-result-content">

        <div style={{ textAlign: 'center' }}>
          <h1>{t('home.result.title').replace('{name}', card?.name?.trim() || t('home.child'))}</h1>
          <p className="hm-sub" style={{ marginTop: 6 }}>{t(card ? 'home.result.sub' : 'home.result.empty')}</p>
        </div>

        {card ? <>
          {recommendations.length > 0 && <>
            <h3 style={{ marginTop: 8 }}>{t('home.result.specialists')}</h3>
            {recommendations.map(step => <button className="hm-navigation-card" key={`role-${step.id}`} onClick={() => navigate(`/specialists?specialty=${encodeURIComponent(roleSteps[step.id].role)}`)}>
              <span className="hm-icon-tile" style={{ width: 52, height: 52, borderRadius: 16 }}><Icon name={roleSteps[step.id].icon} size={28} /></span>
              <div style={{ flex: 1 }}><strong>{t(`home.recommendations.${roleSteps[step.id].code}.title`)}</strong><small>{t(`home.recommendations.${roleSteps[step.id].code}.description`)}</small></div><Arrow />
            </button>)}
          </>}
          <h3 style={{ marginTop: 8 }}>{t('home.result.steps')}</h3>
          {steps.slice(0, SHOWN_STEPS).map((step, i) => <button className="hm-navigation-card" key={step.id} onClick={() => navigate(`/plan/${i}`)}>
            <span className="hm-icon-tile" style={{ width: 52, height: 52, borderRadius: 16 }}>
              <Icon name={stageIcons[step.stage] ?? 'todo-list'} size={28} />
            </span>
            <div style={{ flex: 1 }}>
              <strong>{language === 'kz' ? step.title_kk : step.title}</strong>
              <small>{step.subtitle}</small>
            </div>
            <Arrow />
          </button>)}
          {!steps.length && <p className="hm-sub">{t('home.result.noSteps')}</p>}

          <h3 style={{ marginTop: 8 }}>{t('home.matches')}</h3>
          {match.loading ? <Loading /> : match.error ? <ResourceError retry={match.reload} /> : match.data?.items.slice(0, 3).map(item => <MatchedSpecialist key={item.id} item={item} childName={card.name || undefined} />)}
          {!match.loading && !match.error && !match.data?.items.length && <p className="hm-sub">{t('home.noMatches')}</p>}
          <Safety result />
        </> : <Primary onClick={() => navigate('/quiz')}>{t('home.fillB')}</Primary>}

      </div>
    </div>
    {card && <div className="hm-result-footer">
      <Primary className="hm-secondary" onClick={() => navigate('/plan')}>{t('home.result.openPlan')}</Primary>
      <Primary onClick={() => navigate('/specialists')}>{t('home.result.allSpecialists')}</Primary>
    </div>}

  </Page>;
}
