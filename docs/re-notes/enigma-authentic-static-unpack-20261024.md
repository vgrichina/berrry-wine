# Enigma 1.01: authentic static unpacking; dynamic closure remains unproven

All ten retained original PE32 modules passed authentic UPX integrity tests and
decompressed successfully to separate diagnostic files. Their recovered normal
imports bind: **849 entries, 40 module edges, 192 packaged export references**.
The packed tables exposed only 81 import entries over the same 40 edges.
This is static diagnostic acceptance. It proves neither full dynamic closure,
emulator API implementation nor menu/gameplay readiness. No guest was executed.

The exact starting commit is
`b9450836983365a8f7f90d3f9f8213bf7f629f31`, from the assigned original-task
donor, not main. This branch adds a separate helper, tests and evidence only.
The original verifier and its tests are byte-identical to that commit. The
original verifier still reports **BLOCKED_PACKED_IMPORTS**. Its full read-only
archive/asset recheck passed for all 2,460 files. Original manifest SHA256 before
and after is `74a65c35b0742c00f0a53f4590fe1c888715e6b59acae8f0349d1d98c1dbb574`.

## Provenance, bytes and recovered tables

Official release: <https://github.com/upx/upx/releases/tag/v5.0.2>.
The retained primary API response is
<https://api.github.com/repos/upx/upx/releases/tags/v5.0.2>.
The selected Linux x86-64 asset is
<https://github.com/upx/upx/releases/download/v5.0.2/upx-5.0.2-amd64_linux.tar.xz>.
Its official API digest and independently measured 626,608-byte download agree:
`ddc2654063fe4dc80d95b420788494e4db078ebb01a650692d623b5a9906e61e`.
Extracted `upx` SHA256 is
`992aa498ea367409359e424da5afdca8b2818eb55486ffcf7d4a63576cde4501`.
`--version` reported 5.0.2. No mirror, package installer or compiler was used.
Acquisition had no denied request or retry. Both local guard failures prevented
their sentinel before the first metadata/download operation. Each production
predecessor's status gated its successor. Exact argv/status/log hashes remain
in `metadata-fetch.json`, `tool-fetch.json` and each module binding.

Task root: `/tmp/enigma-authentic-static-unpack-oct24/`.
Only ten named PE files were copied from the standing read-only original tree;
no archive or assets were copied. Inputs total 2,177,024 bytes. Outputs total
7,828,992 bytes; all inputs retain their original SHA256. Binaries, complete
UPX distribution and primary metadata are retained separately from Git.
They are recovery material, not remotely backed up by the task commit.

Each module has original path/hash, release/tool hash, exact `-t` and
`-d -o NEW_PATH ORIGINAL_COPY` command, zero exit status, log hash, output
length/hash and recovered entrypoint/sections in
[`enigma-unpacked-evidence-20261024.json`](enigma-unpacked-evidence-20261024.json).
No replacement or injected library was produced. UPX's test covers its packed
payload, not arbitrary overlay data or program behavior; full-file input/output
hashes supply the independent byte binding.

The new parser bounds PE32 headers, section raw/virtual extents and overlaps,
entrypoint backing/executable flag, RVA reads, import tables and export targets.
It rejects remaining UPX section names and delay imports needing extra handling.
The old parser deliberately remains untouched: decompressed files contain
legitimate repeated descriptors for `msvcrt.dll` which it rejects. The separate
diagnostic parser merges these descriptors while retaining their counts.

All packaged module imports are traversed, including modules outside the EXE's
direct static graph. Named exports and ordinals are represented separately;
forwarders recursively resolve with cycle rejection and ordinal support.
These actual files contain no ordinal imports or forwarded exports; dedicated
positive and rejecting graph controls exercise those resolver branches.
The normal system boundary is kernel32, advapi32, gdi32, user32, msvcrt, winmm
and ws2_32. Their required names are recorded, without asserting emulator support.

## Dynamic loads: decoded evidence and remaining gates

The verifier decodes six fixed-name codec initializers, checking literal stack
arguments, relative calls, import thunks, IAT identities, saved module handles,
and all 74 literal function-name requests. It also checks exported SDL bridge
parameter flow into Windows `LoadLibraryA` and `GetProcAddress`.

| Caller | Fixed DLL | Lookups | Static result |
| --- | --- | ---: | --- |
| SDL_image | jpeg.dll | 9 | Packaged exports bind |
| SDL_image | libpng12-0.dll | 16 | Packaged exports bind |
| SDL_image | libtiff-3.dll | 5 | DLL absent |
| SDL_mixer | mikmod.dll | 25 | Packaged exports bind |
| SDL_mixer | libvorbisfile-3.dll | 6 | DLL absent |
| SDL_mixer | smpeg.dll | 13 | DLL absent |

