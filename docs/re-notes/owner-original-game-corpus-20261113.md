# Requested original games: corpus intake

Owner Telegram 187 clarified the linked post on 2026-11-13: **The Incredible
Machine, original Worms, and The Neverhood**. These are separate from the
registered Worms 2 and Worms Armageddon demos. No matching originals were found
in the current candidate/DOS manifests or app registry. This is an intake record,
not a claim that the games are installed or playable.

Evidence: `scratch/runs/20261113-coordinator-owner186-corpus/`.

## The Incredible Machine

All 11 ordinary floppy payloads (732,298 bytes), both FATs and the complete archive/image identities are now verified. See [full manifest and recovery recipe](incredible-machine-original-floppy-intake-20261113.md).

The downloaded archive was checked in temporary RAM storage, without installing
or running it. Its FAT12 floppy contains `TIM.EXE`, `INSTALL.COM`,
`RESOURCE.MAP`, `RESOURCE.001` through `.004`, three `.TIM` files and `READ.ME`.
The release notes identify The Incredible Machine version 1.0. This verifies the
package's contents and self-identification, not independent publisher provenance.

- Source: <https://archive.org/details/000821-TheIncredibleMachine>
- Download: <https://archive.org/download/000821-TheIncredibleMachine/000821_the_incredible_machine.7z>
- Archive: 429,273 bytes; SHA-1 `3ca8f05a94afdf1766a99f25f5457fc9a4f4d17b`.
- Member: `000821_the_incredible_machine/disk1.img`, 1,474,560 bytes.
- `TIM.EXE`: 111,951 bytes; SHA-256 `34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
- Executable starts MZ and has no PE signature. Preserve the DOS route distinction;
  do not register it as a Windows PE app.

Recovery: download and verify the archive identity above, extract the named image
with `7z e`, then extract the FAT image with `7z x`. Preserve the entire companion
tree. The run's `tim-package-listing.json`, `tim-floppy-layout.json`, and
`tim-executable-identity.json` record the inspected bytes and release notes.
Temporary RAM copies are disposable; the package recipe is the recovery source.

The [original DOS launch contract](incredible-machine-original-dos-launch-contract-20261113.md) now establishes INSTALL.COM configuration/copy followed by EXEC of the unchanged packed TIM.EXE and all 159 resource records. ToyVM has the underlying COM/MZ/EXEC and FAT12 mechanisms; an initial A: installer route is being prepared as unexecuted WIP.

Next: once capacity permits, observe ordinary original installation and its generated configuration, preserve the full installed output and recovery checks, then test original puzzle input and capture the actual result. L1 identifies basketball-through-hoop, but neither startup nor gameplay has been tested.

## Worms (original)

The complete 578,432,064-byte mixed-mode CD candidate and 401-byte cue are now verified. Image SHA-256: `e353ccf735d26f2c56d87614ab26f700f2ee5dfb79dd1848c18208276ff5d888`. All 68 ordinary files, 14 directories and nine raw track spans were inspected; retain the eight audio tracks. WORMS.EXE/WRMS.EXE establish the DOS/protected-mode candidate route. See [complete identity and recovery recipe](worms-original-cd-intake-20261113.md).

No media was installed or executed. Publisher authenticity and full retail identity remain unproven. The [original DOS launch contract](worms-original-dos-launch-contract-20261113.md) now identifies the generated SETUP.CFG and MZ/overlay-to-DOS4GW/LE chain. Current ToyVM has MZ/overlay paths but lacks MSCDEX, CD mounting and CDDA; extracted files alone do not establish the required CD semantics. These are static capability findings, not observed startup failure. Next: the original installation contract and required device support, then a recoverable DOS corpus entry and actual original-game turn. Worms 2 and Armageddon demos do not satisfy this request.

## The Neverhood

The complete 651,438,080-byte ISO is now stream-verified, including all 257 ordinary files and seven DATA BLBs totaling 638,122,574 bytes. Image SHA-256: `94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3`; provider SHA-1/MD5 match. See [complete identity, executable/asset closure and recovery recipe](neverhood-original-cd-intake-20261113.md).

SETUP/NHC.EXE is the x86 native game candidate; root SETUP.EXE is an NE installer. The matching Smacker DLL is fully hashed. README requires installation and CD access during play. No installer/game ran, no media was staged, and installed configuration/asset behavior remains unverified. Next: establish that contract, add the recoverable corpus entry and test original-game interaction.

## Capacity and completion

Heavy runtime and local media staging remain gated by the owner's requirement
to keep `/home` free space above 1.5 GB. No filesystem reserve change has been
approved or applied. Metadata and temporary RAM inspection do not establish local
corpus availability. All three requested original-game gameplay outcomes remain
open; no public deployment is involved.
