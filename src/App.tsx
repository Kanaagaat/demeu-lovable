import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { OnboardingGuard } from './components/OnboardingGuard';
import { Placeholder } from './components/Placeholder';
import { I18nProvider, useT } from './i18n';
import { AppStateProvider } from './state/AppState';
import { RIDES_ENABLED } from './lib/flags';

// After a deploy, a stale tab/service worker may ask for chunk files that no longer exist: reload once instead of a blank screen.
function page(load: () => Promise<{ default: () => JSX.Element }>) {
  return lazy(() => load().catch((error: unknown) => {
    try {
      if (!sessionStorage.getItem('demeu.chunkReload')) { sessionStorage.setItem('demeu.chunkReload', '1'); window.location.reload(); return new Promise<never>(() => {}); }
    } catch { /* fall through */ }
    throw error;
  }));
}

// One file per screen in src/pages — screen groups are implemented in parallel without touching this file.
const Welcome = page(() => import('./pages/Welcome'));
const Consent = page(() => import('./pages/Consent'));
const Login = page(() => import('./pages/Login'));
const Home = page(() => import('./pages/Home'));
const Quiz = page(() => import('./pages/Quiz'));
const Voice = page(() => import('./pages/Voice'));
const Result = page(() => import('./pages/Result'));
const Specialists = page(() => import('./pages/Specialists'));
const Specialist = page(() => import('./pages/Specialist'));
const Compare = page(() => import('./pages/Compare'));
const Plan = page(() => import('./pages/Plan'));
const Step = page(() => import('./pages/Step'));
const Resources = page(() => import('./pages/Resources'));
const Book = page(() => import('./pages/Book'));
const Booked = page(() => import('./pages/Booked'));
const My = page(() => import('./pages/My'));
const Feedback = page(() => import('./pages/Feedback'));
const Notifications = page(() => import('./pages/Notifications'));
const Support = page(() => import('./pages/Support'));
const Chat = page(() => import('./pages/Chat'));
const Sos = page(() => import('./pages/Sos'));
const Useful = page(() => import('./pages/Useful'));
const Article = page(() => import('./pages/Article'));
const Profile = page(() => import('./pages/Profile'));
const Privacy = page(() => import('./pages/Privacy'));
const Cabinet = page(() => import('./pages/Cabinet'));
const Admin = page(() => import('./pages/Admin'));
const Calendar = page(() => import('./pages/Calendar'));
const Progress = page(() => import('./pages/Progress'));
// Rides («DEMEU Жол») — all routes behind VITE_RIDES_ENABLED.
const Rides = page(() => import('./pages/rides/Rides'));
const NewRide = page(() => import('./pages/rides/NewRide'));
const RideScreen = page(() => import('./pages/rides/RideScreen'));
const Driver = page(() => import('./pages/driver/Driver'));
const Training = page(() => import('./pages/driver/Training'));
const Checklist = page(() => import('./pages/driver/Checklist'));
const Feed = page(() => import('./pages/driver/Feed'));
const DriverRide = page(() => import('./pages/driver/DriverRide'));

const S = ({ children }: { children: ReactNode }) => <Suspense fallback={null}>{children}</Suspense>;

function NotFound() {
  const { t } = useT();
  return <Placeholder title={t('screens.notFound')} back />;
}

function AppRoutes() {
  return <Routes><Route path="/admin" element={<S><Admin /></S>} />
    <Route element={<OnboardingGuard><AppShell /></OnboardingGuard>}>
      <Route path="/welcome" element={<S><Welcome /></S>} />
      <Route path="/consent" element={<S><Consent /></S>} />
      <Route path="/login" element={<S><Login /></S>} />
      <Route path="/" element={<S><Home /></S>} />
      <Route path="/quiz" element={<S><Quiz /></S>} />
      <Route path="/quiz/voice" element={<S><Voice /></S>} />
      <Route path="/result" element={<S><Result /></S>} />
      <Route path="/specialists" element={<S><Specialists /></S>} />
      <Route path="/specialists/:id" element={<S><Specialist /></S>} />
      <Route path="/compare" element={<S><Compare /></S>} />
      <Route path="/plan" element={<S><Plan /></S>} />
      <Route path="/plan/:idx" element={<S><Step /></S>} />
      <Route path="/resources" element={<S><Resources /></S>} />
      <Route path="/book/:id" element={<S><Book /></S>} />
      <Route path="/booked/:id" element={<S><Booked /></S>} />
      <Route path="/my" element={<S><My /></S>} />
      <Route path="/feedback/:id" element={<S><Feedback /></S>} />
      <Route path="/notifications" element={<S><Notifications /></S>} />
      <Route path="/support" element={<S><Support /></S>} />
      <Route path="/support/chat" element={<S><Chat /></S>} />
      <Route path="/sos" element={<S><Sos /></S>} />
      <Route path="/useful" element={<S><Useful /></S>} />
      <Route path="/useful/:id" element={<S><Article /></S>} />
      <Route path="/profile" element={<S><Profile /></S>} />
      <Route path="/profile/privacy" element={<S><Privacy /></S>} />
      <Route path="/cabinet" element={<S><Cabinet /></S>} />
      <Route path="/calendar" element={<S><Calendar /></S>} />
      <Route path="/progress" element={<S><Progress /></S>} />
      {RIDES_ENABLED && <>
        <Route path="/rides" element={<S><Rides /></S>} />
        <Route path="/rides/new" element={<S><NewRide /></S>} />
        <Route path="/rides/:id" element={<S><RideScreen /></S>} />
        <Route path="/driver" element={<S><Driver /></S>} />
        <Route path="/driver/training" element={<S><Training /></S>} />
        <Route path="/driver/checklist" element={<S><Checklist /></S>} />
        <Route path="/driver/feed" element={<S><Feed /></S>} />
        <Route path="/driver/ride/:id" element={<S><DriverRide /></S>} />
      </>}
      <Route path="*" element={<NotFound />} />
  </Route></Routes>;
}

export default function App() {
  return <I18nProvider><AppStateProvider><AppRoutes /></AppStateProvider></I18nProvider>;
}
