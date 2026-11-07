# Wormhole and Bellhop: qualified bounded browser observations, 7 November 2026

Run `20261107-graphics-wormhole-bellhop-qualified` completes **eight explicitly
named bounded startup cases**, after repairing and qualifying the concrete
transport prerequisites that invalidated [the prior run](graphics-wormhole-bellhop-20261107.md).
All 24 original full-frame captures were personally inspected. The four
Wormhole cases show changing tunnel ring spacing, curvature and convergence;
the four Bellhop cases remain at the legible “Choose A Connection” dialog,
with a provider dropdown, empty connection list and two disabled Join buttons.
Every case remains running at its final checkpoint, with advancing owning
execution counters and no recorded escaped trap, page error or
unimplemented-API fault. These observations establish neither full visual
correctness nor active D3D coverage. No emulator code changed.

| Registered original | Requested selector | Execution | Owning host slices: initial → settled 1 → settled 2 | Inspected scene |
| --- | --- | --- | --- | --- |
| dx_wormhole | software | cooperative | 284 → 1821 → 2722 | Moving DirectDraw wire tunnel |
| dx_bellhop | software | cooperative | 96 → 703 → 1002 | Static GDI connection dialog |
| dx_wormhole | software | guest Worker | 275 → 2203 → 3110 | Moving DirectDraw wire tunnel |
| dx_bellhop | software | guest Worker | 342 → 747 → 1037 | Static GDI connection dialog |
| dx_wormhole | webgl | cooperative | 283 → 1792 → 2699 | Moving DirectDraw wire tunnel |
| dx_bellhop | webgl | cooperative | 96 → 761 → 1060 | Static GDI connection dialog |
| dx_wormhole | webgl | guest Worker | 271 → 2019 → 2927 | Moving DirectDraw wire tunnel |
| dx_bellhop | webgl | guest Worker | 353 → 1230 → 1520 | Static GDI connection dialog |

Each initial scene was inspected before the driver admitted its two settled
captures. The latter are separated by at least 15 seconds; JSON timestamps,
not nominal `scene-5s/20s/35s` filenames, give actual timing. The browser uses
`defaultViewport:null`, requested outer size 1100×820 and actual viewport
1100×733, device scale 1. Counters precede compositor captures while execution
continues; they are not frame-aligned or FPS measurements. No original
requires or receives native key/mouse input in this bounded route. No guest
state, clock or callback is manipulated. No original is replayed.

The actual presentation owner in all eight cases is page `Win98Renderer`
with `CanvasRenderingContext2D`. Wormhole presents a DirectDraw wire tunnel;
Bellhop only draws its GDI preconnection dialog. Both WebGL-selector
cooperative cases allocate a host D3D helper, but all sampled draw, clear and
upload counters are zero and target lists are empty. All four guest Worker
cases have no rendering Worker manager/endpoint and no active D3D statistics.
Their executing owner is guest endpoint 1, slot 0, with increasing owning
sequence counters; Bellhop also creates a sibling guest Worker. A guest
Worker is not a rendering Worker. The inspected scenes therefore provide
**zero active D3D/WebGL draw cases**. They do not establish whether a later
connected Bellhop scene would request 3D rendering. The provider dropdown was
not opened and no connection was attempted.

Per-case browser `SystemInfo.getInfo` identifies ANGLE Vulkan SwiftShader
(Subzero), SwANGLE driver 5.0.0; the box has no `/dev/dri`. This is browser
provider information, not evidence that an original scene used WebGL or a
physical GPU. Original WebGL render-target provider strings are unavailable
because no such targets exist at the checkpoints.

The helper repair is confined to the owned run directory. It supplies the
missing transitive `ordinary-keys.cjs` using the recent passing Forsaken
validator/release helpers, and adds an explicit exact ACK-ID assertion to the
numbered request path. It replaces the old broad rejection assertions with
specific UNKNOWN deadline, sticky closure, stale-only-refresh, partial-input,
wrong-ID and explicit-rejection assertions. The read-only SimGolf/Forsaken
helper references and SHA-256 values are retained in `helper-references.json`;
their bytes remain unchanged. No unrelated game controls were repeated.

