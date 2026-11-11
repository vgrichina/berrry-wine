'use strict';

// Uses retained native full frames, never starts or modifies a guest.
// node tools/kknd_cursor_animation_test.cjs RUN0230 RUN0120 UNIQUE_OUTPUT
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PNG } = require('pngjs');
const checker = require('./kknd_cursor_pixels.cjs');
const [retained, older, output] = process.argv.slice(2).map(p => path.resolve(p));
fs.mkdirSync(output, { recursive: false });
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = (root, n, kind) => {
  const file = path.join(root, 'retrieved/output-fixed', `stage-${n}.${kind}`);
  return fs.existsSync(file) ? fs.readFileSync(file) : execFileSync('xz', ['-dc', file + '.xz']);
};
const expected = new Map([[11,5],[12,8],[13,11],[14,5],[15,12],[19,7],[20,7],
  [21,7],[22,12],[26,6],[27,11],[28,10],[33,11],[34,11],[35,11],[36,10],
  [40,8],[41,6],[42,11],[43,8],[44,8],[45,8],[46,8],[47,9],[51,12],
  [55,12],[60,7],[61,8],[62,8],[63,9]]);
const records = [], frames = new Map(), samples = new Map();
const pins = [];
for (const [n, radius] of expected) {
  const bytes = read(retained, n, 'png'), raw = read(retained, n, 'json');
  const reviewPath = path.join(retained, 'reviews', `review-${n}.json`);
  const reviewBytes = fs.readFileSync(reviewPath), review = JSON.parse(reviewBytes);
  const state = JSON.parse(raw), png = PNG.sync.read(bytes, { checkCRC: true });
  assert.deepEqual(state, review.state);
  assert.equal(hash(bytes), review.capture.sha256);
  assert.equal(bytes.length, review.capture.size);
  assert.equal(review.classification, 'valid-ground');
  assert.equal(review.personallyReviewed, true);
  assert.equal(state.mouse.buttons, 0);
  assert.equal(state.lastCommand.buttons, 0);
  assert.equal(state.lastCommand.kind, 'mouse');
  assert.equal(state.lastCommand.index, n);
  assert.equal(state.lastCommand.x, review.x);
  assert.equal(state.lastCommand.y, review.y);
  assert.equal(state.mouse.x, review.x);
  assert.equal(state.mouse.y, review.y);
  frames.set(n, {bytes, png, review, state, radius});
  if (!samples.has(radius)) samples.set(radius, frames.get(n));
  for (const [kind, data, source] of [['png', bytes, `retrieved/output-fixed/stage-${n}.png.xz`],
    ['json', raw, `retrieved/output-fixed/stage-${n}.json.xz`],
    ['review', reviewBytes, `reviews/review-${n}.json`]]) {
    pins.push({stage:n, kind, source:path.join(retained, source), rawSize:data.length, rawSha256:hash(data)});
  }
}
const rgba = (p,x,y) => [...p.data.subarray((y*p.width+x)*4, (y*p.width+x)*4+4)];
const symbol = pixel => pixel[3] === 255 && pixel.slice(0,3).every(c => c === 255) ? 'W' :
  pixel[3] === 255 && pixel.slice(0,3).every(c => c === 0) ? '#' : '.';
// Derive the contracted mask from the raw frame, with expanded phases at the
// same stationary target exposing the terrain underneath every mask pixel.
const contracted = [], causal = [];
for (let y = -5; y < 5; y++) {
  let row = '';
  for (let x = -5; x < 5; x++) {
    const pixels = [11,13,14,15].map(n => rgba(frames.get(n).png, 550+x,120+y));
    assert.deepEqual(pixels[0], pixels[2], 'contracted mask must recur exactly');
    assert.deepEqual(pixels[1], pixels[3], 'expanded frames must expose identical background');
    const c = symbol(pixels[0]);
    if (c !== '.') assert.notDeepEqual(pixels[0], pixels[1], 'mask pixel must replace terrain');
    else assert.deepEqual(pixels[0], pixels[1], 'transparent pixel must preserve terrain');
    row += c;
  }
  contracted.push(row);
}
for (const n of [11,12,13,14,15]) {
  const f = frames.get(n);
  if (n > 11) {
    assert(f.state.mouse.reads > frames.get(n-1).state.mouse.reads);
    assert(f.state.dispatched > frames.get(n-1).state.dispatched);
    assert(f.state.lastCommand.dispatched >= frames.get(n-1).state.dispatched);
  }
  causal.push({stage:n, radius:f.radius, x:f.review.x, y:f.review.y,
    reads:f.state.mouse.reads, dispatched:f.state.dispatched,
    lastCommand:f.state.lastCommand, frameSha256:hash(f.bytes)});
}
// Every opaque pixel in a full cursor square is derived independently from
// native frames, rather than manufacturing positive fixtures from the checker.
const masks = [...samples].sort((a,b)=>a[0]-b[0]).map(([radius,f]) => {
  const rows = [];
  for (let y=-radius;y<radius;y++) {
    let row='';
    for(let x=-radius;x<radius;x++) row+=symbol(rgba(f.png,f.review.x+x,f.review.y+y));
    rows.push(row);
  }
  return {radius, rows, stage:f.review.stage, hotspot:[f.review.x,f.review.y], frameSha256:hash(f.bytes)};
});
fs.writeFileSync(path.join(output,'native-mask-evidence.json'), JSON.stringify({pins, masks, contracted,
  causal, derivation:'11/14 identical contracted opaque pixels; 13/15 identical exposed terrain; neutral hovers only'},null,2));
