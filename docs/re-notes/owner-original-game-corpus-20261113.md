# Requested original games: corpus intake

Owner Telegram 187 clarified the linked post on 2026-11-13: **The Incredible
Machine, original Worms, and The Neverhood**. These are separate from the
registered Worms 2 and Worms Armageddon demos. No matching originals were found
in the current candidate/DOS manifests or app registry. This is an intake record,
not a claim that the games are installed or playable.

Evidence: `scratch/runs/20261113-coordinator-owner186-corpus/`.

## The Incredible Machine

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

Next: once host capacity permits, stage the complete original tree, add its
verified DOS corpus entry and recovery checks, then test original puzzle input
and capture the actual result. Neither startup nor gameplay has been tested.

## Worms (original)

Candidate listing: <https://archive.org/details/worms_team17>, titled
“Worms (EN-US) (MSDOS) (1995)”. Metadata names `CDWORMS.bin` (578,432,064 bytes,
SHA-1 `a7c9b3adee3a9fe8d8cdffb858d70f9d6a775cc6`) and `CDWORMS.cue` (401 bytes,
SHA-1 `ad14316f962fd862209c1b6780c220a1b3937223`). These are provider assertions;
the full media and executable have not been downloaded or verified. The complete
401-byte cue was subsequently downloaded and hash-verified: it describes track 1
as MODE1/2352 and tracks 2–9 as AUDIO. Preserve the mixed-mode layout and all
eight audio tracks; a data-only ISO would discard part of this candidate.

Bounded reads of the raw MODE1 track subsequently confirmed ISO volume `CDWORMS`
and the root executable layout. The complete `WORMS.EXE` launcher is 14,368 bytes,
SHA-256 `7dd42f1d5d719912855c567e95570423cd4c816500c754ff8628dd84f67d46ec`.
The complete `WRMS.EXE` is 426,117 bytes, SHA-256
`483f9f2376f76224602e67fc608f19ea13c218c0ef66643de30f2daf18d51ada`, with
an LE header at offset 10,832. `DOS4GW.EXE` is present in the root directory.
This candidate needs the DOS/protected-mode route, rather than the Windows PE
launcher. `DATA`, `FMV`, configuration and audio contents remain unverified.
Read receipts and full small-file identities are in
`scratch/runs/20261113-coordinator-owner187-worms-layout/`.

Next: verify original release identity, executable and complete data/audio tree,
then add a recoverable corpus entry and test an actual original-game turn.
The local Worms 2 demo does not satisfy this request. Armageddon's registered demo
currently lacks all seven declared local paths.

## The Neverhood

Candidate listing: <https://archive.org/details/neverhood_202508>, titled
“The Neverhood, (1996) Install CD”. Metadata names `Neverhood.iso`, 651,438,080
bytes, SHA-1 `4e4314440c98083cd4477f806525a0182f01f2c2`.
The whole-image hash remains an unverified provider assertion. Bounded HTTP range
reads subsequently inspected the ISO-9660 volume `Neverhood`: 272 directory
entries and executable prefixes consumed 77,824 bytes. Every response's exact
Content-Range and length were checked. Root `SETUP.EXE` has an NE header;
`SETUP/NHC.EXE` has an x86 PE header. This distinguishes the installer from the
native game.

The complete `SETUP/NHC.EXE` was also read into RAM: 810,496 bytes, SHA-256
`82bf1e31ad6c811a4915f49da1a5ea841cc23b37b0ee212c6d90fddbba97d011`.
Its import table names KERNEL32, USER32, GDI32, ADVAPI32, SMACKW32, DDRAW,
DSOUND, WINMM and MSVFW32. The image includes `SETUP/SMACKW32.DLL` (66,048 bytes).
All 121 named imports occur in the inspected current API table (SHA-256
`0522ee56adeed79597fac6a6a7ab28bcd52c4adf543f43ffef5ef0aa0b52bda1`).
This establishes name registration only, not behavioral compatibility. Eight
Smacker imports use ordinals and still require the actual matching DLL.
The seven `DATA/*.BLB` directory records total 638,122,574 bytes:
`A.BLB`, `C.BLB`, `HD.BLB`, `I.BLB`, `M.BLB`, `S.BLB`, `T.BLB`.
Those asset bytes have not been downloaded or hash-verified.

The complete bundled `README.TXT` was inspected and hashed as
`67d23ea0523aaf4fbc7de528f646a677b29d1c365fca3ba2311d9b7e71d26c0c`.
It requires installation rather than running from CD alone, and requires the CD
during play. Do not turn the discovered EXE path into an incomplete direct-launch
entry. Installation paths, registry/configuration and the original data access
contract still need verification. No executable has been run.

Additional evidence and reproducible bounded ISO directory reader:
`scratch/runs/20261113-coordinator-owner187-cd-layout/` (`neverhood-layout.json`,
`neverhood-complete-small-files.json`, `worms-cue.json`, `inspect-iso.py`).

Next: verify the full original install media and installed executable/asset closure, add
the corpus entry with a recovery recipe, then test original-game interaction.
An engine reimplementation would not establish native EXE compatibility.

## Capacity and completion

Heavy runtime and local media staging remain gated by the owner's requirement
to keep `/home` free space above 1.5 GB. No filesystem reserve change has been
approved or applied. Metadata and temporary RAM inspection do not establish local
corpus availability. All three requested original-game gameplay outcomes remain
open; no public deployment is involved.
