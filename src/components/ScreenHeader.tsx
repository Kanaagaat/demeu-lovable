import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { Icon } from './Icon';

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <header className="flex h-[60px] shrink-0 items-center px-5">
      <button type="button" aria-label={t('common.back')} onClick={onBack ?? (() => navigate(-1))} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-back">
        <Icon name="back" size={22} />
      </button>
      <h1 className="mr-12 flex-1 text-center text-lg font-extrabold">{title}</h1>
    </header>
  );
}
