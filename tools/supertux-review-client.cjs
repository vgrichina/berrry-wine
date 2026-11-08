'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const http = require('node:http');
const assert = require('node:assert/strict');
const {MAX_AGE_MS} = require('./supertux-native-pause-controller.cjs');
const {verify} = require('./supertux-native-driver-composition.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = file => {
  let b = fs.readFileSync(file);
  if (b[0] === 31 && b[1] === 139) b = zlib.gunzipSync(b);
  return JSON.parse(b);
};
const choices = Object.freeze({
  'right-100': {keys: ['ArrowRight'], holdMs: 100},
  'left-100': {keys: ['ArrowLeft'], holdMs: 100},
  'jump-right-200': {keys: ['ArrowRight', 'Space'], holdMs: 200},
  'jump-left-200': {keys: ['ArrowLeft', 'Space'], holdMs: 200},
  'jump-100': {keys: ['Space'], holdMs: 100}
});

// No launch, key, menu, route, refresh timer, or automatic approval path.
// request must be the accepted numbered transport, not a new input channel.
function createClient({out, request, deadline, save = () => {}}) {
  assert(path.isAbsolute(out));
  assert.equal(typeof request, 'function');
  assert(Number.isFinite(deadline));
  let current = null, busy = false, closed = fs.existsSync(path.join(out, 'review-client-closed.json.gz'));
  const closedFile = path.join(out, 'review-client-closed.json.gz');
  function stop(error) {
    closed = true; current = null;
    if (!fs.existsSync(closedFile)) fs.writeFileSync(closedFile,
      zlib.gzipSync(JSON.stringify({at: new Date().toISOString(), error: String(error), noReplay: true})), {flag: 'wx'});
  }
  function open() {
    assert(!closed, 'review client UNKNOWN; no replay');
    for (const name of ['first-failure.json', 'transport-closed.json', 'cleanup.json'])
      assert(!fs.existsSync(path.join(out, name)), 'driver UNKNOWN/closed; no replay');
    assert(Date.now() < deadline, 'immutable runtime deadline');
  }
  function view() {
    return {closed, busy, now: Date.now(), runtimeDeadline: deadline, maxAgeMs: MAX_AGE_MS,
      choices, ...(current ? {token: current.token, capture: current.capture,
        image: current.image, captureDeadline: Date.parse(current.capture.at) + MAX_AGE_MS} : {})};
  }
  async function execute(body) {
    // Reject overlapping browser requests without interrupting an admitted UP.
    assert(!busy, 'client busy'); busy = true;
    try {
      open();
      const id = 'review-' + crypto.randomUUID();
      const command = {id, label: id, action: 'capture', waitMs: 100};
      if (body.action === 'choose') {
        assert(current && body.token === current.token, 'exact fresh capture token');
        assert(Object.hasOwn(choices, body.choice), 'explicit short action choice');
        assert(body.nativePaused === true && body.grounded === true, 'personally reviewed native Pause and ground contact required');
        assert(typeof body.review === 'string' && body.review.trim().length > 0 && body.review.length <= 1000,
          'describe visible ground and chosen action geometry');
        const cap = current.capture;
        const age = Date.now() - Date.parse(cap.at);
        assert(Number.isFinite(age) && age >= 0 && age <= MAX_AGE_MS, 'stale capture; UNKNOWN; no refresh');
        assert.deepEqual(read(path.join(out, 'latest.json')), cap, 'driver latest changed');
        assert.equal(sha(fs.readFileSync(path.join(out, cap.label + '.png'))), cap.sha256, 'image changed');
        const review = {label: cap.label, sha256: cap.sha256, identity: cap.identity, review: body.review.trim()};
        fs.writeFileSync(path.join(out, cap.label + '-review.json'), zlib.gzipSync(JSON.stringify(review)), {flag: 'wx'});
        Object.assign(command, {action: 'pause-step', reviewRef: cap.label,
          observation: {...cap, nativePaused: true, grounded: true, review: review.review}, ...choices[body.choice]});
        save({kind: 'explicit-reviewed-choice', capture: cap, choice: body.choice, review: review.review, at: Date.now()});
      } else assert.equal(body.action, 'capture', 'only explicit capture or reviewed choice');
      current = null; // single use before any asynchronous dispatch
      const ack = await request(out, id, command, 30000);
      assert(ack.ok && ack.id === id && !ack.status, 'exact successful completion required');
      open();
      const capture = read(path.join(out, id + '-capture.json'));
      assert.equal(capture.label, id);
      assert.deepEqual(read(path.join(out, 'latest.json')), capture);
      const image = fs.readFileSync(path.join(out, id + '.png'));
      assert.equal(sha(image), capture.sha256, 'exact fresh image SHA');
      assert(Number.isFinite(Date.parse(capture.at)), 'original capture timestamp required');
      current = {capture, image: image.toString('base64'), token: crypto.randomUUID()};
      save({kind: 'capture-received', capture, at: Date.now()});
      return view();
    } catch (error) { stop(error); throw error; }
    finally { busy = false; }
  }
  return {view, execute};
}

