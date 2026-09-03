'use client';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  duration: number,
  volume = 0.15,
  type: OscillatorType = 'sine',
  when = 0
) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + duration + 0.05);
}

export const sfx = {
  add() {
    tone(520, 0.12, 0.12, 'sine');
    tone(780, 0.15, 0.1, 'sine', 0.05);
  },
  remove() {
    tone(360, 0.12, 0.12, 'sine');
  },
  click() {
    tone(600, 0.06, 0.08, 'triangle');
  },
  success() {
    tone(620, 0.15, 0.12, 'sine');
    tone(830, 0.15, 0.1, 'sine', 0.1);
    tone(1040, 0.2, 0.08, 'sine', 0.2);
  },
  error() {
    tone(280, 0.15, 0.12, 'sine');
    tone(210, 0.2, 0.1, 'sine', 0.1);
  },
  pop() {
    tone(900, 0.07, 0.1, 'triangle');
  },
};
