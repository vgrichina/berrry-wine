# Redline (Accolade / Beyond Games, 1999): original single-player demo recovery

## Local candidate registration (2026-11-01)

The recovered original is registered as local-only experimental `redline_demo`.
Use the ordinary local `index.html?candidates&app=redline_demo` selector route.
This is static launch preparation; no browser, installer, game or gameplay was
executed. Public eligibility is unchanged. The earlier recovery report below
describes the media-only stage before registration.

Canonical ignored fixture: `test/binaries/candidates/redline-demo/`.
`original/MAINDIR/` contains all 60 unchanged original run files, including
both readmes, Mplayer support, I-Force files and the whole data container.
The other five extracted support files remain under `original/` with their
exact extraction-relative paths; installer TEMP/GROUP_PATH labels are not
mounted as invented installed Windows locations. All 65 candidate files are
independent byte copies, with no shared inodes or links to archival originals.
There are no generated settings or modified guest files.

The entry launches `original/MAINDIR/Redline.exe` as
`c:\MAINDIR\Redline.exe`, with cwd `c:\MAINDIR` and empty arguments, preserving
the original shortcut's relationship. The ordinary schema1
`.wine-assembly-browser.json` lists exactly the other 59 MAINDIR members with
explicit `c:\MAINDIR\...` paths and exact whole-file sizes. It retains the
three auxiliary EXEs as companions. It uses the current manifest validation
contract without an integrity bypass or a claim that its optional single-EXE
integrity format can describe this multi-EXE tree. Separate full-file checking
pins the package and all 65 extracted files against the table below.

Static import-table and printable dynamic module-name inspection of both
Redline.exe and IFORCE2.DLL found `IFORCE2` as the only game app-local seed.
It imports KERNEL32/ole32; printable module names also include user32/kernel32.
Redline's names otherwise match its system imports listed below. Therefore
the entry seeds only the original `IFORCE2.DLL`, using the host's existing
basename DLL policy. Mplayer's Url.dll/Rnaph.dll and installer DxDlg.dll are
preserved support files, not injected startup dependencies. Static inspection
cannot establish every dynamically constructed runtime dependency.

The native original DISPLAY selection / Play first-run flow remains intact.
No renderer, default selection, registry overlay, CFG, DirectX version
override or dependency injection was added. Whether original installation
side effects are necessary remains unknown; static extraction and a source
readme do not constitute installation or runtime evidence. DirectX 6 / 3D
prerequisites, rendered output, input, audio and gameplay remain unqualified.
Runtime access stays blocked pending authorized functioning transfer. Boat
ID/state/expiry: N/A; no box or runtime lifecycle ownership was acquired.

The original package is deliberately referenced, not duplicated:
`scratch/runs/20261031T2348Z-redline-original-recovery/RLSPDEMO.EXE`, with the
48,229,213-byte SHA-256 pin below. `.host/package-reference.json` records this
predecessor reference; `.host/inventory.json` and `inventory.sha256` retain
whole-file recovery pins. The predecessor's actual handoff is `RECOVERY.md`
(`RECOVERY.txt` does not exist). Its extraction/package/source files remain
unchanged. To recheck recovery and the actual registered fixture from repo
root, run:

```sh
node test/test-redline-demo-registration.js --fixture
```

The explicit fixture mode fails if media is missing. It verifies the package,
all candidate and archival whole-file hashes, exact 65-file set and 60-file
run tree, independent inodes, the canonical inventory digest, exact registry
entry and manifest, actual CLI resolver, browser-relative URLs/VFS paths,
ordinary loading policy (8 eager / 51 lazy; synchronous reads: 59 eager),
and checked-out local selector / public exclusion expressions. Without
`--fixture`, the test checks registry and selector behavior without requiring
ignored media. Evidence, static PE/string inspection, gate logs and recovery
instructions: `scratch/runs/20261101T0002Z-redline-local-registration/`.
The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passed, as did
the focused fixture check, file-policy / candidate-manifest tests, census
mutation tests and Rune registration regression. The reviewed census change
updates only the apps host-file SHA; all boundary/ownership fields remain
unchanged. `/home` remained above 2 GB free (over 2.56 GB at final build).

