# Redline browser texture realization, 2026-11-08

Run: `scratch/runs/20261108-redline-texture-realization/` (ignored evidence).
Base source: `8a6ca96982daa4b500616a6bc02c3e50c8df1bfd`. Recovery uses Git,
`relevant-source.patch`, `repair-source.patch`, new-file patches and exact runtime,
module and existing-media SHA-256 pins; no source/media archive.

## Demonstrated cause and generic repair

The historical DirectDraw creator-identity, Surface4 descriptor and texture Load
fixes are already present. The new disagreement is in browser boot. Actual
`GuestThreadHost.loadPe` initializes DirectX COM thunks on the owning worker.
`host.js` then imports their identities into the idle page instance through
`init_thread`, but unconditionally initializes the thunks again on that shadow.
This replaces the shared registry while the owner retains its earlier vtables.
Later guest workers import the replacement registry and fail to recognize the
owner's DirectDraw4 creator. Their surfaces therefore expose Surface2 methods.

The first original gameplay bank realization is
`..\\GameData\\textures\\ocra#12.btf`: CreateSurface returns S_OK at `0x450db6`,
with a 124-byte DDSURFACEDESC2, 64×64 ARGB4444, caps 6144. The creator is
137580552, vtable 6240636 (DirectDraw4 extension methods 3084–3087).
The later shared registry instead says DirectDraw4=7287060, Surface4=7286676,
Surface2=7278948. The returned surface 136459408 actually uses 7278948.
GetSurfaceDesc at `0x453ec3` and Lock at `0x4540bc` consequently return
`0x80070057`. All 467 gameplay-worker GetSurfaceDesc calls fail; the main
worker's 280 UI descriptors succeed. This is the first failed upstream boundary,
not evidence of a renderer binding defect. `first-failure.json`,
`registry-before-repair.json`, selected original disassembly and bounded traces
retain calls, returns, interface methods, frame/caller and texture-bank identity.
The backend's caller frame returns to `0x4181d5`.

DirectDraw4 CreateSurface accepts DDSURFACEDESC2 and returns Surface4; its
GetSurfaceDesc/Lock must accept the 124-byte descriptor. Surface2 correctly
rejects that descriptor. The existing generated implementation follows this
contract when creator identities match. The repair prevents only the redundant
shadow initialization in Worker boot; local boot still initializes normally.
No guest/config/texture-state patch and no WAT change is involved.

`test/test-worker-directx-vtable-boot.js` exercises the actual host loadExe method,
actual GuestThreadHost.loadPe and compiled production WAT with owner, shadow and
later-worker instances. Before repair it fails with E_INVALIDARG on the valid
124-byte descriptor. After repair DirectDraw4/7 later-worker surfaces succeed,
108-byte descriptors remain rejected, and local initialization succeeds.
The callback census host-file SHA was reviewed and refreshed: this removes a
redundant synchronous initialization and adds no producer or continuation.

## Original verification

One new box and one Chrome process; repair retest uses an acknowledged reload in
that same browser. The registered 65 original files and ordinary DISPLAY
640×480×16 → Play → New Game → Stadium City route are unchanged. Passive waits
are at most ten seconds; input uses qualified trusted delivery, owner bindings,
exact ACKs and independent release. A pre-dispatch stale cinematic scene was
refused with zero effects before repair; it was not replayed. A malformed local
point after reload was rejected by validation before command publication, then
correctly submitted. There has been no UNKNOWN input.

After repair, the same ocra#12 surface uses vtable 6240252 and CreateSurface,
GetSurfaceDesc, Lock and Unlock all return S_OK. All 467 gameplay texture
realizations succeed. Main-worker traces now contain Texture2_Load (92) and
Device3_SetTexture (824) at the first repaired cinematic capture, rather than
neither call before repair. Bounded trace observer errors are empty after reload.
Before Play, its diagnostic decoder was corrected to copy SharedArrayBuffer
views before decoding; the correction and initial error are retained explicitly.
It does not alter guest memory, APIs or scheduling policy.

Actual D3DIMGpu ownership was read through the live renderer object's exports
and memory, both matching the owning instance. Before repair: device slot 7,
texture slot/handle 0/0, modulation enabled, cache/uploads 0/0. After repair at
01:47:56Z: device slot 7, texture slot 266, handle 0, cache/uploads 67/67.
The live endpoint is legacy WebGL, actual WebGL2 Intel UHD 620/Mesa, context not
lost, software mode 0. These are object reads, not selector-label coverage.
Personally reviewed repaired captures show textured buildings, floor, characters,
signage and effects where the retained original was flat shaded.

## Validation and scope

Failing-before/passing-after browser-boot regression, existing Surface3 strict
descriptor regression, callback census reconciliation and locked build pass.
The first locked build detected the stale census seal; the reviewed seal then
passes. Registration test passes and canonical 65 media pins match. The broad
historical `--fixture` command remains unavailable because its old archive path
is absent; it is not reported as passing. Request deadlines, eighteen native
control paths, independent release/UNKNOWN control and bounded observer controls
were qualified locally before original input.

Actual served WASM stays
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`;
only the repaired host boot code changes. FPS, audio and full playability remain
separate claims.

Original playerworld is reviewed in `repaired-world-hud.png` and
`repaired-action-settled.png`: textured shutter/weapon and HUD ammo 200, health
100. One 250 ms Control action has exact ACK and independent UP, with held and
released captures. Weapon pose changes, but ammo remains 200 and no distinct
muzzle/impact consequence is demonstrated; firing and vehicle entry remain open.
There was no repeated firing or movement survey. At 01:50:35Z the actual owning
GPU reports 204 cached textures and 374 uploads. Its instantaneous final texture
slot/handle is 0/0 despite those working textured draws: the earlier zero slot
alone was never proof of a binding defect. Registry reads after repair agree on
DirectDraw4=6240636 and Surface4=6240252 in renderer, main and guest worker 2.

The browser closed normally at 01:51:42Z, exit 0, before its immutable deadline.
Controller/Chrome PIDs, both listening ports and temporary profile are gone.
All 708 runtime pins were rechecked: only the intentionally repaired host.js and
diagnostic decoder script changed; the complete 65-file fixture remains pinned.
The initially malformed drain read named a nonexistent transport-closed.json;
the corrected read uses cleanup.json and proves normal drain. This is a read-only
evidence-script error, not an original input failure.

295 evidence references (264 unique, 90,797,544 reference bytes), 26 PNG CRC/IDAT
checks, 406 served-pin reads, 26 command ACKs and all source/module bindings pass
independent local verification. The prearmed detached 25-minute watchdog and
normal-stop delegate both exit 0; their supervisor records no remaining children.
Normal stop `stop_f7e74b49faaaf898` completed without force at 01:52:38Z after
hash verification. Box `bx_kmkrut6b` is archived, current expiry null (initial
02:00:17.625Z). No resume, delete, public deployment or RAM gate was used.
Sampled local free disk remained above 5 GB; remote final free disk was 56.9 GB.

Next: qualify a visible original firing consequence and a reviewed vehicle-door
route with the repaired browser boot. No further renderer fix is justified by
this result. Paired backends, FPS, audio and complete playability remain open.

The repository-wide evidence checker retains seven unrelated historical errors;
this run has no containment/missing-artifact errors.
