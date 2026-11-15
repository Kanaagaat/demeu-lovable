import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { CrisisCard, Header, Page } from '../components/support/ui';
import { useVoiceInput } from '../components/support/useVoiceInput';
import { useT } from '../i18n';
import { AssistantError, askAssistant } from '../lib/api';
import { useAppState } from '../state/AppState';
import { isBoolean, useSupportSetting } from '../state/support';
import type { ChatContext, ChatMessage } from '../lib/types';

type Message = ChatMessage & { offer?: boolean };
type Failure = { kind: 'offline' | 'timeout' | 'unavailable'; text: string };
export default function Chat() {
  const { t, language } = useT(); const toast = useToast(); const { card } = useAppState();
  const [useCard, setUseCard] = useSupportSetting<boolean>('chatContext', true, isBoolean);
  const [messages, setMessages] = useState<Message[]>([]); const [input, setInput] = useState(''); const [typing, setTyping] = useState(false); const [crisis, setCrisis] = useState(false); const [failure, setFailure] = useState<Failure | null>(null);
  const alive = useRef(true), sending = useRef(false); const log = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, typing, crisis, failure]);
  const voice = useVoiceInput(setInput, language, toast, t);
  // Only what the parent allowed, and never the name or district.
  const context: ChatContext | undefined = card && useCard ? { age: card.age, features: card.features, comm: card.comm, react: card.react, goals: card.goals, disability: card.disability } : undefined;
  async function send(text: string, retry = false) {
    const value = text.trim().slice(0, 4000); if (!value || sending.current) return;
    sending.current = true; setInput(''); setTyping(true); setFailure(null);
    const next: Message[] = retry ? messages : [...messages, { role: 'user', content: value }]; if (!retry) setMessages(next);
    const body = { messages: next.slice(-20).map(({ role, content }) => ({ role, content })), ...(context ? { context } : {}), language };
    try {
      const answer = await askAssistant(body);
      if (!alive.current) return;
      if (answer.crisis) setCrisis(true);
      setMessages(previous => [...previous, ...answer.reply.map((content, i) => ({ role: 'assistant' as const, content, offer: !answer.crisis && answer.offer_psychologist && i === answer.reply.length - 1 }))]);
    } catch (error) {
      if (!alive.current) return;
      // No made-up answer: an honest message and a retry button.
      setFailure({ kind: error instanceof AssistantError ? error.kind : 'unavailable', text: value });
    } finally { if (alive.current) setTyping(false); sending.current = false; }
  }
  const decline = (index: number) => setMessages(previous => [...previous.map((message, i) => i === index ? { ...message, offer: false } : message), { role: 'user', content: t('support.offerNo') }, { role: 'assistant', content: t('support.offerDeclined') }]);
  return <Page className="support-chat support-fullscreen"><Header fallback="/support"><span className="support-icon-box" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden' }}><img src="/mascot/m-laptop.png" alt="" style={{ width: 44, animation: 'none' }} /></span><div className="support-grow"><strong>{t('support.assistant')}</strong><small style={{ fontSize: 12 }}>{t('support.assistantSub')}</small></div></Header>
    {crisis && <div style={{ padding: '8px 20px 0' }}><CrisisCard /></div>}
    {card && <label className="support-chat-context" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px 0', fontSize: 13, color: '#6E6880' }}><input type="checkbox" checked={useCard} onChange={event => setUseCard(event.target.checked)} /><span><strong style={{ color: '#2E2A3B' }}>{t('support.useCard')}</strong><br />{t('support.useCardHint')}</span></label>}
    <div className="support-chat-log" ref={log} role="log" aria-live="polite" aria-label={t('support.assistant')}>
      {[t('support.greeting'), t('support.howAreYou')].map(content => <div key={content} className="support-message"><div className="support-bubble">{content}</div></div>)}
      {messages.map((message, index) => <div key={index} className={`support-message ${message.role === 'user' ? 'support-message-user' : ''}`}><div className="support-bubble" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>{message.offer && <div className="support-row" style={{ gap: 8 }}><Link className="support-button" style={{ minHeight: 44, fontSize: 15, padding: '8px 12px' }} to="/specialists?kind=parent">{t('support.offerYes')}</Link><button className="support-button support-outline" style={{ minHeight: 44, fontSize: 15, padding: '8px 12px' }} onClick={() => decline(index)}>{t('support.offerNo')}</button></div>}</div>)}
      {typing && <div className="support-typing" role="status" aria-label={t('support.typing')}><span /><span /><span /></div>}
      {failure && <div className="support-message" role="alert"><div className="support-bubble">{t(failure.kind === 'offline' ? 'support.errOffline' : failure.kind === 'timeout' ? 'support.errTimeout' : 'support.errUnavailable')}</div><div className="support-row"><button className="support-button" style={{ minHeight: 44, fontSize: 15, padding: '8px 12px' }} disabled={typing} onClick={() => void send(failure.text, true)}>{t('support.retryAsk')}</button></div></div>}
    </div><div className="support-quick">{[1, 2, 3].map(id => <button key={id} className="support-chip" disabled={typing} onClick={() => void send(t(`support.quick${id}`))}>{t(`support.quick${id}`)}</button>)}</div>
    <form className="support-composer" onSubmit={event => { event.preventDefault(); void send(input); }}><div className="support-input-wrap"><input aria-label={t('support.message')} placeholder={t('support.message')} value={input} maxLength={4000} onChange={event => setInput(event.target.value)} /><button type="button" className="support-mic" aria-label={t('support.voice')} onClick={voice}><Icon name="microphone" color="6755B2" size={20} /></button></div><button className="support-send" type="submit" aria-label={t('support.send')} disabled={typing || !input.trim()}><Icon name="paper-plane" size={22} color="FFFFFF" /></button></form><div className="support-chat-disclaimer">{t('support.disclaimer')}</div>
  </Page>;
}
