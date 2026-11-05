# MDK2 accepted runtime binding and single original observation

The actual `local.start` entry now selects accepted source
`9422cf64ca9d0bf868becb64e7209fb5feb670b3`, canonical
`018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` and compat
`4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2`.
This repairs the actual resolver selection diagnosed in published
[`bc03209a1`](mdk2-original-timer-load-20261104.md), including its composed
preload, inspection, original filesystem loops, server and controller identities.
The passive observer remains byte-identical to published `399d2128d`.

Evidence is `scratch/runs/20261104-mdk2-accepted-runtime-binding/` (RUN).
Git is the source archive: base/candidate commits, relevant binary diff and
owned new-note patch are retained. Modules and original media are referenced
by existing path and SHA only. There are no source snapshots, tar archives,
module/media copies or shared-file restoration.

The old 432-row inventory and retained-module references remain under
`historical` in the selected manifest and remain covered by their original
regressions. The accepted 439-row HTTP/filesystem inventory applies exactly the
following named amendments, adding the seven accepted JavaScript dependencies.
The four WAT rows are source provenance checks against Git, not served source
copies. No other inventory row is rehashed or replaced. New dependencies have
no historical SHA (`absent`). Each publication below is reachable in accepted
`9422cf64c`; full commit IDs and publication subjects are in RUN/binding-ledger.json
and the resolver's immutable literal ledger.