Static media recovery only, 2026-10-31. No installer, game, browser or runtime
was executed; no box was allocated or accessed. Gameplay compatibility remains
unknown. The recovery base is main `81f5df0c8966ef74e23bb0961cf8cc1e746d0efe`,
a descendant of requested `4efd707960b1b4bbbce2f77b11c9da84b7c8b305`.

Evidence and original media are retained in the ignored directory
`scratch/runs/20261031T2348Z-redline-original-recovery/` (called `R` below).
Before ownership, searched existing reverse-engineering notes, `lib/apps.js`,
`TODOS.md`, `ops/STATUS.md` and the append-only messageboard. No competing
Redline game ownership, qualified lane or hold was found. References to
Rendition's `redline.dll` concern a different component. The coordinator's
Redline task/status entry is this assignment. No registry or candidate files
were changed.

## Source and identity

Selected the standalone Windows package
[`RLSPDEMO.EXE`](https://archive.org/download/RedlineDemo/RLSPDEMO.EXE)
from Internet Archive's
[`RedlineDemo` preservation item](https://archive.org/details/RedlineDemo),
uploaded in February 2012 and attributed to Beyond Games / Accolade, 1999.
This is a credible preservation mirror, not a publisher-hosted download or
cryptographically authenticated publisher release. The item's description
discusses multiplayer; the actual Wise script explicitly names this payload
**Redline Single Player Demo**. Its executable and original readmes determine
the recovered build's identity.

[PCGamingWiki's preservation entry](https://community.pcgamingwiki.com/files/file/2800-redline-demo/)
separately identifies single-player `reddemo.exe` and multiplayer `reddemo_m.exe`
and links archived FilePlanet IDs 47170 / 47169. Those historical names are
leads, not a claim that `reddemo.exe` is byte-identical to `RLSPDEMO.EXE`.
[ModDB's demo mirror](https://www.moddb.com/games/redline/downloads/redline-demo)
bundles both demos in `redlinedemo.zip` (67,366,650 bytes; advertised MD5
`6e6712d976529fea06a6e266847f97fe`). That ZIP was not downloaded or verified.

Saved Archive metadata records the selected package as 48,229,213 bytes,
MD5 `ad55f1adc4b3a094b1576ff95956d777`, SHA-1
`57618ed347c2ee842ba5bfad391a04a14f70e5d4`.
HTTP range probes returned 206, total 48,229,213 bytes, last modification
2012-02-15 17:14:16 GMT and ETag `"4f3be7e8-2dfeb5d"`.

## Static extraction and installation boundary

The 65-member Wise file table was parsed from the first 65,536 bytes before
the full download. It advertises **91,645,042 expanded bytes**. Admission
reserved the complete package plus complete expanded payload and 3 MB for
helpers/evidence; the combined task limit is 200,000,000 bytes, and `/home`
must remain above 2,000,000,000 free bytes. No compilation archive was
downloaded. An unrelated 27.99 GB WizardWorks archive was identified through
metadata only; its archive listing returned HTTP 403 and it was not fetched.

REWise extracts original bytes without running the Windows installer.
`extracted/MAINDIR/` is the game's original run-file tree; `TEMP/`,
`UNINSTALL_PATH` and `GROUP_PATH/` retain installer support and website files.
These variable names are extraction labels, not literal installed Windows
paths. Static extraction does not perform the original installer actions.
The readme documents interactive double-click installation; additional
installer command-line arguments and any required installer cwd are unknown.

The original script sets the default directory to
`%PROGRAM_FILES%\Accolade\Redline Single Player Demo`. Its ordinary game
shortcut and finish-page launch target `%MAINDIR%\Redline.exe`, with empty
arguments and working directory `%MAINDIR%`. Therefore the corresponding
extracted-tree launch proposal is `Redline.exe`, cwd `R/extracted/MAINDIR`,
args empty. This is source-backed launch intent, not a successful launch.
The separate Mplayer shortcut targets `mplaynow.exe`; it is not the
single-player executable.

The script invokes the bundled `TEMP/DxDlg.dll` export `DirectXDlg`, creates
shortcuts, installation log and uninstall metadata, and offers desktop icon /
launch choices. `wise-script.log` retains the parsed original operations,
including the empty shortcut argument field and cwd. No installation replay,
registry/config fabrication, dependency replacement or patch was performed.

## Original prerequisites and ordinary first run

`MAINDIR/Readme.doc` and `Readme.rtf` identify a **January 28, 1999 single-player
and network demo**. They describe two training missions, Stadium City followed
by Yahoos, and multiplayer arenas MultiAirport / Triagonizer. This differs
from the Archive item's older multiplayer description. A numeric release
version for these actual bytes has not been established; the catalog's 0.90
label for another filename is not adopted as an executable version.

The original System Requirements section specifies Windows 95/98, AMD K6-2
233 or Pentium 200, 32 MB RAM, DirectX 6, compatible display and sound drivers,
and a 3D accelerator. It advertises 75 MB disk space, which is smaller than
the actual recovered run tree; use the measured sizes here for storage
planning. IPX LAN or TCP/IP is listed for multiplayer. The Installation
section calls its installer `REDLINEDEMO.EXE`; this name differs from the
mirror's `RLSPDEMO.EXE`, and no byte-identity claim is made for the former.
It says to follow the installer prompts and obtain DirectX 6 if missing.
The driver section says a DirectX installation requires a restart.

The documented first-run sequence is the original launcher, DISPLAY hardware
selection, then Play Redline. The launcher documentation recommends selecting
the primary display device for a combined 2D/3D card. It exposes resolution
and advanced options; none were selected or changed here. Then New Game
reaches the first mission according to the readme. These are instructions for
future ordinary use, not observed behavior. Arrow keys move/drive, Ctrl fires,
Space jumps on foot or brakes in a vehicle, and Delete/Page Down exits a
vehicle. The readme discourages editing `Redline.CFG`; no loose CFG is shipped
in this extracted tree and none was created. Any defaults inside `Redline.bgd`
remain untouched; its internal format was not unpacked.

Static PE imports of `Redline.exe`: `SHELL32`, `DDRAW`, `DINPUT`, `DSOUND`,
`WINMM`, `USER32`, `GDI32`, `ole32`, `WSOCK32`, `IFORCE2`, `ADVAPI32`,
`KERNEL32`. The bundled `IFORCE2.DLL` imports `KERNEL32` and `ole32`.
`DDRAW` imports include `DirectDrawCreate` / `DirectDrawEnumerateA`, and
`DINPUT` includes `DirectInputCreateA`. These are static import observations,
not a complete runtime dependency trace. Executable strings also state the
DirectX 6 and 3D acceleration requirements and name
`SOFTWARE\Beyond Games\Redline`; required initial registry values, if any,
remain unknown. No DirectX redistributable is present among the 65 members.
Authentic DirectX 6 installation and working 3D driver enumeration are the
first ordinary launch prerequisites to establish in any future runtime lane.
No native-DLL mapping or compatibility claim is made.

## Actual pins and validation

Recovered package SHA-256:
`e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c`.
Both catalog MD5 and SHA-1 matched the complete downloaded bytes.
`MAINDIR/Redline.exe` is a 1,828,864-byte PE32 i386 Windows GUI executable;
SHA-256 `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`.
Its COFF timestamp is 1999-01-28 02:05:18 UTC (a header field, not independent
release-date proof); preferred image base is `0x00400000`.

All **65 extracted files / 91,645,042 bytes** matched the pre-download Wise
table's paths and sizes. Every file's computed CRC32 matched the original
script, and REWise `-V` independently reported success for all 65 members.
The complete `MAINDIR/` run tree is **60 files / 91,406,857 bytes**, including
the original readmes, I-Force files, Mplayer support and 48 WAV files.
The main `Redline.bgd` container is 71,788,765 bytes; it was retained whole.
No original settings, bytes or filenames were modified.

`inventory.json` records path, size, SHA-256 and CRC32 for every file.
`inventory.sha256` uses sorted paths and canonical lines of the form
`SHA256`, two spaces, decimal byte size, two spaces, path, newline. Its
SHA-256 is
`08c55c1a9054ec7f0d8ceb717aa308d7bd338e7a542d3ffbde56965b353d82df`.
The full inventory is also pinned below so recovery does not depend on
ignored evidence surviving.

Evidence: `preflight.json`, `redlinedemo-metadata.json`, `range-metadata.json`,
`head-list.log`, `head-recheck.log`, `download-admission.json`, `download.json`,
`extract-admission.json`, `extraction.log`, `verify.log`, `wise-script.log`,
`redline-pe.txt`, `iforce-pe.txt`, `dxdlg-pe.txt`, original readmes and
`validation.json`. The DOC's printable strings were inspected statically;
neither document was opened in a GUI.

The first geo download and a sequential direct-server continuation were
terminated (own processes, exit 143) because of slow transfer. Four disjoint
HTTP 206 ranges completed the same file, with exact Content-Range/length
checks and final whole-file catalog hash verification. No second package
copy was retained. An attempted filtered extraction from only the head probe
failed with a parser/seek error and produced no payload; complete-package
extraction, full CRC verification and independent table checks passed.

At the completed extraction check, this task's logical files totaled
140,696,032 bytes and `/home` had 2,226,073,600 bytes free. Both download and
extraction had separate pre-write admission checks; downloads also checked
remaining extraction headroom while writing. Original predecessor files were
read only. No project build is required for this documentation-only commit.

## Recovery recipe

Use a newly owned, empty ignored run directory; never extract over an existing
fixture. Retain the whole original package, readmes and all run files. The
readme contains Accolade's copyright notice; no redistribution license was
established and no media was published.

Extractor: official REWise revision
[`c3d3b68903a90ec53ff7b0a4ae704adc6302814b`](https://codeberg.org/CYBERDEV/REWise/src/commit/c3d3b68903a90ec53ff7b0a4ae704adc6302814b),
source URL
`https://codeberg.org/CYBERDEV/REWise/archive/c3d3b68903a90ec53ff7b0a4ae704adc6302814b.tar.gz`,
1,724,088 bytes, SHA-256
`7f18fd53180cc4f9547fb62c232952b414b71e5c89286604751c898a91e447da`.
This task reused the existing verified source archive from
`scratch/runs/20261031T2253Z-rune-demo-media-resume/` without changing it,
copied its source/COPYING/README/Makefile into `R/rewise-source/`, and built a
small standalone extraction helper. Its local SHA-256 is
`8da810cf481dd17764854289aa28be727b34390e6d2b01e1320c8ca3668c6203`;
compiler-dependent helper identity is separate from game/package identity.
`extractor-source-pins.json` records every copied source file. The debug
variant built with `-DREWISE_DEBUG` supports `-z` for static script inspection.
No Windows installer or game code runs through REWise.

For fresh recovery, first recheck space. Allow at least 145 MB task headroom
for package, expanded payload, source and bounded evidence, while preserving
the 2 GB free-space floor and 200 MB task ceiling. Re-fetch the 64 KiB head
with HTTP 206 and confirm the exact expanded table before any full download.
Then use the stable package URL above; the metadata also advertises direct
server `https://ia801407.us.archive.org/19/items/RedlineDemo/RLSPDEMO.EXE`.
If endpoints change, read `/metadata/RedlineDemo` for current servers; require
the same package size and pins rather than trusting the filename.

Commands below assume `R` is that empty owned directory, the pinned source
has been verified and selectively extracted to `R/rewise-source/`, and fresh
download/disk checks have passed. Use bounded HTTP timeouts and size limits.

```sh
gcc -Wall -I"$R/rewise-source/src" \
  "$R"/rewise-source/src/{rewise,CP1252,print,reader,exefile,pkzip,wildcard,wisescript,wiseoverlay}.c \
  -o "$R/rewise" -lz
mkdir "$R/rewise-tmp"
curl --fail --location --max-time 60 --range 0-65535 \
  https://archive.org/download/RedlineDemo/RLSPDEMO.EXE \
  -o "$R/range-head.bin"
"$R/rewise" -l -p -t "$R/rewise-tmp" "$R/range-head.bin"
# Require 65 members / 91645042 bytes; repeat free-space admission.
curl --fail --location --max-time 600 --max-filesize 48229213 \
  https://archive.org/download/RedlineDemo/RLSPDEMO.EXE \
  -o "$R/RLSPDEMO.EXE"
# Require 48229213 bytes and package SHA-256 e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c.
sha256sum "$R/RLSPDEMO.EXE"
# Repeat free-space admission immediately before expansion.
mkdir "$R/extracted"
"$R/rewise" -x "$R/extracted" -p -t "$R/rewise-tmp" "$R/RLSPDEMO.EXE"
"$R/rewise" -V -p -t "$R/rewise-tmp" "$R/RLSPDEMO.EXE"
```

Compare every extracted path, size and SHA-256 with the table below.
The retained `R/check-media.py` additionally compares all original script
CRCs and recreates the canonical inventory digest. Its use in this run is
recorded in `validation.json`; that script is an evidence helper, not a
tracked runtime or app registration.

Next: preserve this fixture for a separately authorized ordinary installation
and first-run lane that establishes authentic DirectX 6 / 3D hardware support.
Installation side effects, generated settings, actual rendered output,
input, audio and gameplay remain untested. Runtime/Boat ID, state and expiry:
N/A; no lifecycle ownership was acquired.

## Complete extracted file pins

Paths below are relative to `R/extracted/`. All hashes are SHA-256.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `GROUP_PATH/Accolade Website.url` | 51 | `fd1eca0f4e9d0aab1a7a2b01cebaf1f353d463c9fe845dad8f9f382eeda0f95a` |
| `GROUP_PATH/BeyondGames Website.url` | 54 | `44768e854571fd9092b9e6067dd89572d984fc032fa552467a087f480710313f` |
| `MAINDIR/IFORCE2.DLL` | 68608 | `13df61b255529952085af6812890ff824245479513a5a610b81cb5edca4a7ad1` |
| `MAINDIR/Mplaynow.ini` | 222 | `0b3350903136d46aa6395a4db2598ec144b108f38aab3d22aab833d8a0a18ecb` |
| `MAINDIR/Mplaynow/Mplayer/setup.EXE` | 1038780 | `d08aa48938b4577f4b6e93d1be3613266300ddef020cb37933d6bf3397ed9004` |
| `MAINDIR/Mplaynow/Mpnetsue.exe` | 10112 | `af605d85dd58e8f00c8970e28cfea4a92e8c9eb4842559b4172e9947a1fc69b8` |
| `MAINDIR/Mplaynow/Rnaph.dll` | 9728 | `a72e6d59937affc14ceaf55bd5663968c4e78c1399d45c55283552e23a8a86be` |
| `MAINDIR/Mplaynow/Url.dll` | 87552 | `b00a7034f2e34350f9c2efd402f786716994fee98d7ae26c9b0ff59dfa8c1fa5` |
| `MAINDIR/Readme.doc` | 89600 | `a31bb6fbe7086b6128c8f6af0a77e7e97625a947396c8eacbd15f04500ae6828` |
| `MAINDIR/Readme.rtf` | 65275 | `4b91a429ada240d65a3ddc577842766397abb026c817e8c9204dfcb44023b02c` |
| `MAINDIR/Redline.bgd` | 71788765 | `840dc1421e88708bb64de686e6a996e2638c27693b25ecdb54237824c64808aa` |
| `MAINDIR/Redline.exe` | 1828864 | `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e` |
| `MAINDIR/mplaynow.exe` | 273408 | `ae9577e276413b5635194521417f01919b799f33b287bcbaaa458ed99baada00` |
| `MAINDIR/redline.ifr` | 1217 | `b3e9f558349f50beff05b7f87efc0730b5f7e04e5516999a29bcf32b7140d82a` |
| `MAINDIR/wav/CrowdPanic2.wav` | 440378 | `f9a2680dbeda57031f497c98ae4ce56e53c24abc939c69c0306b80a16e624bf6` |
| `MAINDIR/wav/EnviroGrowl.wav` | 459566 | `e961f27ca0431eae28695111971b246c96efa5b0e0b9bac2666eb0f29106a47f` |
| `MAINDIR/wav/EnviroHall.wav` | 84090 | `38fb370728a5af3b8325effa05974baa331521aa568e2c2291b5dfb48f205aad` |
| `MAINDIR/wav/RantGrowl.wav` | 210160 | `7cb94ab93831f66d7b51c92e6fa4e6e3e3f6d9f9e132b6e118a202b6c85452b7` |
| `MAINDIR/wav/Stad1st_01.wav` | 633978 | `8cbb5a87e5b158404a24ec7add3f351b3c0ba2a2bc7552624079883556a27adf` |
| `MAINDIR/wav/Stad1st_02.wav` | 469382 | `19391bf8d8230a3943478560085f2dda6e77e83829df76e9ca10c3e140ac799f` |
| `MAINDIR/wav/Stad1st_03.wav` | 370394 | `b5495309afc9f345872093815e8c2415731e66fc91b29b6f7c3662359edb3c82` |
| `MAINDIR/wav/Stad1st_05.wav` | 937328 | `fdb32af0176127a1371e5648a7b9e55984dbd76f29885f4652073c3990a0e8cd` |
| `MAINDIR/wav/Tox5.wav` | 121614 | `db5874dcb6b12a48ea93cbafa3f3f35d452e0e918d3d488aab92bba84e679c6a` |
| `MAINDIR/wav/YahooIntro.wav` | 1503280 | `3b945517ba1373e3bf092bbfa04ba4c157b7093b5e86c593d99fd93f2695ed7f` |
| `MAINDIR/wav/flameboom.wav` | 101840 | `581a38591f569a1e14309326e0a3f4858eb2731644255acbe7d799e20d31d7f4` |
| `MAINDIR/wav/howlingchamber.wav` | 283838 | `da65e0c34b146776bdd2e250120e7077b305993f698ddc7130d8de98fa4fdab8` |
| `MAINDIR/wav/hub0.wav` | 1478300 | `a5f6244ae720a03cd58bad3bd9d8a012c89d17241bc1b38b82359956d292d1fa` |
| `MAINDIR/wav/hub0_1a.wav` | 281104 | `146421e0296f693c6149d2592122eb6f6bd5d0b5304325967d29fa5936d4a080` |
| `MAINDIR/wav/hub0_1b.wav` | 221042 | `9829322e53ef3e006a252d4df621e275adddc84ac2ff2d85374cf875c1b9f162` |
| `MAINDIR/wav/hub0_1c.wav` | 512144 | `4db534b2034689026f4dfaf2e517415ff9712faee460883a6cebbef16454e394` |
| `MAINDIR/wav/hub0_2.wav` | 317578 | `e076757e5c1cb1316c1de9428718cadc257065d12708a28455e576f4790dfe37` |
| `MAINDIR/wav/hub0_3.wav` | 133240 | `dfd54ea955d760baa4c0cbe9ea1cc848628d640d03aaaa04aecf41dde068b834` |
| `MAINDIR/wav/hub2.wav` | 143116 | `db0dd776bdc9d7199124113017dc6db3fe6ab7cc30214fec8c00d36972853b70` |
| `MAINDIR/wav/rumble1.wav` | 79178 | `d76441e1a2a13560ee59e8d93ac61bffc479c369ef629a82b8c7c3fb52b09ac7` |
| `MAINDIR/wav/stadSong2.wav` | 976712 | `afcd3138b42ad0eff7d2679b4612d7f22db420a438906984036b9c436abf4c8b` |
| `MAINDIR/wav/stadSong3.wav` | 941132 | `f4d10d9d2a9ff884f129dc1323a0b4ee33f5c77640fbd2ed70b9b6a0c133fa0b` |
| `MAINDIR/wav/stadium10.wav` | 82810 | `63069fbebe883e9ac9d5dc695304cae854a72107c6a836e2d047d43ccd480b18` |
| `MAINDIR/wav/stadium11.wav` | 59580 | `de140fd5224548b264cfb27c3a014da414a3e7699508b993a52c4ea641d40baf` |
| `MAINDIR/wav/stadium13.wav` | 39542 | `a92a4fbba37b5c2fa0b42f691d7a50c313283f89c533c484a0be8cd097df4fed` |
| `MAINDIR/wav/stadium14.wav` | 93182 | `4bda00558b16fded36c3ce05e9520fd11a5c2b67f437e926f33aa7902c6912d6` |
| `MAINDIR/wav/stadium9.wav` | 328782 | `17bcecc84f50f46666f7c70a979b3b1f1e389403df2daf1a82b25b01dfd8e771` |
| `MAINDIR/wav/windLoop.wav` | 203646 | `f02df070838380f1d0d863019074d837a069a212e5955b0113e93db5448727d1` |
| `MAINDIR/wav/yahoos1.wav` | 191992 | `2fd9a7d586d444d7f659452b0ddcd8ffe091bb268cad259c4d19003d90e4b4db` |
| `MAINDIR/wav/yahoos10.wav` | 285420 | `cfa5918fcc323907db3bf72137ed51ad6cc3648d9784de11391625898de2e21c` |
| `MAINDIR/wav/yahoos11.wav` | 125992 | `7b689566e1cc2b7620855b470b2a89faa68f6047daccebf2a0e550ab139e7d1e` |
| `MAINDIR/wav/yahoos12.wav` | 390534 | `eab2a77ce713df632edf5c79964d992cc1a99eacec07703e0174488877e8b8d4` |
| `MAINDIR/wav/yahoos13.wav` | 248852 | `d5f7ea6c9adc8d56fbcac71677d99100d7edadae113dae5782c12a2d779c288e` |
| `MAINDIR/wav/yahoos14.wav` | 206832 | `a7b73623cdeacfa1a9cbbf7d8f50eb400a9d48c7a135bf00cb98ed48048f49ac` |
| `MAINDIR/wav/yahoos15.wav` | 143336 | `337f6183f64c0816c37bedccbbf9e3c7cabecdf09ba94aad8c8c5b8e48de9c18` |
| `MAINDIR/wav/yahoos16.wav` | 96412 | `5466b8eb989f831fbf2c52f1ee53ee99c76f96a63c3de52a8d26df718baac6e6` |
| `MAINDIR/wav/yahoos17.wav` | 226276 | `7069447dff1a536f55b8d10ab693b78e66a7b163be3c3de72649c1c2e4c65b58` |
| `MAINDIR/wav/yahoos18.wav` | 197108 | `ef283b662a49fa1033bd3a3c0d5d154ead15e18f034c36b9f81dc8ac0830edff` |
| `MAINDIR/wav/yahoos19.wav` | 126488 | `b8bc5303b7c7c0e222e31260db7fc81de794f4ae845e370093b579577504b76b` |
| `MAINDIR/wav/yahoos20.wav` | 57720 | `fe43778dcb52faf2b1ffc0d57ee460ef28ef13526c254455f3ba075ab4ae73a1` |
| `MAINDIR/wav/yahoos3.wav` | 117780 | `2ec99501277ff7530c8c3725841a1c5e93f2d529972da5b17046966e87a5c7c1` |
| `MAINDIR/wav/yahoos4.wav` | 70020 | `722b8973ff8fa8a090f716fe86b5314e0dc7096b2671a1e4682e8316ae6314ca` |
| `MAINDIR/wav/yahoos5.wav` | 114552 | `ed88a8aa13a34bafc6fa85bf21ae989763db3c38f02543732b70b3045924adc7` |
| `MAINDIR/wav/yahoos6.wav` | 356360 | `4bd895a778ca10ab225a0992afcbc4b75ec4e56985cc74153d855ccfa382da64` |
| `MAINDIR/wav/yahoos7.wav` | 79664 | `575e8066556a5c21eb447efdceea496a25401b072862839f4dd5e46670fa2ba7` |
| `MAINDIR/wav/yahoos8.wav` | 341780 | `7d71097d71f41fa39a24a59d3ed3b7eae10f881f12933ace7c18143f9228e306` |
| `MAINDIR/wav/yahoos9.wav` | 325596 | `6dfb5560d7fc8d9a1a126419bb1a7e81ba2b0a91f3f267ce4484fe150169819a` |
| `MAINDIR/wav/yahoosexp.wav` | 935076 | `93836f5a2459875d684e218ae055d2b2798ad326d489c3e9106e3daa03916379` |
| `TEMP/DxDlg.dll` | 80896 | `a17daf20e9abcc519d0ecb53ce5dc8c37515e4eeffee2a89213b55991456a69d` |
| `TEMP/W32INST_PATH_` | 8704 | `3e0c4e282a232b65f22911a4ab25c7b8f84660dc52a2a2bc4f1a90892ad02472` |
| `UNINSTALL_PATH` | 148480 | `a2b6c24d41b3837f2979029c403a451d3946c4ab2cbf1e05e85066e39df551ec` |
