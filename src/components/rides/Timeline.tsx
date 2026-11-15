import { useT } from '../../i18n';
import { timelineIndex } from '../../lib/ridesRules';
import { RIDE_FLOW } from '../../lib/ridesTypes';
import type { RideStatus } from '../../lib/ridesTypes';
import './rides-track.css';

export function Timeline({ status }: { status: RideStatus }) {
  const { t } = useT();
  const current = timelineIndex(status);
  return <ol className="rd-track-timeline" aria-label={t('ridesTrack.trackTimeline')}>
    {RIDE_FLOW.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined}
      className={`rd-track-step ${index < current ? 'is-past' : index === current ? 'is-current' : 'is-future'}`}>
      <span className="rd-track-step-dot" aria-hidden="true" /><span>{t(`rides.timeline.${step}`)}</span>
    </li>)}
  </ol>;
}
