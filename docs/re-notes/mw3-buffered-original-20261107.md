# MW3 buffered original preparation — 2026-11-07

The first boundary was functional drift in the retained composed-runtime pins.
The read-only preflight checked all 308 files and rejected `lib/gl-compat.js`.
No new box was allocated, no original game was launched, and no input was sent.
The buffered completion observer was **not installed or locally qualified**.
Original buffered consumption and cockpit movement remain unestablished.

Evidence is in `scratch/runs/20261107-mw3-buffered-original/`. Preparation began
after the keyboard-path worker's 16:32:58Z release of commit `bb2a58205`.
The checkout recorded in `source.json` is
`21be7672f4841ff5a542595a3debc78b86e38ef6`.

## Reproducible preparation blocker

Run from the shared checkout:

```sh
python3 scratch/runs/20261107-mw3-buffered-original/check-retained-pins.py
```

The check exits **2** and writes `retained-pin-check.json`. It compares existing
files against the predecessor's unchanged
`scratch/runs/20261107-mw3-stable-runtime-gameplay/runtime-pins.json`, including
the retained driver and observer. It neither repins nor modifies runtime files.

The sole mismatch is:

| File | Retained qualification | Current checkout |
| --- | --- | --- |
| `lib/gl-compat.js` | 219,342 bytes; `b007377dd11a736b3eeb36f8191597b9657323900fe4698f0c489779b8a6380b` | 220,192 bytes; `2b1f2dc28b08e318e65c95bc4e2df94f4ce31dadb53f3dd84bb12d3067313c32` |

Commit `fece02eca5b8cb41aacc46d8c2d98482524b0689` changes incomplete-texture
sampling and the texture-enable uniforms. `functional-drift.patch` and
`functional-drift-commit.txt` preserve the exact difference and provenance.
This is a functional runtime change; this task does not infer that it changes
MW3's Direct3D rendering or that the change is defective. The task explicitly
required failing closed on functional pin drift and stopping at the first
unresolved boundary, so the retained qualification was not silently extended
to these different bytes. No production repair or rollback was attempted.

The existing built module still hashes to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
2,182,493 bytes. This is a file hash, not an executing-module measurement in
this task. No browser or production guest/render Worker was launched here.

## Focused checks and limits

All three existing focused regressions passed with logs retained:

* `node test/test-mw3-buffered-keyboard-path.js`: actual OS Worker and production
  RPC/WAT/renderer path retained ordered DIK6 press/release after independent UP
  occurred before polling; decoder negatives and non-consuming peek controls
  passed.
* `node test/test-directinput-buffered-keyboard.js --rpc`: 14 buffered-keyboard
  checks passed.
* `node test/test-directinput-independent-worker-acquire-oct27.js`: actual OS
  Worker acquire controls passed and the Worker terminated with no pending work.

These tests use fragment modules and synthetic guest/device fixtures. They do
not establish an installed CDP observer, actual loaded-module completion,
original keyboard consumption, or movement. The retained observer still watches
GetDeviceState and cannot satisfy the requested GetDeviceData observation.
No emulator mismatch has been identified. No code was changed or committed, so
the mandatory build-before-code-commit rule was not triggered.
The global evidence checker still reports existing Alice and Tunnel/Twist
containment errors outside this task; its output is retained. MW3 has no corpus
entry, so this run uses `investigation.json` without an unrelated candidate.

## Recovery, custody and next boundary

`source.json` records the exact Git SHA and hashes of the retained runtime
manifest, driver, observer, decoder, regression and handoff notes.
`relevant-tracked.patch` records relevant uncommitted tracked hunks;
`relevant-new-source.patch` records the existing untracked `lib/wininit-boot.js`.
Media references were checked in place: all 36 existing paths matched recorded
size and SHA-256. No source archive, media copy, repeated module or screenshot
bundle was made. No previous UNKNOWN pulse was replayed.

No box ID, state or expiry belongs to this task: allocation and lifecycle
delegates were never started. The predecessor's archived `bx_ga6esek2` was not
contacted. There were no owned browser profiles, input holds, ports or runtime
processes. The local messageboard watcher was closed before release; sampled
free space remained above 2 GB.

The next attempt needs an explicitly recorded current runtime baseline and
composed local qualification, including installation of the buffered observer
in the retained driver. It must bind the actual executing GetDeviceData body
and completion, retain the 18 owner/module/epoch/freshness checks, capture the
requested count before the call and the returned count/HRESULT/device/format
and records afterward. Observe normal caller `0x4f76c8` passively, separating
initialization flush `0x4f73fd` and one-record drain `0x4f7ae0`, before any fresh
original pulse. The requested original menu/cockpit/navigation and gameplay
work remains undone.
