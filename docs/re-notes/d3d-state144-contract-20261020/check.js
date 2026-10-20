// Focused source-predicate characterization, not rasterizer/native execution.
// Run from repository root: node docs/re-notes/d3d-state144-contract-20261020/check.js
const fs = require('fs');
const assert = require('assert/strict');
const crypto = require('crypto');
const corePath = 'src/09ab-handlers-d3dim-core.wat';
const gpuPath = 'lib/d3dim-gpu.js';
const fixedPath = 'lib/d3d9-fixed.js';
const core = fs.readFileSync(corePath, 'utf8');
const gpu = fs.readFileSync(gpuPath, 'utf8');
const fixed = fs.readFileSync(fixedPath, 'utf8');
function expression(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return text.slice(start, i + 1);
  }
  throw Error('unterminated expression');
}
const marker = core.indexOf(';; D3DRENDERSTATE_COLORKEYENABLE discards');
assert(marker > 0);
const source = expression(core, core.indexOf('(if ', marker));
const tokens = source.match(/\(|\)|[^\s()]+/g);
let cursor = 0;
function parse() {
  const token = tokens[cursor++];
  if (token !== '(') return token;
  const result = [];
  while (tokens[cursor] !== ')') result.push(parse());
  cursor++;
  return result;
}
const ast = parse();
// Only the actual extracted rejection condition is evaluated. No sampler,
// upload, alpha stage, framebuffer, driver, or native-runtime replacement.
function evaluate(node, values) {
  const [op, ...args] = node;
  const at = i => evaluate(args[i], values);
  switch (op) {
    case 'i32.const': return Number(args[0]) | 0;
    case 'local.get': assert(args[0] in values); return values[args[0]] | 0;
    case 'i32.and': return at(0) & at(1);
    case 'i32.eq': return +(at(0) === at(1));
    case 'i32.eqz': return +(at(0) === 0);
    case 'if': return evaluate(args[at(1) ? 2 : 3][1], values);
    default: throw Error('unsupported predicate operation ' + op);
  }
}
const cutoff = fixed.match(/pbody\.push\('if \((sample0\.a < [0-9.]+)\) discard;'\)/);
assert(cutoff);
assert(gpu.includes('colorKey: textured && !!d.keyed && !d.keyBlend'));
const gpuReject = Function('sample0', 'return ' + cutoff[1]);
assert(core.includes('(local.set $fast16 (i32.and (local.get $fast16) (i32.eqz (local.get $key_blend))))'));
assert(core.includes('(if (i32.eq (local.get $member) (local.get $key)) (then (return (i32.const 0))))'));
const cases = [
  {name:'all keyed red', sample:0xffff0000, alpha:0, expected:false},
  {name:'all nonkey green', sample:0xff00ff00, alpha:1, expected:true},
  {name:'all nonkey duplicate-red indices', sample:0xffff0000, alpha:1, expected:true},
  {name:'one quarter keyed red', sample:0xff3fbf00, alpha:.75, expected:null},
  {name:'half keyed red', sample:0xff7f7f00, alpha:.5, expected:null},
  {name:'three quarters keyed red', sample:0xffbf3f00, alpha:.25, expected:null},
  {name:'zero-weight keyed neighbors of green', sample:0xff00ff00, alpha:1, expected:null},
  {name:'zero-weight nonkey neighbors of red key', sample:0xffff0000, alpha:0, expected:null},
];
const observations = cases.map(c => {
  const values = {$key_active:1, $key_blend:0, $key_index_mode:0,
    $sample:c.sample, $key_rgb:0xffff0000};
  const softwareDraw = !evaluate(ast[1], values);
  const gpuDraw = !gpuReject({a:c.alpha});
  return {...c, softwareDraw, gpuDraw,
    softwareMatches:c.expected === null ? null : softwareDraw === c.expected,
    gpuMatches:c.expected === null ? null : gpuDraw === c.expected};
});
assert.equal(observations[0].softwareDraw, false);
assert.equal(observations[0].gpuDraw, false);
assert.equal(observations[1].softwareDraw, true);
assert.equal(observations[1].gpuDraw, true);
assert.equal(observations[2].softwareMatches, false);
assert.equal(observations[2].gpuMatches, true);
for (const blend of [0,1]) {
  assert.equal(evaluate(ast[1], {$key_active:0,$key_blend:blend,
    $key_index_mode:0,$sample:0xffff0000,$key_rgb:0xffff0000}),0);
}
assert.equal(evaluate(ast[1], {$key_active:1,$key_blend:1,
  $key_index_mode:0,$sample:0,$key_rgb:0}),0);
const output = {kind:'source-predicate characterization; supplied sampler outputs',
  sources:Object.fromEntries([corePath,gpuPath,fixedPath].map(p => [p,
    crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),
  softwareExpression:source, gpuExpression:cutoff[1], observations,
  checks:'PASS; one expected software mismatch characterized, ambiguous cases ungraded',
  limits:'No actual WAT/GLSL, sampler, upload, framebuffer, native default, or version dispatch execution.'};
console.log(JSON.stringify(output,null,2));
