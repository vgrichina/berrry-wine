'use strict';

// An explicit byte adapter for the unchanged accepted entry. Never stages files.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = '1329b1ba6eb00144ff77d4cd92a8513d4fc953ad';
const ACCEPTED = '6d5121b5f96ee6032a9e347e2db64db29c478518';
const ENTRY = 'tools/mdk2-construction-driver-integration.cjs';
const ENTRY_SHA = '6cdfd208f802daac8cb5f3fd67f51f07c5195b294a9c86a58d8c168a973a378f';
const PINS_SHA = '4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed';
const BASE = 'scratch/runs/20261104-mdk2-fresh-pending-scene/';
const nativeRead = fs.readFileSync;
const resolvers = new WeakSet();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function relative(name) {
  assert(typeof name === 'string' && name.length && !name.includes('\\') && !name.includes('%') && !name.includes('\0'), 'invalid runtime path');
  assert(!path.isAbsolute(name) && name.split('/').every(p => p && p !== '.' && p !== '..'), 'noncanonical runtime path');
  return name;
}
function local(root, name) {
  relative(name);
  assert.equal(fs.realpathSync(root), root, 'noncanonical root');
  let file = root;
  for (const part of name.split('/')) {
    file = path.join(file, part);
    assert(!fs.lstatSync(file).isSymbolicLink(), 'symlink runtime path: ' + name);
  }
  assert(fs.statSync(file).isFile(), 'not a runtime file');
  return file;
}
function readLocal(root, name) {
  const file = local(root, name);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd), bytes = nativeRead(fd), after = fs.fstatSync(fd);
    assert(before.isFile() && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs, 'runtime changed during read');
    assert.equal(fs.realpathSync(file), file, 'runtime path changed during read');
    return bytes;
  } finally { fs.closeSync(fd); }
}
function exact(bytes, pin) {
  assert.equal(bytes.length, pin.bytes, 'runtime size mismatch: ' + pin.path);
  assert.equal(sha(bytes), pin.sha256, 'runtime SHA mismatch: ' + pin.path);
  return bytes;
}
function git(root, revision, name) {
  relative(name);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, {GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:'/dev/null', GIT_NO_REPLACE_OBJECTS:'1'});
  return cp.execFileSync('git', ['--no-replace-objects', 'show', revision + ':' + name], {cwd:root, env, timeout:10000, maxBuffer:4000000, stdio:['ignore','pipe','pipe']});
}
// Explicit accepted dependency amendments; historical rows stay preserved.
const BOUND_SOURCE = '9422cf64ca9d0bf868becb64e7209fb5feb670b3';
const BINDING = Object.freeze([
  {
    "path": "host.js",
    "oldSHA256": "cf2b7f3470c228f15c45089ddcec95346971e244223e08fdb0a28f85e8b6b5d7",
    "sha256": "f3e0d4bd915141225742d9b1558197aba045559e7d5661d5fdc32dae44898bea",
    "bytes": 383633,
    "publication": "fbbcf6280bf1bd8a27978ac2018262ec38426c53",
    "reason": "Initialize explicit idle input state; focused input/capture tests and locked build pass (20261104-stronghold-explicit-idle-input)",
    "sourceOnly": false
  },
  {
    "path": "lib/d3d-command-stream.js",
    "oldSHA256": "ea1080750e8557f261d2b62f646b2cbc317be1b639cdc566b022c9a6ad494945",
    "sha256": "264e15f0cf88a7c82c0a606293b98e0eb6cb6e41b6d9ff62c991b0f6349cfef9",
    "bytes": 48816,
    "publication": "4ef1febf63a37350fe3889da5b406084b224672c",
    "reason": "Preserve Device7 FLOAT3/4 texture inputs through queued rendering; tested locked build, software and WebGL1/2; run 20261104-legacy-transformed-float34",
    "sourceOnly": false
  },
  {
    "path": "lib/d3d-render-worker.js",
    "oldSHA256": "f3d77c20eb14a8f72233216af03d2a50e60862b2fd10202e4970878050124b52",
    "sha256": "79bf32cd97ee9d5810cfca7cf8c6820158e475b0a77f15e4fa6ff6c0713d0516",
    "bytes": 28021,
    "publication": "7d1a1289ea698cff150a5227a33f2dfae62fad9c",
    "reason": "Forward explicit legacy WebGL version; verify public MIRROR on WebGL1 (locked build, controls, 3840 pixels; run 20261104-legacy-mirror-webgl1)",
    "sourceOnly": false
  },
  {
    "path": "lib/d3d9-backend.js",
    "oldSHA256": "2a914377854faaaaaf771c06b36928d1fafe85823a2c517ff078fc608cd62eaf",
    "sha256": "ed6f21dfd038d6df522fa4a1b0f7dcfe87ea23a2c390a3f3367e3b1371064ecc",
    "bytes": 81699,
    "publication": "a62801c2f653b738a9ba6fa052c91b9d7c673d52",
    "reason": "Fix projected mip quotient gradients after WebGL readback failure; focused tests and locked build pass (20261104-legacy-provisioned-count-webgl)",
    "sourceOnly": false
  },
  {
    "path": "lib/d3d9-fixed.js",
    "oldSHA256": "13c8e353e63ecc11f544259aee8891f9f2ecf8a9aa0f99d0d96e2805da8791a6",
    "sha256": "5e3a7a421f5d11309be694cd1f167d36e27cee9130d8415ab22689c69867025d",
    "bytes": 31351,
    "publication": "ee3d94a31c34914d5903c1d966b7dfc2a5e75ed2",
    "reason": "Fix supplied projection clip Z and finite-input interpolation; WebGL1/2 direct, native projected and locked build PASS; run 20261104-legacy-projected-webgl-pixels",
    "sourceOnly": false
  },
  {
    "path": "lib/d3d9-shader.js",
    "oldSHA256": "24eb3e7e8de190f24893f352076c400d3b9a0dff669b99a37aba6c228df05a58",
    "sha256": "2156e0c1e1317fa7ef5fb26388dc73495f1ff8e0b3056acd72e0f661a992e665",
    "bytes": 49728,
    "publication": "a62801c2f653b738a9ba6fa052c91b9d7c673d52",
    "reason": "Fix projected mip quotient gradients after WebGL readback failure; focused tests and locked build pass (20261104-legacy-provisioned-count-webgl)",
    "sourceOnly": false
  },
  {
    "path": "lib/d3dim-draw-trace.js",
    "oldSHA256": "36899dbdb897e3904de737f71ae6e91b81913a34a142d437b5d559592c517061",
    "sha256": "c9b49045ad4c2d08840a8eb02d8fd9af4f27794fe30185e58df9c5119c6c9bd1",
    "bytes": 3255,
    "publication": "e947be8ad308f3eae93bd5b2914406ca704fbced",
    "reason": "Implement supplied COUNT3 texture projection with owned queued q; test both WASM consumers, mip/clipping controls and locked build (run 20261104-legacy-supplied-uv-projection)",
    "sourceOnly": false
  },
  {
    "path": "lib/d3dim-gpu.js",
    "oldSHA256": "36ea8f406d9ab9b90396e79ba417f347591817ad7242ed3b32436f2b4ea31b6f",
    "sha256": "3ded12d6ea5bd5a52fc609c0092773fada6b3bfc9a0a4190798ef921265be93c",
    "bytes": 58351,
    "publication": "4ef1febf63a37350fe3889da5b406084b224672c",
    "reason": "Preserve Device7 FLOAT3/4 texture inputs through queued rendering; tested locked build, software and WebGL1/2; run 20261104-legacy-transformed-float34",
    "sourceOnly": false
  },
  {
    "path": "lib/d3dim-render-worker.js",
    "oldSHA256": "1383eb795447b7c1beeeb8993a81ac86f17fcfbd8fe04bba7cd7948cfd79473f",
    "sha256": "cc8d0a91bd2389f3b17de757fe1728bf9cc01b504a517761fa8a7654d14f0753",
    "bytes": 3184,
    "publication": "7d1a1289ea698cff150a5227a33f2dfae62fad9c",
    "reason": "Forward explicit legacy WebGL version; verify public MIRROR on WebGL1 (locked build, controls, 3840 pixels; run 20261104-legacy-mirror-webgl1)",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-cache-loader-binding.js",
    "oldSHA256": null,
    "sha256": "6233cc42f6c33c9c700469354cb29ff4f3e5acae4fbffb894e064addbdac48ce",
    "bytes": 8426,
    "publication": "d5e762bce340580b74ce7c5157b77c4d84a7b7bd",
    "reason": "Bind optional cache observers before owning Worker loader execution; queued normal/compat parity, regressions and locked build PASS (20261104-deusex-cache-loader-binding)",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-draw-observer.js",
    "oldSHA256": null,
    "sha256": "7255f31d95f434f118fac7ad56ace4f041743cf74fbd80fc5929b28b2020094b",
    "bytes": 30229,
    "publication": "cbcfd14c1aff56f23bc8b05d29f8966c42b49eeb",
    "reason": "Add read-only Deus Ex surface identities; Worker fixtures and locked build pass; run 20261104-deusex-surface-binding-diagnostic",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-inline-eviction-observer.js",
    "oldSHA256": null,
    "sha256": "dde7764343f58e3ab7ffcf154ec5690f9e358c6aaea5ee4cd1045a10e6cbcfd0",
    "bytes": 7443,
    "publication": "d915b054702e3a9d0e58ffb82b2971aae516a8bb",
    "reason": "Observe original CoreCreate inline eviction; Worker parity and locked build PASS (20261104-deusex-inline-eviction-observer)",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-native-cache-observer.js",
    "oldSHA256": null,
    "sha256": "de6eb1a3110fbd5fed622444cadb75296561847e77db322c59b91f88fcdb2090",
    "bytes": 7426,
    "publication": "d3ef3fedb9d207a45ab7cae6a7ac174543d4071b",
    "reason": "Observe bounded native Core cache call intervals; test original bytes, queued Worker parity and locked build (run 20261104-deusex-native-cache-lifecycle-contract)",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-ordered-producer-observer.js",
    "oldSHA256": null,
    "sha256": "835d15befc348faff4b50d88d5e7f6878f4238f091d76b9bf34f3c6f7877d2a7",
    "bytes": 11085,
    "publication": "540ef75247eba9cfd18268debab79d4336d1692a",
    "reason": "fix(deusex): observe descriptor at delivered setup entry; Worker parity, draw regressions and build pass (20261104-deusex-upstream-observer-coverage)",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-softdrv-cache-observer.js",
    "oldSHA256": null,
    "sha256": "6663e970a32e9d590b183bbf3d81f3d817f99310a60bacfb090efb3ab31fb148",
    "bytes": 11256,
    "publication": "e11350a536ebd73c9b1ea08535f701c93e068ad9",
    "reason": "Observe nine original SoftDrv release paths; Worker parity/Core regressions/build pass (20261104-deusex-softdrv-release-paths)",
    "sourceOnly": false
  },
  {
    "path": "lib/deusex-startup-cache-observer.js",
    "oldSHA256": null,
    "sha256": "938e2d7fa821f61c763bee5e45824718a153e9f079de1f685fabb365a3d2181a",
    "bytes": 9324,
    "publication": "06edf99ac1c65ac76623d25dba65a00fe3af6221",
    "reason": "Observe Deus Ex startup and native FlushItem clear cut points; Worker parity, native regressions and locked build pass (run 20261104-deusex-startup-cache-observer)",
    "sourceOnly": false
  },
  {
    "path": "lib/guest-rpc.js",
    "oldSHA256": "39c0d671833330c71964c2f7ca4e24b1fc841b79e8eb54027d7889a9d2d306a1",
    "sha256": "075388dd3e52b2b137c12111b34406be651467004333567a0be47e09c9f3763b",
    "bytes": 59704,
    "publication": "d223b191ce637894f82d2d470c2a5d60c6cdee43",
    "reason": "Avoid synchronous no-op block trace RPCs in quiet Workers",
    "sourceOnly": false
  },
  {
    "path": "lib/guest-worker.js",
    "oldSHA256": "cffc9cc984874626a7b495ba9606d8c99ce72341db5c0dd7107172b2a8aafe70",
    "sha256": "1a444957d8d4220443ce39fc11e5b90217ec2a22f234d2a9635bf9fee9d738e1",
    "bytes": 72774,
    "publication": "d5e762bce340580b74ce7c5157b77c4d84a7b7bd",
    "reason": "Bind optional cache observers before owning Worker loader execution; queued normal/compat parity, regressions and locked build PASS (20261104-deusex-cache-loader-binding)",
    "sourceOnly": false
  },
  {
    "path": "lib/renderer.js",
    "oldSHA256": "a7c304c678a6a91622b693c8fb5416ace4c002245c3653b65fb18fdaf59d0924",
    "sha256": "35dd9c791dd893244ae3f8cdb8cb5d17f1246422effaaee493e69540a6c9d5ab",
    "bytes": 223300,
    "publication": "fbbcf6280bf1bd8a27978ac2018262ec38426c53",
    "reason": "Initialize explicit idle input state; focused input/capture tests and locked build pass (20261104-stronghold-explicit-idle-input)",
    "sourceOnly": false
  },
  {
    "path": "src/09a8-handlers-directx.wat",
    "oldSHA256": "ada45e4806e770d03dc87c0c1990e8ef88fdd94b2e4ecc47a61af06c667fada2",
    "sha256": "32f1de3506a758c9e094fb2d8a8c0d3d142ba8f017cccffc1c2facc7a743aad8",
    "bytes": 1064251,
    "publication": "e947be8ad308f3eae93bd5b2914406ca704fbced",
    "reason": "Implement supplied COUNT3 texture projection with owned queued q; test both WASM consumers, mip/clipping controls and locked build (run 20261104-legacy-supplied-uv-projection)",
    "sourceOnly": true
  },
  {
    "path": "src/09a8g-gl-raster.wat",
    "oldSHA256": "c7d87ee632ed69fd836980c4d1a232ee242221584fdd67550d8fd1329302a985",
    "sha256": "5cb449b37bd59aa12532aae91fed9fdcb9342c14037b2e4edaedbdf436788095",
    "bytes": 300245,
    "publication": "8fe71d6f021f2d7d9a86a54b30ae79772fe90427",
    "reason": "Fix GL triangle framebuffer alpha composition; test both modules and predecessor pixels; locked build PASS (20261104-gl-valid-fragment-composition)",
    "sourceOnly": true
  },
  {
    "path": "src/09aa-handlers-d3dim.wat",
    "oldSHA256": "4d288cb890e3d5ba4329f29fe8d0a9eb176012551f23133d7552dc9629c74220",
    "sha256": "e10cf2ea4f140a3dd96172e6c4ec3996bf47748d2423ae02d82deaa2f57d15c1",
    "bytes": 142592,
    "publication": "4ef1febf63a37350fe3889da5b406084b224672c",
    "reason": "Preserve Device7 FLOAT3/4 texture inputs through queued rendering; tested locked build, software and WebGL1/2; run 20261104-legacy-transformed-float34",
    "sourceOnly": true
  },
  {
    "path": "src/09ab-handlers-d3dim-core.wat",
    "oldSHA256": "67c23d9282f68b3a113e5d59bccbe283df4e2e1616ea11d88ec3fe5e660b9506",
    "sha256": "5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07",
    "bytes": 622555,
    "publication": "9422cf64ca9d0bf868becb64e7209fb5feb670b3",
    "reason": "Fix fractional clipped texture sample interpolation; both-module public COM/Worker matrices and locked build pass (run 20261104-legacy-fractional-clipping)",
    "sourceOnly": true
  },
  {
    "path": "build/wine-assembly.wasm",
    "oldSHA256": "cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee",
    "sha256": "018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd",
    "bytes": 2148848,
    "publication": "9422cf64ca9d0bf868becb64e7209fb5feb670b3",
    "reason": "Accepted canonical/compat build reproduced from accepted source; existing build path only",
    "module": true
  },
  {
    "path": "build/wine-assembly.compat.wasm",
    "oldSHA256": "580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3",
    "sha256": "4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2",
    "bytes": 2151461,
    "publication": "9422cf64ca9d0bf868becb64e7209fb5feb670b3",
    "reason": "Accepted canonical/compat build reproduced from accepted source; existing build path only",
    "module": true
  }
].map(row => Object.freeze(row)));
function acceptedManifest(original) {
  assert.equal(sha(original), PINS_SHA, 'stale original manifest');
  const pins = JSON.parse(original);
  assert.equal(pins.commit, SOURCE); assert.equal(pins.files.length, 432);
  const rows = new Map(pins.files.map(row => [row.path, {...row}]));
  for (const change of BINDING) {
    const prior = rows.get(change.path);
    if (!change.module) {
      if (change.oldSHA256 !== null) assert.equal(sha(git(ROOT, SOURCE, change.path)), change.oldSHA256, 'historical source changed');
      exact(git(ROOT, BOUND_SOURCE, change.path), change);
    }
    if (!change.sourceOnly) {
      if (prior) assert.equal(prior.sha256, change.oldSHA256, 'stale dependency pair: ' + change.path);
      else assert.equal(change.oldSHA256, null, 'missing historical dependency');
      rows.set(change.path, {path:change.path, bytes:change.bytes, sha256:change.sha256});
    }
  }
  return Buffer.from(JSON.stringify({...pins, commit:BOUND_SOURCE,
    historical:{commit:SOURCE, pinsSHA256:PINS_SHA, files:pins.files, moduleFiles:pins.moduleFiles},
    amendments:BINDING.map(row => ({...row, source:BOUND_SOURCE})), files:[...rows.values()],
    moduleFiles:BINDING.filter(row => row.module).map(row => ({path:row.path, localReference:row.path, bytes:row.bytes, sha256:row.sha256}))}));
}

