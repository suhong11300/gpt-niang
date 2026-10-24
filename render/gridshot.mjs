import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('C:/Users/rog/Desktop/deepseek工作区/coopanion-readme/_render');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8733, DEBUG = 9333;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };


const TYPE = String(arg('type', 'expr'));
const outDir = path.join(ROOT, 'out');
await fs.mkdir(outDir, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(String(req.url).split('?')[0]);
    const p = path.join(ROOT, u === '/' ? 'grid.html' : u);
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await fs.readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404).end('404'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cpn-grid-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DEBUG, '--user-data-dir=' + profile,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--window-size=1620,1500', 'about:blank'], { stdio: 'ignore' });
let target = null;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try { const list = await (await fetch('http://127.0.0.1:' + DEBUG + '/json/list')).json(); const pg = list.find((x) => x.type === 'page'); if (pg?.webSocketDebuggerUrl) { target = pg; break; } } catch {}
}
if (!target) { console.log('FAIL no target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
let sq = 0; const waiting = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); if (m.error) w.j(new Error(JSON.stringify(m.error))); else w.r(m.result); }
});
const send = (method, params) => new Promise((r, j) => { const i = ++sq; waiting.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || '').slice(0, 200));
  return r.result.value;
};
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/grid.html?type=' + TYPE });
let ok = false;
for (let i = 0; i < 80; i++) { await sleep(200); try { ok = await evaluate('!!window.__done'); } catch {} if (ok) break; }
const box = await evaluate('(() => { const g = document.getElementById("grid").getBoundingClientRect(); const b = document.body.getBoundingClientRect(); return { w: Math.ceil(g.right + 28), h: Math.ceil(b.height) }; })()');
console.log('page box', JSON.stringify(box), 'done=' + ok);
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: box.w, height: box.h, scale: 1 } });
const file = path.join(outDir, 'sheet-' + TYPE + '.png');
await fs.writeFile(file, Buffer.from(shot.data, 'base64'));
console.log('saved', file, (await fs.stat(file)).size, 'B');
ws.close(); chrome.kill(); server.close();
await sleep(200);
process.exit(0);