# Redline current browser player world, 2026-11-08

The original demo now has current browser evidence for the ordinary launcher,
Stadium City loading, first-person player mode and keyboard turning. The full
requested action/consequence objective remains **incomplete**: textures and HUD
detail are missing, forward displacement is not established independently, and
neither firing/ammo consequence nor vehicle entry is verified.

Evidence is retained in ignored
`scratch/runs/20261108-redline-current-browser-gameplay/`. No emulator, renderer,
fixture, manifest or configuration was changed. Historical loader, DirectDraw
identity and final CLI capture-selection repairs were accepted rather than
repeated. No new WAT/JS mismatch was demonstrated.

## Original route and reviewed observations

One browser ran `index.html?candidates&no-log&threads&app=redline_demo`, with
empty guest arguments, `C:\MAINDIR`, the original IFORCE2 seed, all 59 manifest
companions and default browser execution timing. No CFG, guest state, clock,
instruction-budget or private-handler override was supplied.

The native DISPLAY dialog showed **Primary Display Driver / 640×480×16**.
Done accepted those unchanged choices, then Play reached the title and ordinary
Start Up → New Game → highlighted Stadium City. Enter reached LOADING WORLD.
A passive 10-second request reached the rendered opening cinematic. Only then
was the shipped readme's Space skip sent, with independently armed release.
Two further 10-second passive requests passed through a dark transition and
reached the actual first-person weapon and bottom HUD strip.

The reviewed `player-gate.png` has an interior wall/shutter, firearm silhouette
and HUD strip. It lacks readable ammo/health numerals and detailed weapon/wall
textures; a later central aiming mark appears as a solid cyan square. These are
not fully rendered HUD or texture success claims.

| Current evidence | Supported observation and limit |
| --- | --- |
| `forward` / `turn-right` | Initial 750 ms Up and Right requests have exact ACKs, but their immediate captures do not independently establish forward displacement or turning. Weapon pose/lighting changes alone were not counted. |
| `fire` / `action-settled` | A later capture faces a nearby yellow wall rather than the original shutter, supporting a delayed view change after the preceding controls. Since several actions precede it, exact attribution of displacement is limited. Ctrl firing input alone does not establish a shot. |
| `turn-left` | From the reviewed wall-facing scene, ordinary Left produces a clearly different view with a pillar, bench and vehicle side/wheel. This establishes current first-person turning beyond cinematic motion. |
| `forward-room` / `face-vehicle` | The first Up capture remains similar; the later capture fills with a nearby wall. The short Left action intended to face the vehicle does not leave an identifiable door approach. No vehicle entry, door opening or onward progress is claimed. |
| `fire-wall` and 13 passive film frames | Fresh reviewed wall-facing Ctrl input and held/released captures show changing weapon poses, but no distinct muzzle flash, projectile, impact or readable ammo decrement. Firing consequence remains unqualified. |

All controls came from the original `Readme.rtf`: arrows for movement/turning,
Space for cutscene skip, Ctrl or left mouse for fire, and walking into a driver
or passenger door for vehicle entry. The vehicle was visible briefly, but its
door was not identifiable in the later approach scene; no blind entry input
was substituted. The passive film supplements review and never authorizes an
input. Original full-page PNGs and the derived contact sheet are retained.

## Current rendering blocker: narrow mechanism, upstream cause still open

The live owning render Worker was inspected read-only through its actual
`D3DIMGpu` prototype instance, not through the backend selector. Its exports
match `instance.exports`, and its memory buffer matches the renderer's shared
memory. At **01:27:31.109 UTC**, the sole type-20 device, slot **7**, has:

- texture slot **0** at state offset 2824;
- texture handle **0** at render-state TEXTUREHANDLE;
- stage-zero words `[0,4,2,0,2,2,1,0]`, including COLOROP **MODULATE**;
- GPU texture-cache count **0**, texture uploads **0**, with **4,315 draws /
  180,687 draw calls** already observed.

The current source's texture resolver rejects slot zero. Thus this sampled
device has no bound texture available for texture modulation, consistent with
the flat current 3D scene. This is a concrete checkpoint blocker to treating
the scene as textured gameplay. It does **not** identify the first upstream
binding failure, prove every draw's state, or identify the separate HUD path.
It also does not distinguish a guest-side binding problem from serialization
or another upstream cause. No speculative renderer repair follows.

