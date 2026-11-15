import { useEffect, useRef } from 'react';

// WhatsApp-style live waveform: new bar every ~70 ms from the mic level, scrolling right-to-left.
// Without a stream (no permission / iOS speech path) it falls back to a gentle synthetic voice-like motion.
export function LiveWave({ stream, active, boost = 0 }: { stream: MediaStream | null; active: boolean; boost?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const boostRef = useRef(boost);
  boostRef.current = boost;
  useEffect(() => {
    const element = canvas.current;
    const draw = element?.getContext?.('2d');
    if (!element || !draw) return;
    const ratio = window.devicePixelRatio || 1;
    const width = element.clientWidth || 300;
    const height = element.clientHeight || 64;
    element.width = width * ratio;
    element.height = height * ratio;
    draw.scale(ratio, ratio);
    const bar = 4, gap = 3, count = Math.floor(width / (bar + gap));
    const levels: number[] = Array(count).fill(0.06);
    let analyser: AnalyserNode | null = null;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    if (stream && active) {
      try {
        const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        audioContext = new Ctor();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
      }
      catch { analyser = null; }
    }
    const samples = analyser ? new Uint8Array(analyser.fftSize) : null;
    let frame = 0, last = 0, phase = 0, smooth = 0.06;
    const level = () => {
      if (analyser && samples) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += ((v - 128) / 128) ** 2;
        return Math.min(1, Math.sqrt(sum / samples.length) * 4.5);
      }
      // Synthetic: syllable-like bursts, stronger right after recognised speech.
      phase += .45;
      const syllable = Math.max(0, Math.sin(phase) * Math.sin(phase * .37 + 1));
      const b = boostRef.current;
      return Math.min(1, .08 + syllable * (.35 + b * .5) + Math.random() * .12);
    };
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (active && time - last > 70) {
        last = time;
        smooth = smooth * .35 + level() * .65;
        levels.shift();
        levels.push(Math.max(.06, smooth));
      }
      draw.clearRect(0, 0, width, height);
      levels.forEach((value, i) => {
        const h = Math.max(4, value * (height - 4));
        const x = i * (bar + gap);
        const fresh = i > count - 6;
        draw.fillStyle = active ? (fresh ? '#6755B2' : i % 3 === 1 ? '#A898E6' : '#7E6CC6') : '#CBBFF5';
        draw.globalAlpha = active ? .35 + .65 * (i / count) : .6;
        const y = (height - h) / 2;
        draw.beginPath();
        if (draw.roundRect) draw.roundRect(x, y, bar, h, 2); else draw.rect(x, y, bar, h);
        draw.fill();
      });
      draw.globalAlpha = 1;
      if (!active) cancelAnimationFrame(frame);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      source?.disconnect();
      void audioContext?.close().catch(() => undefined);
    };
  }, [stream, active]);
  return <canvas ref={canvas} aria-hidden="true" style={{ width: 'min(300px, calc(100vw - 64px))', height: 64, display: 'block' }} />;
}
