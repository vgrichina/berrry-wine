# Original Worms: DOS launch, installation and CD contract

Static investigation, 2026-11-13. **The ordinary entry is `WORMS.EXE`, a
real-mode DOS launcher; the game is `WRMS.EXE`, an MZ stub plus LE image using
external DOS/4GW.** Neither is a Windows PE entry. The repository can enter
their MZ stubs through ToyVM, but this does not establish that DOS/4GW, the LE
game, installation, CD access or a turn works. No program was executed here.

## Sources and identity

Use the [complete CD intake](worms-original-cd-intake-20261113.md) for the
candidate, all 68 file hashes, recovery and mixed-mode layout. The previously
verified `CDWORMS.bin` is 578,432,064 bytes, SHA-256
`e353ccf735d26f2c56d87614ab26f700f2ee5dfb79dd1848c18208276ff5d888`.
Its 401-byte CUE declares one MODE1/2352 track and eight audio tracks. Provider
identity is verified; independent publisher authenticity remains unknown.

Original text already retained in
`scratch/runs/20261113-coordinator-owner187-worms-layout/readme.txt` and
`install.bat` was reused and checked against the full-stream manifest. README:
6,454 bytes, SHA-256
`c854c996af3871bd7c66f17cfe3ee497fca34ed0bc057516c296d399577ccedb`.
INSTALL.BAT: seven bytes (`setup\r\n`), SHA-256
`0949888c614d02518f48a1137b75fd27028bfc8e927bd4181bb90af6b637d91f`.

Own ignored evidence is `scratch/runs/20261113-worms-dos-static-0940/`:
`headers.py`, `headers.json`, bounded `*.disasm.txt`, `validation.json`, source
pins and relevant patches. Four ordinary public HTTP ranges returned exact 206
bounds; only executable headers/stubs were read into a unique RAM temporary
directory. The complete 14,368-byte `WORMS.EXE` fits that bound and its full
SHA-256 matches
`7dd42f1d5d719912855c567e95570423cd4c816500c754ff8628dd84f67d46ec`.
The other reads are **prefixes**, not freshly verified complete executables:
16,384 bytes of WRMS, 8,192 of SETUP and 4,096 of DOS4GW. Their prefix hashes
and receipts are in `headers.json`; full-file identities remain those of the
earlier full-stream manifest. No whole-disc fetch, media staging or binary
archive was made. The temporary RAM directory was removed after disassembly.

## Ordinary install and launch contract

The original README's Information section says the program installs to a
chosen hard-drive directory (default `WORMS`), using at most approximately
2 MB, and reads its data from the CD. `INSTALL.BAT` invokes `setup`; DOS resolves
the root `SETUP.EXE` (39,746 bytes). Thus the source-backed ordinary sequence is
installation/configuration from the CD, followed by `WORMS.EXE` in the configured
installed context. The README's Windows section explicitly names `WORMS.EXE`
and recommends DOS or Windows 95 MS-DOS mode. That is DOS hosting advice, not
evidence of a PE executable.

The launcher gives a concrete CWD requirement: it opens **relative
`SETUP.CFG`**. At image offset `0x1f` it calls the file-open wrapper with that
name; a failed open prints the run-SETUP diagnostic and exits. Its success path
requests `0x5e` (94) bytes into DS:`0x440`, closes the file, and derives later
paths/settings from this buffer. `SETUP.CFG` is absent from the CD's complete
root manifest: installed/generated state is required. Do not manufacture it or
treat the shipped 4,204-byte `WORMS.CFG` as its replacement.

Disassembly addresses below are **offsets within the MZ load image**, excluding
the file header, with relocation biases unapplied. WORMS's data segment starts
at image offset `0x33a0` (file `0x33e0`); DS-relative string references therefore
have a checkable byte mapping. These are static paths, not observed execution.

| Launcher path | Original evidence and consequence |
|---|---|
| Configuration | DS:`0xbc` = `SETUP.CFG`; DS:`0xc6` = missing-configuration diagnostic; main `0x1f–0x4c` |
| Persistent game config | Main `0x4f–0x7a` constructs `%c:%s\WORMS.CFG`, then sets `WORMSCFG` through wrapper `0x750` |
| Sound environment | Main branches on the config words and constructs `ULTRASND` / `BLASTER` settings; preserve setup-produced choices rather than inventing hardware values |
| Extender environment | Main `0x157–0x160` sets `DOS4G` to `quiet`; the printable DOS/4GW 1.97 banner in the launcher is not an embedded extender implementation |
| Intro helpers | Main constructs `%c:\BLACK.EXE`, then `%c:\FMV\PLAY.EXE` with `fmv\logo1.avi` and `fmv\logo2.avi`; calls the common launch wrapper at `0x9f3` |
| Game | Main `0x1c3–0x1e4` constructs `%c:%s\WRMS.EXE` from config-derived drive/directory and invokes that same wrapper; DOS EXEC ultimately occurs at `0x2edf` |

