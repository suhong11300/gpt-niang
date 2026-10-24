// 本地真实渲染 harness：把 gpt-niang 形象包喂给 Coopanion 的形象沙箱并逐帧驱动
const frame = document.getElementById('f');
let pending = null, readyInfo = null, errText = null, loadedSeen = false;
window.__frames = 0; window.__err = null; window.__ready = null; window.__layout = null;
const post = (m) => frame.contentWindow.postMessage(m, '*');
async function start() {
  const origin = location.origin;
  const model = await (await fetch('/figure/model.json')).json();
  post({ t: 'init', entry: origin + '/figure/figure.js', export: 'createGptBody', base: origin + '/figure/',
    model, scheme: 'white', start: { x: 210, facing: 1, enter: 'drop', skin: null },
    theme: 'dark', bounds: { W: 420, H: 420, floorY: 414, S: 1.62 }, language: 'zh' });
}
addEventListener('message', (e) => {
  if (e.source !== frame.contentWindow) return;
  const m = e.data || {};
  if (m.t === 'loaded') { loadedSeen = true; start().catch((x) => { errText = String(x); window.__err = errText; }); }
  else if (m.t === 'ready') { readyInfo = m; window.__ready = { z: m.z, words: m.words }; }
  else if (m.t === 'error') { errText = m.message; window.__err = m.message; }
  else if (m.t === 'frame') { window.__frames++; window.__layout = m.layout; if (pending) { const p = pending; pending = null; p(m); } }
});
window.__tick = (dt) => new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('tick timeout')), 10000);
  pending = (m) => { clearTimeout(timer); res(m.layout); };
  post({ t: 'tick', dt: dt == null ? 1/30 : dt });
});
window.__do = (word) => post({ t: 'do', word });
window.__set = (state) => post({ t: 'set', state });
window.__run = async (word, frames, dt) => {
  if (word) window.__do(word);
  for (let i = 0; i < frames; i++) await window.__tick(dt);
  return window.__layout;
};
window.__status = () => ({ loadedSeen, ready: readyInfo ? readyInfo.words && readyInfo.words.length : null, frames: window.__frames, err: errText, layout: window.__layout });
// 把 WebGL 画布抠到一个 2D 画布上（带背景），返回 PNG dataURL，便于逐帧录制
window.__grab = (size, bg) => {
  const src = frame.contentDocument.querySelector('canvas');
  if (!src) return null;
  if (!window.__g2d) window.__g2d = document.createElement('canvas');
  const c = window.__g2d; const s = size || 360;
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  if (bg === 'none') ctx.clearRect(0, 0, s, s);
  else {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#1b1728'); g.addColorStop(.55, '#2b2242'); g.addColorStop(1, '#3a2f56');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
  ctx.drawImage(src, 0, 0, s, s);
  return c.toDataURL('image/png');
};