const html = `<!doctype html><meta charset="utf-8"><title>SuperTux Pause review</title>
<style>body{font:16px sans-serif;background:#172029;color:#fff;max-width:1000px;margin:20px auto}img{max-width:100%;display:block}button{padding:12px;margin:5px}textarea{width:95%}#clock{font-size:24px}label{display:block;margin:8px}</style>
<h1>SuperTux Pause review</h1><button id="capture">Fresh capture (no input)</button>
<div id="clock"></div><pre id="status"></pre><img id="image" alt="Explicitly request a fresh capture">
<label><input type="checkbox" id="paused">I reviewed this image: native Pause is visible</label>
<label><input type="checkbox" id="grounded">Tux is visibly grounded; selected direction/landing geometry reviewed</label>
<textarea id="review" placeholder="Visible ground, obstacle/landing, and reason for this one action"></textarea><div id="choices"></div>
<p>Each button sends one reviewed action, then native Pause. No keyboard shortcuts. UNKNOWN ends this client. Historical images cannot authorize input.</p>
<script>
const auth=location.hash.slice(1);let state={},pending=false,received=0,networkBound=0;
const el=id=>document.getElementById(id);
function clock(){const now=state.now+networkBound+(performance.now()-received),age=state.capture?now-Date.parse(state.capture.at):NaN;
el('clock').textContent=state.capture?'Capture age ≤ '+Math.ceil(age)+' ms (server sample '+(state.now-Date.parse(state.capture.at))+' ms; network bound '+Math.ceil(networkBound)+' ms) | 12s deadline '+new Date(state.captureDeadline).toISOString()+' | remaining ≥ '+Math.floor(state.captureDeadline-now)+' ms':'';
el('capture').disabled=pending||state.closed;
document.querySelectorAll('#choices button').forEach(b=>b.disabled=pending||state.closed||!state.capture||age<0||age>state.maxAgeMs||now>=state.runtimeDeadline||!el('paused').checked||!el('grounded').checked||!el('review').value.trim());}
function render(s,began){state=s;received=performance.now();networkBound=received-began;el('paused').checked=el('grounded').checked=false;el('review').value='';
el('image').src=s.image?'data:image/png;base64,'+s.image:'';el('status').textContent=s.closed?'UNKNOWN — stop; no replay':s.capture?JSON.stringify({label:s.capture.label,at:s.capture.at,sha256:s.capture.sha256,runtimeDeadline:new Date(s.runtimeDeadline).toISOString()},null,2):'Ready; no capture requested';
el('choices').replaceChildren();Object.entries(s.choices||{}).forEach(([id,c])=>{const b=document.createElement('button');b.textContent=c.keys.join(' + ')+' '+c.holdMs+' ms';b.onclick=()=>act({action:'choose',choice:id,token:state.token,nativePaused:el('paused').checked,grounded:el('grounded').checked,review:el('review').value});el('choices').append(b)});clock();}
async function act(body){if(pending)return;pending=true;const began=performance.now();clock();try{const r=await fetch('/command',{method:'POST',headers:{'authorization':auth,'content-type':'application/json'},body:JSON.stringify(body)});const s=await r.json();if(!r.ok)throw Error(s.error);render(s,began);}catch(e){state.closed=true;el('status').textContent=String(e)+'; stop, no replay';}finally{pending=false;clock();}}
el('capture').onclick=()=>act({action:'capture'});setInterval(clock,50);
const began=performance.now();fetch('/state',{headers:{authorization:auth}}).then(r=>r.json()).then(s=>render(s,began)).catch(e=>el('status').textContent=String(e));
</script>`;

function serve(client, {port = 0, token = crypto.randomBytes(32).toString('hex')} = {}) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    if (req.method === 'GET' && req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== token) { res.writeHead(403); res.end('{}'); return; }
    try {
      if (req.method === 'GET' && req.url === '/state') { res.end(JSON.stringify(client.view())); return; }
      assert(req.method === 'POST' && req.url === '/command', 'unknown endpoint');
      let body = ''; for await (const chunk of req) { body += chunk; assert(body.length <= 4096, 'request too large'); }
      res.end(JSON.stringify(await client.execute(JSON.parse(body))));
    } catch (error) { res.writeHead(409); res.end(JSON.stringify({error: String(error)})); }
  });
  server.listen(port, '127.0.0.1');
  return {server, token};
}

if (require.main === module) {
  const [outArg, portArg = '0'] = process.argv.slice(2);
  assert(outArg, 'usage: node tools/supertux-review-client.cjs /absolute/runtime/original [port]');
  const out = path.resolve(outArg), root = path.resolve(__dirname, '..');
  // Accepted PATHHASH transport and gzip adapter; no copied providers.
  const pins = [
    {path: 'scratch/runs/20261108-supertux-short-step-progression-2236/transport.cjs', size: 3925, sha256: '71ec7b61a92822bbb558d97a56af321127314ae9ffa4bd72a4e88a2383301aef'},
    {path: 'scratch/runs/20261108-supertux-controller-visible-progress-2301/json-storage.cjs', size: 1392, sha256: '1ee86f18f53fa67cd04fc4a2d247a0c7d827285d3762bf35f006c593bb1e4655'}
  ];
  for (const pin of pins) verify(root, pin);
  require(path.join(root, pins[1].path)).install(out);
  const ready = read(path.join(out, 'ready.json'));
  assert(ready.ready === true && ready.deadline > Date.now(), 'live driver readiness/deadline required');
  const lock = path.join(out, 'review-client.lock'); fs.mkdirSync(lock);
  const client = createClient({out, deadline: ready.deadline, request: require(path.join(root, pins[0].path)).request,
    save: row => fs.writeFileSync(path.join(out, 'review-client-' + crypto.randomUUID() + '.json.gz'), zlib.gzipSync(JSON.stringify(row)), {flag: 'wx'})});
  const {server, token} = serve(client, {port: Number(portArg)});
  const cap = setTimeout(() => server.close(), Math.max(0, ready.deadline - Date.now()));
  server.once('close', () => { clearTimeout(cap); fs.rmdirSync(lock); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  server.once('listening', () => console.log('Review URL http://127.0.0.1:' + server.address().port + '/#' + token));
}

module.exports = {createClient, serve, choices};
