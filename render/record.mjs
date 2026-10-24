import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = path.resolve('C:/Users/rog/Desktop/deepseek工作区/coopanion-readme/_render');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8732, DEBUG = 9332;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const WORDS = String(arg('words', 'wave')).split(',');
const FRAMES = Number(arg('frames', 40));
const DT = Number(arg('dt', 1 / 30));
const SIZE = Number(arg('size', 360));
const TAG = String(arg('tag', 'motion'));
const BG = String(arg('bg', ''));
const SETTLE = Number(arg('settle', 120));
const outDir = path.join(ROOT, 'out', TAG);
await fs.mkdir(outDir, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const u = decodeURIComponent(String(req.url).split('?')[0]);
    const p = path.join(ROOT, u === '/' ? 'harness.html' : u);
    if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await fs.readFile(p);
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404).end('404'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cpn-rec-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DEBUG, '--user-data-dir=' + profile,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--window-size=460,460', 'about:blank'], { stdio: 'ignore' });
let target = null;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try { const list = await (await fetch('http://127.0.0.1:' + DEBUG + '/json/list')).json(); const pg = list.find((x) => x.type === 'page'); if (pg?.webSocketDebuggerUrl) { target = pg; break; } } catch {}
}
if (!target) { console.log('FAIL no target'); chrome.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
let seq = 0; const waiting = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); if (m.error) w.j(new Error(JSON.stringify(m.error))); else w.r(m.result); }
});
const send = (method, params) => new Promise((r, j) => { const i = ++seq; waiting.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || '').slice(0, 300));
  return r.result.value;
};
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/harness.html' });
let st = null;
for (let i = 0; i < 100; i++) { await sleep(200); try { st = await evaluate('window.__status ? window.__status() : null'); } catch { st = null; } if (st && (st.ready || st.err)) break; }
if (!st || st.err) { console.log('FAIL init', JSON.stringify(st)); ws.close(); chrome.kill(); server.close(); process.exit(1); }
await evaluate('window.__run(null, ' + SETTLE + ')');
console.log('ready, words=' + st.ready + ' settle=' + SETTLE);

const save = async (durl, file) => {
  if (typeof durl !== 'string' || !durl.startsWith('data:image/png;base64,')) return false;
  await fs.writeFile(path.join(outDir, file), Buffer.from(durl.split(',')[1], 'base64'));
  return true;
};

let n = 0;
for (const word of WORDS) {
  await evaluate('window.__do(' + JSON.stringify(word) + ')');
  for (let f = 0; f < FRAMES; f++) {
    await evaluate('window.__tick(' + DT + ')');
    const d = await evaluate('window.__grab(' + SIZE + (BG ? ', ' + JSON.stringify(BG) : '') + ')');
    if (await save(d, String(n).padStart(4, '0') + '.png')) n++;
  }
  console.log('  ' + word + ' -> ' + FRAMES + ' frames');
}
console.log('total frames:', n, '->', outDir);
ws.close(); chrome.kill(); server.close();
await sleep(200);
process.exit(0);