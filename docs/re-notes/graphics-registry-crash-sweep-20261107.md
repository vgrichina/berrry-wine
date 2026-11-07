# Registered graphics startup sweep — 2026-11-07

Actual guest execution on one fresh separate box, **bx_psf77a49**. At source
pin time main was `0c66fe75482d3a86bacdd9b971ee377abdb4dc34`; this is a bounded
sample of four requested registered titles, not historical27 membership or
backend parity. Evidence is in
`scratch/runs/20261107-graphics-registry-crash-sweep/`.

All requested original registered inputs were available: Quake II 67 paths,
Quake III 307, GLTron 92, Forsaken 873. Availability and SHA-256 pins are in
`runtime-pins.json`; no replacement media was downloaded, substituted or
modified. Runtime, shared DLL/type-library/font inputs and pngjs were pinned
before the successful launch: **1,782 files**, all unchanged in remote
postflight. Git plus `relevant-source.patch` and the new `lib/wininit-boot.js`
patch identify source; no source/media archive was made. Node **v24.22.1** was
recorded before launch; the executable SHA-256 was additionally recorded at
cleanup, rather than claimed as a prelaunch binary pin.

Both shipped modules were pinned and recovered:

- Standard, 2,181,694 bytes:
  `2f9fd9f5fb1841afe68f47f61d9870ea617a73f2c45253cbf662c2479b723e55`.
- Compatibility, 2,184,340 bytes:
  `ee95ae7880c3b09e0e0a677b9314902145e487026d20d4b5012f7f53e9a6f6e5`.

All eight actual sweep processes read the pinned **standard** module, recorded
by a run-only read observer. Compatibility was retained, not executed. No
fresh-build or compatibility-module behavior claim is made.

Successful command, from the isolated runtime root:

```sh
node tools/crash-sweep.js --apps=quake2_demo,quake3_demo,gltron,forsaken_demo --seconds=20 --modes=coop,threads --jobs=1 --stuck-after=0 --no-build --jsonl=/home/user/graphics-sweep-runtime/scratch/runs/20261107-graphics-registry-crash-sweep/actual2/sweep.jsonl
```

Only one guest process ran at a time; there was no RAM gate. The tool ran
03:58:28–04:00:37 UTC. Raw per-process logs, final PNGs and PCM outputs were
retained before the stock tool removed its temporary files. Large logs were
losslessly gzip-compressed for recovery. `retrieval-verification.json` verifies
88 recovered artifacts, 45 unique hashes, including both modules. Cleanup and
scheduler comparison were recovered separately afterward.

| App | Cooperative | Threads | Personally inspected final captures |
|---|---|---|---|
| quake2_demo | ok/content, 20.2 s | ok/content, 20.2 s | Both show GAME/MULTIPLAYER/OPTIONS/VIDEO/QUIT menu at 320×240. |
| quake3_demo | ok/blank, 20.2 s | ok/blank, 20.3 s | Both uniformly gray at 640×480; no menu proved. |
| gltron | exit:1/blank, 3.7 s | exit:1/blank, 3.5 s | Both uniformly teal at 640×480; no menu proved. |
| forsaken_demo | ok/content, 20.3 s | ok/content, 20.3 s | Cooperative shows SINGLE PLAYER and other menu entries over the 3D backdrop; threads shows an attract-scene view, debug labels and Acclaim logo. |

The stock comparison reports **0 of 4 apps disagree** on its signature,
frame-content and audio classifications. Forsaken's pictures differ despite
matching coarse classifications; equal wall time does not mean equal guest
progress. All eight audio signals are `none`, not evidence of working or
silent audio. No unimplemented API or escaped trap was logged. Tool exit 0
also covers GLTron's guest exit 1 and is not an all-games pass.

## Early-exit investigation and limits

One additional GLTron cooperative execution used existing selected API tracing,
0–40,000 batches, maximum 8 seconds/40,000 batches. It ended after 32,790
batches, again with guest exit 1. `investigation/trace.log` records
ChoosePixelFormat returning 1, SetPixelFormat returning 1, then
**wglCreateContext(0x00310001) returning 0**, followed by guest shutdown.
The trace's final teal PNG was also inspected.

`test/run.js` supplies a GL canvas factory only for its explicit headless-GL
route (or the separate software-Glide condition). This mandated sweep command
requests neither headless GL nor software OpenGL. `lib/gl-compat.js` therefore
has no canvas in Node and returns zero from context creation. Microsoft's
[wglCreateContext contract](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglcreatecontext)
specifies NULL on failure. This is consistent with the existing GLTron notes'
warning about generic sweep exit 1 on a different graphics route. No Win32/x86
semantic regression was demonstrated, so no production fix or speculative
regression test was added. Quake III's gray frames remain a limitation of this
actual command; they are not promoted to successful rendering or a diagnosed
scheduler defect. No second graphics route was substituted.

Two earlier staging failures are preserved separately: the first omitted the
shared `test/binaries/tlbs/stdole2.tlb`, and the second used a TMPDIR long
enough to fail desktop Unix-socket startup with ECONNECTION. Both failed before
guest execution. Existing shared runtime input staging and a short owned
TMPDIR corrected these run-local setup errors; each subsequent invocation used
a fresh JSONL path. No cybersecurity flag, access403, held-lane retry, guest
patch, public deployment or nested worker occurred.

## Cleanup and next work

All unique evidence was recovered and verified before delegated normal stop
`stop_5800d4a664d25d2d`. It completed **04:02:07.270 UTC**, forced=false,
error=null; box state **archived**, active expiry null (original expiry
04:26:07.799 UTC). No lifecycle ownership remains to hand back. Remote cleanup
found no live owned runtime processes or owned Unix listeners and removed all
three owned temporary trees. No browser, TCP server or profile was started.
Local work used no emulator, server, build or source-edit lane; Aranna/Lords2
coordination is on the append-only board. Free /home remained above 2 GB.

This documentation-only publication records the sweep, API investigation,
module/hash checks, image inspection and cleanup. It does not establish
controlled gameplay, audio quality, FPS, full graphics correctness, historical27
coverage or broad crash freedom. A separately requested software-GL or real
browser run would be useful for Quake III/GLTron rendering; it is outside this
mandated command. No emulator repair is warranted by this evidence.