| Dependency | Old SHA-256 | Accepted SHA-256 | Published provenance / reason |
| --- | --- | --- | --- |
| `host.js` | `cf2b7f3470c228f15c45089ddcec95346971e244223e08fdb0a28f85e8b6b5d7` | `f3e0d4bd915141225742d9b1558197aba045559e7d5661d5fdc32dae44898bea` | `fbbcf6280`: Initialize explicit idle input state; focused input/capture tests and locked build pass (20261104-stronghold-explicit-idle-input) |
| `lib/d3d-command-stream.js` | `ea1080750e8557f261d2b62f646b2cbc317be1b639cdc566b022c9a6ad494945` | `264e15f0cf88a7c82c0a606293b98e0eb6cb6e41b6d9ff62c991b0f6349cfef9` | `4ef1febf6`: Preserve Device7 FLOAT3/4 texture inputs through queued rendering; tested locked build, software and WebGL1/2; run 20261104-legacy-transformed-float34 |
| `lib/d3d-render-worker.js` | `f3d77c20eb14a8f72233216af03d2a50e60862b2fd10202e4970878050124b52` | `79bf32cd97ee9d5810cfca7cf8c6820158e475b0a77f15e4fa6ff6c0713d0516` | `7d1a1289e`: Forward explicit legacy WebGL version; verify public MIRROR on WebGL1 (locked build, controls, 3840 pixels; run 20261104-legacy-mirror-webgl1) |
| `lib/d3d9-backend.js` | `2a914377854faaaaaf771c06b36928d1fafe85823a2c517ff078fc608cd62eaf` | `ed6f21dfd038d6df522fa4a1b0f7dcfe87ea23a2c390a3f3367e3b1371064ecc` | `a62801c2f`: Fix projected mip quotient gradients after WebGL readback failure; focused tests and locked build pass (20261104-legacy-provisioned-count-webgl) |
| `lib/d3d9-fixed.js` | `13c8e353e63ecc11f544259aee8891f9f2ecf8a9aa0f99d0d96e2805da8791a6` | `5e3a7a421f5d11309be694cd1f167d36e27cee9130d8415ab22689c69867025d` | `ee3d94a31`: Fix supplied projection clip Z and finite-input interpolation; WebGL1/2 direct, native projected and locked build PASS; run 20261104-legacy-projected-webgl-pixels |
| `lib/d3d9-shader.js` | `24eb3e7e8de190f24893f352076c400d3b9a0dff669b99a37aba6c228df05a58` | `2156e0c1e1317fa7ef5fb26388dc73495f1ff8e0b3056acd72e0f661a992e665` | `a62801c2f`: Fix projected mip quotient gradients after WebGL readback failure; focused tests and locked build pass (20261104-legacy-provisioned-count-webgl) |
| `lib/d3dim-draw-trace.js` | `36899dbdb897e3904de737f71ae6e91b81913a34a142d437b5d559592c517061` | `c9b49045ad4c2d08840a8eb02d8fd9af4f27794fe30185e58df9c5119c6c9bd1` | `e947be8ad`: Implement supplied COUNT3 texture projection with owned queued q; test both WASM consumers, mip/clipping controls and locked build (run 20261104-legacy-supplied-uv-projection) |
| `lib/d3dim-gpu.js` | `36ea8f406d9ab9b90396e79ba417f347591817ad7242ed3b32436f2b4ea31b6f` | `3ded12d6ea5bd5a52fc609c0092773fada6b3bfc9a0a4190798ef921265be93c` | `4ef1febf6`: Preserve Device7 FLOAT3/4 texture inputs through queued rendering; tested locked build, software and WebGL1/2; run 20261104-legacy-transformed-float34 |
| `lib/d3dim-render-worker.js` | `1383eb795447b7c1beeeb8993a81ac86f17fcfbd8fe04bba7cd7948cfd79473f` | `cc8d0a91bd2389f3b17de757fe1728bf9cc01b504a517761fa8a7654d14f0753` | `7d1a1289e`: Forward explicit legacy WebGL version; verify public MIRROR on WebGL1 (locked build, controls, 3840 pixels; run 20261104-legacy-mirror-webgl1) |
| `lib/deusex-cache-loader-binding.js` | `absent` | `6233cc42f6c33c9c700469354cb29ff4f3e5acae4fbffb894e064addbdac48ce` | `d5e762bce`: Bind optional cache observers before owning Worker loader execution; queued normal/compat parity, regressions and locked build PASS (20261104-deusex-cache-loader-binding) |
| `lib/deusex-draw-observer.js` | `absent` | `7255f31d95f434f118fac7ad56ace4f041743cf74fbd80fc5929b28b2020094b` | `cbcfd14c1`: Add read-only Deus Ex surface identities; Worker fixtures and locked build pass; run 20261104-deusex-surface-binding-diagnostic |
| `lib/deusex-inline-eviction-observer.js` | `absent` | `dde7764343f58e3ab7ffcf154ec5690f9e358c6aaea5ee4cd1045a10e6cbcfd0` | `d915b0547`: Observe original CoreCreate inline eviction; Worker parity and locked build PASS (20261104-deusex-inline-eviction-observer) |
| `lib/deusex-native-cache-observer.js` | `absent` | `de6eb1a3110fbd5fed622444cadb75296561847e77db322c59b91f88fcdb2090` | `d3ef3fedb`: Observe bounded native Core cache call intervals; test original bytes, queued Worker parity and locked build (run 20261104-deusex-native-cache-lifecycle-contract) |
| `lib/deusex-ordered-producer-observer.js` | `absent` | `835d15befc348faff4b50d88d5e7f6878f4238f091d76b9bf34f3c6f7877d2a7` | `540ef7524`: fix(deusex): observe descriptor at delivered setup entry; Worker parity, draw regressions and build pass (20261104-deusex-upstream-observer-coverage) |
| `lib/deusex-softdrv-cache-observer.js` | `absent` | `6663e970a32e9d590b183bbf3d81f3d817f99310a60bacfb090efb3ab31fb148` | `e11350a53`: Observe nine original SoftDrv release paths; Worker parity/Core regressions/build pass (20261104-deusex-softdrv-release-paths) |
| `lib/deusex-startup-cache-observer.js` | `absent` | `938e2d7fa821f61c763bee5e45824718a153e9f079de1f685fabb365a3d2181a` | `06edf99ac`: Observe Deus Ex startup and native FlushItem clear cut points; Worker parity, native regressions and locked build pass (run 20261104-deusex-startup-cache-observer) |
| `lib/guest-rpc.js` | `39c0d671833330c71964c2f7ca4e24b1fc841b79e8eb54027d7889a9d2d306a1` | `075388dd3e52b2b137c12111b34406be651467004333567a0be47e09c9f3763b` | `d223b191c`: Avoid synchronous no-op block trace RPCs in quiet Workers |
| `lib/guest-worker.js` | `cffc9cc984874626a7b495ba9606d8c99ce72341db5c0dd7107172b2a8aafe70` | `1a444957d8d4220443ce39fc11e5b90217ec2a22f234d2a9635bf9fee9d738e1` | `d5e762bce`: Bind optional cache observers before owning Worker loader execution; queued normal/compat parity, regressions and locked build PASS (20261104-deusex-cache-loader-binding) |
| `lib/renderer.js` | `a7c304c678a6a91622b693c8fb5416ace4c002245c3653b65fb18fdaf59d0924` | `35dd9c791dd893244ae3f8cdb8cb5d17f1246422effaaee493e69540a6c9d5ab` | `fbbcf6280`: Initialize explicit idle input state; focused input/capture tests and locked build pass (20261104-stronghold-explicit-idle-input) |
| `src/09a8-handlers-directx.wat` | `ada45e4806e770d03dc87c0c1990e8ef88fdd94b2e4ecc47a61af06c667fada2` | `32f1de3506a758c9e094fb2d8a8c0d3d142ba8f017cccffc1c2facc7a743aad8` | `e947be8ad`: Implement supplied COUNT3 texture projection with owned queued q; test both WASM consumers, mip/clipping controls and locked build (run 20261104-legacy-supplied-uv-projection) |
| `src/09a8g-gl-raster.wat` | `c7d87ee632ed69fd836980c4d1a232ee242221584fdd67550d8fd1329302a985` | `5cb449b37bd59aa12532aae91fed9fdcb9342c14037b2e4edaedbdf436788095` | `8fe71d6f0`: Fix GL triangle framebuffer alpha composition; test both modules and predecessor pixels; locked build PASS (20261104-gl-valid-fragment-composition) |
| `src/09aa-handlers-d3dim.wat` | `4d288cb890e3d5ba4329f29fe8d0a9eb176012551f23133d7552dc9629c74220` | `e10cf2ea4f140a3dd96172e6c4ec3996bf47748d2423ae02d82deaa2f57d15c1` | `4ef1febf6`: Preserve Device7 FLOAT3/4 texture inputs through queued rendering; tested locked build, software and WebGL1/2; run 20261104-legacy-transformed-float34 |
| `src/09ab-handlers-d3dim-core.wat` | `67c23d9282f68b3a113e5d59bccbe283df4e2e1616ea11d88ec3fe5e660b9506` | `5c892770004355099d016e301ff73366a560237d681faf0cd3c6bd3aa8e4fc07` | `9422cf64c`: Fix fractional clipped texture sample interpolation; both-module public COM/Worker matrices and locked build pass (run 20261104-legacy-fractional-clipping) |
| `build/wine-assembly.wasm` | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` | `9422cf64c`: Accepted canonical/compat build reproduced from accepted source; existing build path only |
| `build/wine-assembly.compat.wasm` | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` | `9422cf64c`: Accepted canonical/compat build reproduced from accepted source; existing build path only |

