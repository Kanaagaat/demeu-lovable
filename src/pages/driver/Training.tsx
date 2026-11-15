import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { useDriver } from '../../state/rides';
import { patchDriver } from '../../lib/rides';
import type { Driver } from '../../lib/ridesTypes';
import { DRIVER_LESSONS, readLessons, saveLessons, type DriverLessonId } from '../../data/driverLessons';
import { DriverError, DriverLoading, DriverPage, ReadyMark } from '../../components/rides/driver/ui';
import { Lesson } from '../../components/rides/driver/Lesson';

function Course({ driver, refresh }: { driver: Driver; refresh: () => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(() => readLessons(driver.id));
  const [selected, setSelected] = useState<DriverLessonId | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const saving = useRef(false);
  const allPassed = completed.length === DRIVER_LESSONS.length;
  const trained = driver.trained || saved;
  // Resume the final save if the user left after the last test, including after a network failure.
  useEffect(() => {
    if (!allPassed || trained || saving.current) return;
    saving.current = true;
    setBusy(true);
    void patchDriver(driver.id, { trained: true }).then(() => { setSaved(true); refresh(); }).catch(setError).finally(() => { saving.current = false; setBusy(false); });
  }, [allPassed, trained, driver.id, refresh]);
  async function retry() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try { await patchDriver(driver.id, { trained: true }); setSaved(true); refresh(); }
    catch (error) { setError(error); } finally { saving.current = false; setBusy(false); }
  }
  const lesson = DRIVER_LESSONS.find(item => item.id === selected);
  function pass(id: DriverLessonId) {
    const next = [...new Set([...completed, id])];
    saveLessons(driver.id, next); setCompleted(next);
  }
  return <DriverPage title={t('driver.trainTitle')} onBack={() => lesson ? setSelected(null) : navigate(-1)}>
    {trained && !reviewing ? <div className="dr-success"><img src="/mascot/m-thumbs.png" alt="" /><h2>{t('driver.trainSuccess')}</h2><span className="dr-badge">{t('driver.trainBadge')}</span><Link className="dr-primary" to="/driver/checklist">{t('driver.trainToChecklist')}</Link><button className="dr-secondary" onClick={() => setReviewing(true)}>{t('driver.trainReviewLessons')}</button></div>
      : lesson ? <Lesson key={lesson.id} lesson={lesson} referenceOnly={false} onPassed={() => pass(lesson.id)} onClose={() => setSelected(null)} />
        : <><h2>{t('driver.trainIntro')}</h2><p className="dr-muted">{t('driver.trainIntroText')}</p>
          {DRIVER_LESSONS.map((item, index) => <div key={item.id} className="dr-panel"><div className="dr-ready-row"><ReadyMark ready={trained || completed.includes(item.id)} /><h3>{index + 1}. {t(`driver.trainLesson_${item.id}_title`)}</h3></div><p className="dr-small dr-muted">{t('driver.trainReview')}</p><button className="dr-secondary" onClick={() => setSelected(item.id)}>{t(trained || completed.includes(item.id) ? 'driver.trainRepeatLesson' : 'driver.trainOpenLesson')}</button></div>)}
        </>}
    {busy && <p role="status">{t('driver.trainSaving')}</p>}<DriverError error={error} />{error !== null && <button className="dr-primary" disabled={busy} onClick={() => void retry()}>{t('driver.regRetry')}</button>}
  </DriverPage>;
}
export default function Training() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reference = DRIVER_LESSONS.find(lesson => lesson.id === params.get('lesson'));
  const { data: driver, loading, error, offline, refresh } = useDriver();
  if (reference) return <DriverPage title={t('driver.trainTitle')} onBack={() => navigate(-1)}><Lesson key={reference.id} lesson={reference} referenceOnly onPassed={() => undefined} onClose={() => navigate(-1)} /></DriverPage>;
  if (loading || (!driver && (error || offline))) return <DriverPage title={t('driver.trainTitle')}><DriverLoading retry={loading ? undefined : refresh} /></DriverPage>;
  if (!driver) return <Navigate to="/driver" replace />;
  return <Course key={driver.id} driver={driver} refresh={refresh} />;
}
