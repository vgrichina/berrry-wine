# Crimsonland: exact missing Win98 SE USER.EXE input

Run `scratch/runs/20261107-crimsonland-win9x-resource/` narrows the original
DX81 setup **-9** blocker to an already documented, currently absent stock
Windows fixture. No authentic resource bytes were found, and no emulator
resource-lookup defect was demonstrated. No engine or guest change is justified
by this audit. Original setup and subsequent gameplay screenshots remain pending.

## Exact recovery target

The existing [DLL source ledger](../../test/binaries/dlls/SOURCES.md#win16-system-modules-from-windows-98-se-oem-ordinal-resolution)
records an authentic USER module extracted on August 16 for ordinal resolution:

| Input | Recorded identity |
| --- | --- |
| Original file | `scratch/win16-system/user.exe`, **549,664 bytes** |
| SHA-256 | `fe4bedde380982f81e12d73de6a87d65fb21e9dba76f714c74bbd4d4e8bfad53` |
| Source media | `Microsoft Windows 98 Second Edition OEM [X05-29232].iso`, **655,591,424 bytes** |
| Media SHA-1 | `fa040cd3f7fd472e9612b1721bc72d7b82538450` |
| Extraction | `WIN98/BASE4.CAB`, continued cabinet set with `WIN98_21.CAB` through `WIN98_74.CAB` present |
| Required guest mapping | `C:\WINDOWS\SYSTEM\USER.EXE` |

This is a historical fixture pin, **not a fresh hash of available authentic
bytes**. The source ledger treats these stock OS files as local-only, with no
redistribution permission established. Use retained licensed media or the
owner's lawful local installation; do not put this OS binary in a public
deployment. This investigation did not download or open an archive.

Once that local input is available, the ledger's narrow extraction recipe is:

```sh
# From the media's WIN98 directory, with the continued CAB set present.
cabextract -q -d "$DEST" -F user.exe BASE4.CAB
sha256sum "$DEST/user.exe"
```

Require the size/hash above before using this historical recipe's output.
Preserve the whole file and its original NE resource bytes. The precise
physical CAB containing the member is not established here; BASE4.CAB is the
documented chain entry, not a claim that the data resides in that one cabinet.
The original language/codepage and fixed version remain unmeasured until the
file is recovered. Do not fill them from assumptions about English Windows.

## Retained-input evidence

The documented paths `scratch/win16-system/user.exe`, `scratch/win98se.iso`
and `scratch/win98cabs` are absent. A metadata scan examined 466,621 files
under `/home/user`, excluding sessions/config/cache/dependencies, symlinks and
Army Men staging. It found **no file of 549,664 bytes**, no matching authentic
USER digest, and no named Win9x base media under its filename rules. All five
loose USER.EXE files in that scope are the same 147-byte placeholder, SHA-256
`981d0de5c3052108052074d418e9202ad8010b1fe3f047f986569206c2d6498d`.
`retained-inputs.json` records the exact scope and zero traversal errors; this
does not exclude an arbitrarily named member inside an uninspected archive.

Existing Army Men and Jedi recovery manifests likewise identify the 147-byte
placeholder, including Jedi's content-addressed payload name. Their resource
references do not point to an omitted authentic OS file. The predecessor's
20-copy inventory covers the excluded staging copies; it was read, not rerun.
`manifest-references.json` retains the relevant small ledger excerpts.
`tools/gen_win16_ordinals.js` still names the absent `scratch/win16-system/`
input. Its committed ordinal-name JSON cannot reconstruct an executable or
its version/language resource.

## Original failure versus implementation

The original setup trace and native log from
`20261107-crimsonland-authentic-installed-state` were reused, without running
setup again. `setup-contract.json` pins those records and `dsetup32.dll`.
Small additional disassemblies and PE-decoded strings establish:

1. `0x408b04` calls GetSystemDirectoryA; recorded result 17 supplies
   `C:\WINDOWS\SYSTEM`. Original code appends `\user.exe` and calls
   GetLangCodePage at `0x4068f1`.
2. `0x406906` calls GetFileVersionInfoSizeA through thunk `0x4155be`, IAT
   `0x401248`. Recorded API749 returns zero to relocated `0x013ad90b`, original
   `0x40690b`. The helper logs `GetFileVersionInfoSize Failed!`, returns zero,
   and `0x408b46` branches to the caller's **-9** result. The native log's
   `Error = 0` does not establish a successful resource lookup.
3. The later, **unexecuted** success path allocates/locks the returned size,
   calls GetFileVersionInfoA (`0x4155b8`, IAT `0x401244`), then VerQueryValueA
   (`0x4155b2`, IAT `0x40124c`). Its literal at `0x401808` is exactly
   `\VarFileInfo\Translation`. At `0x406a08` it reads the first returned DWORD
   into the output: language WORD followed by codepage WORD. This helper does
   not compare a fixed file-version number. Other setup requirements remain
   unexecuted.

Current `lib/process-boot.js` explicitly generates USER.EXE via
`win16ModuleStub('USER')`. Its NE resource-table and resident-name offsets
both equal 64: **there is no resource table to resolve**. The mount skips an
already existing exact VFS key, and `mountSystemDataFiles` can subsequently
set supplied file bytes. An authentic file at the exact system path therefore
has a supported mapping; there is no hidden original resource in this stub.
This is static implementation analysis, not a newly tested authentic mount.

In `src/09a1-comctl-handlers.wat`, the ANSI VERSION handlers delegate to
`file_version_info_size_named` / `file_version_info_named` / `version_query`,
with stdcall cleanup of 12 / 20 / 20 bytes. `version_open_file` treats the
drive-qualified filename as explicit and opens read-only, OPEN_EXISTING.
`lib/filesystem.js` normalizes paths and looks up the exact VFS file, without
basename substitution. `file_version_resource` detects NE and delegates to
`version_ne_resource`; its `end <= start` check rejects this empty resource
table. The size helper consequently returns zero. No PE-only parser limitation,
case mismatch, static-handle shadowing, or absent-file search fallback is
needed to explain the observed return.

For genuine NE bytes, the parser seeks type `0x8010` and reads the original
shifted file range. The VERSION tree code recognizes ANSI NE keys, walks
`VarFileInfo\Translation`, and returns a binary pointer into the caller's
buffer with its byte count. That matches the next original call's shape;
compatibility with the **missing authentic USER.EXE** is still untested.
The predecessor's successful D3D8 resource fixture is inherited evidence only;
neither it nor the already passing controls/media recovery were rerun.

## Validation and next step

Only the new read-only audit ran: source/evidence hashes, retained-file
size/hash inventory, manifest excerpts, original PE string decoding and small
disassemblies. No API fixture, original runtime, build, archive extraction,
download, box or gameplay input ran. Source identity is recorded by Git SHA
and relevant binary diff; owned new script/note patches accompany the tiny
evidence. Free space fell from 2,778,402,816 to 1,283,014,656 bytes while this
task was running, so the owner 2GB floor also prohibits a build/runtime retry.
No code WIP or build is needed for this documentation-only result.

Next recover the exact locally permitted OS input above, mount it unchanged
at the required guest path, and verify its actual NE Translation through the
real VERSION API before continuing **original DXSETUP**. Retain actual copy,
deletion, registration and restart effects. Only after setup completes should
the original Crimsonland launcher and gameplay screenshots be attempted.
No fabricated translation/version, detector-only component mount or setup
patch is proposed. Box ID/state/expiry: N/A; no runtime ownership to hand back.
