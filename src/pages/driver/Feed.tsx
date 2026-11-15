import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { errorText, getDriverId, sendOffer, setOnline } from '../../lib/rides';
import { RIDE_FLOW, type OfferView } from '../../lib/ridesTypes';
import { useDriver, useDriverFeed, useDriverRides } from '../../state/rides';
import { Toast } from '../../components/Toast';
import { ActiveRidePage, ActiveRideRoute, useActiveRideNotice } from '../../components/rides/driver/ActiveRideDetails';
import { FeedCard } from '../../components/rides/driver/FeedCard';
import { FeedOfferSheet } from '../../components/rides/driver/FeedOfferSheet';

export default function Feed() {
  const { t } = useT();
  const navigate = useNavigate();
  const driverId = getDriverId();
  const driver = useDriver();
  const feed = useDriverFeed(driverId);
  const rides = useDriverRides(driverId);
  const [busy, setBusy] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const { notice, notify } = useActiveRideNotice();
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    if (!feed.data) return;
    const added = seen.current ? feed.data.filter(item => !seen.current!.has(item.id)).map(item => item.id) : [];
    seen.current = new Set(feed.data.map(item => item.id));
    setFresh(added);
    const timer = setTimeout(() => setFresh([]), 2400);
    return () => clearTimeout(timer);
  }, [feed.data]);
  if (!driverId) return <Navigate to="/driver" replace />;
  const active = rides.data?.find(ride => RIDE_FLOW.slice(0, -1).includes(ride.status));
  const sheetItem = feed.data?.find(item => item.id === sheetId);
  async function offer(rideId: string, price: number): Promise<OfferView | null> {
    if (busy) return null;
    setBusy(true);
    try { const result = await sendOffer(rideId, driverId!, price); feed.refresh(); return result; }
    catch (error) { notify(errorText(t, error)); feed.refresh(); return null; }
    finally { setBusy(false); }
  }
  async function leave() {
    if (busy) return;
    setBusy(true);
    try { await setOnline(driverId!, false); driver.refresh(); navigate('/driver'); }
    catch (error) { notify(errorText(t, error)); }
    finally { setBusy(false); }
  }
  return <ActiveRidePage title={t('driver.feedTitle')}>
    <div className="dr-feed-online"><Link to="/driver">{t('driver.feedOnline')}</Link><button disabled={busy} onClick={() => void leave()}>{t('driver.feedGoOffline')}</button></div>
    {active && <Link className="dr-feed-active" to={`/driver/ride/${active.id}`}><strong>{t('driver.feedActive')}</strong><ActiveRideRoute ride={active} /></Link>}
    {(feed.offline || rides.offline || driver.offline) && <p role="status" className="dr-feed-banner">{t('rides.offline')}</p>}
    {feed.error === 'driver_not_ready' ? <div className="dr-feed-card"><h2>{t('driver.feedNotReady')}</h2><Link className="dr-feed-primary" to="/driver">{t('driver.feedPrepare')}</Link></div> : feed.error ? <div className="dr-feed-card" role="alert"><p>{errorText(t, feed.error)}</p><button className="dr-feed-secondary" onClick={feed.refresh}>{t('rides.button.retry')}</button></div> : feed.loading && !feed.data ? <p role="status">{t('rides.loading')}</p> : feed.data?.length === 0 ? <div className="dr-feed-empty"><img src="/mascot/m-peek.png" alt="" /><h2>{t('driver.feedEmpty')}</h2></div> : feed.data?.map(item => <FeedCard key={item.id} item={item} fresh={fresh.includes(item.id)} busy={busy} onOffer={price => offer(item.id, price)} onPrice={() => setSheetId(item.id)} />)}
    {sheetItem && <FeedOfferSheet key={`${sheetItem.id}:${sheetItem.parent_price}`} item={sheetItem} busy={busy} onClose={() => setSheetId(null)} onSend={async price => !!await offer(sheetItem.id, price)} />}
    <Toast message={notice?.text ?? null} />
  </ActiveRidePage>;
}
