# Enigma 1.01 original Win32 acquisition — closure blocked by packing

Original bytes recovered and retained; **not ready for registry or gameplay**.
All ten original modules are UPX-packed. The checker binds their visible PE
loader tables but deliberately exits 2 (`BLOCKED_PACKED_IMPORTS`): unpack-time
`LoadLibraryA`/`GetProcAddress` requests are not proved by these tables.
No unpacker is installed at `command -v upx`. The coordinator must assign a
bounded static unpacking/import reconstruction step, with authentic tool
provenance and fresh overlap admission, before full dependency closure can be
claimed. No replacement binary was compiled; no original executable was run.

## Provenance and retained bytes

Upstream: <https://www.nongnu.org/enigma/download.html>, independently retrieved
2026-10-24 (22,747 bytes, SHA256
`ae1b58c2e551180bc476d5a03bb070146219e7501bcb2c8d3221426b7ff248dc`).
Its historical 1.01 section labels this Minimum Zip as Windows 95 and later:

<https://sourceforge.net/projects/enigma-game/files/Release%201.01/Enigma-w32-1.01-w7.zip>

Published and measured ZIP SHA256:
`a738a8b1508675bfaf12db07b7bdb42356f013f4c2d5c2a494516d78d25070a1`.
The upstream-linked request succeeded, redirecting automatically to SourceForge's
master download server. No mirror hopping or denied request occurred.

Retained task root: `/tmp/enigma-original-win32-closure-oct24/`.
`Enigma-w32-1.01-w7.zip` is 12,132,834 bytes. `original/` holds the exact
extraction: 2,521 ZIP entries, 2,460 files, 17,591,277 expanded bytes, largest
file 1,459,200 bytes. Compressed/expanded logical overlap: 29,724,111 bytes.
These original files and the archive are separately retained **not Git-backed**.
`archive-inventory.json` enumerates every member and compressed/expanded size;
`original-sha256.json` enumerates every extracted file with SHA256.

Initial projection 61,865,984 bytes; revision for measured Git index overhead
62,390,272 bytes. Before extraction, a filesystem-block-rounded projection
of 57,922,018 bytes passed the 67,108,864-byte allocation, including 8 MiB
reserve and 10 MiB external-history/future allowance. No ledger was reset.
Admission receipts preserve initial and revised allocations, positive SQLite
growth baseline, external session/events, host disk floor and memory evidence.

## Recovery and checking

Use a fresh admitted directory. Run the local guard tests **before downloads**:

```sh
python3 test/enigma-original-closure.test.py
```

Production used `tools/enigma-original-closure.py sequence GUARD_JSON DOWNLOAD_JSON`;
the guard checks admission and free space and its nonzero status propagates.
The retained `upstream-fetch.json` and `archive-fetch.json` contain exact argv.
The fetch subcommand accepts a URL, new destination and maximum bytes; the page
limit was 131072 and archive limit 12582912. Every dependent operation checked
its predecessor. Do not retry an actual denial unchanged.

After successful download, verify the pinned SHA256. Before extraction inspect
`zipfile.ZipFile(...).infolist()`, sum all expanded sizes and round each file up
to 4096 bytes (directories charge 4096), add archive, checkout/Git, all external
growth, temporary/evidence/future bytes and 8388608 reserve. Require total
<=67108864, every member <=25165824, host free after projected increment
>=2982150144. Reject absolute paths, `..`, symlinks and duplicate names.
The exact measured inventory above must match. Only then extract:

```sh
python3 -m zipfile -e Enigma-w32-1.01-w7.zip original
python3 tools/enigma-original-closure.py inventory Enigma-w32-1.01-w7.zip original-sha256.json
python3 tools/enigma-original-closure.py verify Enigma-w32-1.01-w7.zip original original-sha256.json
# Expected exit 2: authentic bytes and visible tables pass; packed closure blocked.
python3 test/enigma-original-closure.test.py Enigma-w32-1.01-w7.zip original original-sha256.json
```

