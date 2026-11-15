import { useT } from '../i18n';

export function LanguageSwitch() {
  const { t, language, setLanguage } = useT();
  return <div className="flex min-h-[58px] items-center justify-between gap-3">
    <span className="text-base font-bold">{t('common.language')}</span>
    <div role="group" aria-label={t('common.language')} className="flex gap-0.5 rounded-full bg-surface p-[3px]">
      {(['ru', 'kz'] as const).map((lang) => (
        <button key={lang} type="button" aria-pressed={language === lang} onClick={() => setLanguage(lang)} className={`h-9 min-w-12 rounded-full text-sm font-extrabold ${language === lang ? 'bg-white text-brand shadow-card' : 'text-muted'}`}>
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  </div>;
}