The configured drive values are converted to letters by adding `0x40`; this
analysis does not assign unobserved actual drive letters or installed paths.
The ordinary launch must retain the CD root helper paths, `FMV` paths and data
tree alongside the installed program/configuration. The complete CD manifest
lists 46 DATA files and 13 FMV files. The README proves CD data use, while this
bounded analysis does **not** prove the minimum runtime asset subset, every
installer copy operation, the complete installed file list, the configuration
schema, or which intro failures the launcher tolerates. Those remain explicit
installation/startup observations for later work.

The README specifies 386DX33/4 MB minimum, 486DX2/66/8 MB recommended and
Sound Blaster compatible or Gravis Ultrasound sound. It describes selectable
English/American/French/German speech, adjustable sound quality, and ALT-X for
quick DOS exit. Its Protection section says this CD release has no code-sheet
protection; that statement neither authenticates this candidate nor establishes
all runtime disc checks.

## Exact executable chain

1. `WORMS.EXE`: MZ, 64-byte header, six relocations, declared MZ file end
   14,368, relative CS:IP `0000:09fe`, SS:SP `0385:0800`. `e_lfanew=0` does
   not name a second executable header. It configures the environment and
   launches the helpers and WRMS described above.
2. `WRMS.EXE`: complete-file identity from the stream is 426,117 bytes,
   SHA-256 `483f9f2376f76224602e67fc608f19ea13c218c0ef66643de30f2daf18d51ada`.
   Its 96-byte MZ header has six relocations, relative CS:IP `0000:030e`,
   SS:SP `02a5:0800`, and declared MZ file end 10,830. Two padding bytes precede
   the **LE header at `e_lfanew=10,832` (`0x2a50`)**.
3. The WRMS real-mode stub searches `DOS4GPATH` first (`0x8–0x38`), then
   executable/PATH search logic (`0x3a–0x65`, `0x19f` onward), for `dos4gw.exe`.
   Its main at `0x66` copies the original PSP command tail and supplies the
   original executable name as an argument to the extender. **This is not
   simply another child EXEC 4B00:** the tail of the exec implementation copies
   a trampoline (`0x1ce6–0x1d03`), prepares MZ entry/stack words, sets
   AX=`4b03` at `0x1d5a` and jumps to that trampoline. Its MZ branch begins at
   `0x1b20`, issues INT 21h, then transfers to the loaded image. This is an
   overlay replacement of the stub with the external runtime. It needs correct
   overlay loading, PSP/environment retention and transfer semantics.
4. The CD root `DOS4GW.EXE` is 265,420 bytes, full-stream SHA-256
   `dd9f4f342533f99570475b62e53231a468de2e3d83e4fc31e80c27d3a7d6b49c`;
   FMV's copy is identical. Its MZ header is 512 bytes, 78 relocations, declared
   MZ file end 62,580, relative CS:IP `01bd:2382`. Only its initial 4,096 bytes
   were inspected here; later runtime code was not traced. DOS/4GW is responsible
   for loading/fixing the LE game and establishing its protected-mode context.

The LE prefix contains CPU field 2 (386), OS field 1, 4,096-byte pages,
78 module pages and two objects. Object 1: virtual size 252,895, relocation base
`0x10000`, flags `0x2045`, pages 1–62. Object 2: size 2,238,528, base `0x50000`,
flags `0x2043`, pages 63–78. Entry is object 1 offset 215,612; initial stack is
object 2 offset 2,238,528. These are LE declarations, **not runtime addresses**.
The absolute data-page offset 110,080 plus 77 full pages and the final 645 bytes
equals the manifest's 426,117-byte length. Fixup records extend beyond the
fetched prefix; no complete relocation/import/dependency analysis is claimed.

## Repository route and concrete boundaries

