import { COMM, DISABILITY, FEATURES, GOALS, REACT } from '../../state/home';
export function optionLabel(value: string, t: (key: string) => string) {
  for (const [key, values] of Object.entries({ features: FEATURES, comm: COMM, react: REACT, goals: GOALS, disability: DISABILITY })) {
    const index = (values as string[]).indexOf(value);
    if (index >= 0)
      return t(`home.options.${key}.${index}`);
  }
  return value;
}
export function ageLabel(age: number, language: string, t: (key: string) => string) {
  const plural = new Intl.PluralRules(language === 'kz' ? 'kk' : 'ru').select(age);
  return `${age === 18 ? '18+' : age} ${t(`home.ageUnits.${plural}`)}`;
}
