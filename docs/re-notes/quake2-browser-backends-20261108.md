# Quake II current browser routes: launch blocker, 2026-11-08

Neither requested browser route reached Quake II's menu or world. Both fresh,
serial launches fail before guest boot because the registered launch metadata
declares **568 bytes** for `lib/quake2-modern-controls.ini`, while the unchanged,
successfully served file is **642 bytes**. This is a concrete shared launch
blocker, not evidence of either GL backend's world/gameplay coverage.

Evidence: `scratch/runs/20261108-quake2-browser-backends/` (ignored).
Only this note is committed. Full historical27 remains open.

## Causal evidence

The tested main source is `f6d008d96d3526f8475e1b49428c9ff3b32b38ca`, with an
empty relevant tracked diff. The registered `quake2_demo` closure contains 67
distinct paths: 65 original fixture files and two registry-supplied text files.
All 705 staged runtime/media/helper pins match before launch and after both
routes. Existing paths, byte counts and SHA-256 references are retained; no
source tree or media archive was made. The PAK retains SHA-256
`cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`.

`lib/app-file-sizes.generated.js` supplies the stale 568-byte entry, stamped
onto the registered config by `lib/apps.js`. Its tested SHA-256 is
`e3a048a1d1dc9e267624d58ca767eac9073c2814079a75274894d4150b04bba1`.
The actual config is 642 bytes, SHA-256
`afb166910b596b204e1c11f93ff4972999804d18299bde134d6380a51587e3b3`.
Both routes' served logs independently match those actual config bytes.
`host.js` rejects the size disagreement in `loadFiles` before exposing the
asset to the guest. The two console logs name that exact file and error.
Each route's startup state has `apps: []` and no owning render endpoint.
The capture guard subsequently refuses the absent app; that guard failure is
secondary to the recorded loader error.

| Requested route | Observed result |
| --- | --- |
| WebGL, ordinary registered `+set vid_ref gl +menu_main` | Launch failure at config size check; no gameplay input or successful bound capture. |
| Software GL, same registered arguments and bytes | Same launch failure. Personally inspected `retrieved/software/launch-failure-ui.png` shows the desktop fatal launch-error dialog naming Quake II and the config size mismatch. No menu, world, weapon or HUD is visible. |

Chrome is 151.0.7922.108, V8 15.1.206.16, native viewport 945×889, with cross-origin
isolation. The actual instantiated guest Worker module was recovered on both
routes: 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The Worker retires during launch cleanup. No owning GL context/provider or
live CPU backend exports were obtained. Requested route labels do not qualify
an actual backend. Neither Game/Easy nor movement, guard, door or pickup was
reachable. Native llvmpipe and older browser/CLI results do not fill these cells.

## Controls, retrieval and shutdown

The released bound-input and numbered ACK transport helpers were reused
byte-for-byte. Independent finite key release and injected UNKNOWN/no-replay
controls pass before allocation. Both browser sessions pass trusted blank-page
key/type/combo preflights. No original-game input command was submitted, no
UNKNOWN original-input outcome occurred, and no input was replayed. No guest
state, configuration, clock, private handler or original media was changed.
No WAT/JS execution mismatch was demonstrated and no runtime repair was made.

WebGL Chrome exits normally at 00:37:25.030 UTC, before software launches at
00:38:14.589 UTC. Software Chrome exits normally at 00:38:33.221 UTC. Both
controllers/Chromes are absent, all four ports are closed, profiles and writer
locks are absent. All 318 successful served reads per route match staged pins.
The error PNG passes CRC and IDAT checks and was personally inspected.

All 48 artifact references / 39 unique contents (9,183,218 referenced bytes),
including unique logs, the failure capture and actual modules, were retrieved
and independently SHA-256/size verified before normal stop was requested.
One UUID-created box, `bx_7znd8k6d`, was created at 00:36:47.408 UTC. The
independent observable detached 25-minute watchdog and normal-stop delegate
were armed before allocation; original expiry was 01:01:47.422 UTC.
Delegated normal stop `stop_eb0e1b65fba64c81` completes at 00:39:18.094 UTC,
forced=false, error=null. Final state is **archived**, current expiry null.
Both lifecycle delegates exit zero and their supervisor has no remaining
children. No resume, deletion, extra box or public deployment occurred.
Local free disk remained above 5 GB; no RAM gate was applied.

Recovery uses the recorded Git SHA, empty `relevant-source.patch`, retained
untracked runtime dependency patch, owned helper/note patches, actual modules,
and existing media path/hash references. A preparation assertion about helper
identity was corrected before allocation; it caused no original execution.
Focused syntax, independent release, pin/served-byte, causal blocker, PNG,
retrieval and lifecycle checks pass. No production code changed or new build
is claimed.

Next: correct the generated config size metadata while preserving the config
bytes, test the real production loader and locked build, then obtain fresh
ordinary Game/Easy world, owning-context/CPU-export and action/consequence
evidence for WebGL followed by software GL. This stopped box must not be
resumed by default. Parity, FPS, audio quality, enemy hits and full playability
remain unqualified.
