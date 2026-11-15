import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { getFavDrivers, setFavDriver } from '../../lib/favDrivers';
import { errorText, rateRide } from '../../lib/rides';
import { formatPrice } from '../../lib/ridesRules';
import { RidesError } from '../../lib/ridesTypes';
import type { RatingTag, RideView } from '../../lib/ridesTypes';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { useToast } from '../Toast';
import './rides-track.css';

const TAGS: RatingTag[] = ['calm', 'careful', 'on_time'];

export function RideDone({ ride }: { ride: RideView }) {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const driverId = ride.driver?.id ?? ride.driver_id;
  const [favourites, setFavourites] = useState(getFavDrivers);
  const favourite = !!driverId && favourites.includes(driverId);
  const rated = ride.rating_stars !== null || sent;
  const submit = async () => {
    if (!stars || rated || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await rateRide(ride.id, stars, tags); setSent(true); }
    catch (reason) {
      if (reason instanceof RidesError && reason.code === 'already_rated') setSent(true);
      else setError(errorText(t, reason));
    } finally { lock.current = false; setBusy(false); }
  };
  return <section className="rd-track-page rd-done-page">
    <div className="rd-track-content">
      <header className="rd-done-hero"><img src="/mascot/m-cheer.png" alt="" /><h1>{t('ridesTrack.doneTitle')}</h1></header>
      <section className="rd-track-card rd-done-summary" aria-label={t('ridesTrack.doneSummary')}>
        {ride.final_price !== null && <h2>{t('ridesTrack.doneCash').replace('{price}', formatPrice(ride.final_price))}</h2>}
        <p className="rd-done-route">{ride.from_address || ride.from_district}<span aria-hidden="true"> → </span>{ride.to_address}</p>
        {ride.driver && <div><h3>{ride.driver.name}</h3><p className="rd-track-muted">{ride.driver.car} · {ride.driver.plate}</p></div>}
      </section>
      {rated ? <p className="rd-done-thanks" role="status">{t(sent ? 'ridesTrack.doneThanks' : 'ridesTrack.doneAlreadyRated')}</p> : <form className="rd-track-card rd-done-rating" onSubmit={event => { event.preventDefault(); void submit(); }} aria-label={t('ridesTrack.doneRate')}>
        <h2>{t('ridesTrack.doneRate')}</h2>
        <div className="rd-done-stars" role="group" aria-label={t('ridesTrack.doneStars')}>
          {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" disabled={busy} aria-pressed={value === stars}
            aria-label={t('ridesTrack.doneStarLabel').replace('{stars}', String(value))} className={value <= stars ? 'is-selected' : ''} onClick={() => setStars(value)}><span aria-hidden="true">★</span></button>)}
        </div>
        <div className="rd-done-tags" role="group" aria-label={t('ridesTrack.doneTags')}>
          {TAGS.map(tag => <Chip key={tag} selected={tags.includes(tag)} disabled={busy} onClick={() => setTags(current => current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag])}>{t(`rides.tag.${tag}`)}</Chip>)}
        </div>
        {error && <p className="rd-track-error" role="alert">{error}</p>}
        <Button type="submit" disabled={!stars || busy}>{busy ? t('rides.loading') : t('ridesTrack.doneSendRating')}</Button>
      </form>}
      {driverId && <button type="button" className="rd-done-favourite" aria-pressed={favourite} onClick={() => {
        if (setFavDriver(driverId, !favourite)) {
          setFavourites(getFavDrivers());
          toast(t(favourite ? 'ridesTrack.doneFavouriteRemoved' : 'ridesTrack.doneFavouriteAdded'));
        } else toast(t('ridesTrack.doneFavouriteError'));
      }}>{t('ridesTrack.doneFavourite')}</button>}
      <footer className="rd-done-actions">
        <Button onClick={() => navigate('/rides')}>{t('rides.button.done')}</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>{t('rides.button.home')}</Button>
      </footer>
    </div>
  </section>;
}
