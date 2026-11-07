# Nox equipment attempt: inventory-helper blocker, 2026-11-07

Run `20261107-nox-weapon-interaction` reached the original registered demo's
Bunker arena, then stopped on a capture/input-helper assertion before any
inventory key was delivered. **No equipment pickup, equipment/HUD change,
weapon action or target damage was demonstrated.** This is a concrete harness
blocker, not a demonstrated Nox/emulator defect. The accepted movement, jump
and November 2 potion proof in `nox-demo.md` remain separate.

All evidence is in `scratch/runs/20261107-nox-weapon-interaction/`. No emulator,
registration, game configuration or original game files were changed. No peers,
cheats, memory/configuration/callback/clock manipulation or public deployment
were used. No workers were spawned.

## Installed closure and tested identities

Before allocating the sole fresh box, every installed original matched the
retained November 2 manifest: 125 files, 50,450,550 bytes, exact path/size/SHA-256
agreement. The registered browser manifest contains 124 data files, with
`nox.exe` loaded separately. Their union is the complete original closure.
`filesize-closure.json` additionally verifies all 125 shipped FILESIZE.INI
paths and sizes. The fixture remains at
`test/binaries/candidates/nox-demo/game/`; it was referenced and individually
materialized remotely, without a source/media archive.

- Original `nox.exe`: SHA-256
  `496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
- Original `mss32.dll`: SHA-256
  `d7028f4f8d458b359b8cb8e6bbdf00d2ecc145643e88e9e641be98fae0bada23`.
- Source commit: `7c8c952ee3005f81eff3882a49c15eefc57eb525` on main.
  `source-commit.txt`, `relevant-source.patch`, `untracked-inputs.patch` and
  `runtime-pins.json` retain the source/input identities. Git is the source
  archive; no source-tree snapshot was saved in the run.
- Current-source standard build:
  `flock /tmp/wine-build.lock bash tools/build.sh` passed. Actual served and
  recovered live guest module: SHA-256
  `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
  2,182,493 bytes. The unique live module is retained under `original/`.
  All 761 staged runtime/input pins matched before launch and after teardown.
- Chrome `151.0.7922.108`, native inner viewport **1024×712**, outer window
  1024×855. There was no viewport emulation or Puppeteer default viewport.
  The intrinsic game canvas was 640×480; its page rectangle was 1024×678 at
  top 34. This differs from the older 1024×768 run and is explicitly recorded.
- Observed owner: page `Win98Renderer` / `#screen`, process 1000. Actual
  scheduler: threaded guest Worker endpoint 1, slot 0, with two additional
  active guest thread slots. No D3D renderer endpoint or owning D3D Worker was
  present. The renderer selector does not establish a D3D backend here;
  an actual canvas context-constructor query was not obtained before closure.

## Reviewed route and first fault

The actual route was the candidates selector, verified `nox_demo` registration,
then `?candidates&no-log&threads&app=nox_demo` → title → Multiplay → Network →
Host Game → native flag placement → Conjurer → default Jack → Chat Area →
native Game panel with Bunker/Arena selected → GO → Bunker stone corridor.
All 32 original captures were personally inspected. Native menu animations and
loading required additional passive captures. Mouse motion realigned the game
cursor at the browser edges; absolute host and game cursor positions were not
assumed equal. Enter did not accept Jack's customization; its native Accept
button did. No Home press was attempted.

`review/bunker-loading.png` shows Jack in the rendered Bunker corridor, with
stone walls, torches and the normal HUD. It shows no identified equipment or
actual target. This capture establishes the reached scene only, not new
movement, equipment, action or combat qualification.

The next command, numbered 31, requested `KeyI` to capture the native inventory
baseline. `ordinary-keys.cjs` accepted that key, but the separately reused
`bound-input.cjs` key table supports only arrows, Enter, Escape and Tab. It
raised its assertion at line 176 before `Input.dispatchKeyEvent` was called.
The attempted preparation used an exact text replacement that expected a key
table ending in Escape; the actual table ended in Tab, so the extension was
silently absent. This was an avoidable scratch-driver preparation error.

`original/first-browser-failure.json`, `original/first-failure.json`, command
31 and the request failure retain the first fault. The transport had already
marked the command as dispatched at its outer admission boundary and closed
with its conservative UNKNOWN/no-replay rule. The native event log independently
contains **zero KeyI events**; admission or the dispatch marker is not proof of
inventory input. No command was replayed and no second original runtime began.

The prior actual-Chromium controls passed owner/process/endpoint/worker/module/
epoch replacement refusal, stale and slow captures, partial delivery, UNKNOWN
and late ACK closure, and independent balanced release. Their tested arrow
inputs did **not** cover the required Nox keys. A later diagnostic, without a
browser or game replay, reproduces KeyI, Home and Space rejection with zero CDP
events and zero samples (`helper-key-boundary.json`). No helper/emulator fix is
claimed or committed by this run.

## Retrieval and lifecycle

Fresh UUID-idempotent box `bx_q9d5p9pv` was allocated at 09:14:34 UTC, original
expiry 09:54:34.182 UTC. The task window ended at 09:49:34 UTC; the actual attempt
finished much earlier. Only one original runtime was launched.

The first fault triggered normal browser closure: Chrome exit 0, no signal,
at 09:23:44.259 UTC. Independent checks found controller/Chrome PIDs absent,
no Chrome processes, both server/DevTools ports closed, profile and writer lock
absent. All 184 recorded DOM events were trusted. Nine left-button pairs and
two Enter pairs were balanced, with no held input. These checks are retained in
`runtime-cleanup.json`; no synthetic inventory state was substituted.

All 363 unique terminal files, 14,796,386 bytes, were retrieved and SHA-256
verified **before** the explicitly delegated normal, nonforced stop. The live
module and 32 original captures are local. The stop completed at
09:24:59.922 UTC with `forced:false`; the box state is **archived** (stopped),
`stoppedAt` 09:24:59.904 UTC, expiry now null. The box was never resumed or
deleted. Local free disk remained above 2 GB (2,360,270,848 bytes after retrieval).

Next: qualify the exact Nox input vocabulary (I, Home, Space and both mouse
buttons) through both helper layers in actual Chromium before another explicitly
authorized original session. Then explore Bunker for a visibly identified bow,
staff or other usable equipment and collect paired pickup/equipment/action
captures. Target damage requires an actual observed target; this corridor view
supports no enemy or combat inference.
