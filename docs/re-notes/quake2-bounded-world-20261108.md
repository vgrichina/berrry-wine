# Quake II bounded browser world and actions, 2026-11-08

Current original Quake II reaches ordinary **Game → Easy**, a readable textured
world, forward movement, keyboard turning and visible blaster discharge on
both actual WebGL and software GL. A native guard encounter progresses on
both routes, including incoming damage. This closes the assigned bounded
world/action check beyond menus. Full historical27, parity, FPS and audio
remain open; no guard kill, pickup, door operation or level completion is
claimed.

Evidence is retained in `scratch/runs/20261108-quake2-bounded-world/` (ignored).
This is a documentation-only change; the accepted metadata repair
`55d976387fe209b1c6344e1cef0697379014e1ba` and original 642-byte controls are
unchanged. No emulator repair was needed.

## Request path and original execution

Before allocation, the released `request-safe.py` guard was reused with the
MW3 immutable-deadline implementation from
`53e1139ddedc3e12de109cd707f17492e67f5f26`, adapted to the existing numbered ACK
client and ordinary input validators. The actual Python request helper,
publication, numbered consumer and exact ACK path passed generated fixtures
with real **0, 1000, 2000 and 10000 ms** waits. The 2000 ms wait was qualified
with a 750 ms hold. A second positive qualification added the exact
250 ms hold/2000 ms wait pair before its first original use. The original
requests use only those qualified durations; quit uses zero wait.

The existing oversized-60000 ms and post-UNKNOWN negative cases still reject
before a local request record or remote dispatch. A request that cannot fit
the immutable browser deadline and 30-second cleanup reserve also publishes
nothing. All eight MW3 timing regressions pass, including wrong ACK identity,
late ACK after sticky UNKNOWN, bounded execution and zero-effect stale-scene
refusal. The independent-UP control passes both slow observation and injected
UNKNOWN. This reuses the known correction; it does not repeat the solved
loader repair or reopen either earlier box.

Both serial browser sessions use the complete **67-path registered closure**,
the original `+set vid_ref gl +menu_main` command line and normal menu input.
All **706 staged pins** match before execution and after browser shutdown;
all **359 successful served reads** match pinned bytes. No guest config,
state, clock, save, binding or private handler was edited. No console/map
command was used.

## Reviewed scenes and owning backends

| Route | Personally reviewed progress | Actual context and CPU proof |
| --- | --- | --- |
| WebGL | `world` shows diagonal support, textured walls/floor, blaster, crosshair and 100-health HUD. `forward` enlarges the support and reveals the lower room/stairs/guard. `turn-left` and `turn-right` visibly rotate the view; `aim-guard` uses the qualified shorter turn. Passive film frame 001 shows the bright blaster discharge, raised weapon and projectile trail, with a guard visible below. Later frames show blood/red damage effects; `descend` advances farther into the lower-room approach, ending at 60 health. | Owning render Worker endpoint 1 is `api: gl`, backend WebGL. Its live `WebGLBackend` owns a non-lost `WebGLRenderingContext`, WebGL 1. Chrome ANGLE reports Intel UHD Graphics 620, OpenGL 4.6/Mesa 23.2.1. Guest and renderer CPU exports both report `gl_sw_enabled() == 0`. |
| Software GL | `software-world` shows the textured starting world, weapon and 100-health HUD. `software-forward` exposes the same lower room and guard; `software-left` turns into the passage. Passive film frame 003 shows bright discharge, recoil and projectile trail. `software-settled` shows continuing guard activity and 41 health. | Owning `OpenGLHostBridge` reports backend software and software-consumer true, software context 1 for HWND 65537, current owner 0/context 1. Its export memory matches the renderer instance. Guest and renderer CPU exports both report `gl_sw_enabled() == 1`; guest software presents are 690 at observation. The separate legacy/WebGL endpoint and presentation device are not substituted for this owning-context proof. |

Enlarged HUD review in `health-review.png` confirms WebGL's intermediate
`blaster-lower` health as **68**, correcting the live commentary's 67. The
other enlarged readings are `turn-right` 95, `descend` 60 and software settled
41. Guard attack/damage is established; outgoing blaster hit or kill is not.
The WebGL film has 28 passive frames and the software film 52. These passive
frames supplement the bound captures; they are not used to authorize input.

All **19 numbered commands** have exact successful ACKs: 11 WebGL and 8
software, including each route's ordinary quit. All **14 finite key holds**
have independent release receipts; observed release intervals are
250 ms for both short turns and 749–750 ms for the 750 ms holds. Fresh
scene/owner/module identity remains bound at admission. There is no gameplay
UNKNOWN, replay, stale-scene refusal or replacement box.

Both browsers report Chrome **151.0.7922.108**, V8 **15.1.206.16**, native
viewport without emulated resize. All **109 recovered PNGs** pass CRC and
IDAT checks; all 19 bound capture hashes and guest/renderer module identities
pass. Executing modules match current `build/wine-assembly.wasm`, 2,182,500
bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

## Host-side issues retained

The first software launch assertion ran immediately after the WebGL quit ACK,
while its controller was still draining. It failed before any software
directory or browser was created. A read-only drain check then proved both
WebGL PIDs absent, both ports closed, profile and writer absent, and software
unstarted. Only then was the first software browser launched. The already
pending readiness observer expired before this later startup; a subsequent
passive observation confirmed readiness. Neither failure was an input ACK
UNKNOWN or an original command replay.

An early software film-manifest read preceded completion of its finite passive
sampler; the later completion record and every frame were recovered. The
initial local contact-sheet step lacked Pillow and was replaced with installed
ImageMagick after the original raw frames were already downloaded. These
host-side errors remain in evidence and do not establish an emulator defect.

## Recovery and resource closure

Runtime source is Git **`4d4dac575048a2eddc0ca8d288f07250c35e884e`**, with
empty relevant tracked diff and the retained untracked `lib/wininit-boot.js`
dependency patch. Owned run inputs and this note are preserved as new-file
patches. Existing media paths, sizes and SHA-256 values are recorded in
`fixture-identity.json`; no source or media archive was created. The PAK hash
remains `cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`;
controls remain `afb166910b596b204e1c11f93ff4972999804d18299bde134d6380a51587e3b3`.

One UUID-created box, **`bx_rwqnrjvw`**, was allocated at 00:52:30.401 UTC.
The detached supervisor, independent 25-minute watchdog and delegated normal
stop process were observable before allocation. The fixed local deadline was
01:17:30.101 UTC; initial provider expiry was 01:17:30.272 UTC.

WebGL Chrome exited normally at 00:56:33.659 UTC; software Chrome exited
normally at 00:59:59.295 UTC. Final checks prove all four controller/browser
PIDs absent, all four ports closed, both profiles and writer locks absent,
and all pins unchanged. **355 artifact references / 323 unique contents**
(43,742,919 reference bytes) were retrieved and independently size/SHA-256
verified before delegated normal stop. Stop **`stop_cdeae76d0e51724e`** completed
at **01:01:05.015 UTC**, forced=false, error=null. Final state is **archived**,
current expiry null. Both lifecycle delegates exit zero and the supervisor
has no remaining children. Sampled local free disk remained above 5 GB; no
RAM gate, resume, delete, extra box or public deployment occurred.

Next work is separately assigned deeper native progress: confirmed outgoing
hit/kill, door/pickup and onward route. Full27, parity, FPS and audio remain
unqualified. This bounded worker releases its resources and stops.
