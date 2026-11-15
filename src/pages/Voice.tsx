import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { CUSTOM_LENGTH, CUSTOM_MAX, FEATURES, clearDraft, completeCard, missingStep, readCustomFeatures, readDraft, saveCustomFeatures, saveDraft, toggleFeature, voiceToDraft } from '../state/home';
import { parseTranscript } from '../lib/voiceParse';
import { play } from '../lib/sfx';
import { LiveWave } from '../components/home/LiveWave';
import type { VoiceField } from '../state/home';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Header, Loading, Page, Primary, Safety } from '../components/home/ui';
import { optionLabel } from '../components/home/labels';
type Stage = 'idle' | 'rec' | 'proc' | 'review';
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
const speechConstructor = () => typeof window === 'undefined' ? undefined : (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export default function Voice() {
  const { t, language } = useT();
  const { card, setCard } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('idle');
  const [seconds, setSeconds] = useState(0);
  const [fields, setFields] = useState<VoiceField[]>([]);
  const [edit, setEdit] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const active = useRef(0);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const speech = useRef<Recognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const [live, setLive] = useState('');
  const [waveStream, setWaveStream] = useState<MediaStream | null>(null);
  const [boost, setBoost] = useState(0);
  const boostTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    alive.current = true;
    const invalidate = () => { active.current++; };
    return () => {
      alive.current = false; invalidate(); controller.current?.abort();
      clearTimeout(boostTimer.current);
      if (speech.current) { speech.current.onend = null; speech.current.onresult = null; speech.current.onerror = null; speech.current.abort(); }
      if (recorder.current?.state === 'recording')
        recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    if (stage !== 'rec')
      return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [stage]);
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setWaveStream(null); };
  const processAudio = async (blob: Blob | null, run: number, reason: 'denied' | 'unsupported' = 'unsupported') => {
    if (!alive.current || active.current !== run)
      return;
    setStage('proc');
    release();
    // Fallback for browsers without speech recognition: server transcription (needs OPENAI_API_KEY on the API).
    // No fake example is ever shown: if nothing was recognised, we say so honestly.
    let heard = '';
    const aborter = new AbortController();
    controller.current = aborter;
    const timeout = setTimeout(() => aborter.abort(), 30000);
    try {
      const url = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
      if (url && blob && blob.size > 0 && blob.size <= 2 * 1024 * 1024) {
        const body = new FormData();
        body.append('audio', blob, blob.type.includes('mp4') ? 'recording.m4a' : 'recording.webm');
        const response = await fetch(`${url}/api/voice/parse`, { method: 'POST', body, signal: aborter.signal });
        const parsed: unknown = response.ok ? await response.json() : null;
        if (parsed && typeof parsed === 'object' && 'transcript' in parsed && typeof parsed.transcript === 'string' && !('mock' in parsed && parsed.mock))
          heard = parsed.transcript;
      }
    }
    catch { /* handled below */ }
    finally {
      clearTimeout(timeout);
    }
    if (!alive.current || active.current !== run)
      return;
    if (!heard.trim()) {
      play('error');
      setStage('idle');
      toast(t(blob ? 'home.voice.unsupported' : `home.voice.${reason}`));
      return;
    }
    finishSpeech(heard, false, run);
  };
  // Primary path: the browser's own speech recognition (Chrome, Android, iOS Safari) + on-device parsing.
  const startSpeech = (Constructor: new () => Recognition, run: number) => {
    let done = '';
    let session = '';
    let interim = '';
    let restarts = 0;
    let denied = false;
    let failed = false;
    let stopping = false;
    let finished = false;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(restartTimer);
      speech.current = null;
      finishSpeech(done, denied && !done.trim(), run, failed);
    };
    const begin = () => {
      const recognition = new Constructor();
      speech.current = recognition;
      recognition.lang = language === 'kz' ? 'kk-KZ' : 'ru-RU';
      // Android Chrome duplicates words in continuous mode: there we listen phrase by phrase and restart.
      recognition.continuous = !/Android/i.test(navigator.userAgent);
      recognition.interimResults = true;
      session = '';
      interim = '';
      recognition.onresult = event => {
        const results = Array.from(event.results);
        session = results.filter(r => r.isFinal).map(r => r[0].transcript.trim()).join(' ');
        interim = results.filter(r => !r.isFinal).map(r => r[0].transcript.trim()).join(' ');
        if (alive.current && active.current === run) {
          setLive([done, session, interim].filter(Boolean).join(' '));
          setBoost(1);
          clearTimeout(boostTimer.current);
          boostTimer.current = setTimeout(() => setBoost(0), 700);
        }
      };
      recognition.onerror = event => {
        // Only the first start can be a real permission refusal; iOS refuses later restarts made outside a tap — then we just finish.
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) { if (restarts === 0) denied = true; else stopping = true; }
        else if (!['no-speech', 'aborted'].includes(event.error)) failed = true;
      };
      recognition.onend = () => {
        // iOS Safari may end without marking the last phrase final: keep what was heard as interim too.
        done = [done, [session, interim].filter(Boolean).join(' ')].filter(Boolean).join(' ');
        session = '';
        interim = '';
        if (speech.current === recognition) speech.current = null;
        if (!alive.current || active.current !== run)
          return;
        // Mobile browsers end recognition after a pause: keep listening until the parent presses stop.
        // A short delay: starting again synchronously inside onend throws on some Android builds.
        if (!stopping && !denied && !failed && restarts < 200) {
          restarts++;
          restartTimer = setTimeout(() => {
            if (stopping || !alive.current || active.current !== run) { finish(); return; }
            try { begin(); }
            catch { finish(); }
          }, 250);
          return;
        }
        finish();
      };
      recognition.start();
    };
    stopSpeech.current = () => {
      stopping = true;
      if (speech.current) speech.current.stop();
      else finish();
      // Safety net: some browsers never fire onend after stop/abort.
      setTimeout(finish, 4000);
    };
    try { begin(); }
    catch { finished = true; finishSpeech('', true, run); }
  };
  const stopSpeech = useRef<(() => void) | null>(null);
  const finishSpeech = (text: string, denied: boolean, run: number, failed = false) => {
    stopSpeech.current = null;
    release();
    if (!alive.current || active.current !== run)
      return;
    const heard = text.trim().slice(0, 4000);
    if (!heard) {
      setStage('idle');
      setLive('');
      play('error');
      toast(t(denied ? 'home.voice.denied' : failed ? 'home.voice.unsupported' : 'home.voice.empty'));
      return;
    }
    const parsed = parseTranscript(heard);
    play(parsed.length ? 'success' : 'pop');
    setTranscript(heard);
    setFields(parsed);
    setEdit(null);
    setStage('review');
  };
  const start = async () => {
    const run = ++active.current;
    setSeconds(0);
    setStage('rec');
    setLive('');
    setTranscript('');
    play('recStart');
    // A previous recognition still closing would make the new start() throw («через раз»): drop it first.
    if (speech.current) { speech.current.onend = null; speech.current.onresult = null; speech.current.onerror = null; try { speech.current.abort(); } catch { /* already closed */ } speech.current = null; }
    const Constructor = speechConstructor();
    if (Constructor) {
      startSpeech(Constructor, run);
      // Live level meter for the waveform (skipped on iOS and Android, where a second mic capture can break dictation).
      if (!isIOS() && !/Android/i.test(navigator.userAgent) && navigator.mediaDevices?.getUserMedia)
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(media => {
          if (!alive.current || run !== active.current || !stopSpeech.current) { media.getTracks().forEach(track => track.stop()); return; }
          stream.current = media;
          setWaveStream(media);
        }).catch(() => undefined);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error('Microphone unavailable');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || run !== active.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      setWaveStream(media);
      const recording = new MediaRecorder(media);
      recorder.current = recording;
      const chunks: BlobPart[] = [];
      let handled = false;
      const finish = (audio: Blob | null) => {
        if (!handled) {
          handled = true;
          void processAudio(audio, run);
        }
      };
      recording.ondataavailable = event => {
        if (event.data.size)
          chunks.push(event.data);
      };
      recording.onstop = () => finish(new Blob(chunks, { type: recording.mimeType || 'audio/webm' }));
      recording.onerror = () => {
        finish(null); if (recording.state === 'recording')
          recording.stop();
      };
      recording.start();
    }
    catch (error) {
      void processAudio(null, run, error instanceof Error && error.message === 'Microphone unavailable' ? 'unsupported' : 'denied');
    }
  };
  const stop = () => {
    play('recStop');
    if (stopSpeech.current) {
      setStage('proc');
      stopSpeech.current();
      const pending = speech.current;
      setTimeout(() => { if (pending && speech.current === pending) pending.abort(); }, 2500);
      return;
    }
    setStage('proc');
    if (recorder.current?.state === 'recording')
      recorder.current.stop();
    else {
      const run = ++active.current;
      void processAudio(null, run);
    }
  };
  const toDraft = () => {
    let draft = voiceToDraft(fields, readDraft(card));
    const custom = fields.find(f => f.key === 'custom')?.value.split(',').map(v => v.trim().slice(0, CUSTOM_LENGTH)).filter(Boolean) ?? [];
    if (custom.length) {
      saveCustomFeatures([...new Set([...readCustomFeatures(), ...custom])].slice(0, CUSTOM_MAX));
      if (!draft.features.includes(FEATURES[6]))
        draft = { ...draft, features: toggleFeature(draft.features, FEATURES[6]) };
    }
    return draft;
  };
  const save = () => {
    const draft = toDraft();
    const saved = completeCard(draft);
    if (saved) {
      setCard(saved);
      clearDraft();
      navigate('/result');
    }
    else {
      saveDraft(draft);
      toast(t('home.voice.complete'));
      navigate('/quiz', { state: { step: missingStep(draft) ?? 1 } });
    }
  };
  return <Page className="hm-voice">
    <Header title={t('home.quiz.voice')} onBack={() => navigate('/quiz')} />

    {(stage === 'idle' || stage === 'rec') && <div className="hm-voice-talk">
      <div style={{ background: '#F5F1FF', borderRadius: 22, padding: 18, fontSize: 17, lineHeight: '25px', fontWeight: 600, textAlign: 'center' }}>{t('home.voice.hint')}</div>
      <div className="hm-voice-controls">
        {stage === 'idle' && <img src="/mascot/m-meditate.png" alt="" style={{ width: 110, marginBottom: -8 }} />}
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '.02em', fontVariantNumeric: 'tabular-nums' }} role="timer">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</div>
        <LiveWave stream={waveStream} active={stage === 'rec'} boost={boost} />
        <button data-silent className="hm-mic" data-recording={stage === 'rec'} aria-label={t(stage === 'rec' ? 'home.voice.stop' : 'home.voice.start')} onClick={stage === 'rec' ? stop : () => void start()}>
          {stage === 'rec' && <span className="hm-pulse" />}
          <Icon name={stage === 'rec' ? 'stop' : 'microphone'} color="FFFFFF" style="fluency-systems-filled" size={52} />
        </button>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#6E6880' }}>{t(stage === 'rec' ? 'home.voice.stopHint' : 'home.voice.startHint')}</p>
        {stage === 'rec' && live && <p aria-live="polite" style={{ fontSize: 15, lineHeight: '22px', color: '#2E2A3B', textAlign: 'center', maxHeight: 88, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>{live}</p>}
      </div>
      <Safety />
    </div>}

    {stage === 'proc' && <div className="hm-content hm-stack" aria-live="polite">
      <h2 style={{ fontSize: 22 }}>{t('home.voice.processing')}</h2>
      <Loading />
      <div style={{ height: 72, borderRadius: 20, background: '#F4F2F7', width: '70%' }} />
    </div>}

    {stage === 'review' && <>
      <div className="hm-content hm-stack" style={{ paddingTop: 8, gap: 10 }}>
        <h2>{t('home.voice.review')}</h2>
        <p className="hm-sub" style={{ fontSize: 15, lineHeight: '22px', marginBottom: 6 }}>{t('home.voice.reviewSub')}</p>
        {transcript && <div style={{ background: '#F5F1FF', borderRadius: 18, padding: '12px 16px' }}>
          <div style={{ fontSize: 13, lineHeight: '18px', color: '#6E6880', fontWeight: 700 }}>{t('home.voice.heard')}</div>
          <p style={{ fontSize: 15, lineHeight: '22px' }}>«{transcript}»</p>
        </div>}
        {!fields.length && <p role="status" className="hm-sub" style={{ fontSize: 15, lineHeight: '22px' }}>{t('home.voice.nothing')}</p>}

        {fields.length > 0 && fields.map((field, i) => <div className="hm-card" style={{ padding: '12px 12px 12px 16px', display: 'flex', alignItems: 'center', gap: 10 }} key={field.key}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor={`home-voice-${i}`} style={{ fontSize: 13, lineHeight: '18px', color: '#6E6880', fontWeight: 700 }}>{t(`home.voice.fields.${field.key}`)}</label>
            {edit === i ? <input autoFocus id={`home-voice-${i}`} maxLength={field.key === 'name' ? 80 : 500} value={field.value} onKeyDown={e => {
              if (e.key === 'Enter')
                setEdit(null);
            }} onChange={e => setFields(items => items.map((item, index) => index === i ? { ...item, value: e.target.value } : item))} style={{ width: '100%', height: 40, border: 0, borderBottom: '2px solid #6755B2', fontSize: 16, fontWeight: 700, outline: 'none', background: 'transparent', padding: 0 }} /> : <p style={{ fontSize: 16, lineHeight: '22px', fontWeight: 700 }}>{field.value.split(', ').map(value => optionLabel(value, t)).join(', ')}</p>}
          </div>
          <button className="hm-icon-tile" style={{ border: 0, background: edit === i ? '#6755B2' : '#F5F1FF' }} aria-label={`${t(edit === i ? 'home.quiz.done' : 'home.edit')}: ${t(`home.voice.fields.${field.key}`)}`} onClick={() => setEdit(edit === i ? null : i)}>
            <Icon name={edit === i ? 'checkmark' : 'edit'} color={edit === i ? 'FFFFFF' : '6755B2'} size={20} />
          </button>
        </div>)}
        <Safety />
      </div>
      <div className="hm-footer" style={{ paddingTop: 12, gap: 8 }}>
        {fields.length > 0 && <Primary onClick={save}>{t('home.voice.save')}</Primary>}
        <button className="hm-text-button" onClick={() => { active.current++; recorder.current = null; setStage('idle'); setSeconds(0); setTranscript(''); setLive(''); }}>{t('home.voice.redo')}</button>
        <button className="hm-text-button" onClick={() => { saveDraft(toDraft()); navigate('/quiz'); }}>{t('home.voice.backToQuiz')}</button>
      </div>
    </>}

  </Page>;
}