let checks = 0;
function accept(bytes,x,y,radius,label) {
  const proof = checker.check(bytes,x,y);
  assert.equal(proof.radius,radius,label);
  assert.equal(proof.x,x); assert.equal(proof.y,y);
  assert.equal(proof.frameSha256,hash(bytes));
  checks++;
}
function refuse(bytes,x,y,label) {
  assert.throws(()=>checker.check(bytes,x,y), undefined, label); checks++;
}
for(const [n,f] of frames) {
  accept(f.bytes,f.review.x,f.review.y,f.radius,`native stage ${n}`);
  records.push({stage:n,radius:f.radius,hotspot:[f.review.x,f.review.y],frameSha256:hash(f.bytes)});
  // Every off-by-one, plus offsets spanning the enclosing native square.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)
    if(dx||dy)refuse(f.bytes,f.review.x+dx,f.review.y+dy,`shift ${n}: ${dx},${dy}`);
  for(const delta of [-13,-6,-2,2,6,13])for(const [dx,dy] of [[delta,0],[0,delta]])
    refuse(f.bytes,f.review.x+dx,f.review.y+dy,`distant hotspot ${n}: ${dx},${dy}`);
}
// Mutate actual native opaque pixels, with a newly encoded valid PNG. Check all
// corners, both colours, and each RGBA channel separately for each phase.
for(const [radius,f] of samples) {
  const mask=masks.find(m=>m.radius===radius);
  for(const sx of [-1,1])for(const sy of [-1,1])for(const colour of ['W','#']) {
    let point;
    for(let y=-radius;y<radius&&!point;y++)for(let x=-radius;x<radius;x++) {
      if(Math.sign(x+.5)===sx&&Math.sign(y+.5)===sy&&mask.rows[y+radius][x+radius]===colour) {point=[x,y];break;}
    }
    assert(point);
    const o=((f.review.y+point[1])*640+f.review.x+point[0])*4;
    for(let channel=0;channel<4;channel++) {
      const p=PNG.sync.read(f.bytes); p.data[o+channel]^=1;
      refuse(PNG.sync.write(p),f.review.x,f.review.y,`mutated ${radius}/${sx}/${sy}/${colour}/${channel}`);
    }
  }
  // Transparent terrain is intentionally unconstrained, including at centre.
  const p=PNG.sync.read(f.bytes);
  for(let y=-radius;y<radius;y++)for(let x=-radius;x<radius;x++)if(mask.rows[y+radius][x+radius]==='.') {
    const o=((f.review.y+y)*640+f.review.x+x)*4;
    p.data.set([29,91,137,255],o);
  }
  accept(PNG.sync.write(p),f.review.x,f.review.y,radius,'terrain changes');
}
const source=samples.get(12), {x,y}=source.review;
function blank() {
  const p=PNG.sync.read(source.bytes);
  for(let dy=-20;dy<=20;dy++)for(let dx=-20;dx<=20;dx++)p.data.set([29,91,137,255],((y+dy)*640+x+dx)*4);
  return p;
}
function paint(p,rows,ox,oy) {
  for(let row=0;row<rows.length;row++)for(let col=0;col<rows[row].length;col++) {
    const c=rows[row][col]; if(c==='.')continue;
    const v=c==='W'?255:0; p.data.set([v,v,v,255],((oy+row)*640+ox+col)*4);
  }
}
const arrow=['#W#...','WWW#.#','#WWW#W','.#WWWW','..#WWW','.#WWWW'];
function arrows(p,radius,quadrants=[[-1,-1],[-1,1],[1,-1],[1,1]]) {
  for(const [sx,sy] of quadrants)for(let row=0;row<6;row++)for(let col=0;col<6;col++) {
    const c=arrow[row][col];if(c==='.')continue;
    const dx=-radius+col,dy=-radius+row,v=c==='W'?255:0;
    p.data.set([v,v,v,255],((y+(sy===-1?dy:-dy-1))*640+x+(sx===-1?dx:-dx-1))*4);
  }
}
for(const radius of [3,4,5,13,14,15]) {
  const p=blank();arrows(p,radius);
  refuse(PNG.sync.write(p),x,y,'unsupported or guessed overlap radius '+radius);
}
let p=blank();arrows(p,8,[[-1,-1],[1,1]]);arrows(p,11,[[-1,1],[1,-1]]);
refuse(PNG.sync.write(p),x,y,'mixed phases');
p=blank();paint(p,contracted,x-5,y-5);arrows(p,12);
refuse(PNG.sync.write(p),x,y,'ambiguous contracted and expanded sprites');
fs.writeFileSync(path.join(output,'ambiguous-native-masks.png'),PNG.sync.write(p));
const red=read(older,52,'png'), redState=JSON.parse(read(older,52,'json'));
refuse(red,redState.mouse.x,redState.mouse.y,'retained prohibited stage52');
for(const [bx,by] of [[0,0],[12,120],[550,12],[627,120],[550,467]])
  refuse(source.bytes,bx,by,'clipped cursor');
const result={passed:true,checks,nativeFrames:records.length,phases:[...samples.keys()].sort((a,b)=>a-b),records};
fs.writeFileSync(path.join(output,'verdicts.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,records:undefined}));
