# Enigma: complete explicit providers pass SDL; startup hits output guard

One authentic-unpacked diagnostic on 2026-10-24 progressed beyond the earlier
`SDL_getenv` trap, initialized eight native DLLs, created an `SDL_app` window,
and read Lua/configuration and graphics assets. Its first terminal condition
was the required **131,072-byte output guard**, while filesystem logging read
`data/gfx32/fl-concrete.png` (last complete record batch 11689). This is a
harness limit, not an established guest API failure, menu, or gameplay result.
There was exactly one guest attempt, no second attempt and no semantic fix.

## Provider correction and readiness

Immutable donor `4285b2bc213da24003a574af45e9d4622d1cfb7c` was verified with
the supplied dedicated identity and strict trusted-known-hosts SSH configuration.
The canonical runner's `--dlls` branch replaces automatic `resolveDllGraph`.
Automatic discovery also uses the registry's loadability filter; merely
removing `--dlls` would not establish this authentic provider set. We retained
explicit providers and derived a dependency-first list from the sealed normal
import directories, plus required system MSVCRT:

```
msvcrt.dll, zlib1.dll, libpng12-0.dll, SDL.dll,
SDL_image.dll, SDL_mixer.dll, libfreetype-6.dll, SDL_ttf.dll
```

`provider-gate.py` validates the actual filename-bearing `--dlls` paths against
the complete manifest, rehashes their standing source bytes, checks each native
normal-import provider and its position before its consumer, and checks all
527 native import/export bindings. The unchanged accepted PE parser SHA256 is
`f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf`.
Authentic SDL SHA256 is
`66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b`;
`SDL_getenv` resolves to RVA **37536**. A local synthetic full manifest with
SDL's row removed rejects with exit 2 before launch. Its exact compressed
fixture and receipt are retained. The full normal-import graph does not require
preloading `jpeg.dll` or `mikmod.dll`; they were left available in the mount.
No optional missing codec was fabricated, downloaded or declared necessary.

The runtime reports all eight DLLs loaded, patches EXE SDL imports to native
DLL #3 at `0x00e8e000`, patches the native dependency edges, and returns EAX=1
from each initial DllMain. Base plus sealed SDL export RVA gives expected native
address `0x00e972a0`; this arithmetic is separate from a live memory observation.
The prior `SDL_getenv` unimplemented trap is absent and startup advances to
configuration and image loading. Native SDL was not replaced with a stub.

## Observation and first terminal condition

The accepted narrower API-only trace fallback was selected: retained runner
multi-address tracing uses JS block boundaries, one native breakpoint, and a
string reader without a proven guest-readable mapping predicate. Therefore no
exact EAX/EDX/ECX/[ESP] entry record, bounded validated Lua strings, `[EDI]`
cache observation or exact branch record is claimed for `0x5ab8f0/0x5ab957`.
Four supported counters were armed, but the forced stop did not print their
totals; totals remain unknown. The 16-record API cap was reached, so later API
requests are outside the capture. No observed Lua shared-loader request or cache
branch is established; absence from these traces is not proof of no entry hit.

The supported trace includes DDRAW and shfolder requests, SHGetFolderPathA,
TrackMouseEvent, JPEG loading and native JPEG symbol resolutions, then a request
for the already loaded libpng provider. SDL_image's JPEG loader return site is
`0x00ecc8dd`. Native JPEG DllMain returns 1 and later GetProcAddress records
identify module `0x015d3000` and real symbol addresses. The trace's `=> 0` on
the LoadLibraryA line is not classified as terminal failure in the presence of
that continuation. No optional Lua/codec search miss is promoted to fatality.

The raw output ends partway through an FS record at exactly 131072 bytes.
The supervisor detected the output guard, sent group TERM, then KILL after its
five-second grace, reaped return -9, and verified no remaining group. Elapsed
supervised wall time was 7.395 seconds. No UNIMPLEMENTED API, runtime crash,
terminal guest message or ExitProcess is established in the retained prefix.
The SDL window title and reads of `menu_bg.jpg` do not establish menu rendering.
No frame was produced before the batch-30000 capture action; no PNG is claimed.

## Exact inputs, gates and bounds