The quiet bridge remains explicit: historical `39c0d671…` to accepted
`075388dd…` is published `d223b191c`, the same quiet `log_block` behavior
previously produced by the candidate adapter. Explicit forwarding remains
unchanged. The accepted Git bridge is served directly; it is not patched twice.
The historical `quietManifest`/`quietRuntimeBytes` transformation remains for
its unchanged historical regression and is not the actual selected entry.

The controller pair checks also bind the accepted source/canonical SHA in
memory. Exactly two identity literals change in each original controller; the
stored historical files remain unchanged. Menu readiness, full active0 rest,
inspection, ACK, input, failure latch, aggregate deadline and fixed selector
budgets remain. The existing no-pacing/Medium-reserve adapter still retains
16ms and the 512/544 limits. Generated `bound-controller.cjs` carries the
original operator continuation to these bound exports; it does not invoke a
new game route. RUN/controller bindings and generated-input-hashes.json record
the exact transforms and generated transport/controller bytes.

| Caller/helper dependency | Old SHA-256 | Bound SHA-256 | Provenance / reason |
| --- | --- | --- | --- |
| `scratch/runs/20261104-mdk2-adequate-lifetime-menu/native-menu.cjs` | `1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed` | `71e6c05b6cba75184a900229a1525bcbf5b6ca253bb6fbb81655dd881c02c680` | Retained helper pinned by published399d2128d: In-memory exact source/canonical identity binding only; original controller predicates unchanged |
| `scratch/runs/20261104-mdk2-unhighlighted-menu-onward/unhighlighted-control.cjs` | `b116e469f472a79affd4757850cfc509b618f7c665a3707c1a282b403821a6c7` | `e7f4b517d1bbfc7595a1fb1468f52d68fd134cc62e39b8094be7742d9222e9e7` | Retained helper pinned by published399d2128d: In-memory exact source/canonical identity binding only; original controller predicates unchanged |
| `scratch/runs/20261104-mdk2-pending-scheme-cause/pending-control.cjs` | `8d96656540eb39a873e50ce5bb006dd8b51524a26d6177e915c7305c5448fbb0` | `b7d6af2f4911ddf619fce75c402d6a4742e7dc45a74dd97eb4534ce349af2332` | Retained helper pinned by published399d2128d: In-memory exact source/canonical identity binding only; original controller predicates unchanged |
| `scratch/runs/20261104-mdk2-adequate-lifetime-menu/construction-control.cjs` | `b8176b7c3a923a02630f65f9df1edf9b8117ccbca82f0fe83727c71dd3d374d2` | `a0d87ef291e24e581b185ce08f55909e3fd9fc667e0eb657622ccdab84ced7bb` | Retained helper pinned by published399d2128d: In-memory exact source/canonical identity binding only; original controller predicates unchanged |
| `scratch/runs/20261104-mdk2-adequate-lifetime-menu/comic-control.cjs` | `820dd72ffedbcd3478bbcda2e6bd33440410a5fd3e7b91cd39c4574bef6e2484` | `14fc279a3a2951359730de1392065b1afbc8148073e915500c4df1949b86a06f` | Retained helper pinned by published399d2128d: In-memory exact source/canonical identity binding only; original controller predicates unchanged |
| `tools/mdk2-local-runtime.cjs` | `058f062131879a2a3f723cb3f1fc0838a369e1dd894b0b6cd7ee67db0ae60957` | `64a88c0eb94cb49c87b6a0e193cbe6691270be97a580edd8a7c060d3bc82f97b` | bc03209a1; observer/driver origin399d2128d: Exact controller pair binding and candidate closure, local assignment/deadline renewal; caps unchanged |
| `tools/mdk2-construction-driver-integration.cjs` | `e0f3aa9b36af2a70d42f292c1f165f6dccc5724d75e716d276dcb9b78eb3fcf0` | `304095c0d5a70966ce13172731e055446af6444a25f5fb0fc1ee7d354ba77feb` | bc03209a1; observer/driver origin399d2128d: Use accepted resolver/preload/inspection/controller CLI; retain published399d2128d observation/driver behavior |
| `tools/mdk2-immutable-runtime-resolver.cjs` | `356f0e7216e375e3e8d7c6a003d958de4f9f611205a222aa7d9cf65c7e53c77c` | `782462b58905ca7ef5973ecf01b5820ce233b69958e3e21c03c013ab395f040a` | bc03209a1; observer/driver origin399d2128d: Explicit accepted runtime binding with historical inventory retained |
| `tools/mdk2-lua-construction-observer.cjs` | `dd37b5ba98bf052078bc81c72f4850f4e73caeea5b72c81698c4b0805269dfc3` | `dd37b5ba98bf052078bc81c72f4850f4e73caeea5b72c81698c4b0805269dfc3` | bc03209a1; observer/driver origin399d2128d: Unchanged published399d2128d passive observer |

