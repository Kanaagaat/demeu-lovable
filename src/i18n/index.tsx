import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import ru from './ru.json';
import kz from './kz.json';

type Language = 'ru' | 'kz';
type LeafKeys<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}` }[keyof T & string];
export type TranslationKey = LeafKeys<typeof ru>;
type Dictionary = { [key: string]: string | Dictionary };
// Namespaced dictionaries: src/i18n/ns/<ns>.<lang>.json → keys "<ns>.<path>" (one file per screen group, safe for parallel work).
const nsFiles = import.meta.glob('./ns/*.json', { eager: true, import: 'default' }) as Record<string, Dictionary>;
function withNamespaces(base: Dictionary, language: Language): Dictionary {
  const merged: Dictionary = { ...base };
  for (const [file, dict] of Object.entries(nsFiles)) {
    const match = /\/([\w-]+)\.(ru|kz)\.json$/.exec(file);
    if (match && match[2] === language) merged[match[1]] = dict;
  }
  return merged;
}
const dictionaries: Record<Language, Dictionary> = { ru: withNamespaces(ru, 'ru'), kz: withNamespaces(kz, 'kz') };
type I18n = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey | (string & {})) => string };
const I18nContext = createContext<I18n | null>(null);

function readLanguage(): Language {
  try { return localStorage.getItem('demeu.lang') === 'kz' ? 'kz' : 'ru'; }
  catch { return 'ru'; }
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, updateLanguage] = useState<Language>(readLanguage);
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem('demeu.lang', next); } catch { /* In-memory language still works. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language === 'kz' ? 'kk' : 'ru'; }, [language]);
  const t = useCallback((key: TranslationKey | (string & {})): string => {
    let value: string | Dictionary = dictionaries[language];
    for (const part of key.split('.')) {
      if (typeof value === 'string' || !(part in value)) return key;
      value = value[part];
    }
    return typeof value === 'string' ? value : key;
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useT must be used within I18nProvider');
  return context;
}
