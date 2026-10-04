// A slow, soft loop in A minor pentatonic, scheduled note by note. No audio
// files. Uses the lookahead pattern: a timer wakes up often and schedules every
// note that falls into the next window, so the loop stays tight even if the
// timer itself drifts.

import { getContext, getMusicGain } from './audio.js';

const BPM = 76;
const STEP_S = 60 / BPM / 4;            // one sixteenth
const LOOKAHEAD_MS = 40;
const SCHEDULE_AHEAD_S = 0.2;

const R = null;                          // rest
// 64 steps, four bars. Pad holds the chord, lead wanders, shimmer sparkles.
const PAD = [
  57, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
  60, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
  55, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
  57, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
];
const PAD_FIFTH = [
  64, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
  67, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
  62, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
  64, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R,
];
const BASS = [
  45, R, R, R, R, R, R, R, 45, R, R, R, R, R, R, R,
  48, R, R, R, R, R, R, R, 48, R, R, R, R, R, R, R,
  43, R, R, R, R, R, R, R, 43, R, R, R, R, R, R, R,
  45, R, R, R, R, R, R, R, 40, R, R, R, R, R, R, R,
];
const LEAD = [
  R, R, R, R, 76, R, R, R, 79, R, R, R, 81, R, R, R,
  R, R, 79, R, R, R, 76, R, R, R, R, R, 74, R, R, R,
  R, R, R, R, 72, R, R, R, 74, R, R, R, 76, R, 74, R,
  R, R, 72, R, R, R, R, R, 69, R, R, R, R, R, R, R,
];
const SHIMMER = [
  R, R, R, R, R, R, R, R, R, R, 88, R, R, R, 91, R,
  R, R, R, R, R, R, R, R, R, R, R, R, 93, R, R, R,
  R, R, R, R, R, R, 88, R, R, R, R, R, R, R, 91, R,
  R, R, R, R, R, R, R, R, 96, R, R, R, R, R, R, R,
];

const TRACKS = [
  { steps: PAD, type: 'sine', gain: 0.09, length: 15, attack: 0.6 },
  { steps: PAD_FIFTH, type: 'sine', gain: 0.05, length: 15, attack: 0.8 },
  { steps: BASS, type: 'sine', gain: 0.16, length: 6, attack: 0.03 },
  { steps: LEAD, type: 'triangle', gain: 0.09, length: 3, attack: 0.04 },
  { steps: SHIMMER, type: 'sine', gain: 0.03, length: 2, attack: 0.01 },
];

const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

let busGain = null;
let timer = 0;
let nextNoteTime = 0;
let step = 0;
let running = false;

function noteAt(track, midi, time) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const duration = STEP_S * track.length;
  osc.type = track.type;
  osc.frequency.setValueAtTime(midiToFreq(midi), time);
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(track.gain, time + track.attack);
  env.gain.setValueAtTime(track.gain, time + Math.max(track.attack, duration * 0.6));
  env.gain.exponentialRampToValueAtTime(0.0008, time + duration);
  osc.connect(env);
  env.connect(busGain);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function scheduler() {
  const ctx = getContext();
  if (!ctx || !busGain) return;
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
    for (const track of TRACKS) {
      const midi = track.steps[step % track.steps.length];
      if (midi !== null) noteAt(track, midi, nextNoteTime);
    }
    nextNoteTime += STEP_S;
    step += 1;
  }
}

export function start() {
  const ctx = getContext();
  const musicGain = getMusicGain();
  if (!ctx || !musicGain || running) return;
  if (!busGain) {
    busGain = ctx.createGain();
    busGain.gain.value = 1;
    // Rounds off the oscillators so the loop sits in the background.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1800;
    busGain.connect(lowpass);
    lowpass.connect(musicGain);
  }
  running = true;
  step = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  scheduler();
  timer = setInterval(scheduler, LOOKAHEAD_MS);
}

export function stop() {
  running = false;
  clearInterval(timer);
  timer = 0;
}

export const isPlaying = () => running;

// Quieter behind overlays and while the tab is hidden, without touching the
// user's volume.
export function setDucked(ducked) {
  const ctx = getContext();
  if (!ctx || !busGain) return;
  busGain.gain.setTargetAtTime(ducked ? 0.3 : 1, ctx.currentTime, 0.15);
}