The verifier hashes the whole ZIP, binds every extracted file to both its seal
and pinned archive member, parses PE32 headers/imports/exports, and recursively
resolves packaged name/ordinal imports and forwarded exports. It checks all
packaged modules, including codecs potentially loaded dynamically. The system
DLL boundary is explicit; it does not assert that the emulator implements those
APIs. Unknown DLLs and unsatisfied exports reject. UPX blocks final acceptance.

Tests passed: metadata and byte guards each return 37 and prevent sentinel
creation; missing asset, changed asset, changed DLL, changed ZIP, injected
unresolved DLL and unsatisfied export all reject. Actual original byte mutations
were restored in `finally`; final re-verification passes visible-table integrity.

## Launch/data recipe for subsequent coordinator work

Map the entire original `original/Enigma-1.01/` tree to one guest directory,
for example `C:\\Enigma`. Launch `C:\\Enigma\\enigma.exe`, arguments empty,
**CWD `C:\\Enigma`**. Preserve names and relative hierarchy. This is a proposed
mapping derived from package layout and the packaged NSIS shortcuts, not an
executed harness argv or validated runtime. Use a canonical-parser-validated
tree mount, enumerating all files including comma-bearing names, when a runtime
is assigned. No mount/box/runtime operation was part of this task.

Keep EXE and nine DLLs together: SDL, SDL_image, SDL_mixer, SDL_ttf, jpeg,
zlib1, libfreetype-6, libpng12-0 and mikmod. Every module is machine 0x014c;
EXE entry RVA is 0x0060d430 (UPX loader entry, not unpacked game entry).
`closure.json` contains all ten hashes, entry RVAs, image bases, visible imports,
exports and 40 import edges. Seven visible system boundaries are kernel32,
advapi32, gdi32, user32, msvcrt, winmm and ws2_32. A DDRAW.DLL string is also
visible in the EXE; strings alone do not prove its load path. Do not treat this
list as the complete post-unpacking runtime API contract.

Preserve all `data/`: 1,110 level files; 388 gfx40, 385 gfx32, 385 gfx48,
51 gfx, 36 soundset, 11 schema, 10 locale and six font files, plus Lua startup,
models, security/configuration, ratings and remaining data. Keep manual,
reference, images, README and licence notices as packaged. The manifest verifies
the entire extraction rather than guessing a smaller asset subset.
Future runtime requires original DLL initialization and UPX unpacking support,
Windows system APIs/CRT, SDL video/input/timing/audio and fonts/image codecs,
writable user configuration/save storage, then actual menu/level/input evidence.
Optional external sound/music codec load paths remain unproven until static
unpacking and/or a separately assigned traced runtime establishes them.

## Licences and limits

Packaged `README` says Enigma is GPL version 2 or later; `COPYING` contains GPLv2.
`README-SDL.txt` identifies SDL's LGPL; `lgpl.txt` is packaged. Preserve
`ACKNOWLEDGEMENTS`, which gives Bitstream/Arev font terms, public-domain DejaVu
changes, Zipios/Oxydlib/Enet/Lua/tolua notices, and `gpl.txt`/`COPYING`.
This evidence identifies the package's declarations, not an independent audit
of every historical sample: README expressly says some sound origins could not
be pinned down and directs readers to a soundset README. That referenced sound
README is absent from this minimum package's file inventory. Do not represent
every asset as uniformly GPL or fully verified public domain.

Base and actual remote main were both
`f6571101e38985b3fa34d328f2ccadd9735a7573`; Enigma was absent from main's
`lib/apps.js` and `TODOS.md`. Root/donor tracked files, indexes and refs remained
read-only; only root messageboard appends were made. No registry changes, main
merge, workers, browser, guest, build, deployment or box lifecycle operations.
Runtime lifecycle: N/A; coordinator owns all shared shutdown decisions.