// Preserve the complete accepted manifest; amend only the named released source
// and its exact existing module pair for this separately authorized original.
const CURRENT_SOURCE = '17e09475ecaeaa47de76684df0a0518124a6e387';
const CURRENT_BINDING = Object.freeze([
  {
    "path": "src/09ab-handlers-d3dim-core.wat",
    "oldSHA256": "5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07",
    "sha256": "dbcf489a787b4f399eadc926e13336976d6eb0cc30ffed5c8c360af5b496a75a",
    "bytes": 629038,
    "publication": "17e09475ecaeaa47de76684df0a0518124a6e387",
    "reason": "Final published RGB anchored subpixel placement with literal preserved SIMD packing; exact released module pair",
    "sourceOnly": true
  },
  {
    "path": "build/wine-assembly.wasm",
    "oldSHA256": "018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd",
    "sha256": "e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412",
    "bytes": 2149486,
    "publication": "17e09475ecaeaa47de76684df0a0518124a6e387",
    "reason": "Final published RGB anchored subpixel placement with literal preserved SIMD packing; exact released module pair",
    "module": true
  },
  {
    "path": "build/wine-assembly.compat.wasm",
    "oldSHA256": "4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2",
    "sha256": "66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8",
    "bytes": 2152099,
    "publication": "17e09475ecaeaa47de76684df0a0518124a6e387",
    "reason": "Final published RGB anchored subpixel placement with literal preserved SIMD packing; exact released module pair",
    "module": true
  }
].map(row => Object.freeze(row)));
function currentManifest(original) {
  const acceptedBytes = acceptedManifest(original), pins = JSON.parse(acceptedBytes);
  const files = new Map(pins.files.map(row => [row.path, {...row}]));
  for (const change of CURRENT_BINDING) {
    const prior = change.sourceOnly ? BINDING.find(row => row.path === change.path) : files.get(change.path);
    assert.equal(prior?.sha256, change.oldSHA256, 'stale current dependency pair: ' + change.path);
    if (change.sourceOnly) exact(git(ROOT, CURRENT_SOURCE, change.path), change);
    else files.set(change.path, {path:change.path, bytes:change.bytes, sha256:change.sha256});
  }
  return Buffer.from(JSON.stringify({...pins, commit:CURRENT_SOURCE,
    accepted:{commit:BOUND_SOURCE, pinsSHA256:sha(acceptedBytes), files:pins.files,
      moduleFiles:pins.moduleFiles, amendments:pins.amendments},
    amendments:[...pins.amendments, ...CURRENT_BINDING.map(row => ({...row, source:CURRENT_SOURCE}))],
    files:[...files.values()],
    moduleFiles:CURRENT_BINDING.filter(row => row.module).map(row => ({path:row.path, localReference:row.path, bytes:row.bytes, sha256:row.sha256}))}));
}

