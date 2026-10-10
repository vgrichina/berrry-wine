#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createReader, safeFile, parseTasks } = require('./readers');
const { createTerminalBridge } = require('./terminal-server');
const { createTaskStore } = require('./task-store');
const { createEmulatorHandler } = require('./emulator-server');
const { createToyvmHandler } = require('./toyvm-server');
const { createAnalytics } = require('./analytics');

function createServer(options = {}) {
  const reader = createReader(options);
  const analytics = createAnalytics(reader.root);
  const serveEmulator = createEmulatorHandler(reader.emulatorRoot);
  const serveToyvm = createToyvmHandler(reader.root);
  const taskStore=createTaskStore(reader.root);
  let cached, refreshedAt = 0, pending;
  let appendQueue = Promise.resolve();
  let terminals;
  async function snapshot() {
    if (cached && Date.now() - refreshedAt < 5000) return cached;
    if (!pending) pending = reader.snapshot().then(value => { cached = value; refreshedAt = Date.now(); return value; }).finally(() => { pending = null; });
    return pending;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const fail = (status, message) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(message); };
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return fail(403, 'Loopback host required');
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return fail(403, 'Same-origin requests only');
    try {
      if (await serveEmulator(req,res)) return;
      if (await serveToyvm(req,res)) return;
      const url = new URL(req.url, `http://${host}`);
      if(req.method==='GET' && url.pathname==='/api/analytics') { const data=await analytics(await reader.analyticsSnapshot());res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return; }
      if(req.method==='POST' && url.pathname==='/api/terminal-ticket') return await terminals.ticket(req,res);
      if(req.method==='POST' && url.pathname==='/api/approval-decision') return await terminals.approvalDecision(req,res);
      if(req.method==='POST' && url.pathname==='/api/work-nudge') return await terminals.nudge(req,res);
      if(req.method==='GET' && url.pathname==='/api/work-status') {res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(await terminals.workStatus()));return;}
      if(req.method==='GET' && url.pathname==='/api/work-watchdog') {
        let status={checkedAt:null,reason:'Work watchdog has not run'};
        try{status=JSON.parse(await fs.promises.readFile(path.join(reader.root,'scratch/work-watchdog/state.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(status));return;
      }
      if(req.method==='GET' && url.pathname==='/api/orchestrator-screen') return await terminals.screen(req,res);
      if(req.method==='POST' && ['/api/tasks','/api/task-note'].includes(url.pathname)) {
        if(req.headers.origin!==`http://${host}`)return fail(403,'Same-origin request required');
        if(req.headers['content-type']!=='application/json')return fail(415,'JSON required');
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>16384)return fail(413,'Request too large');chunks.push(chunk);}
        let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return fail(400,'Invalid JSON');}
        try {
          const result=await (url.pathname==='/api/tasks'?taskStore.mutate(input):taskStore.note(input));
          // An older in-flight read must not become the next cached snapshot.
          if(pending)await pending.catch(()=>{});refreshedAt=0;cached=null;
          res.writeHead(201,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify(result));
        }catch(e){
          if(e.status===409){if(pending)await pending.catch(()=>{});refreshedAt=0;cached=null;}
          if(e.status)return fail(e.status,e.message);throw e;
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/blocker-reply') {
        if (req.headers.origin !== `http://${host}`) return fail(403, 'Same-origin request required');
        if (req.headers['content-type'] !== 'application/json') return fail(415, 'JSON required');
        const chunks = [];
        let bodyBytes = 0;
        for await (const chunk of req) {
          bodyBytes += chunk.length;
          if (bodyBytes > 8192) return fail(413, 'Reply too long');
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks, bodyBytes).toString('utf8');
        let input; try { input = JSON.parse(body); } catch { return fail(400, 'Invalid JSON'); }
        if (!input || typeof input.taskId !== 'string' || !/^[\w.-]{1,100}$/.test(input.taskId) || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.message)) return fail(400, 'A task ID and reply of 1–2000 characters are required');
        const tasks = parseTasks(await fs.promises.readFile(path.join(reader.root, 'TODOS.md'), 'utf8'));
        const matching = tasks.filter(t => t.id === input.taskId);
        const task = matching.length === 1 && matching[0].status === 'blocked' && matching[0].replyAllowed ? matching[0] : null;
        if (!task) return fail(409, 'Task is no longer blocked or does not exist. Refresh first.');
        const message = input.message.replace(/\s+/g, ' ').trim();
        const line = `${new Date().toISOString()} dashboard-user [OPS-REPLY ${task.id}] ${message}\n`;
        // One append per explicit click. Never rewrite task state or board history.
        const append = appendQueue.then(async () => {
          const board = await safeFile(reader.root, 'messageboard.txt');
          if (!board) throw new Error('Messageboard unavailable');
          const handle = await fs.promises.open(board, 'r');
          let prefix = '';
          try {
            const { size } = await handle.stat();
            if (size) { const byte = Buffer.alloc(1); await handle.read(byte, 0, 1, size - 1); if (byte[0] !== 10) prefix = '\n'; }
          } finally { await handle.close(); }
          await fs.promises.appendFile(board, prefix + line, 'utf8');
        });
        appendQueue = append.catch(() => {});
        await append;
        refreshedAt = 0;
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ posted: true, message: line.trim(), status: 'Awaiting owner verification' }));
      }
      if (!['GET', 'HEAD'].includes(req.method)) return fail(405, 'Method not supported');
      if (url.pathname === '/api/state') {
        const data = await snapshot();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : JSON.stringify({...data,terminals:await terminals.list(),approvals:await terminals.approvals()}));
      }
      let file, type = 'text/plain; charset=utf-8';
      const statics = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/blocker-model.js': ['blocker-model.js', 'text/javascript; charset=utf-8'], '/release-model.js': ['release-model.js', 'text/javascript; charset=utf-8'], '/dos-view.js': ['dos-view.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'],
        '/terminal.js':['terminal.js','text/javascript; charset=utf-8'],
        '/task-ui.js':['task-ui.js','text/javascript; charset=utf-8'],
        '/approval-ui.js':['approval-ui.js','text/javascript; charset=utf-8'],
        '/views.js':['views.js','text/javascript; charset=utf-8'],
        '/favicon.svg':['favicon.svg','image/svg+xml'],
        '/fonts/chakra-petch-400.woff2':['fonts/chakra-petch-400.woff2','font/woff2'],
        '/fonts/chakra-petch-600.woff2':['fonts/chakra-petch-600.woff2','font/woff2'],
        '/fonts/chakra-petch-700.woff2':['fonts/chakra-petch-700.woff2','font/woff2'],
        '/fonts/jetbrains-mono.woff2':['fonts/jetbrains-mono.woff2','font/woff2'],
        '/vendor/xterm.js':['node_modules/@xterm/xterm/lib/xterm.js','text/javascript; charset=utf-8'],
        '/vendor/xterm.css':['node_modules/@xterm/xterm/css/xterm.css','text/css; charset=utf-8'],
        };
      if (statics[url.pathname]) {
        const [name, mime] = statics[url.pathname]; file = path.join(__dirname, name); type = mime;
      } else if (url.pathname === '/artifact') {
        await snapshot(); file = await reader.artifact(url.searchParams.get('key'));
        const extension = path.extname(file || '').toLowerCase();
        type = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[extension] || type;
      } else if (url.pathname === '/source') {
        const relative = url.searchParams.get('path') || '';
        if (relative === 'TODOS.md' || relative === 'ops/STATUS.md' || relative === 'test/candidate-corpus/manifest.json' || /^docs\/re-notes\/[\w.-]+\.md$/.test(relative)) file = await safeFile(reader.root, relative);
      }
      if (!file) return fail(404, 'Not found');
      const stream = fs.createReadStream(file);
      stream.once('error', () => { if (!res.headersSent) fail(404, 'Not found'); else res.destroy(); });
      stream.once('open', () => {
        res.writeHead(200, { 'Content-Type': type });
        if (req.method === 'HEAD') { stream.destroy(); res.end(); } else stream.pipe(res);
      });
    } catch (e) { console.error('ops:', e.message); if (!res.headersSent) fail(500, 'Could not read dashboard sources'); else res.destroy(); }
  });
  terminals=createTerminalBridge(server,{...options,root:reader.root});
  server.closeTerminals=terminals.close;
  return server;
}

if (require.main === module) {
  const opts = {};
  let port = 8098;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--help') {
      console.log('node ops/server.js [--port=8098] [--root=PATH] [--codex-root=PATH] [--claude-root=PATH] [--no-agents]'); process.exit(0);
    }
    else if (arg.startsWith('--port=')) port = Number(arg.slice(7));
    else if (arg.startsWith('--root=')) opts.root = path.resolve(arg.slice(7));
    else if (arg.startsWith('--codex-root=')) opts.codexRoot = path.resolve(arg.slice(13));
    else if (arg.startsWith('--claude-root=')) opts.claudeRoot = path.resolve(arg.slice(14));
    else if (arg === '--no-agents') opts.codexRoot = opts.claudeRoot = false;
    else { console.error(`Unknown option: ${arg}`); process.exit(1); }
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('Invalid port'); process.exit(1); }
  const server = createServer(opts);
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Wine / Ops: http://127.0.0.1:${server.address().port}`));
}

module.exports = { createServer };
