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
the media and executable have not been downloaded or verified. Inspect the cue
and full media layout before choosing a route; preserve any audio tracks.

Next: verify original release identity, executable and complete data/audio tree,
then add a recoverable corpus entry and test an actual original-game turn.
The local Worms 2 demo does not satisfy this request. Armageddon's registered demo
currently lacks all seven declared local paths.

## The Neverhood

Candidate listing: <https://archive.org/details/neverhood_202508>, titled
“The Neverhood, (1996) Install CD”. Metadata names `Neverhood.iso`, 651,438,080
bytes, SHA-1 `4e4314440c98083cd4477f806525a0182f01f2c2`.
This is an unverified provider assertion. The image, installer, native game
executable and required asset layout have not been inspected or staged.

Next: verify the original install media and native executable/asset closure, add
the corpus entry with a recovery recipe, then test original-game interaction.
An engine reimplementation would not establish native EXE compatibility.

## Capacity and completion

Heavy runtime and local media staging remain gated by the owner's requirement
to keep `/home` free space above 1.5 GB. No filesystem reserve change has been
approved or applied. Metadata and temporary RAM inspection do not establish local
corpus availability. All three requested original-game gameplay outcomes remain
open; no public deployment is involved.
