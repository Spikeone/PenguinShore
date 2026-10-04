// Number formatting. Below a thousand plain integers; above, three significant
// figures with a suffix (1.23K, 12.3K, 123K, 1.23M ...).

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n) {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  let v = Math.abs(n);
  if (v < 1000) return (neg ? '-' : '') + String(Math.floor(v));
  let tier = 0;
  while (v >= 1000 && tier < SUFFIXES.length - 1) {
    v /= 1000;
    tier++;
  }
  // Three significant figures, but never round up into the next tier
  // (999.6K must read 999K, not 1000K).
  let digits = v >= 100 ? 0 : (v >= 10 ? 1 : 2);
  let text = v.toFixed(digits);
  if (Number(text) >= 1000) {
    text = '999';
  }
  return (neg ? '-' : '') + text + SUFFIXES[tier];
}

// Production rate: one decimal below 100, otherwise like fmt.
export function fmtRate(n) {
  if (!Number.isFinite(n)) return '0';
  if (n < 100) return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return fmt(n);
}

// A short duration: 12s, 3m 05s, 2h 10m.
export function fmtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const s = Math.ceil(seconds);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + String(s % 60).padStart(2, '0') + 's';
  const h = Math.floor(m / 60);
  if (h < 48) return h + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  return Math.floor(h / 24) + 'd';
}

export const fmtPercent = (frac) => Math.round(frac * 100) + '%';
