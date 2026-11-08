# NFS3: current fixture recovered; ordinary D3D route and renderer identity blocked

No current race-control or renderer acceptance was obtained. The registered
fixture is intact, but the recoverable D3D driver changes guest configuration
and the current browser wrapper injects both a fingerprint and SwiftShader.
The historical contradictory endpoint identity remains unaccepted. This task
stopped before allocation rather than launch a different route or relax that gate.

Evidence: `scratch/runs/20261108-nfs3-current-race-renderer/`.
Read-only audit SHA: `0ad1958d9c1537411dddb56667376e775f6f30ae` on `main`.
Only this note is committed; audit helpers, patches and references are ignored.

The audit read `CLAUDE.md`, the NFS3 task in `TODOS.md`, renderer-bench,
capacity-recheck and software-prep handoffs, both NFS investigation notes, and
the additionally discovered backend-review and software-package handoffs.
Older copying, seed forcing and resource proposals were not executed.

All **133 manifest entries, 22,070,305 bytes**, exist with exact manifest sizes.
`media-pins.json` records each existing path, VFS name, size and SHA-256 without
copying media. The original EXE and all three renderer DLLs match their retained
historical hashes:

| Original file | SHA-256 |
| --- | --- |
| `nfs3demo.exe` | `0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad` |
| `d3da.dll` | `ae676272438d93fd7a8da7a19250d6e8b664d8570824ab8042e2b20b38395a02` |
| `voodooa.dll` | `6c7b0a1bd3ea4f7c673b7ff89db25379939171d33b1a969aa2506e44b8103b77` |
| `softtria.dll` | `8ea15aac0a7095b7d750cd75bbc9095553b6f708d1b89ca807864294a1a12b02` |

The current 2,182,500-byte on-disk WASM hashes to
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
It was not instantiated here; its executing identity and source lineage are
unknown. `preparatory-runtime-pins.json` rehashes 706 existing references from
the predecessor's generic production closure plus NFS3 inputs. It explicitly
does **not** certify a complete executing runtime: a compliant launch helper is
missing. `source-recovery.json`, `relevant-source.patch` and individual patches
for relevant untracked files retain Git recovery without a source archive.

The ordinary D3D prerequisite is specific. Both entries in
`lib/apps.js:4818` (`nfs3_glide_demo`) and `lib/apps.js:4832` (`nfs3_demo`)
set `Thrash Driver=voodoo`; the app name does not select D3D.
`tools/nfs-renderer-bench.js:262` changes `app.startupRegistry` to select D3D,
and its guest-worker overlay overrides the RNG-seeding GetTickCount result.
That helper therefore cannot be reused unchanged for this assignment.
The optional `test/test-nfs3-d3d-web.js` launches the default entry without
overriding it, then demands a d3da load; its comment is not current route proof.

The shipped `game/Setup/english/readme.txt` documents **3D Device Setup** as
a separate utility, with Use Defaults and OK, and documents Up for acceleration
and Left for steering. `game/Setup/3dSetup/3DSetup.exe` is present and hashed.
The 19 retained game menu files, including `psgraph.mnu`, supplied no documented
in-game renderer-selection route. This is not proof no such route exists.
The EXE's original selector references `Thrash Driver` at preferred VA
`0x53eb24` and `D3D Device` at `0x53eb34`, in the routine at `0x4b49a0`;
bounded disassembly and xrefs are retained. No guest memory was written.
Under the explicit prohibition on configuration forcing and alternate
executables, neither registry injection nor launching the separate setup
utility was admitted. Recover a reviewed ordinary D3D launch route compatible
with those restrictions before allocating. If bundled native setup is intended
to be in scope, that scope and its state-transfer route need to be explicit.

The identity trace follows actual source paths. In the current Worker route,
`lib/glide-render-worker.js:43` creates a WebGLBackend over OffscreenCanvas.
After open, lines 69–70 call the browser's
`WEBGL_debug_renderer_info.UNMASKED_RENDERER_WEBGL` query.
`lib/glide-host.js:98` validates the worker epoch and stores the open reply on
`device.glRenderer`. `tools/nfs-renderer-bench.js:193` reads that value, while
line 232 obtains browser GPU information through CDP SystemInfo. These are
separate browser observations; the Intel string is not a guest DLL label.
The extra OffscreenCanvas probe is appended to **guest-worker.js** at line 464,
so it does not independently observe the dedicated render Worker's context.

Current `/usr/bin/google-chrome` resolves to
`/opt/google/chrome/google-chrome`. Its captured shell source calls itself a
BetterChromium launcher, derives `--fingerprint` from the profile, and prepends
`--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader` before
executing `/opt/google/chrome/chrome`. This directly establishes the current
argument injection mechanism. Launcher, actual binary, timezone helper,
installed archive marker and SwiftShader library hashes are retained in
`current-browser-provenance.json`; only the small launcher source was copied.
The browser fork's WebGL identity-rewrite implementation was not found in the
inspected installed files. Fingerprint injection does not prove its exact
effect on getParameter, nor identify the historical browser bytes.

The old backend-review reports CDP ANGLE/SwiftShader versus endpoint Intel/Mesa.
Its source-trace account agrees with the current paths above, but the historical
raw records and frozen fixtures are absent from this checkout, including all
four `scratch/nfs3-*-20261002` roots and the 2026-10-10 run. Their contents remain
unknown, not independently reverified. The current wrapper provides additional
provenance, not retrospective proof. The remaining identity prerequisite is
reviewed browser source/configuration explaining the endpoint override, or an
explicitly reviewed honest provenance channel, followed by same-run owning
context, backend, CDP and process evidence. No broad CDP-only acceptance is made.

Fallback also remains an execution check. Current Glide endpoint code catches
WebGL creation failure and opens the WAT software backend. D3DIM similarly
declines unavailable/unsupported GPU work into native rasterization through
`lib/d3dim-render-worker.js` and `lib/d3dim-gpu.js`. Requested WebGL alone cannot
prove absence of fallback. Original `softtria.dll` is the game's x86 rasterizer
presented through DirectDraw; it is distinct from emulator SoftwareGL,
software-D3D and Glide-software.

Validation: `python3 scratch/runs/20261108-nfs3-current-race-renderer/audit.py`
passes fixture size/hash, launch-contract, source-recovery and wrapper-source
checks. No new native action was introduced, so production Worker action
qualification was not run. No emulator mismatch, repair, build or browser test
is claimed. No source/media archive, RAM gate, old-box action, deployment or
nested worker occurred. Disk remained above 5 GB. No box was created: final
box ID, expiry and stop receipt are **null**, state **not allocated**; there is
no owned runtime to stop. Current acceleration, steering, road displacement,
renderer verification, three-way comparison, warmed timing, audio, parity and
full27 remain open.
