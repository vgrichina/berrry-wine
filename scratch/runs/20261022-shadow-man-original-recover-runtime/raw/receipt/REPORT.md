# READY-FOR-REMOTE-RECOVERY

Task NEW-GAME-SHADOW-MAN-DEMO-20261013, 2026-10-22. Source acquisition only; no installer, runtime, compute, engine change, or deployment. `acceptedInGuest=false`. Coordinator assigns the next serialized installation/runtime task and owns compute shutdown. No box assigned or accessed here.

## Fresh source evidence

- [Archive item](https://archive.org/details/gsscda1999) and [metadata](https://archive.org/metadata/gsscda1999): HTTP 200, saved bodies and response records in `archive-*.body` and `http-initial.json`. This is GameStar's archived cover disc, uploaded by a third party; Archive metadata is not publisher certification.
- Exact media: [1999-11/GS1199.iso](https://archive.org/download/gsscda1999/1999-11/GS1199.iso), **674,328,576 bytes**, Joliet volume **GS1199A**. Metadata SHA-1 `f985ca1349af958f886957aa662e87956a7db22d`, MD5 `b7183c0705623a62c9f8e20d0cbd006a`, CRC32 `da943d86`. These are metadata hashes, not fresh full-image hashes. No ISO SHA-256 known yet. `GS1199B.iso` is a different disc and is not the source.
- **16 HTTP 206 ranges, 287,178 body bytes total**, with exact Content-Range/total-length validation. Each request's final Archive storage URL, headers, timestamp and range SHA-256 are saved in `ranges/*.json`; corresponding `.bin` files permit offline reproduction. No invented member-download endpoint was used. These range hashes do not authenticate the unsampled ISO bytes.
- Root/Demos directory records locate **`Demos/Shadowman`**, extent 96, offset 196,608, directory length 2,048. Complete directory enumeration gives **23 regular files, 73,339,636 bytes, zero child directories or multi-extent records**. See `listing-*.json` and `closure.json` for every exact case-sensitive name, extent, byte offset, length, flags and known/unknown hash. All 23 are the installer source closure; `Setup.exe` alone is insufficient.
- Fresh entire-member bytes were recovered for ten small files, including `Setup.exe` (73,728 bytes; SHA-256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`) and `data1.hdr` (152,916 bytes; SHA-256 `a54b1f41509c26ee9c7cd7ca15ba7d85b40ecafc5a830766595d180de5dad5c4`). `closure.json` records their fresh SHA-1 and SHA-256. **`data1.cab` (67,648,523 bytes) and the other 12 unsampled files have unknown current member hashes**. There is no claim of freshly recovered/extracted game payload.

On-disc `Info.rtf` identifies “Shadow Man (dt.)”, a completely German demo, 97 MByte disk requirement and Direct3D-only configuration. `setup.lid` declares only language 0007; `SETUP.INI` names ShadowMan. The original readme requires Windows-era 3D drivers and **DirectX 6.1 or later**. It also contains retail installation sizes; those are not measured demo sizes. The fresh `data1.hdr` contains `ShadowMan.exe`, `Mss32.dll`, `D3DConfigUtility.exe` and nested `Data` paths; their bytes/imports remain unverified. Preserve InstallShield `_sys1.*`, `_user1.*`, `_inst32i.ex_`, `_Setup.dll`, language/OS/layout/script resources, `iv5setup.exe` and all other listed files. Do not assume codec/support files are optional.

The same disc has **`Diverses/Directx6/Dx61ger.exe`**, extent 291637, offset 597272576, **7,014,176 bytes**; current member hash unknown, no payload downloaded. Its name and location support retaining it as the disc's DirectX distribution; version contents and actual installer dependency reachability are not freshly verified. Keeping the entire verified ISO preserves any additional parent-disc dependencies. No alternate mirror search was needed.

## Reproduction and next recovery

Local evidence replay (Python 3 standard library):

```sh
python3 probe.py --offline --walk Demos/Shadowman
python3 verify.py
```

`probe.py` can repeat the bounded live directory probes without `--offline`; cached ranges are reused. It fails closed on HTTP 200, unexpected Content-Range, oversized/short responses, directory endian disagreement, or its 8 MiB range budget. Run in a fresh receipt copy to request all ranges anew. Recorded small-member ranges are raw bytes, not filesystem extraction.

Only after coordinator allocation, copy this complete receipt directory to the assigned remote. Host dependencies: Bash, coreutils, curl with trusted HTTPS CA roots, Python 3.11+ (`hashlib.file_digest`), 7-Zip with ISO/Joliet support; **unshield 1.5.1** for subsequent native InstallShield inspection (local tool version observed). No package installation or remote tool check occurred here.

```sh
bash recover-source.sh --coordinator-assigned-remote /absolute/new/shadow-man-source
```

The helper performs a finite 20-minute, no-retry full ISO download, exact byte count and whole-image metadata SHA-1 match, records a fresh SHA-256, lists the ISO, and uses **`7z x`**, preserving hierarchy and names, to extract all of `Demos/Shadowman/*` and `Diverses/Directx6/*`. It verifies the exact 23-file set, every size and all ten fresh member hashes, and records newly recovered hashes for the entire source closure. A name/case/size/hash mismatch stops recovery. HTTP ranges were tested; the large download and 7-Zip extraction commands are a remote recipe, not a locally executed extraction claim. Keep the ISO until installer completion so unanticipated disc references remain recoverable.

For the following native inspection, not installation, on that assigned host:

```sh
unshield l source/Demos/Shadowman/data1.cab > native-file-list.txt
timeout --signal=TERM --kill-after=10s 300s unshield t source/Demos/Shadowman/data1.cab > native-test.txt
timeout --signal=TERM --kill-after=10s 300s unshield -d native x source/Demos/Shadowman/data1.cab > native-extract.txt
```

Preserve unshield group/directory hierarchy; do not use flattening `-j`, lowercase `-L`, or fabricate `Grafix.cfg`/registry values. Enumerate and hash outputs; compare counts/sizes against the archive listing. Native extraction diagnoses file closure and does not replace original Setup. If the historical 1,959 files / 100,354,053 bytes differs, record the actual delta and investigate before runtime. Do not substitute a flat extracted EXE for the original installer source.

Projected remote disk, excluding already installed engine/browser/tools: ISO 674,328,576 + source 73,339,636 + DirectX 7,014,176 = **754,682,388 bytes**; two native/installed demo copies using historical size add 200,708,106; 16 MiB logs plus 512 MiB temporary allowance gives **1,509,038,622 bytes**. Admit **2 GiB additional allocation**, plus **2,982,150,144 bytes free reserve**; helper requires at least **5,129,633,792 free bytes**. Native/installed sizes and temporary allowance are projections, not guaranteed upper bounds: remeasure after recovery, before materializing another copy or installer expansion. Build artifacts/new packages would need separate coordinator admission.

Finite next-task acceptance gate: whole ISO/hash and source verification first; native closure and fresh import/support inventory second; then only with coordinator's serialized runtime grant, original Setup from its intact directory, ordinary German language/welcome/authorized Ja path, maximum 240 seconds per stage with external TERM at 255/KILL at 260 and owned-process cleanup. Record actual guest acceptance separately. Require real installed registry/config state, original 3D configuration, menu -> Neues Abenteuer -> visible gameplay with ordinary movement/action and reviewed screenshot plus source/build/input identity. Stop and report the first concrete fault or finite timeout; no fabricated install state, memory patches, or silent stubs. This is an acceptance plan, not a grant or a claim of gameplay. Coordinator retains shutdown ownership.

## Historical provenance and limits

At base `63d563df7a2b901d222a311ceaf55a0823a22261`, committed task/readiness/reconciliation excerpts are preserved in `historical-*.json`; root append-only board entries in `historical-board.txt`. Historical claims: publisher November 1999 CD index matched this Archive image; full ISO SHA-1 verified remotely; unshield recovered 1,959 files / 100,354,053 bytes; actual engine/setup reached the German license screen on October 13 with no acceptance. The old detailed scratch receipts and captures are absent locally, and no old box was resumed or accessed. Fresh on-disc Info.rtf corroborates German demo identity, but the historical web publisher index was not freshly recovered. Historical EXE/import/runtime claims are not refreshed by this source-only probe. Authorization `docs/license-acceptance-authorization-20261018.json` persists; actual guest acceptance remains false.

Fresh verification: offline raw directory replay, all 16 range seals, exact source set/size arithmetic and ten entire-member hashes pass. Recovery helper receives Bash syntax and argument-guard checks only; no full recovery or installer execution. No main merge, no protected root index/config/WIP/TODOS/STATUS edits. Live process 164732 exposed gpt-6.1-sol medium and 200000 total compaction launch arguments; no threshold crossing claimed.
