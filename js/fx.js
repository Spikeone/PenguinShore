// Transient HTML effects over the scene: floating numbers, toasts, banners.
// Every node is created, animated and removed here.

const $ = (id) => document.getElementById(id);

let layer = null;
let toastEl = null;
let bannerEl = null;
let hintEl = null;
const toastQueue = [];
const MAX_FLOATS = 24;

export function init() {
  layer = $('fx-layer');
  toastEl = $('toast');
  bannerEl = $('banner');
  hintEl = $('hint');
}

export const reduceMotion = () =>
  document.getElementById('app').classList.contains('reduce');

function spawn(node, ms) {
  if (!layer) return;
  layer.appendChild(node);
  while (layer.childElementCount > MAX_FLOATS) layer.firstElementChild.remove();
  const remove = () => { if (node.parentNode) node.parentNode.removeChild(node); };
  node.addEventListener('animationend', remove);
  setTimeout(remove, ms);
}

// A "+12" at the finger. cls: '', 'gold', 'big'
export function floatNumber(text, clientX, clientY, cls) {
  if (!layer) return;
  const b = layer.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = 'float-num ' + (cls || '');
  node.textContent = text;
  const x = Math.max(8, Math.min(b.width - 8, clientX - b.left));
  const y = Math.max(8, Math.min(b.height - 8, clientY - b.top));
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  spawn(node, 1000);
}

// Toasts queue up so two milestones at once are both readable.
function showNextToast() {
  if (!toastEl || toastQueue.length === 0) return;
  const item = toastQueue.shift();
  toastEl.innerHTML = '';
  const icon = document.createElement('div');
  icon.className = 'icon ' + (item.kind || '');
  icon.innerHTML = item.icon || '<svg viewBox="-22 -60 44 62" width="34" height="46"><use href="#sp-adelie"/></svg>';
  const body = document.createElement('div');
  const title = document.createElement('div');
  title.className = 't-title';
  title.textContent = item.title;
  const desc = document.createElement('div');
  desc.className = 't-desc';
  desc.textContent = item.desc || '';
  body.appendChild(title);
  if (item.desc) body.appendChild(desc);
  toastEl.appendChild(icon);
  toastEl.appendChild(body);
  toastEl.classList.remove('hidden', 'leaving');
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
    toastEl.classList.add('leaving');
    setTimeout(() => {
      toastEl.classList.add('hidden');
      toastEl.classList.remove('leaving');
      showNextToast();
    }, 300);
  }, item.ms || 2600);
}

export function toast(item) {
  toastQueue.push(item);
  if (toastEl && toastEl.classList.contains('hidden')) showNextToast();
}

export function clearToasts() {
  toastQueue.length = 0;
}

// A short centred announcement over the scene.
export function banner(text, sub) {
  if (!bannerEl) return;
  bannerEl.innerHTML = '';
  bannerEl.appendChild(document.createTextNode(text));
  if (sub) {
    const small = document.createElement('span');
    small.className = 'sub';
    small.textContent = sub;
    bannerEl.appendChild(small);
  }
  bannerEl.classList.remove('hidden');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
  setTimeout(() => {
    bannerEl.classList.remove('show');
    bannerEl.classList.add('hidden');
  }, 2200);
}

// One gentle hint at a time, at the bottom of the scene.
export function hint(text) {
  if (!hintEl) return;
  if (!text) {
    hintEl.classList.add('hidden');
    return;
  }
  hintEl.textContent = text;
  hintEl.classList.remove('hidden');
}
