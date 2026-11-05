# Return Fire playback observation, 2026-11-05

The sole local original attempt stopped at a concrete observation-harness
boundary: `manifest.webmanifest` was omitted from the pinned served-file list.
Its HTML-declared request received HTTP 500 and the harness stopped before guest
startup. Return Fire's audio startup, populated Play and host delivery were **not
observed**. This demonstrates no audio engine defect. Audible output remains
unobserved. No second original was run and no production fix was made.
Accepted launcher `5d014a0e` and movement/presentation `9f695796c` remain accepted.

Read alongside `return-fire-audio-cause-20261105.md` and `return-fire-demo.md`.
Evidence and small executable run inputs are in
`scratch/runs/20261105-return-fire-playback-observation/`. Originals remain at
their existing paths, with all 58 file hashes checked against the original
inventory and all 37 PCM effects preserved. There are no media, module or source
tree copies, archives, guest/configuration edits or production fixes.

The passive observer uses the existing dispatch entry/return imports and owning
instance getters, following the pairing contract exercised by
`tools/jig-owning-api-observer.test.js`. It records startup timer/acmMetrics50,
device/primary, mmio load, secondary creation/Lock/Unlock, DuplicateSoundBuffer
and Play with completion/stack checks. Read-only DX records come from the
generated region mirror; populated PCM is hashed without saving PCM copies.
The existing narrow block-entry diagnostic covers original sound-enable/device
gates at `420840`/`420854`; enabling this diagnostic changes trace flags only.
It does not invoke guest functions, alter guest data/registers, or change clocks.

The exact original Worker is attached while paused before startup through CDP.
Observation wrappers preserve original HTTP Worker and module bytes. Page
compile, module-send, owning Worker receive/instantiate, target/session/URL and
served file identities are recorded separately. The page import observation
matches voice ID, byte count and PCM SHA256 to the owning Play request, then
samples source/worklet, AudioContext state/time, gains/mute and existing wave
and master analysers. Analyser peaks alone cannot establish audible output.

Offline validation:

- `fixture.cjs`: eight mocked timer/startup/device/load/gate/populated-Play/suspended/running
  scenarios pass through the passive API observer and real host audio imports
  with a mocked AudioContext. Metric50, format, Lock/Unlock and Duplicate
  captures and four peak/hash/clock/source negative controls pass.
- `full-entry-mock.cjs`: the actual driver entry passes real FS and HTTP checks
  for 1,530 pinned requests in its latest run, Worker attach wiring, balanced input APIs and close
  path; native spawn is forbidden and zero Chrome instances are launched.
- The existing owning API observer fixture passes. The first composition test
  attempted to replace Puppeteer's read-only ESM export and failed before any
  browser launch; that log remains. The corrected native-spawn guard acts on
  the process boundary instead.
- The actual serialized page/Worker preload fixture passes module, message and
  import identity checks and reversible diagnostic tracing. Existing audio
  worklet routing (36 checks), mixer (four groups) and 58-file recovery pass.
  Original37 PCM span SHA256s and individual formats are retained separately
  from whole-file SHA256s, so a populated Play can be compared to its source
  effect without copying media. Nine unchanged loaded instruction pins bind
  API observations to the original preferred-base executable.

The attempt ran only after Stronghold `stronghold-review-ack-original-0036`
final runtime/file release `38ed29dbe` and MDK
`mdk2-optimized-original-0050` final runtime/file release `5b72401a7`.
`releases-verified.json` independently verifies their exact normal child exits,
PID/startticks absence, refused ports, absent actual launch profiles and free
external flock, with no other Chrome/game runtime. The actual Node parent held
the exclusive `/tmp/wine-local-runtime.lock` inode. Default audio and
`defaultViewport:null` were preserved. No trusted Play/H/W control was issued:
readiness was never reached, so the 30-second post-readiness window never began.
The attempt ended at 01:18:33Z, before the 02:00Z cutoff.

