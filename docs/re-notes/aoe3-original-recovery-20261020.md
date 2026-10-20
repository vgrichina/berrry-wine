# AoE3 original closure recovery — 2026-10-20

Task `NEW-GAME-AOE3-DEMO-20261010` stops before download on a concrete storage blocker. No asset was recovered or freshly hash-verified, and no registry/manifest correction is justified. No runtime, build, browser, Boat, installer or worker action occurred. Acceptance remains authorized but `acceptedInGuest=false`.

At 12:03:46 UTC local free space was **1,960,284,160 bytes**, below the **2,147,483,648-byte** floor by **187,199,488 bytes**. Initial free space was 2,661,076,992 bytes; this task downloaded no media and wrote only small evidence/text files. No unrelated files were removed. Recalculate space before any subsequent recovery.

The historical note records a 383,598,224-byte installer, 375,136,768-byte MSI and 174-file, 569,072,090-byte payload. Payload alone therefore requires **756,271,578 additional free bytes** at the recorded checkpoint. Retaining installer, MSI and payload requires 1,327,807,082 bytes, or **1,515,006,570 additional free bytes**. These are lower bounds excluding filesystem overhead, CAB/extraction scratch and supporting DLLs. Exact peak extraction allocation is unknown, so these are not download authorization thresholds.

## Reconciled missing evidence and media

The following repository-relative paths were checked and absent:

- `test/binaries/win98-games-a-d/Age-of-empire-3trial-Win98-SW.exe`
- `scratch/runs/20261010T0404Z-aoe3-bootstrap`
- `scratch/runs/20261010T0410Z-new-games-bootstrap-diagnostics`
- `scratch/runs/20261010T0419Z-aoe3-msxml-startup`
- `scratch/runs/20261010T0430Z-aoe3-eula`

A filename inventory under `/home/user`, excluding Git metadata, caches, node_modules and Codex state, found no other AoE3-named package/tree or `age3.exe` outside this task's evidence and launcher records. This is a scoped filename inventory, not proof that no renamed archive exists anywhere. The shared candidate manifest had no AoE3 entry. The current reconciliation note was absent from the shared checkout but read from `origin/main` and copied into evidence.

## Documented original recovery identities

`docs/re-notes/age-of-empires3-demo.md` and the October 10 messageboard entries document the original package and extraction on historical host `bx_hx8msa33`:

- Installer SHA-256: `4ef69289dfa0817ec14942d85ef597835a9d2b09e1506c60b9938b20daa274ad`.
- Bootstrap output directory: `/home/user/aoe3-bootstrap-20261010`; captured member `Age of Empires III Trial.msi`. Its exact nested path and hash are not recorded in the inspected note.
- Extracted CAB payload: `/home/user/aoe3-payload-20261010`.
- MSI-mapped installed directory: `/home/user/aoe3-installed-20261010/Age of Empires III`.
- Installed `age3.exe` SHA-256: `5d7fb9a8ae28e3e3758cee1346b2960f20ba7b4feaa511fa7f52ceffeeeca256`.
- Required original launch files include `rockalldll.dll`, `granny2.dll`, `deformerdll.dll`, `binkw32.dll` and `data/StringTable.xml` (2,404,654 bytes), plus native `msxml4.dll` and `msxml4r.dll` from MSI `System:System`, and the documented msvcrt/Explorer98 shlwapi dependencies. Individual hashes and a complete path manifest were not recovered.

These are historical recorded identities, not fresh verification. The documented reconstruction used bootstrap extraction, Data1.cab and host `msiextract`, then XP/native-MSXML dependency configuration. Repeating the bootstrap would require separately allocated runtime, outside this task. Remote retention/availability is unknown and was not probed.

The existing CMR3 acquisition receipt names an Archive.org member in `Win98_Games-A-D.7z`; it is a different game's receipt and does not verify an AoE3 endpoint, rights, or package. The retained torrent is not an original package copy. No URL was synthesized or treated as an authoritative verified AoE3 source, and no alternate source was pursued.

## Evidence and stopping condition

Self-contained local evidence is `scratch/runs/20261020-aoe3-original-recovery/`: receipt, local name inventory, original game note, current task text, dashboard reconciliation, authorization and explicitly labeled other-game source receipt. The report is preserved on a task branch only; no main integration or shared HEAD/index change is intended.

The coordinator must first provide sufficient storage and an authorized retained-original recovery location. Verify recovered installer and age3.exe against the historical hashes, obtain a full closure hash manifest and recover the missing historical receipt before claiming closure. This report neither schedules that work nor claims guest acceptance, installation, gameplay or a verified remote acquisition recipe.
