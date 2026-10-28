# Need for Speed II original retail CD

This is the original 1997 release, not the demo or Special Edition. Its
`need-for-speed-2-full` candidate remains a **private source fixture**, with no
registered game app or accepted browser launch route. Registration would not
establish startup or gameplay.

The original CD was recovered on 2026-10-28 from the package pinned in source
revision `e2f39b5e48fe9d2e5c0dfd26fe65f6afc3f640f9`:

- URL: `https://archive.org/download/nfs-2_202308/NFS2.ISO`
- ISO: 549,926,912 bytes; SHA-1 `137085b8538613fed087bf9343773e58a7d5546b`;
  SHA-256 `96a2d4a3398aa85a5d4da3fc95a0506c6ae431d0415a55d0bd6c75987eb4f1e5`.
- `cd/NFSW.EXE`: 885,248 bytes; SHA-256
  `b791b4b9af11a71235fd612dbf9dd738b3d29b229d92036abf5fe64eb9a51528`.
- ISO9660 extraction: 1,123 files totaling 547,373,794 bytes, using
  `pycdlib 1.14.0`. All original bytes remain on the assigned private Boat.

The retained `cd/` tree uses the disc's Joliet names. Comparison by original
extent and length found five ISO9660/Joliet name differences: four document
case changes and `FEDATA/PC/SAVE/TEMP.` versus `FEDATA/PC/SAVE/TEMP`.
Those five names were corrected to Joliet without changing file bytes or
inode identity. Both namespace inventories, the original content hashes,
the five-path delta and all 71 original directories are retained.

## Installation boundary

The CD README documents the autorun INSTALL action, destination selection
(default `C:\Electronic Arts\Need for Speed II`), component selection
(minimum/standard/maximum/remote), file copying, and a DirectX 3.0 prerequisite.
It then describes starting the installed shortcut with the CD present.

The exact English bootstrap is `SETUP/ENGLISH/SETUP.EXE`, 44,928 bytes, SHA-256
`8b40dd7bb91ca280e90f9097697b0f93c4c1b732caeec9bb10e7d3a888a3d876`.
Its new-header offset is `0xe00` and signature is `NE`. Preserve its original
adjacent `_SETUP.LIB`, `_SETUP.DLL`, `_ISDEL.EXE`, `_INST32I.EX_`, `SETUP.PKG`,
`SETUP.INS`, `SETUP.INI`, bitmap, README and license. No installer was executed
in this task, and no installed directory or registry state was synthesized.

Static examination of the unchanged original `NFSW.EXE` identifies a relevant
guard at `0x4462dd`–`0x44634e`. The code forms an `INSTALL.WIN` path, extracts
its drive letter (`0x47fbbc`), and checks for a CD-ROM working drive
(`0x47fbe4`, `GetDriveTypeA(...) == 5`). On that branch, the English case selects
the install-first error at `0x44631b`; other language cases select a CD message.
This is evidence against registering a direct optical-drive launch. It does
**not** prove that every fixed-drive copy requires installation: that alternative
has not been accepted and must not be represented as an installed game.

The source `INSTALL.WIN` is an original 721-byte relative-path configuration.
Its presence alone does not establish an installed layout. Preserve it unchanged;
do not borrow the demo's preparation, rewrite its paths, invent registry values,
or patch the executable to skip the guard.

## Next gate and retained evidence

Qualify the original installer route and resulting file/configuration changes
with separately authorized execution, or establish an authentic fixed-drive
direct-launch contract. Only then add a local-only app and validate its complete
case-insensitive VFS mapping against the recovered originals. Startup, CD checks,
menus and gameplay remain untested.

The canonical recovery and acceptance receipt is
`scratch/usage-watch/nfs2-retail-recovery-registration-oct28/receipt.json` on the
Boat host. It binds immutable source/media pins, exact operations and controls,
production-registry/manifest checks, remote evidence and lifecycle handback.
The original ISO, extracted tree and full inventories are retained under
`/home/user/nfs2-recovery/` on `bx_6d46zgy6` for the coordinator's snapshot.
Do not deploy or commit the ISO or extracted assets. Expiry is
2026-10-28 12:21:54 UTC; the coordinator owns snapshot/shutdown at 12:15 UTC.

Acceptance imported the actual production `APPS` export and confirmed that no
app resolves to this retail fixture. The existing candidate-browser-manifest
and debug-game-app registration tests passed. Separately, an explicitly
diagnostic invocation of the unchanged production manifest writer covered all
1,123 original files (1,122 companion mappings plus the executable), checking
hashes, sizes and case-insensitive paths. Missing-executable and missing-
`INSTALL.WIN` fault injection each rejected before replacing the inventory;
the original files were untouched. This diagnostic inventory is not configured
in the candidate or app registry and is not an accepted launch route.
