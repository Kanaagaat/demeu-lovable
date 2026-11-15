import { RIDES_ENABLED } from '../lib/flags';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { installClickSounds } from '../lib/sfx';
import { TabBar } from './TabBar';
import { ToastProvider } from './Toast';
import './rides/rides-list.css';

export function AppShell() {
  const { pathname } = useLocation();
  const hideTabs = /^\/(?:welcome|consent|login|quiz|book)(?:\/|$)/.test(pathname) || (RIDES_ENABLED && (/^\/rides\/new\/?$/.test(pathname) || /^\/driver\/ride\//.test(pathname)));
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => shell.current ? installClickSounds(shell.current) : undefined, []);
  return (
    <div className="app-shell" data-tabs={!hideTabs} data-rides={RIDES_ENABLED && /^\/(?:rides|driver)(?:\/|$)/.test(pathname)} ref={shell}>
      <ToastProvider>
        <main className="app-content" key={pathname}><Outlet /></main>
        {hideTabs ? null : <TabBar />}
      </ToastProvider>
    </div>
  );
}
