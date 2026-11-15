import { useState } from 'react';
import { useT } from '../../../i18n';
import type { DriverLesson } from '../../../data/driverLessons';

export function Lesson({ lesson, referenceOnly, onPassed, onClose }: { lesson: DriverLesson; referenceOnly: boolean; onPassed: () => void; onClose: () => void }) {
  const { t } = useT();
  const [card, setCard] = useState(0);
  const [testing, setTesting] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [question, setQuestion] = useState(0);
  const selected = answers[question];
  const finished = question === 3;
  const score = answers.filter((answer, index) => answer === lesson.answers[index]).length;
  const key = `driver.trainLesson_${lesson.id}`;
  function next() {
    if (question === 2 && score === 3) onPassed();
    setQuestion(current => current + 1);
  }
  return <>
    <h2>{t(`${key}_title`)}</h2>
    <p className="dr-review dr-small">{t('driver.trainReview')}</p>
    {lesson.id === 'seizure' && <div className="dr-emergency">{t('driver.trainEmergency')}</div>}
    {!testing ? <>
      <p className="dr-step">{t('driver.trainCard').replace('{current}', String(card + 1)).replace('{total}', String(lesson.cards))}</p>
      <div className="dr-panel dr-lesson-card" aria-live="polite"><p>{t(`${key}_card${card + 1}`)}</p></div>
      <div className="dr-pagination"><button className="dr-secondary" disabled={card === 0} onClick={() => setCard(current => current - 1)}>{t('driver.trainPrevious')}</button>
        {card < lesson.cards - 1 ? <button className="dr-primary" onClick={() => setCard(current => current + 1)}>{t('driver.trainNext')}</button>
          : <button className="dr-primary" onClick={() => referenceOnly ? onClose() : setTesting(true)}>{t(referenceOnly ? 'driver.trainClose' : 'driver.trainStartTest')}</button>}
      </div>
    </> : finished ? <div className="dr-panel" role="status">
      <h3>{t(score === 3 ? 'driver.trainPassed' : 'driver.trainTryAgain')}</h3><p>{t('driver.trainScore').replace('{score}', String(score))}</p>
      {score !== 3 && <button className="dr-primary" onClick={() => { setQuestion(0); setAnswers([]); }}>{t('driver.trainRetake')}</button>}
    </div> : <>
      <p className="dr-step">{t('driver.trainQuestion').replace('{current}', String(question + 1))}</p>
      <h3>{t(`${key}_q${question + 1}`)}</h3>
      {[0, 1, 2].map(option => <button key={option} className="dr-answer" aria-pressed={selected === option} disabled={selected !== undefined} onClick={() => setAnswers(current => [...current, option])}>{t(`${key}_q${question + 1}_a${option}`)}</button>)}
      {selected !== undefined && <div className={`dr-feedback ${selected === lesson.answers[question] ? 'dr-correct' : ''}`} role="status"><p>
        {selected === lesson.answers[question] ? t('driver.trainCorrect') : t('driver.trainAlmost').replace('{answer}', t(`${key}_q${question + 1}_a${lesson.answers[question]}`))}
      </p></div>}
      <button className="dr-primary" disabled={selected === undefined} onClick={next}>{t(question === 2 ? 'driver.trainFinish' : 'driver.trainNext')}</button>
    </>}
    <button className="dr-secondary" onClick={onClose}>{t(referenceOnly ? 'driver.trainClose' : 'driver.trainToLessons')}</button>
  </>;
}
