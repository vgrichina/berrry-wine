# Enigma unpacked verifier: independent correctness rejection

Candidate `def12ace9c3157ca270495a6b770b5119d776683` is **rejected for parser
correctness**, with a minimal real-module reproduction. This does not invalidate
the retained authentic decompression or demonstrate a bypass of the verifier's
hardcoded module hashes. No production code was repaired. No game was executed.

## Reproducible defect

In the authentic unpacked `SDL.dll`, change the four-byte export-address-table
slot for the actually imported `SDL_Init` at file offset **299908** (`0x49384`)
from RVA `0x1340` to RVA `0x53000`. The new RVA lies inside the export directory
`[0x53000,0x5443b)` and points to a zero byte. It therefore denotes an invalid
empty forwarder, not the original executable export.

`pe()` returns `exports['SDL_Init'] == ''`. `closure()` uses `if forward:` and
treats that empty string as a resolved non-forwarded export. It includes
`['sdl.dll','SDL_Init']` in packaged bindings and reports `normal_imports: PASS`.
An empty string cannot specify a provider and exported name/ordinal. The parser
and resolver must reject it. The malformed file SHA256 is
`04448e081b6a27c4cf02989d5c763cd2cc9f1d1f0cb7e0e3934964fa5a6791c0`.

The full `verify()` entry point still compares every module against immutable
`SEALS`; this mutant differs from the pinned SDL SHA256
`66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b`.
The defect is a false positive in the substantial new PE parser/resolver, not a
claim that edited receipts can authorize arbitrary PE bytes. The authentic ten
modules have no forwarded exports; their observed normal binding counts remain
consistent with the candidate's report.

Reproduce from this branch, using the standing retained artifacts:

```sh
python3 -B test/enigma-unpacked-independent-review.test.py \
  /tmp/enigma-authentic-static-unpack-oct24 \
  /tmp/enigma-unpacked-independent-accept-oct24/reproduce
```

This diagnostic exits zero when it reproduces the known defect and expected
controls. Its JSON verdict is `REJECT_PARSER_CORRECTNESS`; zero is not acceptance
of production code. It compiles the exact SHA256-checked candidate source bytes
directly and disables Python bytecode writes. All mutated modules are new owned
copies. No original, donor, standing input/output or tool was modified.

## What passed, and receipt limits

Fresh execution against standing modules confirmed **849 normal entries, 40
edges, 192 packaged references**, legitimate repeated import descriptors, and
six fixed codec calls with 74 decoded symbol requests (50 target packaged
exports; 24 target missing providers). Existing ordinal/forwarder/cycle producer
controls pass on owned fixtures. These facts are scoped static evidence, not
whole-program dynamic closure or emulator compatibility.

The unchanged producer suite passed 14 semantic rejecting controls and two
guard/sentinel controls on copied ten-module inputs/outputs. Its first attempt
hit this review wrapper's mistakenly small file-size limit while writing its
owned fixture; that setup failure is retained and is not counted as a rejecting
control. Correcting the wrapper to the authorized 25,165,824-byte per-file bound
allowed the same unchanged suite/oracles to complete.

Eight fresh independent controls reject for the expected reasons: invented
output digest, extra binding, duplicate binding, changed command input,
truncated section payload, overlapping virtual sections, import descriptors
without their terminator inside the declared extent, and a codec call redirected
to a different authentic IAT slot. The last preserves the DLL literal and call
opcode but fails `dynamic IAT binding`; strings alone do not satisfy that oracle.

Two additional receipt probes expose narrower provenance limits: changing
`original.path` to an invented directory with the same basename passes, and
replacing a command log plus its receipt hash with an empty owned log passes.
Neither changes the immutable module hashes. `verify()` validates supplied
command status/argv and self-supplied log digests, rather than independently
proving that a supplied log arose from that command. Do not use arbitrary edited
receipts as fresh command-execution evidence. Here the actual retained receipts,
commands and logs were independently rehashed, original full paths were checked
against the retained originals, and official release metadata/checksum were read.

