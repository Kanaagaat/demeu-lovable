import type { VoiceField } from '../state/home';

// Deterministic, on-device parsing of a spoken story into quiz answers (no AI, no diagnosis:
// we only pick up what the parent said explicitly). Works for Russian and basic Kazakh.
const NUMBERS: Record<string, number> = {
  один: 1, одна: 1, годик: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18,
  бір: 1, екі: 2, үш: 3, төрт: 4, бес: 5, алты: 6, жеті: 7, сегіз: 8, тоғыз: 9, он: 10,
};
const WORDS = Object.keys(NUMBERS).sort((a, b) => b.length - a.length).join('|');
const KZ_TEENS = /он\s+(бір|екі|үш|төрт|бес|алты|жеті|сегіз)/;

const DISTRICTS: [RegExp, string][] = [
  [/алатау/, 'Алатауский'], [/алмалин|алмалы/, 'Алмалинский'], [/ауэзов|әуезов|ауезов/, 'Ауэзовский'],
  [/бостанды[кқ]/, 'Бостандыкский'], [/жет[ыі]су/, 'Жетысуский'], [/медеу/, 'Медеуский'],
  [/наурызбай/, 'Наурызбайский'], [/т[уү]рк?сиб|т[уү]рксіб/, 'Турксибский'],
];
const FEATURES: [RegExp, string][] = [
  [/аутиз|аутист| рас |спектр/, 'РАС'], [/ дцп |церебральн/, 'ДЦП'], [/даун/, 'Синдром Дауна'],
  [/ зпр | зрр | зпрр |задержк|отставан/, 'ЗПР / ЗРР'], [/слух|слабослыш|глух|кохлеар|естімей/, 'Нарушения слуха'],
  [/зрени|слабовид|незряч|слеп|нашар көр/, 'Нарушения зрения'],
];
// Named conditions outside the list go to «Другое» with the parent's own words.
const OTHER: [RegExp, string][] = [
  [/сдвг|гиперактив/, 'СДВГ'], [/эпилеп/, 'Эпилепсия'], [/алали/, 'Алалия'], [/дизартри/, 'Дизартрия'],
  [/заикан|заика/, 'Заикание'], [/генетическ/, 'Генетический синдром'],
];
const GOALS: [RegExp, string][] = [
  [/ реч|говорить|заговор|разговар|сөйле/, 'Речь'], [/поведен|истерик|мінез/, 'Поведение'],
  [/самостоят|сам од[еи]ва|сама од[еи]ва|сам ест|сама ест|горшок|өз бетінше/, 'Самостоятельность'],
  [/моторик|ходить|ходит плохо| рук|пальц|қозғал/, 'Моторика'], [/школ|учеб|учёб|читать|писать|счита|мектеп|оқу/, 'Учёба'],
  [/общени|общать|друз|сверстник|детьми|қарым|достар/, 'Общение'],
];

const has = (text: string, pattern: RegExp) => pattern.test(text);

export function parseTranscript(raw: string): VoiceField[] {
  const text = ` ${raw.toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:«»"()]/g, ' ').replace(/\s+/g, ' ')} `;
  const fields: VoiceField[] = [];

  const name = /(?:зовут|имя|есімі|атымыз|аты)\s+([а-яәғқңөұүһіa-z-]{2,20})/i.exec(raw.replace(/ё/g, 'е'));
  if (name && !/^(у|нас|его|ее|её|моего|моей|ребенка|сына|дочки|дочери)$/i.test(name[1]))
    fields.push({ key: 'name', value: name[1][0].toUpperCase() + name[1].slice(1).toLowerCase() });

  const unit = '(?:лет|год|года|годик|годика|годиков|жаста|жас)';
  const digit = new RegExp(`(\\d{1,2})\\s*${unit}`).exec(text)
    ?? /(?:ему|ей|исполнилось|возраст|жасы|жаста)\s+(\d{1,2})\b/.exec(text);
  let age: number | null = digit ? Number(digit[1]) : null;
  if (age === null) {
    const teen = KZ_TEENS.exec(text);
    const word = new RegExp(`(?:^|\\s)(${WORDS})\\s+${unit}`).exec(text) ?? new RegExp(`(?:ему|ей|исполнилось|жасы)\\s+(${WORDS})(?=\\s)`).exec(text);
    age = teen ? 10 + NUMBERS[teen[1]] : word ? NUMBERS[word[1]] : null;
  }
  if (age !== null && age <= 18)
    fields.push({ key: 'age', value: `${age}` });

  const district = DISTRICTS.find(([pattern]) => has(text, pattern));
  if (district)
    fields.push({ key: 'district', value: district[1] });

  const features = FEATURES.filter(([pattern]) => has(text, pattern)).map(([, value]) => value);
  const custom = OTHER.filter(([pattern]) => has(text, pattern)).map(([, value]) => value);
  if (custom.length)
    features.push('Другое');
  if (features.length)
    fields.push({ key: 'features', value: features.join(', ') });
  if (custom.length)
    fields.push({ key: 'custom', value: custom.join(', ') });

  const comm = has(text, /не говорит (?:фразами|предложениями)|отдельн[а-яәғқңөұүһі]* слов|несколько слов|пару слов|пару-тройку слов|только слова/) ? 'Отдельные слова'
    : has(text, /жест|карточк|pecs|пекс|ымда/) ? 'Жесты или карточки'
      : has(text, /не говорит|не разговаривает|пока молчит|не сөйлемейді|сөйлемейді/) ? 'Пока не говорит'
        : has(text, /говорит фразами|фразами|предложениями|хорошо говорит|сөйлемдер/) ? 'Говорит фразами' : null;
  if (comm)
    fields.push({ key: 'comm', value: comm });

  const react = has(text, /истерик|сильн[а-яәғқңөұүһі]* реакц|кричит|агресс|срыв|бурно/) ? 'Бывают сильные реакции'
    : has(text, /привык|нужно время|стесня|осваива|боится чуж|насторож|уйрену/) ? 'Нужно время, чтобы привыкнуть'
      : has(text, /спокойн|легко знаком|тыныш/) ? 'Спокойно' : null;
  if (react)
    fields.push({ key: 'react', value: react });

  const goals = GOALS.filter(([pattern]) => has(text, pattern)).map(([, value]) => value);
  if (goals.length)
    fields.push({ key: 'goals', value: goals.join(', ') });

  if (has(text, /инвалидн|мүгедек/)) {
    const disability = has(text, /оформля|в процессе|собира|рәсімдеп жатыр/) ? 'В процессе'
      : has(text, /нет инвалидн|не оформ|без инвалидн|инвалидности нет|мүгедектік жоқ/) ? 'Нет' : 'Да';
    fields.push({ key: 'disability', value: disability });
  }
  return fields;
}
