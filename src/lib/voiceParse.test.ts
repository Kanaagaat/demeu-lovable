import { describe, expect, it } from 'vitest';
import { parseTranscript } from './voiceParse';
import { emptyDraft, voiceToDraft } from '../state/home';

const get = (text: string) => Object.fromEntries(parseTranscript(text).map(f => [f.key, f.value]));

describe('parseTranscript', () => {
  it('extracts quiz answers from a Russian story', () => {
    const fields = get('Сына зовут Айдан, ему 6 лет, живём в Бостандыкском районе. У него аутизм, говорит отдельными словами, к новым людям нужно время привыкнуть. Хотим развивать речь и общение. Инвалидность в процессе оформления.');
    expect(fields).toMatchObject({ name: 'Айдан', age: '6', district: 'Бостандыкский', features: 'РАС', comm: 'Отдельные слова', react: 'Нужно время, чтобы привыкнуть', disability: 'В процессе' });
    expect(fields.goals).toContain('Речь');
    expect(fields.goals).toContain('Общение');
  });
  it('understands number words and other conditions', () => {
    const fields = get('дочке пять лет, Медеуский район, эпилепсия и ДЦП, пока не говорит, бывают истерики');
    expect(fields).toMatchObject({ age: '5', district: 'Медеуский', features: 'ДЦП, Другое', custom: 'Эпилепсия', comm: 'Пока не говорит', react: 'Бывают сильные реакции' });
  });
  it('does not invent answers', () => {
    expect(parseTranscript('добрый день, расскажу позже')).toEqual([]);
    expect(get('встреча была хорошей').goals).toBeUndefined();
  });
  it('maps parsed fields into the quiz draft', () => {
    const draft = voiceToDraft(parseTranscript('ему 7 лет, Турксибский район, синдром Дауна, говорит фразами, спокойно, нет инвалидности'), emptyDraft());
    expect(draft).toMatchObject({ age: 7, district: 'Турксибский', features: ['Синдром Дауна'], comm: 'Говорит фразами', react: 'Спокойно', disability: 'Нет' });
  });
});
