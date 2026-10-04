// Web Audio: synthesized sound effects, no audio files at all.
// Nothing is created until unlock() runs inside a user gesture (iOS requirement).

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let noiseBuffer = null;
let muted = false;
const volumes = { music: 0.35, sfx: 0.8 };

export const getContext = () => ctx;
export const getMusicGain = () => musicGain;
export const isReady = () => !!ctx && ctx.state === 'running';

export function applySettings(settings) {
  muted = !!settings.muted;
  volumes.sfx = settings.sfx;
  volumes.music = settings.music;
  if (!ctx) return;
  masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
  sfxGain.gain.setTargetAtTime(volumes.sfx, ctx.currentTime, 0.02);
  musicGain.gain.setTargetAtTime(volumes.music, ctx.currentTime, 0.02);
}

// Must be called from a user gesture handler.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (err) {
      return false;
    }
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = volumes.music;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = volumes.sfx;
    sfxGain.connect(masterGain);

    // One second of white noise, reused by every splashy effect.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return true;
}

function tone(spec) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (spec.at || 0);
  const duration = spec.duration;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = spec.type || 'triangle';
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.endFreq), t0 + duration);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(spec.volume || 0.3, t0 + (spec.attack || 0.006));
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
  osc.connect(env);
  env.connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function noise(spec) {
  if (!ctx || !noiseBuffer) return;
  const t0 = ctx.currentTime + (spec.at || 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter || 'lowpass';
  filter.frequency.setValueAtTime(spec.freq || 1800, t0);
  if (spec.endFreq) filter.frequency.exponentialRampToValueAtTime(spec.endFreq, t0 + spec.duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(spec.volume || 0.3, t0 + (spec.attack || 0.01));
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + spec.duration);
  src.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  src.start(t0);
  src.stop(t0 + spec.duration + 0.02);
}

// A minor pentatonic, which is what the music loop plays in, so every effect
// lands in key.
const NOTE = {
  A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
  A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1568, A6: 1760, C7: 2093, E7: 2637,
};
const PENTA = [NOTE.A4, NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6];

function arpeggio(freqs, step, type, volume) {
  freqs.forEach((freq, i) => {
    tone({ freq, type: type || 'triangle', duration: step * 1.8, at: i * step, volume: volume || 0.2 });
  });
}

// opts.step: 0..9, raises the tap pitch along the scale (the combo drives it).
export function playSfx(kind, opts) {
  if (!isReady() || muted) return;
  const o = opts || {};
  switch (kind) {
    case 'tap': {
      const base = PENTA[Math.max(0, Math.min(PENTA.length - 1, o.step || 0))];
      const detune = 1 + (Math.random() - 0.5) * 0.04;
      tone({ freq: base * detune, endFreq: base * detune * 1.25, type: 'triangle', duration: 0.07, volume: 0.16 });
      noise({ freq: 2400, endFreq: 600, duration: 0.05, volume: 0.05, filter: 'bandpass' });
      break;
    }
    case 'golden':
      arpeggio([NOTE.A5, NOTE.C6, NOTE.E6, NOTE.A6], 0.05, 'triangle', 0.18);
      tone({ freq: NOTE.E7, type: 'sine', duration: 0.3, at: 0.2, volume: 0.1 });
      break;
    case 'buy':
      arpeggio([NOTE.C5, NOTE.E5, NOTE.G5], 0.05, 'triangle', 0.16);
      break;
    case 'cantBuy':
      tone({ freq: 160, endFreq: 120, type: 'sine', duration: 0.12, volume: 0.14 });
      break;
    case 'tab':
      tone({ freq: NOTE.A5, type: 'sine', duration: 0.03, volume: 0.08 });
      break;
    case 'unlock':
      arpeggio([NOTE.G5, NOTE.C6, NOTE.E6], 0.08, 'triangle', 0.18);
      break;
    case 'milestone':
      arpeggio([NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6], 0.07, 'triangle', 0.2);
      break;
    case 'comboTier':
      arpeggio([NOTE.A5, NOTE.E6, NOTE.A6], 0.045, 'sine', 0.14);
      break;
    case 'eventSpawn':
      arpeggio([NOTE.A6, NOTE.C7, NOTE.E7], 0.05, 'sine', 0.1);
      break;
    case 'eventWin':
      arpeggio([NOTE.C6, NOTE.G6, NOTE.C7], 0.06, 'triangle', 0.18);
      noise({ freq: 3000, endFreq: 500, duration: 0.25, volume: 0.08 });
      break;
    case 'splash':
      noise({ freq: 1800, endFreq: 300, duration: 0.3, volume: 0.18, attack: 0.02 });
      break;
    case 'seal':
      tone({ freq: 220, endFreq: 330, type: 'sawtooth', duration: 0.18, volume: 0.06 });
      tone({ freq: 240, endFreq: 360, type: 'sawtooth', duration: 0.18, at: 0.22, volume: 0.06 });
      break;
    case 'chick':
      tone({ freq: NOTE.E6, endFreq: NOTE.G6, type: 'sine', duration: 0.08, volume: 0.1 });
      tone({ freq: NOTE.E6, endFreq: NOTE.G6, type: 'sine', duration: 0.08, at: 0.12, volume: 0.1 });
      break;
    case 'migrate':
      arpeggio([NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5, NOTE.C6], 0.18, 'triangle', 0.18);
      tone({ freq: NOTE.E6, type: 'sine', duration: 0.9, at: 0.9, volume: 0.12, attack: 0.1 });
      break;
    case 'pearl':
      tone({ freq: NOTE.A6, type: 'sine', duration: 0.35, volume: 0.14 });
      tone({ freq: NOTE.E7, type: 'sine', duration: 0.5, at: 0.05, volume: 0.06 });
      break;
    case 'welcome':
      arpeggio([NOTE.E5, NOTE.A5, NOTE.C6, NOTE.E6], 0.09, 'triangle', 0.16);
      break;
    default:
      break;
  }
}