Canonical runner SHA256:
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Historical module SHA256:
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI291,
layout `9a3bc9149d58209c`. No build or current-module substitution occurred.
Authentic unpacked EXE SHA256:
`5885e29ac9c1bdfe7f36e0d7fba76a56b74bc99558e1e6debf8425febe35fa45`,
6287872 bytes. All twenty packed-input/unpacked-output pins were rehashed;
ten outputs total 7828992 bytes. Originals remained unchanged.

Original asset manifest SHA256:
`74a65c35b0742c00f0a53f4590fe1c888715e6b59acae8f0349d1d98c1dbb574`.
The original tree has 2460 files, 17591277 logical / 22994944 allocated file
bytes. Standing source files were streamed through the retained bounded recipe;
there was no broad local asset duplicate. The prior zero-byte-transfer omission
was corrected in the owned transfer mapping before execution: `enigma_conf.lua`
was materialized and included, with no exclusion. Complete remote verification
passed for 2659 runner/system/asset files, 37476538 logical bytes.

The actual canonical parser and VFS helper enumerate/hash all 2460 exact guest
mappings, including the intended comma-bearing names if any. `--vfs-tree` is
used; no per-file comma mount is substituted. Full manifest and mappings were
transported as gzip; only bounded receipts/counts/hashes went through model
output. `tree-validation.json.gz` and `manifest.json.gz` retain exact mappings.
An inherited one-provider assertion in the validator rejected the eight parsed
providers before any guest. Only that assertion was corrected to compare all
eight exact canonical-parsed paths. The first rejection is retained; the
configuration itself was unchanged and no guest had been consumed.

Preflight passed as UID1000, Node24.22.1, pinned pngjs7.0.0 with actual runner
dependency preamble resolution, 28 font files, pixel-preserving PNG roundtrip,
two rejecting PNG controls, bounded 16-record preload/source-seal tests, and
supervisor descendant-reap/output-guard controls. `command.json` is the exact
executed argv: fixed512MiB shared linear memory, Node heap512MiB, CPU90/wall60,
runner55 seconds and output131072 bytes. The inherited command metadata lists guestSeconds60; actual argv55 is
authoritative. Cheap Node probes use heap256MiB.
Fresh prelaunch MemAvailable was 7162978304 bytes and materialization45154304
allocated bytes; largest file6287872. Launch projection was61714432/67108864,
including both hosts, Git, staging/transfer overlap, complete current session/
events, positive SQLite growth, remaining future allowance and8388608 reserve.
Both hosts passed the2982150144-byte free-space floor after projected growth.
Final accounting additionally reserves1MiB for possible SQLite growth before
the first task measurement; that conservative charge does not erase measured
positive growth or reduce the8MiB reserve.

Prior retained capture history was measured from every raw tool-result text
block plus all retained full remote responseBytes: conservative carried charge
1349992 bytes, with overlapping bytes deliberately still charged. A further
2097152 bytes was allocated for this narrowly selected capture. The prior
1048576-byte violation remains qualified and is not reset or retroactively
compliant. New raw response accounting includes transport metadata/base64;
`capture-current.json` and task-root final receipts record actual usage.
Instruction reads measured51782/65536 bytes; retained selected code excerpts
are each bounded. Logs/history were retained, with no deletion or reset.

## Recovery, cleanup and publication

The box is `bx_fvkjwxap`, expiry2026-10-24T10:02:44.741Z. It remained RUNNING
(API state idle, health ok) after owned groups were reaped; a later scan found
no task Node process. Handback was appended at09:41UTC, before the09:53 guest
finish/09:55 handback deadlines. Coordinator owns shutdown09:57; this worker
issued no stop, snapshot, resume or creation operation. Platform-reported
snapshot timestamps are not worker lifecycle actions.

All scripts, exact argv, source seals, positive/negative provider readiness,
preflight, compressed complete manifests/mappings, raw output, terminal and API
records are beside this note. Run the retained task-root `provider-gate.py` with the absolute bundled
`manifest.json.gz` path or rejecting compressed fixture, with all retained
standing source paths available;
these are static recovery recipes, not permission for another guest. Task root
retains setup/stage/API histories and later publication/accounting receipts.
Only this isolated sparse task branch changed; root tracked files/index/refs,
donors and standing original assets stayed read-only. Root board writes were
append-only. There was no source semantic patch, acquisition, build, second
guest, worker launch, main merge or public deployment. This is an authentic
unpacked diagnostic route, not packed-original/menu/gameplay acceptance.