The root cause of this harness failure is established offline. The driver pin
collector includes named root files and selected subdirectories, but omits the
existing root manifest. `index.html` requests it. The pre-attempt composed mock
fetched every one of its 1,530 pins and mocked browser navigation with three
selected responses; it did not discover HTML-declared requests. Its passing
result therefore did **not** prove completeness of the browser request closure.
I missed that coverage gap before the original. `manifest-boundary-fixture.cjs`
now reproduces the same HTTP 500 and first `served-pin-mismatch` through the
actual driver and real FS/HTTP, with only the mock evidence directory redirected
and native spawn forbidden. It does not change the used driver or repeat Chrome.
The original sealed mock reports and used inputs remain intact. A future worker
would need to correct and validate request discovery offline before any newly
authorized original; no retry is authorized by this note.

The actual result is `driver-result.json` and `runtime/observation.json`: one
page preload event, zero owning Worker bindings and zero API or voice events.
Startup timer, acmMetrics50, device/primary HRESULT, PCM load/Lock/Unlock, guest
enable gate, DuplicateSoundBuffer/Play and page AudioContext/source/gain/mute/
analyser boundaries are all unobserved. There are no game captures to review,
no listening or audio capture, and no quality/FPS assertion. The missing optional
`build-info.js` produced an earlier HTTP 404; the first harness stop was the
manifest membership rejection, not that optional response.

Final runtime identity is Git
`5b72401a77b3afb5c57d93a77b305c1666d9a20e`, plus the relevant uncommitted
binary patches in the run. `runtime/pins.json` records 1,530 existing input paths,
sizes and SHA256s. `runtime/final-pins.json` reports no changed files. Actual
HTTP receipts contain 99 matching HTTP 200 bodies, plus the optional 404 and
manifest 500; server-side receipts contain 104 successful sends, including late
requests during close. These are distinct evidence levels. In particular:

| Input | SHA256 | Actual status |
| --- | --- | --- |
| `index.html` | `fa81b9ebfd01d3fbfa2852bfec4503a87d4b5ce47cf4522cd4c134ac82cfb11c` | Matching page response |
| `host.js` | `f3e0d4bd915141225742d9b1558197aba045559e7d5661d5fdc32dae44898bea` | Matching page response |
| `lib/guest-worker.js` | `1a444957d8d4220443ce39fc11e5b90217ec2a22f234d2a9635bf9fee9d738e1` | Pinned; no owning Worker binding |
| `build/wine-assembly.wasm` | `e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412` | Server sent; page body/compile/instantiate unobserved |
| `build/wine-assembly.compat.wasm` | `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8` | Pinned; use unobserved |
| `manifest.webmanifest` | `f44557ea85c2a47ea82fec369c92b1c4d6c2d431a9aa3e46e7aeb4118b5e6821` | Existing file omitted from pins; rejected with HTTP 500 |

Normal `Browser.close` produced actual Chrome PID `1607987`, startticks
`188872167`, exit `0`/null. Node `1607950` and flock `1607949`, both startticks
`188872141`, exited and disappeared. Independent cleanup at 01:18:52.062Z
verified HTTP `40217` and DevTools `36595` refused, no remaining Chrome/profile
users, the exact run profile removed and external flock available. All subreaper
waits were exit 0/null. There was no kill fallback. See
`cleanup-verification.json`, `chrome-lifecycle.jsonl` and supervisor wait logs.

Only this documentation file is committed. All helper/test inputs remain in the
ignored run directory. No source/module mutation or full build was performed;
there is no production code change requiring a build. The focused offline
checks above and the post-attempt exact-driver manifest regression passed.

The complete composed mock is `node
scratch/runs/20261105-return-fire-playback-observation/full-entry-mock.cjs`.
It uses the same driver entry and serialized observation functions as the
original attempt. Its report seals those run-input SHA256s and the final served
closure. A later input or served-file change invalidates this proof. The eight
scenario and four negative-control fixture results are in `fixture.json`; the
serialized preload results are in `preload-fixture.json`. Run input files are
small observation/test inputs, not copies of the source tree.

`existing-media-inputs.json` records the original path/hash evidence. For example,
`HELI.WAV`'s PCM span begins at byte 58, has 17,407 bytes and SHA256
`db6101ee022c55f035adffab771b9c3f3d1b15db6ba58d0fa8c0db69cc33ca7a`.
That is distinct from its complete RIFF file hash. Rate/channel/depth evidence
is recorded per effect rather than assuming all original files share a rate.

Box ID/state/expiry: N/A. Coordinator retains shutdown ownership.
