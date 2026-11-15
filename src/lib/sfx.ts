// Tiny synthesized UI sounds (Web Audio, no files) + light haptics.
// OFF by default: sudden sounds can be distressing for children with sensory sensitivity (e.g. autism).
// The parent turns them on in Profile (demeu.sound=on).
type Sound = 'tap' | 'select' | 'unselect' | 'next' | 'success' | 'pop' | 'recStart' | 'recStop' | 'error';

let context: AudioContext | null = null;
const KEY = 'demeu.sound';

export function soundEnabled() {
  try { return localStorage.getItem(KEY) === 'on'; }
  catch { return false; }
}
export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); }
  catch { /* optional */ }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  }
  catch { return null; }
}

function tone(ctx: AudioContext, { from, to = from, at = 0, length = .08, volume = .06, type = 'sine' as OscillatorType }: { from: number; to?: number; at?: number; length?: number; volume?: number; type?: OscillatorType }) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + .02);
}

const HAPTIC: Partial<Record<Sound, number | number[]>> = { select: 8, next: 10, success: [12, 40, 18], recStart: 15, recStop: 10, error: [20, 30, 20] };

export function play(sound: Sound) {
  if (!soundEnabled()) return;
  try { const pattern = HAPTIC[sound]; if (pattern && 'vibrate' in navigator) navigator.vibrate(pattern); }
  catch { /* haptics are optional */ }
  const ctx = audio();
  if (!ctx) return;
  try {
    // Bubble-like "pops": quick upward pitch sweeps with a fast decay, loud enough for a phone speaker.
    switch (sound) {
      case 'tap': tone(ctx, { from: 380, to: 920, length: .06, volume: .16 }); break;
      case 'select': tone(ctx, { from: 520, to: 1300, length: .08, volume: .22 }); tone(ctx, { from: 900, to: 1700, at: .05, length: .07, volume: .12 }); break;
      case 'unselect': tone(ctx, { from: 900, to: 420, length: .09, volume: .16 }); break;
      case 'next': tone(ctx, { from: 330, to: 660, length: .1, volume: .18, type: 'triangle' }); tone(ctx, { from: 660, to: 990, at: .07, length: .1, volume: .14 }); break;
      case 'pop': tone(ctx, { from: 600, to: 1500, length: .07, volume: .2 }); break;
      case 'recStart': tone(ctx, { from: 440, to: 880, length: .12, volume: .25 }); tone(ctx, { from: 880, to: 1320, at: .1, length: .14, volume: .2 }); break;
      case 'recStop': tone(ctx, { from: 1320, to: 880, length: .12, volume: .22 }); tone(ctx, { from: 880, to: 440, at: .1, length: .14, volume: .18 }); break;
      case 'error': tone(ctx, { from: 320, to: 200, length: .2, volume: .22, type: 'triangle' }); break;
      case 'success':
        tone(ctx, { from: 523, at: 0, length: .16, volume: .22 });
        tone(ctx, { from: 659, at: .1, length: .16, volume: .22 });
        tone(ctx, { from: 784, at: .2, length: .18, volume: .22 });
        tone(ctx, { from: 1047, at: .3, length: .35, volume: .24 });
        break;
    }
  }
  catch { /* sound is decoration only */ }
}

/** Global, delegated click sounds: toggles chirp, primary buttons whoosh, everything else ticks softly. */
export function installClickSounds(root: HTMLElement) {
  const handler = (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest?.('button, a, [role="button"], [role="switch"], [role="checkbox"]');
    if (!target || (target as HTMLButtonElement).disabled || target.closest('[data-silent]')) return;
    const pressed = target.getAttribute('aria-pressed') ?? target.getAttribute('aria-checked');
    if (pressed !== null) play(pressed === 'true' ? 'unselect' : 'select');
    else if (/\b(hm|pl|sp|support)-primary\b/.test(target.className?.toString() ?? '')) play('next');
    else play('tap');
  };
  root.addEventListener('click', handler, true);
  return () => root.removeEventListener('click', handler, true);
}
