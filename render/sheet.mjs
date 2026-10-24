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

const SIZE = Number(arg('size', 240));
const DT = 1 / 30;
const vocab = JSON.parse(await fs.readFile(path.join(ROOT, 'figure', 'figure.json'), 'utf8')).vocab;
const exclusions = String(arg('skip', '')).split(',').filter(Boolean);
const outDir = path.join(ROOT, 'out', 'sheet');
await fs.mkdir(outDir, { recursive: true });
console.log('vocab:', vocab.length, 'words');

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
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cpn-sheet-'));
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
const tick = (n) => evaluate('window.__run(null, ' + n + ', ' + DT + ')');
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/harness.html' });
let st = null;
for (let i = 0; i < 100; i++) { await sleep(200); try { st = await evaluate('window.__status ? window.__status() : null'); } catch { st = null; } if (st && (st.ready || st.err)) break; }
if (!st || st.err) { console.log('FAIL init', JSON.stringify(st)); ws.close(); chrome.kill(); server.close(); process.exit(1); }
await tick(120);
console.log('ready, words=' + st.ready);

for (const v of vocab) {
  if (exclusions.includes(v.id)) continue;
  await evaluate('window.__do("stand")');
  await tick(26);
  await evaluate('window.__do(' + JSON.stringify(v.id) + ')');
  const hold = v.kind === 'expression' ? 14 : Math.max(8, Math.round((v.seconds || 1) * 30 * 0.55));
  await tick(hold);
  const d = await evaluate('window.__grab(' + SIZE + ')');
  const file = path.join(outDir, v.kind.slice(0, 6) + '-' + v.id + '.png');
  await fs.writeFile(file, Buffer.from(d.split(',')[1], 'base64'));
  console.log('  ' + v.kind + ' ' + v.id + ' @' + hold + 'f');
}
console.log('done ->', outDir);
ws.close(); chrome.kill(); server.close();
await sleep(200);
process.exit(0);