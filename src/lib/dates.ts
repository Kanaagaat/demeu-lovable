/**
 * Date formatting that does not depend on the browser's Kazakh locale data.
 * Many browsers ship no `kk` month names and print "M12 5" instead of "5 желтоқсан", so KZ is assembled by hand.
 */
const KZ_MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
const KZ_MONTHS_SHORT = ['қаң.', 'ақп.', 'нау.', 'сәу.', 'мам.', 'мау.', 'шіл.', 'там.', 'қыр.', 'қаз.', 'қар.', 'жел.'];
const KZ_WEEKDAYS_SHORT = ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб'];
const KZ_WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(value: Date | string | number, language: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (language !== 'kz') return new Intl.DateTimeFormat('ru-RU', options).format(date);
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', { timeZone: options.timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)) parts[part.type] = part.value;
  const month = Number(parts.month) - 1, weekday = EN_WEEKDAYS.indexOf(parts.weekday);
  const segments: string[] = [];
  if (options.weekday) segments.push((options.weekday === 'long' ? KZ_WEEKDAYS : KZ_WEEKDAYS_SHORT)[weekday]);
  const day = options.day ? String(Number(parts.day)) : '';
  const monthName = options.month === 'long' ? KZ_MONTHS[month] : options.month === 'short' ? KZ_MONTHS_SHORT[month] : options.month ? String(month + 1).padStart(2, '0') : '';
  const datePart = options.year && !options.day ? [monthName, parts.year].filter(Boolean).join(' ') : [day, monthName, options.year ? parts.year : ''].filter(Boolean).join(' ');
  if (datePart) segments.push(datePart);
  const head = segments.join(', ');
  const time = options.hour || options.minute ? `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}` : '';
  return [head, time].filter(Boolean).join(', ');
}
