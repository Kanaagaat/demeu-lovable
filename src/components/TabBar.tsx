import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import { Icon } from './Icon';

const tabs = [
  { path: '/', key: 'home', icon: 'home' },
  { path: '/plan', key: 'plan', icon: 'todo-list' },
  { path: '/specialists', key: 'specialists', icon: 'conference-call' },
  { path: '/support', key: 'support', icon: 'support' },
  { path: '/profile', key: 'profile', icon: 'user' },
] as const;

export function TabBar() {
  const { t } = useT();
  return (
    <nav aria-label={t('common.navigation')} className="tab-bar">
      {tabs.map(({ path, key, icon }) => (
        <NavLink key={path} to={path} end={path === '/'} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          {({ isActive }) => <>
            <span className={`flex h-[30px] w-14 items-center justify-center rounded-[15px] ${isActive ? 'bg-mist' : 'bg-transparent'}`}>
              <Icon name={icon} color={isActive ? '6755B2' : '8A849A'} style={isActive ? 'fluency-systems-filled' : 'fluency-systems-regular'} />
            </span>
            <span className={`text-[11px] font-extrabold leading-[14px] ${isActive ? 'text-brand' : 'text-muted'}`}>{t(`tabs.${key}`)}</span>
          </>}
        </NavLink>
      ))}
    </nav>
  );
}