Before creating the box or launching any original, actual Chromium exercised
the current production guest and rendering Workers with public COM rendering
calls, the actual standard WASM module, a completed render batch and exact
live owner/module identities. A positive numbered request → consume → native
trusted ArrowUp down/up → matching ACK round trip passed. Stale capture,
all exact identity fields, an actual wrapper replacement and a wrong module
were rejected with zero input effects. The generated fixture is explicitly
separate from original evidence; its small caption canvas is not an original
scene or a visual correctness oracle. Trusted balanced native release also
passed normal, delayed, pending and rejected acknowledgement controls. The
release is scheduled independently before down acknowledgement can block;
partial input preserves the first UNKNOWN and subsequent requests publish no
second command or native effect. The qualification browser closes normally
with exit code 0. `qualification/controls.json`, the individual receipts and
`qualified-transport/` retain the complete positive and negative boundaries.

Tested source is main `974dee1438ec8cc86578fa2d9726be12f0aef134` plus
`dirty-source.patch` and `new-source.patch`. A locked local
`flock /tmp/wine-build.lock bash tools/build.sh` passes and produces the
unchanged standard module `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` and compatibility module
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
Every original's recorded instantiate/module-post hashes match the standard
module. Before launch, 6,097 staged source/module/input/helper pins match,
including the repaired transitive helper and original driver. Both unchanged
registrations match current `lib/apps.js`; the complete shared input closure
has 39 unique paths, including both original EXEs and all 37 shared files.
Registered input sizes and hashes match the prior retained originals before
launch and postflight. The SDK mesh aliases retain their earlier provenance;
this run does not relabel them as archive-original Viewer assets.

The fresh box reconstructs the recorded Git commit and patches, then receives
only its missing files. SCP first returns exact `api_key_action_forbidden`
HTTP 403 (“This API key cannot perform ssh”) before copying its first module;
no original/input has launched. The already functioning file API supplies all
71 missing paths, without another box, SSH retry or original replay. Npm's
root lock-metadata change is preserved in `retrieved/npm-lock.patch` and the
effective runtime pins. Postflight verifies all 6,097 staged pins again.
Twelve additional successful response paths (eleven UI icons and tracked
`stdole2.tlb`) are matched to exact Git blobs from the reconstructed source
commit in the later served-body audit; they are not retroactively described
as independently preflight-hashed inputs. Git and recorded patches are the
source archive. No source/media archive is made and game media is referenced
by existing path and hash, not copied into evidence.

The served-body audit matches 1389 successful recovered bodies to the
pinned/Git-supplied bytes, with zero mismatches. DevTools cannot recover
135 individual response bodies; their deliveries are not independently
hash-certified. Optional UI/auth/bundle/favicon failures remain visible in
responses and logs. Bellhop reports missing physical `ole32.dll` and use of
built-in handlers. Its empty dialog and that log line alone do not demonstrate
an emulator semantics defect. No speculative repair or guest modification
was made, and no unrelated passing production regressions were repeated.

All 143 terminal runtime artifacts (9291448 bytes),
including unique tested modules, logs and captures, were retrieved and
SHA-verified before the explicitly delegated normal nonforced stop.
`terminal-verified.json` maps every remote artifact to its verified local
version. Postflight finds all named processes absent/zombie, both HTTP ports
closed, no live Chromium/run process, profiles removed and original input
empty. Local qualification processes, port and profile are also gone. The
single fresh UUID-idempotent box `bx_g3v2eqsm`, created at
2026-11-07T11:46:41.028Z with original expiry 12:21:40.837Z, is confirmed
`archived` at `2026-11-07T12:00:09.496Z` with stop completed and
`forced:false`; its expiry is now null. No stopped box was resumed. Custody
returns with no active runtime. Sampled `/home` floor checks remain above
2,000,000,000 bytes, minimum 2,458,603,520 bytes; these are sampled observations,
not a continuous disk-space proof. Runtime and retrieval finish inside the
35-minute task limit.

`coverage-ledger.json`, `served-module-audit.json`, `retrieved/postflight.json`
and the final `result.json` carry the exact case and lifecycle records.
Neither original has a matching candidate-corpus manifest entry, so this is a
named-app investigation retained in these notes, without attachment to an
unrelated candidate. FPS, audio, Windows-reference correctness, backend parity,
connected Bellhop gameplay and full historical27 membership remain unqualified.
Globe, Viewer, Flip3DTL and savers were not launched. No public deployment or
nested worker occurred. Next work, if separately requested, is Bellhop's
ordinary provider/connection path or actual D3D samples; this task stops after
publishing its final result.
