
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9351;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(DIR, '.chrome-banner'),
  '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1200,360', 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

try {
  let list;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      list = await r.json();
      if (list && list.find(t => t.type === 'page')) break;
    } catch {}
  }
  const page = list.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const fileUrl = 'file:///' + path.join(DIR, 'banner-src.html').replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
  await send('Page.navigate', { url: fileUrl });
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const r = await send('Runtime.evaluate', { expression: "document.readyState === 'complete' && !!document.querySelector('.art img') && document.querySelector('.art img').complete", returnByValue: true });
    if (r.result.value) break;
  }
  await send('Runtime.evaluate', { expression: "document.fonts.ready.then(()=>1)", awaitPromise: true, returnByValue: true });
  await sleep(400);

  for (const mode of ['dark', 'light']) {
    const sw = await send('Runtime.evaluate', { expression: "(()=>{document.querySelector('.banner').className='banner " + mode + "'; return document.querySelector('.banner').className;})()", returnByValue: true });
    if (sw.exceptionDetails) throw new Error(JSON.stringify(sw.exceptionDetails));
    console.log('  class ->', sw.result.value);
    await sleep(250);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 360, scale: 1 }, captureBeyondViewport: true });
    const out = path.join(DIR, '..', 'docs', 'preview', mode === 'dark' ? 'banner-dark.png' : 'banner.png');
    await fs.writeFile(out, Buffer.from(shot.data, 'base64'));
    console.log('OK', mode, out, Buffer.from(shot.data, 'base64').length, 'B');
  }
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