Predecessor `12a87f179` recorded observer `32a03239…`, driver `8d173070…`
and local helper `2372f7c8…`; published399d2128d advanced the observer to
`dd37b5ba…` and driver to `e0f3aa9b…`. Publishedbc03209a1 advanced only local
assignment/deadlines to `058f0621…`. The table above starts at bc03209a1 and
names this repair's additional changes; the observer is unchanged. Full earlier
SHAs remain in the predecessor note and RUN/caller-binding-ledger.json.

The actual candidate adapter rejects historical/wrong pairs, stale manifest,
changed accepted dependency, altered canonical/compat bytes, and changed driver
candidate before the launch boundary. Historical tests explicitly request their
historical pins; production defaults and the actual local entry require the
complete accepted pair. Real Worker native fixtures cover both accepted
source/module pairs and their control, alongside historical native regressions.

This assignment renews only local assignment/deadlines to
`20261104-mdk2-accepted-runtime-binding`, Chrome cutoff
`2026-11-05T00:35:00Z`, cleanup cutoff `00:38:00Z`. The 720-second browser,
60-second bootstrap, 40-second command and 180-second cleanup caps remain.
Candidate release checks now include resolver and observer hashes alongside
local/driver hashes. External `/tmp/wine-local-runtime.lock` remains mandatory.
Stronghold and legacy lanes are offline; the coordinator owns shutdown.
Box ID/state/expiry: NA (local processes).