These are supported code paths, not DLL-string guesses. The JPEG/PNG/MikMod
function requests all bind, but static existence does not establish which
initializers a particular asset or configuration invokes. TIFF, Vorbis and MPEG
codec availability, their recursive dependencies and necessity for this package
remain unproven. Do not silently fetch or substitute those libraries.

Bounded disassembly also supports Enigma's literal `shfolder.dll`, `DDRAW.DLL`
and extensionless `WSOCK32` requests, and SDL's DINPUT/DDRAW/DSOUND requests.
The evidence labels their bounded operand windows and call sites. These are
Windows provider boundaries, not bundled-code closure or implemented emulator
APIs. SDL's OpenGL loader accepts a caller-provided filename; `OPENGL32.DLL`
also appears as a string, which alone does not prove a default execution path.
Enigma's load at VA `0x5ab960` passes a register-supplied name. Its subsequent
`GetProcAddress`, SDL's generic load/function and GL lookup paths, driver-selected
APIs, and any computed names/indirect calls remain unproven. Direct-call byte
scanning is a candidate finder, not an exhaustive control-flow proof. This task
does not establish a complete symbol contract for those system/dynamic paths.

Future coordinator-assigned work must establish required dynamic loads and
emulator support, writable configuration, initialization and actual menu/level/
input behavior. Static success grants no registry, deployment or runtime status.

## Verification and recovery recipe

From this private checkout, with retained task material:

```sh
python3 test/enigma-unpacked-closure.test.py /tmp/enigma-authentic-static-unpack-oct24
python3 tools/enigma-unpacked-closure.py verify \
  /tmp/enigma-authentic-static-unpack-oct24/module-bindings.json \
  /tmp/enigma-authentic-static-unpack-oct24/outputs \
  /tmp/enigma-authentic-static-unpack-oct24/inputs \
  /tmp/enigma-authentic-static-unpack-oct24/tool-identity.json
```

The final full suite passed 14 substantive rejecting controls plus two guard/
sentinel controls. Missing DLL, changed output, wrong original binding, wrong
tool identity, failed UPX check, changed command, unresolved DLL/export,
unresolved forwarded ordinal, forward cycle, invalid entrypoint/section bounds,
packed input and changed codec instruction all reject. No pass-on-skip: invoking
the test without the task root runs only its clearly labelled pre-download tests.
Final CLI verification also passed with `dynamic_closure: UNPROVEN`.

For lost diagnostic outputs, first repeat resource/memory admission, preserve the
standing originals and verify every pinned hash in the committed evidence. Copy
only its ten original paths into a new owned `inputs/`, using their original
case. Recover the tool only from the official pinned asset above using the
retained sequencer/guards, finite 2 MiB download bound and 60-second process
group bound. Verify the archive SHA, inventory before extraction (no links/path
escapes; full expanded bound 6 MiB), then executable SHA before execution. Read
the retained `cli-doc-slice.txt`: `-t` tests packed payload; `-d` decompresses;
`-o file` selects a new output. Remove the `UPX` environment override.

For each original copy, run the exact commands in `module-bindings.json`, mapped
to the new owned paths, through the helper's bounded `run(argv, log)`. Gate `-d`
on `-t` returning zero; stop on the first substantive error. Update receipt
paths, statuses/log hashes and output lengths/hashes; the verifier pins all ten
original and diagnostic hashes, so changing receipts cannot bless other bytes.
Keep the tool/version identity receipt's argv path consistent. It is intentional
that receipts from one output directory cannot authorize a different directory.
Retain original archive/asset verifier evidence separately; never replace its
original hashes with diagnostic hashes. The full tables in `unpacked-closure.json`
and `recovered-tables.json` can be regenerated with Python `verify`/`pe`; the CLI
prints compact module summaries to bound capture.

## Resource and lifecycle

Admission was 52,764,672 / 67,108,864 bytes including 8 MiB reserve, tool archive
and extraction overlap, all ten input/output copies, Git/source/evidence and
16 MiB future external-history/SQLite growth allowance. Actual directory blocks,
full external session/events, positive SQLite growth and cumulative capture are
measured by the single retained `resource.py`; the final receipt retains the
initial projection. Largest owned file is 6,287,872 bytes, below 25 MiB. Installed
tool identities/standing footprints are separate; every newly acquired UPX byte
is charged. Fresh memory gates and CPU/wall process bounds passed. No Node,
compiler, full build, browser, guest, box or lifecycle operation occurred.
Mount argv and box ID/state/expiry: N/A. Coordinator retains lifecycle ownership.
Root tracked files/index/refs and all donor stores remained read-only; root board
updates were append-only. This worker stops after publishing the bounded result.