function createResolver({root = ROOT, manifestBytes, binding = 'accepted'} = {}) {
  assert.equal(root, path.resolve(root), 'absolute canonical root required');
  assert.equal(fs.realpathSync(root), root, 'symlink root');
  const originalManifest = manifestBytes === undefined ? zlib.gunzipSync(readLocal(root, BASE + 'runtime-pins.json.gz')) : Buffer.from(manifestBytes);
  assert.equal(sha(originalManifest), PINS_SHA, 'stale original manifest');
  assert(['current','accepted','historical'].includes(binding), 'unknown runtime binding');
  const manifest = binding === 'current' ? currentManifest(originalManifest) : binding === 'accepted' ? acceptedManifest(originalManifest) : originalManifest;
  const pins = JSON.parse(manifest);
  const sourceCommit = binding === 'current' ? CURRENT_SOURCE : binding === 'accepted' ? BOUND_SOURCE : SOURCE;
  const rows = new Map(), sources = new Map();
  for (const row of pins.files) {
    relative(row.path); assert(!rows.has(row.path), 'duplicate runtime path');
    rows.set(row.path, Object.freeze({...row}));
  }
  const modules = new Map(pins.moduleFiles.map(row => [row.path, row]));
  for (const row of rows.values()) {
    const module = modules.get(row.path);
    if (module) {
      assert.equal(module.bytes, row.bytes); assert.equal(module.sha256, row.sha256);
      relative(module.localReference);
      let storage = module.localReference;
      try { fs.lstatSync(path.join(root, storage)); } catch (e) { if (e.code !== 'ENOENT') throw e; storage += '.gz'; }
      sources.set(row.path, Object.freeze({kind:storage.endsWith('.gz') ? 'gzip' : 'retained', path:storage}));
    } else {
      // Existing matching files stay path references. A later change must fail;
      // it cannot silently switch to Git or to a different live path.
      const bytes = readLocal(root, row.path);
      if (bytes.length === row.bytes && sha(bytes) === row.sha256) sources.set(row.path, Object.freeze({kind:'live', path:row.path}));
      else {
        exact(git(root, sourceCommit, row.path), row);
        sources.set(row.path, Object.freeze({kind:'git', commit:sourceCommit, path:row.path}));
      }
    }
  }
  function read(name) {
    relative(name);
    const pin = rows.get(name), source = sources.get(name);
    assert(pin && source, 'foreign runtime path: ' + name);
    // Reject symlink aliases even when the selected bytes come from Git.
    local(root, name);
    let bytes = source.kind === 'git' ? git(root, source.commit, source.path) : readLocal(root, source.path);
    if (source.kind === 'gzip') bytes = zlib.gunzipSync(bytes, {maxOutputLength:pin.bytes + 1});
    return exact(bytes, pin);
  }
  function verify() {
    return [...rows.values()].map(row => { const bytes = read(row.path); return {path:row.path, bytes:bytes.length, sha256:sha(bytes), source:sources.get(row.path)}; });
  }
  verify();
  const resolver = Object.freeze({root, manifest:() => Buffer.from(manifest), files:() => [...rows.values()].map(r => ({...r})), read, verify});
  resolvers.add(resolver); return resolver;
}

