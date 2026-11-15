import { SpecialistCard } from '../SpecialistCard';
import { Icon } from '../Icon';
import { useT } from '../../i18n';
import type { MatchItem } from '../../lib/types';
import { optionLabel } from './labels';

function translatedReason(reason: string, t: (key: string) => string): string {
  const fixed: Record<string, string> = {
    'Опыт с неговорящими детьми': 'nonSpeaking', 'Умеет работать с сильными реакциями': 'reactions',
    'Развивает речь': 'speech', 'Поддерживает общение': 'communication', 'Помогает с поведением': 'behavior',
    'Развивает моторику': 'motor', 'Поддерживает обучение': 'learning', 'Развивает самостоятельность': 'independence',
    'Есть занятия на дому': 'atHome', 'Есть занятия онлайн': 'online', 'Проверено Мама Про (демо)': 'verified',
  };
  if (fixed[reason]) return t(`home.reasons.${fixed[reason]}`);
  const travel = /^(\d+) мин от дома/.exec(reason);
  if (travel) return t('home.reasons.travel').replace('{n}', travel[1]);
  if (reason.startsWith('Работал(а) с ')) return t('home.reasons.experience').replace('{features}', reason.slice('Работал(а) с '.length).split(', ').map(value => optionLabel(value, t)).join(', '));
  return reason;
}

export function MatchedSpecialist({ item, childName }: { item: MatchItem; childName?: string }) {
  const { t, language } = useT();
  return <div className="hm-stack" style={{ gap: 6 }}>
    <SpecialistCard item={item} childName={childName} compact />
    {item.reasons.length > 0 && <ul aria-label={t('home.reasonsTitle')} style={{ margin: 0, padding: '10px 14px', listStyle: 'none', background: '#F5F1FF', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {item.reasons.slice(0, 3).map(reason => <li key={reason} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: '#6755B2', fontSize: 13, lineHeight: '18px', fontWeight: 700 }}><Icon name="checkmark" color="4F7454" size={16} />{language === 'kz' ? translatedReason(reason, t) : reason}</li>)}
    </ul>}
  </div>;
}
