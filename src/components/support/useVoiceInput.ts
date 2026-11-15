import { useEffect, useRef } from 'react';
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { results: ArrayLike<RecognitionResult> }
interface Recognition { lang: string; interimResults: boolean; onresult: ((e: RecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; abort: () => void }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function useVoiceInput(onText: (text: string) => void, language: string, notify: (message: string) => void, t: (key: string) => string) {
  const current = useRef<Recognition | null>(null);
  useEffect(() => () => { if (current.current) { current.current.onresult = null; current.current.onerror = null; current.current.abort(); } }, []);
  return () => {
    const host = window as SpeechWindow; const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Constructor) { notify(t('support.voiceUnsupported')); return; }
    current.current?.abort();
    const recognition = new Constructor(); current.current = recognition; recognition.lang = language === 'kz' ? 'kk-KZ' : 'ru-RU'; recognition.interimResults = false;
    recognition.onresult = event => { const result = Array.from(event.results).map(value => value[0].transcript).join(' '); onText(result.slice(0, 4000)); };
    recognition.onerror = () => notify(t('support.voiceError'));
    recognition.onend = () => { current.current = null; };
    try { recognition.start(); notify(t('support.listening')); } catch { notify(t('support.voiceError')); }
  };
}