The retained UPX archive is 626,608 bytes with official digest
`ddc2654063fe4dc80d95b420788494e4db078ebb01a650692d623b5a9906e61e`;
the retained executable is pinned to release 5.0.2 and SHA256
`992aa498ea367409359e424da5afdca8b2818eb55486ffcf7d4a63576cde4501`.
All ten command/input/output bindings and 25 externally sealed artifacts were
read and checked. No network acquisition or repeated unpacking was needed.

The original helper and its test are byte-identical to
`b9450836983365a8f7f90d3f9f8213bf7f629f31`. Fresh original verification of the
retained archive and all 2,460 files still returns **BLOCKED_PACKED_IMPORTS**
(ten packed modules). The missing convenience `original-recheck.json` was
resolved by reading `original-preservation.json` and rerunning the original
read-only verifier, not by declaring a blocker or mutating original assets.

## Exact remaining original-startup boundary

An independent first-64-byte scan of every original file found 1,229 PNG, seven
JPEG, 36 WAVE and one S3M signatures; 1,187 files were outside these bounded
recognizers. In particular `data/sound/menu.s3m` has SCRM at byte 44. No TIFF,
Ogg or MPEG signature matched this scan. This is stronger than extension counts,
but it does not classify embedded/compressed content or prove runtime file use.

Decoded caller evidence makes the three absent codecs **likely optional for the
packaged media, not demonstrably required at startup**:

* TIFF: `IMG_LoadTIF_RW` at `0x62e46a10` calls `IMG_Init` with flag 4 at
  `0x62e46a4a`. The flag test at `0x62e411a0` gates the initializer call at
  `0x62e41203` to `0x62e46720`, leading to the decoded `libtiff-3.dll` request.
* Vorbis: the mixer initializer at `0x61705f40` tests flag 8; its call at
  `0x61705fc4` reaches `0x61715780` and then the `libvorbisfile-3.dll` load at
  `0x617157a7`. Null load returns failure via the branch at `0x617157b8`.
* SMPEG: flag 4 gates the call at `0x61705ff0` to `0x617161b0`; the load at
  `0x617161d7` likewise returns failure on null. Neither gated initializer proves
  that the original EXE requests those flags, or how its caller handles failure.

Candidate E8 scans were only used to locate the two mixer caller windows; aligned
disassembly of their flag-dispatch function supports the statements above. This
is not a whole-control-flow proof. No absent DLL was stubbed or fetched.

The static system boundary remains the recorded kernel32/advapi32/gdi32/user32/
msvcrt/winmm/ws2_32 imports, plus the decoded Windows-provider requests described
in the producer evidence. Their existence does not establish implemented APIs.
The register-supplied name at Enigma VA `0x5ab960`, its following symbol lookups,
generic SDL `LoadObject`/`LoadFunction`, OpenGL callbacks/driver selections, and
computed/indirect requests remain explicit unknowns. The six verified literal
codec initializers cannot close these paths. Writable configuration, actual
initialization, first menu and later gameplay remain unobserved.

The smallest next observation is **one coordinator-authorized startup of the
unchanged original package**, through the first menu or first failure, with
bounded `LoadLibraryA`/`GetProcAddress` arguments, return values, call stacks,
actual opened media paths, and the caller's branch after a null provider/lookup.
Capture the register-derived filename at `0x5ab960` if reached. This establishes
whether missing providers are attempted and fatal on that startup route; it
does not establish all later levels, optional configurations or full API closure.

## Evidence and ownership

Compact execution receipts, source hashes, control JSON and disassembly are in
`enigma-unpacked-independent-evidence-20261024.json`. Complete raw logs, helpers,
owned mutated bytes, admission and final resource/cleanup receipts are retained
under `/tmp/enigma-unpacked-independent-accept-oct24/`. Git preserves the review
and recovery recipe, not these ignored binaries. Initial projection was
56,651,264 of 67,108,864 bytes including reserve, copied modules and full external
history/future growth; directory blocks and SQLite growth are charged in the
final ledger. No new tool, compiler, build, guest, browser, box or deployment was
used. Mount argv and box ID/state/expiry are N/A. Lifecycle remains coordinator
owned. No main merge or shared integration was performed.
