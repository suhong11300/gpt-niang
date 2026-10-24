import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('C:/Users/rog/Desktop/deepseek工作区/coopanion-readme/_render');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8731, DEBUG = 9331;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.css': 'text/css' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(ROOT, 'out');
await fs.mkdir(outDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(String(req.url).split('?')[0]);
    const p = path.join(ROOT, u === '/' ? 'harness.html' : u);
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await fs.readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch (e) { res.writeHead(404).end('404'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log('[1] http server on', PORT);

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cpn-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DEBUG, '--user-data-dir=' + profile,
  '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--window-size=460,460', 'about:blank'], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try {
    const list = await (await fetch('http://127.0.0.1:' + DEBUG + '/json/list')).json();
    const page = list.find((x) => x.type === 'page');
    if (page && page.webSocketDebuggerUrl) { target = page; break; }
  } catch {}
}
if (!target) { console.log('FAIL: no cdp target'); chrome.kill(); server.close(); process.exit(1); }
console.log('[2] cdp target ok');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
let seq = 0; const waiting = new Map(); const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); if (m.error) w.j(new Error(JSON.stringify(m.error))); else w.r(m.result); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push('[c.' + m.params.type + '] ' + (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' '));
  else if (m.method === 'Log.entryAdded') logs.push('[log.' + m.params.entry.level + '] ' + m.params.entry.text);
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exc] ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || ''));
});
const send = (method, params) => new Promise((r, j) => { const i = ++seq; waiting.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)).slice(0, 300));
  return r.result.value;
};
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable').catch(() => {});
await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/harness.html' });
console.log('[3] navigated');

let st = null;
for (let i = 0; i < 100; i++) {
  await sleep(200);
  try { st = await evaluate('window.__status ? window.__status() : null'); } catch { st = null; }
  if (st && (st.ready || st.err)) break;
}
console.log('[4] status:', JSON.stringify(st));
if (!st || st.err) { console.log('FAIL init:', JSON.stringify(logs.slice(0, 20))); ws.close(); chrome.kill(); server.close(); process.exit(1); }

await evaluate('window.__run(null, 120)');
console.log('[5] layout:', JSON.stringify(await evaluate('window.__layout')));

const durl = await evaluate("(() => { const c = document.getElementById('f').contentDocument.querySelector('canvas'); return c ? c.toDataURL('image/png') : 'NO-CANVAS'; })()");
if (typeof durl === 'string' && durl.startsWith('data:image/png;base64,')) {
  const buf = Buffer.from(durl.split(',')[1], 'base64');
  await fs.writeFile(path.join(outDir, 'canvas-raw.png'), buf);
  console.log('[6] canvas png', buf.length, 'B');
} else console.log('[6] canvas fail:', String(durl).slice(0, 120));

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await fs.writeFile(path.join(outDir, 'page-shot.png'), Buffer.from(shot.data, 'base64'));
console.log('[7] page shot saved, logs:');
console.log(logs.slice(0, 25).join('\n'));

ws.close(); chrome.kill(); server.close();
await sleep(200);
process.exit(0);