function requestPath(raw) {
  assert(typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//'), 'foreign request target');
  const pathname = decodeURIComponent(raw.split('?')[0]);
  return relative(pathname === '/' ? 'index.html' : pathname.slice(1));
}
function handler(resolver, options, serverModule) {
  return async (req, res) => {
    try {
      assert(req.method === 'GET' || req.method === 'HEAD', 'unsupported method');
      const name = requestPath(req.url), bytes = resolver.read(name);
      if (options.handleRequest) assert.equal(await options.handleRequest(req, res), false, 'foreign HTTP handler');
      assert(!res.headersSent && !res.writableEnded, 'foreign HTTP response');
      const resolved = {file:path.join(resolver.root, name), pathname:'/' + name, stat:{size:bytes.length, isFile:() => true}, status:200};
      // Preserve the original driver's audit and first-failure callback.
      const extra = typeof options.headers === 'function' ? options.headers(req, resolved) : (options.headers || {});
      const headers = {...extra, 'Content-Type':serverModule.mimeType(name), 'Content-Length':bytes.length,
        'Cache-Control':'no-store', 'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'require-corp', 'Accept-Ranges':'bytes'};
      let body = bytes, status = 200;
      if (req.headers.range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start = m && m[1] !== '' ? Number(m[1]) : NaN;
        let end = m && m[2] !== '' ? Number(m[2]) : bytes.length - 1;
        if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, bytes.length - Number(m[2])); end = bytes.length - 1; }
        if (!m || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= bytes.length || end < start) {
          res.writeHead(416, {...headers, 'Content-Length':0, 'Content-Range':`bytes */${bytes.length}`}); res.end(); return true;
        }
        end = Math.min(end, bytes.length - 1); body = bytes.subarray(start, end + 1); status = 206;
        headers['Content-Length'] = body.length; headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
      }
      res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (res.headersSent) res.destroy(error);
      else { res.writeHead(403, {'Cache-Control':'no-store'}); res.end('runtime request rejected'); }
    }
    return true;
  };
}
async function startServer(resolver, options = {}, start) {
  assert(resolvers.has(resolver), 'unverified resolver');
  assert.equal(options.root || resolver.root, resolver.root, 'foreign server root');
  assert(!options.host || options.host === '127.0.0.1', 'loopback only');
  assert(!options.rewritePath && !options.allowedRealRoots && !options.mimeType && !options.mimeTypes, 'foreign server mapping');
  assert(options.crossOriginIsolated !== false && options.cacheControl !== false, 'isolation/no-store required');
  const serverModule = require(path.join(resolver.root, 'test/static-server.js'));
  return (start || serverModule.startStaticServer)({...options, root:resolver.root, host:'127.0.0.1', crossOriginIsolated:true,
    handleRequest:handler(resolver, options, serverModule)});
}
async function close(server) {
  server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
}
async function verifyHTTP(resolver, server) {
  assert(resolvers.has(resolver), 'unverified resolver');
  const rows = [];
  const deadline = Date.now() + 30000;
  for (const pin of resolver.files()) {
    assert(Date.now() < deadline, 'HTTP prerequisite deadline');
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/' + pin.path, {signal:AbortSignal.timeout(Math.max(1, Math.min(10000,deadline-Date.now())))});
    assert.equal(response.status, 200, pin.path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    const bytes = exact(Buffer.from(await response.arrayBuffer()), pin);
    rows.push({path:pin.path, bytes:bytes.length, sha256:sha(bytes)});
  }
  return rows;
}
let active = false;
async function installAdapter(resolver, candidateSHA256) {
  assert(resolvers.has(resolver), 'unverified resolver');
  assert(!active && fs.readFileSync === nativeRead, 'adapter requires clean dedicated process');
  exact(git(resolver.root, ACCEPTED, ENTRY), {path:ENTRY, bytes:git(resolver.root, ACCEPTED, ENTRY).length, sha256:ENTRY_SHA});
  assert.match(candidateSHA256 || '', /^[a-f0-9]{64}$/, 'explicit driver candidate required');
  assert.equal(sha(readLocal(resolver.root, ENTRY)), candidateSHA256, 'changed recorded driver candidate');
  const entry = require(path.join(resolver.root, ENTRY));
  const inspection = entry.inspect(); // Original 111 helpers, observer, four Git dependencies and modules.
  const filesystem = resolver.verify();
  const proofServer = await startServer(resolver);
  let http;
  try { http = await verifyHTTP(resolver, proofServer); } finally { await close(proofServer); }
  const serverModule = require(path.join(resolver.root, 'test/static-server.js')), originalStart = serverModule.startStaticServer;
  const names = new Set(resolver.files().map(r => r.path));
  const read = function(file, options) {
    if (typeof file === 'string') {
      const absolute = path.resolve(file), name = path.relative(resolver.root, absolute);
      if (names.has(name)) {
        assert.equal(file, absolute, 'noncanonical filesystem pin path');
        const bytes = resolver.read(name), encoding = typeof options === 'string' ? options : options?.encoding;
        return encoding ? bytes.toString(encoding) : bytes;
      }
    }
    return Reflect.apply(nativeRead, this, arguments);
  };
  const start = options => startServer(resolver, options, originalStart);
  fs.readFileSync = read; serverModule.startStaticServer = start; active = true;
  return {inspection, filesystem, http, restore() {
    assert(fs.readFileSync === read, 'filesystem adapter replaced');
    // The accepted endpoint wrapper may wrap start after installation. Restore
    // only in the dedicated process after its server is closed.
    fs.readFileSync = nativeRead; serverModule.startStaticServer = originalStart; active = false;
  }};
}
module.exports = {ROOT, SOURCE, CURRENT_SOURCE, CURRENT_BINDING, currentManifest, BOUND_SOURCE, BINDING, acceptedManifest, ACCEPTED, ENTRY, PINS_SHA, sha, exact, relative, requestPath, createResolver, startServer, verifyHTTP, close, installAdapter};
if (require.main === module) {
  // Deliberately no --run mode: gameplay requires a fresh separate assignment.
  (async () => {
    assert.equal(process.argv.length, 3); assert.equal(process.argv[2], '--check');
    const resolver = createResolver(), adapter = await installAdapter(resolver, sha(readLocal(ROOT, ENTRY)));
    try { console.log(JSON.stringify({status:'exact-filesystem-and-http-prerequisites', pinsSHA256:PINS_SHA,
      filesystem:adapter.filesystem, http:adapter.http, accepted:adapter.inspection.status, gameplay:false}, null, 2)); }
    finally { adapter.restore(); }
  })().catch(e => { console.error(e.stack); process.exitCode = 1; });
}
