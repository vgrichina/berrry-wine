# The Neverhood original CD candidate intake (2026-11-13)

The complete candidate image was streamed through a bounded reader, without saving media or executing the installer/game. All 257 ordinary ISO files were fully hashed. This verifies candidate bytes and closure; publisher authenticity, installed availability and gameplay remain unproven.

Source: <https://archive.org/details/neverhood_202508>. Exact image: <https://archive.org/download/neverhood_202508/Neverhood.iso>.

- Image length: 651,438,080 bytes.
- SHA-256: `94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3`.
- SHA-1: `4e4314440c98083cd4477f806525a0182f01f2c2`.
- MD5: `5c1dc1c566cd235362f0af14eb994536`.

The full SHA-1 and MD5 match provider metadata. HTTP returned 200 with the exact Content-Length and identity encoding. The reader used 1 MiB chunks, updated every overlapping ISO file extent and required exact per-file byte counts. Volume `Neverhood` has 257 ordinary files and 15 directories. Whole-image hashing also covers metadata, padding and all bytes outside payload extents.

## Executable and asset closure

| Path | Bytes | Full SHA-256 |
| --- | ---: | --- |
| `DATA/A.BLB` | 50571893 | `757e0ec9d987daa7c1766e9152829897e175878950721df4421b3e8f72a86365` |
| `DATA/C.BLB` | 241856188 | `745221b48c904b81b6cc0a4b05d890c5a92930141bde3e8f51615703996b2d50` |
| `DATA/HD.BLB` | 4279716 | `a4e2748182162272403b52e018285a6999acc6af938ca17f1a6bc5b01cb6727c` |
| `DATA/I.BLB` | 42015045 | `ef26069547aeb5caaf59b68a476884e7f087c1602f4d953e090a7181639603d5` |
| `DATA/M.BLB` | 53797472 | `8fdfd6be1c55d6a8b1c7d9eb587ad7d2f4d3ba7cd95aabc3babd8cca3c0e816e` |
| `DATA/S.BLB` | 16622792 | `c7d788e4fb732180815c47b6885fcece547909c519f67f174639f62d1e1f4abe` |
| `DATA/T.BLB` | 228979468 | `06dab5b722594e395b74aa542756dba1eb9581367d9ff64d1f7773e7807adb6f` |
| `SETUP.EXE` | 5904 | `b140041bdcf2eedc266f92acd05597f921e877c8605dc62dc8c3597e76528cb8` |
| `README.TXT` | 10955 | `67d23ea0523aaf4fbc7de528f646a677b29d1c365fca3ba2311d9b7e71d26c0c` |
| `SETUP/NHC.EXE` | 810496 | `82bf1e31ad6c811a4915f49da1a5ea841cc23b37b0ee212c6d90fddbba97d011` |
| `SETUP/SMACKW32.DLL` | 66048 | `3f21682e8b2eb3ce69f776be0ef84d8bb13c295da885d509329f4f873517ae0e` |
| `SETUP95.EXE` | 202240 | `ceae7885f49569fdc1100870286634c36d05eabe6010c228efef214c9444a95e` |

The seven DATA BLBs total 638,122,574 bytes. Their full bytes, and the matching Smacker DLL, are now hash-verified. Earlier bounded reads of NHC.EXE and README agree with this full pass.

Root SETUP.EXE is an NE installer; SETUP95.EXE and SETUP/NHC.EXE are x86 PE files. NHC.EXE is the native game candidate. Its 121 named imports were registered in the previously inspected API table; eight Smacker ordinal imports require the matching DLL. Presence and registration do not establish behavioral compatibility.

README requires installation and the CD during play. Preserve the complete CD and installer/configuration contract; a discovered EXE path alone does not establish a complete runnable entry. No installer, executable, emulator, browser or box ran in this intake.

## Recovery and evidence

Evidence: `scratch/runs/20261113-coordinator-neverhood-stream-0820/`. `manifest.json` records all 257 paths, extents, sizes and complete SHA-256 hashes; `verify.py` is the bounded stream reader; `stream.log`, `progress.json` and `result.json` record its successful terminal pass. Layout input is `scratch/runs/20261113-coordinator-owner187-cd-layout/neverhood-layout.json`. Git records source; no source/media archive was created.

When capacity permits full media staging, download the exact URL with a finite timeout and no denied-operation retry, require the length and full SHA-256 above before use, inspect with `7z l -slt Neverhood.iso`, and extract with `7z x Neverhood.iso`. Retain the complete installation/CD tree and verify extracted payloads against the manifest. The image SHA-256 is the durable recovery identity even if ignored local metadata is unavailable. Do not stage this 651 MB image under the present capacity hold.

Next: establish the installed native executable/configuration/asset contract, add a recoverable corpus entry, then test original-game interaction and capture actual results. No public deployment is involved.