Validation before publication: 25 resolver, 43 local and 153 integration tests and
`flock /tmp/wine-build.lock bash tools/build.sh`. The build reproduces both
accepted module hashes. Published candidate `337356d17278bf2a5df8726437d2dabea3933e4d` passed the fresh
actual-entry 439-filesystem/439-proof-HTTP/439-actual-caller-HTTP preflight,
111 helper and five bound-controller checks, and 2253 installed Puppeteer caller
filesystem checks. Plain Puppeteer mock plus independent public/native spawn
prohibitions admitted ZERO Chrome. Wrong pair, stale hash and changed dependency
negatives reject. The exited preflight directory was moved into the run directory
as `preflight/`; its audit retains its original direct path. The same final
published entry repeated the closure before its single actual Chrome launch.
The final local test uses a relative future timestamp, fixing its obsolete
pre-midnight negative fixture without changing production release checks.

Original observation: ONE launch, at `2026-11-05T00:05:50.545Z`, stopped on
the first causal failure. Actual page and both guest-worker module observations
are canonical `018c94ff…`; selected source is `9422cf64c…`. I personally viewed
every fresh image (ten PNGs: startup 0 through 3584 in 512-step increments,
then native-selector-64 at 3600 and native-selector-67 at 3648) before controls.
New Game opened the difficulty dialog; Medium was visibly highlighted.

The original Medium selector exhausted its unchanged aggregate 512-step menu
allowance at global step4096, before admitting the press. Its ledger is
512 steps /69 commands of113; 16 observe +48 New Game +448 Medium execution
steps account for512. The extra32 post-release reserve (maximum544) was never
eligible: Enter down/character remained queued, native command raw/previous/active
were all0, `current=diff`, `conscheme=menu`, `showmenu=1`. This is pending input,
not a completed Medium release or a full-rest witness. No Medium keyup was sent
and no additional gameplay command followed the failure.

The continuous main-worker observer spans3648–4096 without restart, with
465000 blocks,29 samples,3 decoder-output and2 decoder-return records. Its
worker slot0/endpoint1, thread1 and module identity remain fixed. It records
no main-GC-exit/native timer-handler/deferred-load/type10/script-buffer/newLevel
event during this window. Resource completion remains the already-completed
`pointer` request; deferred requestedLevel/checkpoint/loadFlag remain0 and
Level table138666976 remains unchanged. Neither decoder activity nor this
resource completion establishes timer/load execution or gameplay. Detailed
records and owner boundaries remain in `browser/bounded-trace-*`; the concise
analysis is `original-observation-analysis.json`. No gameplay claim is made.

On that failure I requested normal close. `browser.close` was called
00:11:31.808Z, resolved00:11:32.355Z; Chrome PID1507134/start188435978 exited0
with null signal. Node1506733/start188435528 and flock1506732/start188435528
are absent. ProofHTTP44569, actualHTTP34373 and DevTools41881 refuse connections;
no profile Chrome remains, the exact owned profile was removed, and external
flock inode141907 is free. `cleanup-verification.json` records the checks at
00:11:54Z, well before both cutoffs. No retry, reset, cap raise, source repair
or new Chrome followed. Box ID/state/expiryNA; coordinator retains shutdown.

Evidence uses Git commit337356d plus relevant binary patches and existing-path
SHA references, including original media/module identities. There are no source
snapshots, media/module copies or archives. The next investigation is offline:
why the accepted runtime spends the bounded Medium window in decoder execution
before consuming Enter; this assignment ends at the preserved first failure.
The 50M/360s, owner/record/byte/input/ACK, frozen-review and original assets/config
guards remain; no reset, cap raise or timer driving is introduced. ACK, active1,
a countdown, an absolute deadline, deferred-load demand, completion, type10,
script buffer and newLevel remain distinct evidence.
