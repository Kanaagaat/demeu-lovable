import { RIDES_ENABLED } from '../lib/flags';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppState } from '../state/AppState';

const OPEN = ['/welcome', '/consent', '/login', '/sos'];

/** Not onboarded → only onboarding screens and SOS; onboarded → /welcome redirects home. */
export function OnboardingGuard({ children }: PropsWithChildren) {
  const { onboarded } = useAppState();
  const { pathname } = useLocation();
  if (!onboarded && !OPEN.includes(pathname) && !(RIDES_ENABLED && /^\/driver(?:\/|$)/.test(pathname))) return <Navigate to="/welcome" replace />;
  if (onboarded && pathname === '/welcome') return <Navigate to="/" replace />;
  return <>{children}</>;
}