An earlier observer queried texture fields on the endpoint's adapter wrapper;
those fields/accessors do not exist there. Its false `adapterExportsMatch`
comparison is not a mismatch finding. The corrected direct GPU-object query
above establishes matching exports and memory. Both observations are retained.

## Execution identity and checks

Runtime source is Git **`db5c1ebb0e45bd279ac15b30d23f59d54ebb731e`**, with an
empty relevant tracked diff and the retained untracked `lib/wininit-boot.js`
dependency patch. Exact run inputs and this note are retained as new-file
patches; Git remains the source archive. Existing media paths/sizes/SHA-256
values are referenced rather than archived into the run.

The actual recovered guest and renderer module bytes match
`build/wine-assembly.wasm`, SHA-256
**`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`**.
The owning legacy endpoint has a live **WebGL2RenderingContext**, ANGLE Intel
UHD Graphics 620 / Mesa 23.2.1, no lost context and no endpoint failure.
Actual guest and renderer CPU exports report `gl_sw_enabled() == 0` and
512 MB memory. Chrome is **151.0.7922.108**, V8 **15.1.206.16**. The native
viewport is 945×889; the guest switches to its own 640×480 surface without
browser viewport emulation.

Before allocation, the actual Python request helper, numbered publication /
consumer / exact ACK path passed real 0/1/2/10-second wait tests, oversize and
sticky-UNKNOWN negatives, and immutable-deadline rejection before publication.
Additional actual-path fixtures exercised the future arrow, Enter, Space,
Control and Escape keys at 250/750 ms, plus normalized native left clicks.
The retained bound release helper passes slow-observer and injected-UNKNOWN
controls. All eight MW3 timing regressions pass. Native trusted-key preflight
also passes in the same Chrome before original selection.

The first extra-control fixture incorrectly compared the complete ACK against
two fields, overlooking its successful `number` field. It failed before any
box allocation; the corrected fixture checks the exact ID and success flag.
This was a harness assertion error, not an input UNKNOWN or guest failure.

All **65 canonical original files** match the existing recorded hashes, and
all **703 staged pins** match before and after execution. The repository's
full `--fixture` check fails because the historical archival extraction path
is absent; that broader archival/inode check is not reported as passing.
Current canonical hashes were checked directly against all 65 existing note
rows. All **203 successful served reads** match pinned bytes.

All **20 commands** have exact successful ACKs, including quit; **10 keyboard
holds** and **3 mouse holds** have release receipts. There was no original
UNKNOWN, command replay, replacement browser or extra box. All **38 recovered
PNGs** pass CRC/IDAT checks and all 20 bound captures match their hashes and
actual module identities. No source change required a new build.

## Recovery and shutdown

The detached supervisor, independent 25-minute watchdog and delegated normal
stop process were observable before allocation. One UUID-created box,
**`bx_s66hcn4g`**, was created at 01:19:04 UTC. Initial provider expiry was
**01:44:04.638 UTC**; the independent fixed deadline was 01:44:04.452 UTC.
The browser also had its own earlier immutable deadline.

Chrome exited normally at **01:27:50.701 UTC**. The controller, Chrome and
passive-film PIDs are absent; both ports are closed; profile and writer lock
are absent. **258 artifact references / 235 unique contents / 10,853,988
reference bytes** were retrieved and separately size/SHA-256 verified before
the delegated stop request. Stop **`stop_a21ffe0cd529fe18`** completed at
**01:28:59.929 UTC**, forced=false, error=null. Final box state is
**archived**, current expiry **null**. Both lifecycle delegates exited zero;
the supervisor has no remaining children. Sampled local and remote free disk
stayed above 5 GB. No RAM gate, resume, delete, source/media archive or public
deployment was used.

Next work should trace the first current browser binding/realization failure
and the missing HUD draw path, repairing an emulator mismatch only if one is
demonstrated. Then retry visible firing/ammo and a reviewed vehicle-door
approach. FPS, audio, full playability and paired-backend qualification remain
separate. This bounded worker releases its resources and stops.