The inspected source identity and dirty hunks are pinned in the run. Read
`tools/toyvm/run-dos.js:181` (`runDos`), `:394–478`, and
`tools/toyvm/dos.js:169` (`loadExe`): the native DOS route mounts the file tree,
loads the **MZ real-mode image**, relocates it, installs PSP/environment/arena,
and starts the real-mode registers on the 386-capable ToyVM. It does not map LE
objects from `e_lfanew`. The original stub and DOS4GW must do that work.

`dos.js:4943` implements EXEC, including AL=03 overlay loading with independent
load segment/relocation bias, and AL=00/01 child loading through `loadExe`.
Therefore the WRMS overlay request has a corresponding source implementation;
this is static reachability, not validation of this particular runtime chain.
ToyVM has protected-mode CPU/paging machinery, but no implemented INT 31h DPMI
host; INT 2Fh 1687h is unhandled. DOS/4GW can have other startup routes, so this
absence alone is **not an observed Worms failure or proof it must fail there**.
Protected-mode DOS pointer service still masks offsets to 16 bits in
`dos.js:2251`; flat 32-bit pointer servicing is not generally qualified.

The certain CD boundary is `dos.js:5918` (`int2f`): it handles XMS 43xx and
Windows detection 1600, **not MSCDEX 15xx**. `driveAvailable` at `:1295` permits
C: and mounted A:/B: FAT12 floppies, with no CD drive/ISO/BIN/CUE mount or CDDA
playback route. Ordinary CD file and audio semantics therefore cannot be
represented merely by pointing `fileRoot` at extracted files. This is a source
capability gap, not a recorded Worms error checkpoint.

The original README's Sound section requires the CD audio connection through
the sound card, and its Worm Song section describes an extra song selectable
in Audio Options and randomly used in demo games. Together with the CUE, this
establishes a distinct CDDA requirement in addition to `DATA/AUDIO/*.SFX` speech
and effects. No track-to-song mapping or Worms-specific MSCDEX opcode path was
established. Extracting just the ISO tree loses all eight audio tracks.

Current directory support is **not** the blocker described by older generated
corpus facts: `dos.js:1275–1341` resolves full paths, and `:5402/:5411` implement
mkdir/chdir with guest writes in an overlay. `run-dos.js:1120` also supports a
bounded batch subset. However, its batch parser requires `.exe`/`.com` on
program commands, so the exact seven-byte `INSTALL.BAT` line `setup` is outside
that subset; a later installation probe should launch its explicitly resolved
original `SETUP.EXE` and document that equivalent resolution. Do not claim the
literal batch already runs. Guest COMMAND.COM support is separately limited.

The Windows route is unsuitable: `src/08-pe-loader.wat:14–21` accepts MZ then
NE or PE, and returns `-2` for an LE signature (and for WORMS's MZ at offset 0).
There is no original Worms entry in `lib/apps.js`, the candidate manifest or
the two DOS corpus title manifests. Existing `worms2_demo` and
`worms_armageddon_demo` entries identify different games. DOS corpus conventions
require original DOS payloads, cited ordinary entry/CWD/arguments, full file
pins and explicit device requirements; a Windows DOSBox wrapper is not the
native original entry.

## Smallest later authorized test

First authorize a bounded **original SETUP/install observation**, with the
exact manifest-pinned CD mapping and an isolated writable guest destination;
record generated files, CWD, drive letters and hashes. Retain the BIN/CUE for
data and audio. Capture the first actual unsupported call if the native device
boundary prevents installation; do not forge configuration or presence replies.

Once a real installed state and necessary device support exist, run unchanged
`WORMS.EXE` from its installed CWD through `runDos` with explicit `fileRoot`,
`currentDirectory`, no guessed arguments, finite dispatch/wall deadlines and
automatic menu input disabled. Record actual helper launches, WRMS overlay
load, DOS4GW transition, first game frame and any failing interrupt/opcode.
Entering `WRMS.EXE` directly would only be a separately labeled diagnostic
because it omits the launcher's config/environment/intro contract.

Only after a fresh original menu is visible should a later authorized test
start a local game, identify a human-controlled worm and make one balanced,
reviewed move/aim/fire action with a visible turn consequence. Controls beyond
the README's ALT-X were not established here; inspect original UI/manual first.
Report startup, CD data, effects, CDDA and turn input independently. No install,
successful loading, retail authenticity, audio or original turn is claimed by
this static run. No box was created: ID none, state NOT_CREATED, expiry null,
stop receipt not applicable.
